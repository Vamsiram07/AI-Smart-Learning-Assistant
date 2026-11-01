
from flask import Flask, request, jsonify
from flask_cors import CORS
from pypdf import PdfReader
from pptx import Presentation
from werkzeug.utils import secure_filename
from PIL import Image

import os
import re
import joblib
import torch
import torch.nn as nn
from torchvision import transforms
from torchvision.models import mobilenet_v3_large, MobileNet_V3_Large_Weights

app = Flask(__name__)
CORS(app)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.abspath(os.path.join(BASE_DIR, ".."))

UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")
NLP_MODEL_PATH = os.path.join(ROOT_DIR, "models", "nlp", "sciq_qa_model.joblib")
CV_MODEL_PATH = os.path.join(ROOT_DIR, "models", "cv", "cifar10_cnn.pth")
IMAGENET_MODEL_PATH = os.path.join(ROOT_DIR, "models", "cv", "mobilenet_v3_large_imagenet.pth")

os.makedirs(UPLOAD_FOLDER, exist_ok=True)

app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config["MAX_CONTENT_LENGTH"] = 20 * 1024 * 1024

ALLOWED_EXTENSIONS = {"pdf", "pptx"}
ALLOWED_IMAGE_EXTENSIONS = {"jpg", "jpeg", "png"}
DEVICE = torch.device("cpu")

# NLP MODEL
try:
    qa_model = joblib.load(NLP_MODEL_PATH)
    print("LearnSphere NLP Model Loaded Successfully!")
except Exception as error:
    qa_model = None
    print("NLP Model Loading Error:", error)


# CIFAR-10 CNN ARCHITECTURE
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


# LOAD CIFAR-10 MODEL
CV_CLASSES = [
    "airplane", "automobile", "bird", "cat", "deer",
    "dog", "frog", "horse", "ship", "truck"
]

try:
    cv_model = CNN().to(DEVICE)
    cv_model.load_state_dict(
        torch.load(CV_MODEL_PATH, map_location=DEVICE, weights_only=True)
    )
    cv_model.eval()
    print("LearnSphere CIFAR-10 Model Loaded Successfully!")
except Exception as error:
    cv_model = None
    print("CIFAR-10 Model Loading Error:", error)


# LOAD IMAGENET MODEL - 1000 CATEGORIES
try:
    imagenet_weights = MobileNet_V3_Large_Weights.DEFAULT
    imagenet_model = mobilenet_v3_large(weights=None)
    imagenet_model.load_state_dict(
        torch.load(IMAGENET_MODEL_PATH, map_location=DEVICE, weights_only=True)
    )
    imagenet_model.to(DEVICE)
    imagenet_model.eval()

    IMAGENET_CLASSES = imagenet_weights.meta["categories"]
    print("LearnSphere ImageNet Model Loaded Successfully!")
    print("ImageNet Categories:", len(IMAGENET_CLASSES))

except Exception as error:
    imagenet_model = None
    IMAGENET_CLASSES = []
    print("ImageNet Model Loading Error:", error)


# IMAGE TRANSFORMS
image_transform = transforms.Compose([
    transforms.Resize((32, 32)),
    transforms.ToTensor(),
    transforms.Normalize(
        (0.4914, 0.4822, 0.4465),
        (0.2470, 0.2435, 0.2616)
    )
])

imagenet_transform = imagenet_weights.transforms() if "imagenet_weights" in globals() else None


# FILE VALIDATION
def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def allowed_image(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_IMAGE_EXTENSIONS


# PDF EXTRACTION
def extract_pdf_text(file_path):
    text = ""
    pdf = PdfReader(file_path)
    for page_number, page in enumerate(pdf.pages, start=1):
        text += f"\n\nPage {page_number}\n{page.extract_text() or ''}"
    return text


# PPT EXTRACTION
def extract_ppt_text(file_path):
    text = ""
    presentation = Presentation(file_path)
    for slide_number, slide in enumerate(presentation.slides, start=1):
        text += f"\n\nSlide {slide_number}\n"
        for shape in slide.shapes:
            if hasattr(shape, "text") and shape.text.strip():
                text += shape.text + "\n"
    return text


def extract_document_text(file_path):
    if file_path.lower().endswith(".pdf"):
        return extract_pdf_text(file_path)
    return extract_ppt_text(file_path)


# HOME
@app.route("/")
def home():
    return jsonify({
        "message": "LearnSphere Backend is Running!",
        "nlp_model_loaded": qa_model is not None,
        "cv_model_loaded": cv_model is not None,
        "imagenet_model_loaded": imagenet_model is not None,
        "imagenet_categories": len(IMAGENET_CLASSES),
        "features": [
            "PDF Upload", "PPT Upload", "Text Extraction",
            "NLP Question Answering", "Structured Notes",
            "CIFAR-10 Image Classification",
            "ImageNet 1000 Category Classification"
        ]
    })


# DOCUMENT UPLOAD
@app.route("/upload", methods=["POST"])
def upload_file():
    if "file" not in request.files:
        return jsonify({"error": "No file selected"}), 400

    file = request.files["file"]

    if not file.filename:
        return jsonify({"error": "Please select a file"}), 400

    if not allowed_file(file.filename):
        return jsonify({"error": "Only PDF and PPTX files are allowed"}), 400

    filename = secure_filename(file.filename)
    if not filename:
        return jsonify({"error": "Invalid filename"}), 400

    file_path = os.path.join(UPLOAD_FOLDER, filename)

    try:
        file.save(file_path)
        extracted_text = extract_document_text(file_path)

        if not extracted_text.strip():
            return jsonify({"error": "No readable text found"}), 400

        return jsonify({
            "message": "File uploaded and text extracted successfully!",
            "filename": filename,
            "extracted_text": extracted_text,
            "characters": len(extracted_text)
        })
    except Exception as error:
        return jsonify({"error": str(error)}), 500


# NLP QUESTION ANSWERING
@app.route("/predict", methods=["POST"])
def predict_answer():
    if qa_model is None:
        return jsonify({"error": "NLP model is not loaded"}), 500

    data = request.get_json(silent=True) or {}
    question = data.get("question", "").strip()
    context = data.get("context", "").strip()
    options = data.get("options", [])

    if not question or not context:
        return jsonify({"error": "Question and context are required"}), 400

    if not isinstance(options, list) or len(options) < 2:
        return jsonify({"error": "At least two answer options are required"}), 400

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

        results.sort(key=lambda item: item["score"], reverse=True)

        return jsonify({
            "question": question,
            "predicted_answer": results[0]["option"],
            "confidence_score": results[0]["score"],
            "all_predictions": results
        })
    except Exception as error:
        return jsonify({"error": str(error)}), 500


# STRUCTURED NOTES
@app.route("/generate-notes", methods=["POST"])
def generate_notes():
    data = request.get_json(silent=True) or {}
    filename = secure_filename(data.get("filename", "").strip())

    if not filename:
        return jsonify({"error": "Filename is required"}), 400

    if not allowed_file(filename):
        return jsonify({"error": "Only PDF and PPTX files are supported"}), 400

    file_path = os.path.join(UPLOAD_FOLDER, filename)

    if not os.path.isfile(file_path):
        return jsonify({"error": "Uploaded file not found"}), 404

    try:
        extracted_text = extract_document_text(file_path)

        if not extracted_text.strip():
            return jsonify({"error": "No readable content found"}), 400

        sections = re.split(r"\n(?=(?:Page|Slide)\s+\d+)", extracted_text)
        notes = []

        for section in sections:
            lines = [line.strip() for line in section.splitlines() if line.strip()]
            if len(lines) < 2:
                continue

            notes.append({
                "topic": lines[0],
                "detailed_content": "\n".join(lines[1:]),
                "important_points": [
                    line for line in lines[1:] if len(line.split()) >= 4
                ]
            })

        return jsonify({
            "message": "Structured notes generated successfully!",
            "filename": filename,
            "total_topics": len(notes),
            "notes": notes
        })
    except Exception as error:
        return jsonify({"error": str(error)}), 500


# CIFAR-10 IMAGE PREDICTION - 10 CATEGORIES
@app.route("/predict-image", methods=["POST"])
def predict_image():
    if cv_model is None:
        return jsonify({"error": "CIFAR-10 model is not loaded"}), 500

    if "file" not in request.files:
        return jsonify({"error": "No image selected"}), 400

    file = request.files["file"]

    if not file.filename or not allowed_image(file.filename):
        return jsonify({"error": "Select a JPG, JPEG or PNG image"}), 400

    try:
        image = Image.open(file.stream).convert("RGB")
        tensor = image_transform(image).unsqueeze(0).to(DEVICE)

        with torch.no_grad():
            probabilities = torch.softmax(cv_model(tensor), dim=1)[0]
            scores, indices = torch.sort(probabilities, descending=True)

        predictions = [
            {
                "class": CV_CLASSES[index.item()],
                "confidence": round(score.item() * 100, 2)
            }
            for score, index in zip(scores, indices)
        ]

        return jsonify({
            "message": "CIFAR-10 prediction completed!",
            "predicted_class": predictions[0]["class"],
            "confidence": predictions[0]["confidence"],
            "all_predictions": predictions
        })
    except Exception as error:
        return jsonify({"error": str(error)}), 500


# IMAGENET IMAGE PREDICTION - 1000 CATEGORIES
@app.route("/predict-imagenet", methods=["POST"])
def predict_imagenet():
    if imagenet_model is None or imagenet_transform is None:
        return jsonify({"error": "ImageNet model is not loaded"}), 500

    if "file" not in request.files:
        return jsonify({"error": "No image selected"}), 400

    file = request.files["file"]

    if not file.filename or not allowed_image(file.filename):
        return jsonify({"error": "Select a JPG, JPEG or PNG image"}), 400

    try:
        image = Image.open(file.stream).convert("RGB")
        tensor = imagenet_transform(image).unsqueeze(0).to(DEVICE)

        with torch.no_grad():
            probabilities = torch.softmax(imagenet_model(tensor), dim=1)[0]
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
        })
    except Exception as error:
        return jsonify({"error": str(error)}), 500


# ERROR HANDLING
@app.errorhandler(413)
def file_too_large(error):
    return jsonify({"error": "File size must be less than 20 MB"}), 413


if __name__ == "__main__":
    print("Starting LearnSphere Backend...")
    print("NLP Model Status:", qa_model is not None)
    print("CIFAR-10 Model Status:", cv_model is not None)
    print("ImageNet Model Status:", imagenet_model is not None)
    print("ImageNet Categories:", len(IMAGENET_CLASSES))

    app.run(host="127.0.0.1", port=5000, debug=True)
