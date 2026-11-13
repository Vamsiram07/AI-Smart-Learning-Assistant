# LearnSphere – AI Smart Learning Assistant

An AI-powered learning platform that helps students understand study materials, recognize images, and clarify doubts through an intelligent chatbot.

## 1. Project Overview

LearnSphere is a web-based AI Smart Learning Assistant developed to make learning easier, faster, and more interactive. It combines Artificial Intelligence, Natural Language Processing (NLP), Computer Vision (CV), and Generative AI to provide students with intelligent learning support.

The platform provides three major features: AI Notes Preparation, AI Image Recognition, and an AI Smart Chatbot.

## 2. Key Features

### 2.1 AI Notes Preparation
- Upload PDF and PPT study materials.
- Extract text from uploaded documents.
- Generate topic-wise notes using Gemini AI.
- Get detailed explanations, summaries, and important points.
- Simplify lengthy study materials.

### 2.2 AI Image Recognition
- Uploaded images for automatic object recognition.
- Use pretrained MobileNetV3 Large with ImageNet.
- Recognize objects across 1,000 ImageNet categories.
- Display the top five predictions with confidence scores.
- Includes a separate CNN model trained on CIFAR-10 for 10-category image classification.

### 2.3 AI Smart Chatbot
- Gemini API integration.
- Ask questions naturally without predefined options.
- Receive detailed explanations and answers.
- Ask follow-up questions with conversation history.
- Use uploaded study materials as context for answering questions.

## 3. Technology Stack

| Category | Technologies |
|---|---|
| Frontend | React.js, HTML, CSS, JavaScript |
| Frontend Tool | Vite |
| Backend | Python, Flask |
| AI Integration | Google Gemini API |
| NLP | TF-IDF, Logistic Regression |
| Deep Learning | PyTorch, CNN |
| Image Recognition | MobileNetV3 Large, ImageNet |
| Dataset | CIFAR-10 |
| Development Tools | VS Code, Git, GitHub |

## 4. System Architecture

The system follows a frontend-backend architecture.

1. Student interacts with the React.js frontend.
2. Frontend sends requests to the Flask backend through REST APIs.
3. Backend processes uploaded documents, images, and chatbot questions.
4. AI models and Gemini API perform the required tasks.
5. Results are returned to the frontend and displayed to the student.

**Architecture Flow:**

Student → React.js Frontend → Flask Backend → AI Models / Gemini API → Results → Student

## 5. Project Structure

```text
AI-Smart-Learning-Assistant/
│
├── backend/
│   ├── app.py
│   ├── requirements.txt
│   ├── models/
│   │   ├── cv/
│   │   └── nlp/
│   ├── datasets/
│   └── training/
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   └── App.css
│   ├── package.json
│   └── package-lock.json
│
├── .gitignore
└── README.md
```

## 6. Installation and Setup

### Prerequisites
- Python installed
- Node.js and npm installed
- Git installed
- Google Gemini API key

### Step 1: Clone the Repository

```bash
git clone https://github.com/Vamsiram07/AI-Smart-Learning-Assistant.git
```

```bash
cd AI-Smart-Learning-Assistant
```

### Step 2: Backend Setup

```bash
cd backend
```

Create a virtual environment:

```bash
python -m venv venv
```

Activate it on Windows:

```bash
venv\Scripts\activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

### Step 3: Configure Gemini API

Create a `.env` file in the project root directory:

```env
GEMINI_API_KEY=your_gemini_api_key
```

Replace the placeholder with your own API key. Never upload the `.env` file to GitHub.

### Step 4: Run Backend

From the backend directory:

```bash
python app.py
```

The Flask backend runs at:

`http://127.0.0.1:5000/`

### Step 5: Frontend Setup

Open another terminal from the project root:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Run the frontend:

```bash
npm run dev
```

Open the application at:

`http://localhost:5173/`

## 7. AI Models and Algorithms

### MobileNetV3 Large
A pretrained deep learning model used for image classification. It uses ImageNet categories to recognize objects in uploaded images.

### CNN – CIFAR-10
A Convolutional Neural Network trained on the CIFAR-10 dataset for classifying images into ten categories.

### TF-IDF and Logistic Regression
Used in the NLP model to process text and perform candidate-based answer prediction.

### Gemini AI
Used for generating study notes and providing natural-language chatbot responses.

## 8. Testing

The application can be tested using the following scenarios:

| Test Case | Expected Result |
|---|---|
| Upload PDF | Text extracted successfully |
| Upload PPT | Slide text extracted successfully |
| Generate AI Notes | Topic-wise notes displayed |
| Upload an image | Image processed successfully |
| ImageNet prediction | Top five predictions displayed |
| CIFAR-10 prediction | One of ten classes predicted |
| Ask chatbot question | AI-generated answer displayed |
| Ask follow-up question | Context-aware response generated |

*Record actual test results based on the tests performed on your system.*

## 9. Advantages

- Makes learning more interactive.
- Reduces time spent preparing notes.
- Simplifies complex study materials.
- Provides intelligent image recognition.
- Supports natural-language doubt clarification.
- Combines multiple AI technologies in one platform.

## 10. Future Scope

- Support additional document formats.
- Add multilingual learning assistance.
- Improve model accuracy with larger datasets.
- Introduce personalized learning recommendations.
- Add student progress tracking.
- Support more advanced AI learning tools.

## 11. Conclusion

LearnSphere – AI Smart Learning Assistant demonstrates how Artificial Intelligence, Natural Language Processing, Computer Vision, and Generative AI can be integrated into a single educational platform.

By providing AI-generated notes, image recognition, and an intelligent chatbot, the system aims to make learning more accessible, interactive, and efficient for students.

## 12. Repository

GitHub: https://github.com/Vamsiram07/AI-Smart-Learning-Assistant

---

**Project:** LearnSphere – AI Smart Learning Assistant  
**Domain:** Artificial Intelligence and Machine Learning  
**Frontend:** React.js  
**Backend:** Python Flask
