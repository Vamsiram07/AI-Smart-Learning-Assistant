
import os
import re
import json
import joblib
import torch
import torch.nn as nn

from flask import Flask, request, jsonify
from flask_cors import CORS
from pypdf import PdfReader
from pptx import Presentation
from werkzeug.utils import secure_filename
from PIL import Image
from dotenv import load_dotenv

from google import genai
from google.genai import types

from torchvision import transforms
from torchvision.models import (
    mobilenet_v3_large,
    MobileNet_V3_Large_Weights
)


# --------------------------------------------------
# FLASK APPLICATION AND CONFIGURATION
# --------------------------------------------------

app = Flask(__name__)
CORS(app)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.abspath(os.path.join(BASE_DIR, ".."))

load_dotenv(os.path.join(ROOT_DIR, ".env"))

UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")

NLP_MODEL_PATH = os.path.join(
    ROOT_DIR, "models", "nlp", "sciq_qa_model.joblib"
)

CV_MODEL_PATH = os.path.join(
    ROOT_DIR, "models", "cv", "cifar10_cnn.pth"
)

IMAGENET_MODEL_PATH = os.path.join(
    ROOT_DIR, "models", "cv", "mobilenet_v3_large_imagenet.pth"
)

os.makedirs(UPLOAD_FOLDER, exist_ok=True)

app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config["MAX_CONTENT_LENGTH"] = 20 * 1024 * 1024

ALLOWED_EXTENSIONS = {"pdf", "pptx"}
ALLOWED_IMAGE_EXTENSIONS = {"jpg", "jpeg", "png"}

DEVICE = torch.device("cpu")

GEMINI_MODEL = "gemini-3.5-flash-lite"


# --------------------------------------------------
# GEMINI AI CONNECTION
# --------------------------------------------------

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

gemini_client = None

if GEMINI_API_KEY:
    try:
        gemini_client = genai.Client(api_key=GEMINI_API_KEY)
        print("LearnSphere Gemini Connected Successfully!")
    except Exception as error:
        print("Gemini Connection Error:", error)
else:
    print("WARNING: GEMINI_API_KEY not found in .env file")


# --------------------------------------------------
# LOAD NLP MODEL
# --------------------------------------------------

try:
    qa_model = joblib.load(NLP_MODEL_PATH)
    print("LearnSphere NLP Model Loaded Successfully!")

except Exception as error:
    qa_model = None
    print("NLP Model Loading Error:", error)


# --------------------------------------------------
# CIFAR-10 CNN ARCHITECTURE
# --------------------------------------------------

class CNN(nn.Module):

    def __init__(self):
        super(CNN, self).__init__()

        self.features = nn.Sequential(
            nn.Conv2d(3, 32, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.MaxPool2d(2),

            nn.Conv2d(32, 64, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.MaxPool2d(2),

            nn.Conv2d(64, 128, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.MaxPool2d(2)
        )

        self.classifier = nn.Sequential(
            nn.Flatten(),
            nn.Linear(128 * 4 * 4, 256),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(256, 10)
        )

    def forward(self, x):
        return self.classifier(self.features(x))


# --------------------------------------------------
# LOAD CIFAR-10 MODEL
# --------------------------------------------------

CV_CLASSES = [
    "airplane", "automobile", "bird", "cat", "deer",
    "dog", "frog", "horse", "ship", "truck"
]

try:
    cv_model = CNN().to(DEVICE)

    cv_model.load_state_dict(
        torch.load(
            CV_MODEL_PATH,
            map_location=DEVICE,
            weights_only=True
        )
    )

    cv_model.eval()

    print("LearnSphere CIFAR-10 Model Loaded Successfully!")

except Exception as error:
    cv_model = None
    print("CIFAR-10 Model Loading Error:", error)


# --------------------------------------------------
# LOAD IMAGENET MODEL
# --------------------------------------------------

imagenet_model = None
IMAGENET_CLASSES = []
imagenet_transform = None

try:
    imagenet_weights = MobileNet_V3_Large_Weights.DEFAULT

    imagenet_model = mobilenet_v3_large(weights=None)

    imagenet_model.load_state_dict(
        torch.load(
            IMAGENET_MODEL_PATH,
            map_location=DEVICE,
            weights_only=True
        )
    )

    imagenet_model.to(DEVICE)
    imagenet_model.eval()

    IMAGENET_CLASSES = imagenet_weights.meta["categories"]
    imagenet_transform = imagenet_weights.transforms()

    print("LearnSphere ImageNet Model Loaded Successfully!")
    print("ImageNet Categories:", len(IMAGENET_CLASSES))

except Exception as error:
    imagenet_model = None
    IMAGENET_CLASSES = []
    print("ImageNet Model Loading Error:", error)


# --------------------------------------------------
# IMAGE TRANSFORMS
# --------------------------------------------------

image_transform = transforms.Compose([
    transforms.Resize((32, 32)),
    transforms.ToTensor(),
    transforms.Normalize(
        (0.4914, 0.4822, 0.4465),
        (0.2470, 0.2435, 0.2616)
    )
])


# --------------------------------------------------
# FILE VALIDATION
# --------------------------------------------------

def allowed_file(filename):
    return (
        "." in filename
        and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS
    )


def allowed_image(filename):
    return (
        "." in filename
        and filename.rsplit(".", 1)[1].lower() in ALLOWED_IMAGE_EXTENSIONS
    )


# --------------------------------------------------
# DOCUMENT TEXT EXTRACTION
# --------------------------------------------------

def extract_pdf_text(file_path):

    text = ""
    pdf = PdfReader(file_path)

    for page_number, page in enumerate(pdf.pages, start=1):
        text += f"\n\nPage {page_number}\n"
        text += page.extract_text() or ""

    return text


def extract_ppt_text(file_path):

    text = ""
    presentation = Presentation(file_path)

    for slide_number, slide in enumerate(
        presentation.slides, start=1
    ):
        text += f"\n\nSlide {slide_number}\n"

        for shape in slide.shapes:
            if hasattr(shape, "text") and shape.text.strip():
                text += shape.text + "\n"

    return text


def extract_document_text(file_path):

    if file_path.lower().endswith(".pdf"):
        return extract_pdf_text(file_path)

    return extract_ppt_text(file_path)


# --------------------------------------------------
# GEMINI ERROR RESPONSE
# --------------------------------------------------

def gemini_error_response(error):

    error_text = str(error)
    print("Gemini API Error:", error_text)

    if "503" in error_text or "UNAVAILABLE" in error_text:
        message = "Gemini is temporarily busy. Please try again shortly."
        status = 503

    elif "429" in error_text or "RESOURCE_EXHAUSTED" in error_text:
        message = "Gemini API request limit reached. Please try again later."
        status = 429

    elif "401" in error_text or "403" in error_text:
        message = "Gemini API authentication failed. Check your API key."
        status = 500

    else:
        message = "Unable to process your request. Please try again."
        status = 500

    return jsonify({"error": message}), status


# --------------------------------------------------
# HOME API
# --------------------------------------------------

@app.route("/")
def home():

    return jsonify({
        "message": "LearnSphere Backend is Running!",

        "nlp_model_loaded": qa_model is not None,
        "cv_model_loaded": cv_model is not None,
        "imagenet_model_loaded": imagenet_model is not None,

        "imagenet_categories": len(IMAGENET_CLASSES),

        "gemini_chatbot_loaded": gemini_client is not None,

        "features": [
            "PDF Upload",
            "PPT Upload",
            "Text Extraction",
            "NLP Question Answering",
            "AI Notes Generation",
            "CIFAR-10 Image Classification",
            "ImageNet 1000 Category Classification",
            "Gemini AI Chatbot"
        ]
    })


# --------------------------------------------------
# DOCUMENT UPLOAD
# --------------------------------------------------

@app.route("/upload", methods=["POST"])
def upload_file():

    if "file" not in request.files:
        return jsonify({"error": "No file selected"}), 400

    file = request.files["file"]

    if not file.filename:
        return jsonify({"error": "Please select a file"}), 400

    if not allowed_file(file.filename):
        return jsonify({
            "error": "Only PDF and PPTX files are allowed"
        }), 400

    filename = secure_filename(file.filename)

    if not filename:
        return jsonify({"error": "Invalid filename"}), 400

    file_path = os.path.join(UPLOAD_FOLDER, filename)

    try:
        file.save(file_path)

        extracted_text = extract_document_text(file_path)

        if not extracted_text.strip():
            return jsonify({
                "error": "No readable text found"
            }), 400

        return jsonify({
            "message": "File uploaded and text extracted successfully!",
            "filename": filename,
            "extracted_text": extracted_text,
            "characters": len(extracted_text)
        })

    except Exception as error:
        print("Upload Error:", error)
        return jsonify({"error": "Unable to upload or read this file."}), 500


# --------------------------------------------------
# GEMINI AI CHATBOT API
# --------------------------------------------------

@app.route("/chat", methods=["POST"])
def chat():

    if gemini_client is None:
        return jsonify({
            "error": "Gemini API is not configured. Check your .env file."
        }), 500

    data = request.get_json(silent=True) or {}

    question = data.get("message", "")
    context = data.get("context", "")
    history = data.get("history", [])

    if not isinstance(question, str) or not question.strip():
        return jsonify({"error": "Please enter your question."}), 400

    question = question.strip()

    if len(question) > 5000:
        return jsonify({"error": "Question is too long."}), 400

    if not isinstance(context, str):
        context = ""

    if not isinstance(history, list):
        history = []

    history = history[-10:]
    context = context[:12000]

    system_instruction = """
    You are LearnSphere AI, a friendly educational assistant.

    Explain concepts in simple language with detailed points and examples.
    Answer follow-up questions using conversation history.
    Use headings and bullet points where useful.
    Be patient and supportive.

    When uploaded study material is provided, prioritize it.
    Clearly distinguish information from uploaded material
    and general knowledge. Never invent document content.
    """

    contents = []

    for item in history:

        if not isinstance(item, dict):
            continue

        role = item.get("role")
        message = item.get("content", "")

        if role not in ("user", "model"):
            continue

        if not isinstance(message, str) or not message.strip():
            continue

        contents.append(
            types.Content(
                role=role,
                parts=[types.Part(text=message[:4000])]
            )
        )

    if context:
        prompt = f"""
        UPLOADED STUDY MATERIAL:
        {context}

        STUDENT QUESTION:
        {question}

        Answer using the uploaded material where relevant.
        """
    else:
        prompt = question

    contents.append(
        types.Content(
            role="user",
            parts=[types.Part(text=prompt)]
        )
    )

    try:
        response = gemini_client.models.generate_content(
            model=GEMINI_MODEL,
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.7,
                max_output_tokens=2048
            )
        )

        answer = response.text

        if not answer or not answer.strip():
            return jsonify({
                "error": "Gemini returned an empty response. Please try again."
            }), 503

        return jsonify({
            "answer": answer,
            "model": GEMINI_MODEL
        }), 200

    except Exception as error:
        return gemini_error_response(error)


# --------------------------------------------------
# NLP QUESTION ANSWERING API
# --------------------------------------------------

@app.route("/predict", methods=["POST"])
def predict_answer():

    if qa_model is None:
        return jsonify({
            "error": "NLP model is not loaded"
        }), 500

    data = request.get_json(silent=True) or {}

    question = data.get("question", "")
    context = data.get("context", "")
    options = data.get("options", [])

    if not isinstance(question, str) or not isinstance(context, str):
        return jsonify({"error": "Invalid question or context"}), 400

    question = question.strip()
    context = context.strip()

    if not question or not context:
        return jsonify({
            "error": "Question and context are required"
        }), 400

    if not isinstance(options, list) or len(options) < 2:
        return jsonify({
            "error": "At least two answer options are required"
        }), 400

    try:
        results = []

        for option in options:

            if not isinstance(option, str) or not option.strip():
                continue

            candidate = (
                f"Question: {question} "
                f"Context: {context} "
                f"Answer: {option}"
            )

            score = qa_model.predict_proba([candidate])[0][1]

            results.append({
                "option": option,
                "score": round(float(score), 4)
            })

        if not results:
            return jsonify({"error": "No valid options"}), 400

        results.sort(
            key=lambda item: item["score"],
            reverse=True
        )

        return jsonify({
            "question": question,
            "predicted_answer": results[0]["option"],
            "confidence_score": results[0]["score"],
            "all_predictions": results
        })

    except Exception as error:
        print("NLP Prediction Error:", error)
        return jsonify({"error": "NLP prediction failed."}), 500


# --------------------------------------------------
# AI NOTES GENERATION
# --------------------------------------------------

@app.route("/generate-notes", methods=["POST"])
def generate_notes():

    if gemini_client is None:
        return jsonify({
            "error": "Gemini API is not configured."
        }), 500

    data = request.get_json(silent=True) or {}

    filename = data.get("filename", "")

    if not isinstance(filename, str):
        return jsonify({"error": "Invalid filename"}), 400

    filename = secure_filename(filename.strip())

    if not filename:
        return jsonify({"error": "Filename is required"}), 400

    if not allowed_file(filename):
        return jsonify({
            "error": "Only PDF and PPTX files are supported"
        }), 400

    file_path = os.path.join(UPLOAD_FOLDER, filename)

    if not os.path.isfile(file_path):
        return jsonify({
            "error": "Uploaded file not found"
        }), 404

    try:
        extracted_text = extract_document_text(file_path)

        if not extracted_text.strip():
            return jsonify({
                "error": "No readable content found"
            }), 400

        extracted_text = extracted_text[:18000]

        prompt = f"""
        You are an expert educational notes generator.

        Read the following study material carefully.

        Generate detailed, student-friendly notes.

        Requirements:
        1. Divide the content into meaningful topics.
        2. Explain every topic in simple language.
        3. Include important definitions.
        4. Include important points as bullet points.
        5. Include examples wherever useful.
        6. Do not invent facts outside the study material.
        7. Make notes useful for college examination preparation.

        Return ONLY valid JSON in this exact structure:

        {{
          "notes": [
            {{
              "topic": "Topic name",
              "detailed_content": "Detailed explanation",
              "important_points": [
                "Important point 1",
                "Important point 2"
              ]
            }}
          ]
        }}

        STUDY MATERIAL:

        {extracted_text}
        """

        response = gemini_client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.4,
                max_output_tokens=4096,
                response_mime_type="application/json"
            )
        )

        answer = response.text

        if not answer or not answer.strip():
            return jsonify({
                "error": "Gemini returned an empty response."
            }), 503

        answer = answer.strip()

        if answer.startswith("```"):
            answer = re.sub(
                r"^```(?:json)?\s*|\s*```$",
                "",
                answer,
                flags=re.IGNORECASE
            ).strip()

        result = json.loads(answer)

        notes = result.get("notes", [])

        if not isinstance(notes, list) or not notes:
            return jsonify({
                "error": "No notes were generated."
            }), 500

        cleaned_notes = []

        for note in notes:

            if not isinstance(note, dict):
                continue

            topic = note.get("topic", "Untitled Topic")
            detailed_content = note.get("detailed_content", "")
            important_points = note.get("important_points", [])

            if not isinstance(important_points, list):
                important_points = []

            cleaned_notes.append({
                "topic": str(topic),
                "detailed_content": str(detailed_content),
                "important_points": [
                    str(point) for point in important_points
                ]
            })

        if not cleaned_notes:
            return jsonify({
                "error": "No valid notes were generated."
            }), 500

        return jsonify({
            "message": "AI notes generated successfully!",
            "filename": filename,
            "total_topics": len(cleaned_notes),
            "notes": cleaned_notes
        }), 200

    except json.JSONDecodeError:
        print("AI Notes Error: Invalid JSON returned by Gemini.")
        return jsonify({
            "error": "AI generated an invalid notes format. Please try again."
        }), 500

    except Exception as error:
        return gemini_error_response(error)


# --------------------------------------------------
# CIFAR-10 IMAGE PREDICTION
# --------------------------------------------------

@app.route("/predict-image", methods=["POST"])
def predict_image():

    if cv_model is None:
        return jsonify({
            "error": "CIFAR-10 model is not loaded"
        }), 500

    if "file" not in request.files:
        return jsonify({"error": "No image selected"}), 400

    file = request.files["file"]

    if not file.filename or not allowed_image(file.filename):
        return jsonify({
            "error": "Select a JPG, JPEG or PNG image"
        }), 400

    try:
        image = Image.open(file.stream).convert("RGB")

        tensor = image_transform(image).unsqueeze(0).to(DEVICE)

        with torch.no_grad():
            probabilities = torch.softmax(
                cv_model(tensor), dim=1
            )[0]

            scores, indices = torch.topk(probabilities, 5)

        predictions = [
            {
                "class": CV_CLASSES[index.item()],
                "confidence": round(score.item() * 100, 2)
            }
            for score, index in zip(scores, indices)
        ]

        return jsonify({
            "message": "CIFAR-10 prediction completed!",
            "model": "CIFAR-10 CNN",
            "total_categories": len(CV_CLASSES),
            "predicted_class": predictions[0]["class"],
            "confidence": predictions[0]["confidence"],
            "all_predictions": predictions
        }), 200

    except Exception as error:
        print("CIFAR-10 Prediction Error:", error)
        return jsonify({"error": "Image prediction failed."}), 500


# --------------------------------------------------
# IMAGENET IMAGE PREDICTION
# --------------------------------------------------

@app.route("/predict-imagenet", methods=["POST"])
def predict_imagenet():

    if imagenet_model is None or imagenet_transform is None:
        return jsonify({
            "error": "ImageNet model is not loaded"
        }), 500

    if "file" not in request.files:
        return jsonify({"error": "No image selected"}), 400

    file = request.files["file"]

    if not file.filename or not allowed_image(file.filename):
        return jsonify({
            "error": "Select a JPG, JPEG or PNG image"
        }), 400

    try:
        image = Image.open(file.stream).convert("RGB")

        tensor = imagenet_transform(image).unsqueeze(0).to(DEVICE)

        with torch.no_grad():
            probabilities = torch.softmax(
                imagenet_model(tensor), dim=1
            )[0]

            scores, indices = torch.topk(probabilities, 5)

        predictions = [
            {
                "class": IMAGENET_CLASSES[index.item()],
                "confidence": round(score.item() * 100, 2)
            }
            for score, index in zip(scores, indices)
        ]

        return jsonify({
            "message": "ImageNet prediction completed!",
            "model": "MobileNetV3 Large - ImageNet",
            "total_categories": len(IMAGENET_CLASSES),
            "predicted_class": predictions[0]["class"],
            "confidence": predictions[0]["confidence"],
            "all_predictions": predictions
        }), 200

    except Exception as error:
        print("ImageNet Prediction Error:", error)
        return jsonify({"error": "ImageNet prediction failed."}), 500


# --------------------------------------------------
# ERROR HANDLING
# --------------------------------------------------

@app.errorhandler(413)
def file_too_large(error):

    return jsonify({
        "error": "File size must be less than 20 MB"
    }), 413


# --------------------------------------------------
# RUN APPLICATION
# --------------------------------------------------

if __name__ == "__main__":

    print("\nStarting LearnSphere Backend...")

    print("NLP Model Status:", qa_model is not None)
    print("CIFAR-10 Model Status:", cv_model is not None)
    print("ImageNet Model Status:", imagenet_model is not None)
    print("ImageNet Categories:", len(IMAGENET_CLASSES))
    print("Gemini Model:", GEMINI_MODEL)
    print("Gemini Status:", gemini_client is not None)

    app.run(
        host="127.0.0.1",
        port=5000,
        debug=True
    )
