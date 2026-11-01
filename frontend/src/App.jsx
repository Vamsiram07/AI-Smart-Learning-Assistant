
import { useState } from "react";
import "./App.css";

const API_URL = "http://127.0.0.1:5000";

const features = [
  { icon: "📚", title: "AI-powered notes", desc: "Turn your study materials into clear, structured notes." },
  { icon: "🧠", title: "Smart doubt solver", desc: "Ask questions based on your uploaded study material." },
  { icon: "🎯", title: "Personalized quizzes", desc: "Practice questions based on what you are learning." },
  { icon: "📈", title: "Learning insights", desc: "Discover weak topics and improve your study plan." },
];

function App() {
  const [isLogin, setIsLogin] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [activePage, setActivePage] = useState("Overview");

  // Document states
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedMaterials, setUploadedMaterials] = useState([]);
  const [extractedText, setExtractedText] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Image prediction states
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [predicting, setPredicting] = useState(false);
  const [prediction, setPrediction] = useState(null);
  const [imageError, setImageError] = useState("");
  const [selectedModel, setSelectedModel] = useState("imagenet");

  // NLP doubt solver states
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [answerResult, setAnswerResult] = useState(null);
  const [solving, setSolving] = useState(false);
  const [nlpError, setNlpError] = useState("");

  function handleAuth(e) {
    e.preventDefault();
    const studentName = name.trim() || email.split("@")[0] || "Student";
    setName(studentName);
    setLoggedIn(true);
  }

  // DOCUMENT UPLOAD
  async function handleUpload(e) {
    e.preventDefault();

    if (!selectedFile) {
      setError("Please select a PDF or PPTX file.");
      return;
    }

    setUploading(true);
    setError("");
    setMessage("");
    setExtractedText("");

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const response = await fetch(`${API_URL}/upload`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Upload failed.");
      }

      setMessage(data.message || "File uploaded successfully!");
      setExtractedText(data.extracted_text || "");

      setUploadedMaterials((previous) => [
        ...previous,
        {
          filename: data.filename || selectedFile.name,
          type: selectedFile.name.toLowerCase().endsWith(".pdf")
            ? "PDF"
            : "PPTX",
        },
      ]);

      setSelectedFile(null);
      e.target.reset();

    } catch (err) {
      setError(
        err.message === "Failed to fetch"
          ? "Cannot connect to backend. Please start Flask server."
          : err.message
      );
    } finally {
      setUploading(false);
    }
  }

  // SELECT IMAGE
  function handleImageSelect(e) {
    const file = e.target.files[0];

    setSelectedImage(null);
    setImagePreview("");
    setPrediction(null);
    setImageError("");

    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png"];

    if (!allowedTypes.includes(file.type)) {
      setImageError("Please select a JPG, JPEG or PNG image.");
      e.target.value = "";
      return;
    }

    setSelectedImage(file);
    setImagePreview(URL.createObjectURL(file));
  }

  // IMAGE PREDICTION
  async function handleImagePrediction(e) {
    e.preventDefault();

    if (!selectedImage) {
      setImageError("Please select an image first.");
      return;
    }

    setPredicting(true);
    setImageError("");
    setPrediction(null);

    const formData = new FormData();
    formData.append("file", selectedImage);

    try {
      const endpoint =
        selectedModel === "imagenet"
          ? "/predict-imagenet"
          : "/predict-image";

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Image prediction failed.");
      }

      setPrediction(data);

    } catch (err) {
      setImageError(
        err.message === "Failed to fetch"
          ? "Cannot connect to Flask backend."
          : err.message
      );
    } finally {
      setPredicting(false);
    }
  }

  // NLP DOUBT SOLVER
  async function handleSolveDoubt(e) {
    e.preventDefault();

    setNlpError("");
    setAnswerResult(null);

    if (!extractedText.trim()) {
      setNlpError("First upload a PDF or PPTX in My Materials.");
      return;
    }

    if (!question.trim()) {
      setNlpError("Please enter your question.");
      return;
    }

    const validOptions = options.filter((item) => item.trim());

    if (validOptions.length < 2) {
      setNlpError("Please enter at least two answer options.");
      return;
    }

    setSolving(true);

    try {
      const response = await fetch(`${API_URL}/predict`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: question.trim(),
          context: extractedText,
          options: validOptions,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not solve the question.");
      }

      setAnswerResult(data);

    } catch (err) {
      setNlpError(
        err.message === "Failed to fetch"
          ? "Cannot connect to Flask backend. Please start the server."
          : err.message
      );
    } finally {
      setSolving(false);
    }
  }

  // DASHBOARD
  if (loggedIn) {
    return (
      <div className="dashboard-layout">

        <aside className="sidebar">
          <div className="side-brand">
            <span>✦</span> LearnSphere
          </div>

          <p className="nav-label">YOUR WORKSPACE</p>

          <button
            className={`nav-item ${activePage === "Overview" ? "selected" : ""}`}
            onClick={() => setActivePage("Overview")}
          >
            ⌂ &nbsp; Overview
          </button>

          <button
            className={`nav-item ${activePage === "My Materials" ? "selected" : ""}`}
            onClick={() => setActivePage("My Materials")}
          >
            ▣ &nbsp; My Materials
          </button>

          <button
            className={`nav-item ${activePage === "AI Learning Tools" ? "selected" : ""}`}
            onClick={() => setActivePage("AI Learning Tools")}
          >
            ✧ &nbsp; AI Learning Tools
          </button>

          <button
            className={`nav-item ${activePage === "My Progress" ? "selected" : ""}`}
            onClick={() => setActivePage("My Progress")}
          >
            ▥ &nbsp; My Progress
          </button>

          <div className="sidebar-bottom">
            <div className="avatar">
              {name.charAt(0).toUpperCase()}
            </div>

            <div className="profile-info">
              <strong>{name}</strong>
              <small>Student account</small>
            </div>

            <button
              className="logout"
              onClick={() => setLoggedIn(false)}
              title="Log out"
            >
              ↪
            </button>
          </div>
        </aside>

        <main className="dashboard-main">

          <header className="topbar">
            <span>My workspace / {activePage}</span>
            <div className="top-avatar">
              {name.charAt(0).toUpperCase()}
            </div>
          </header>

          {/* OVERVIEW */}

          {activePage === "Overview" && (
            <>
              <section className="welcome-section">
                <div>
                  <span className="welcome-badge">
                    ✦ YOUR AI LEARNING SPACE
                  </span>

                  <h1>Welcome back, {name}!</h1>
                  <p>Your next breakthrough starts with one small step.</p>
                </div>

                <div className="welcome-art">✧</div>
              </section>

              <section className="stats-grid">
                <div className="stat-card">
                  <span>📚</span>
                  <p>Materials uploaded</p>
                  <h2>{uploadedMaterials.length}</h2>
                  <small>Your study library starts here</small>
                </div>

                <div className="stat-card">
                  <span>📝</span>
                  <p>Notes generated</p>
                  <h2>0</h2>
                  <small>Your AI notes will appear here</small>
                </div>

                <div className="stat-card">
                  <span>🎯</span>
                  <p>Questions answered</p>
                  <h2>{answerResult ? 1 : 0}</h2>
                  <small>Test your understanding</small>
                </div>

                <div className="stat-card">
                  <span>⚡</span>
                  <p>Learning streak</p>
                  <h2>0 days</h2>
                  <small>Start your first study session</small>
                </div>
              </section>

              <section className="section-heading">
                <span className="section-eyebrow">
                  YOUR PERSONAL TOOLKIT
                </span>
                <h2>Learn smarter with AI</h2>
                <p>
                  Everything you need to turn study time into progress.
                </p>
              </section>

              <section className="feature-grid">
                {features.map((feature, index) => (
                  <button
                    className="feature-card"
                    key={feature.title}
                    onClick={() => {
                      setActivePage(
                        index === 0 ? "My Materials" : "AI Learning Tools"
                      );
                    }}
                  >
                    <div className={`feature-icon feature-${index}`}>
                      {feature.icon}
                    </div>

                    <h3>{feature.title}</h3>
                    <p>{feature.desc}</p>

                    <span className="feature-link">
                      Explore feature <span>↗</span>
                    </span>
                  </button>
                ))}
              </section>

              <section className="bottom-panel">
                <div className="panel-icon">✦</div>

                <div className="panel-copy">
                  <h3>Ready to begin your learning journey?</h3>
                  <p>
                    Your first study material is the beginning of a
                    smarter way to learn.
                  </p>
                </div>

                <button onClick={() => setActivePage("My Materials")}>
                  Get started →
                </button>
              </section>
            </>
          )}

          {/* MY MATERIALS */}

          {activePage === "My Materials" && (
            <section style={styles.page}>

              <div style={styles.heading}>
                <span style={styles.eyebrow}>YOUR STUDY LIBRARY</span>
                <h1 style={styles.title}>My Materials 📚</h1>
                <p style={styles.subtitle}>
                  Upload your study materials and let LearnSphere analyse them.
                </p>
              </div>

              <div style={styles.uploadCard}>
                <div style={styles.uploadIcon}>📄</div>
                <h2>Upload Study Material</h2>
                <p>Choose your PDF or PowerPoint presentation.</p>

                <form onSubmit={handleUpload}>
                  <label style={styles.fileLabel}>
                    <input
                      type="file"
                      accept=".pdf,.pptx"
                      onChange={(e) => {
                        setSelectedFile(e.target.files[0] || null);
                        setError("");
                        setMessage("");
                        setExtractedText("");
                      }}
                      style={{ display: "none" }}
                    />

                    <span style={styles.chooseButton}>Choose File</span>

                    <span style={styles.fileName}>
                      {selectedFile
                        ? selectedFile.name
                        : "No file selected"}
                    </span>
                  </label>

                  <p style={styles.hint}>Supported formats: PDF, PPTX</p>

                  <button
                    type="submit"
                    disabled={uploading || !selectedFile}
                    style={{
                      ...styles.uploadButton,
                      opacity: uploading || !selectedFile ? 0.6 : 1,
                    }}
                  >
                    {uploading ? "Uploading..." : "Upload Material ↑"}
                  </button>
                </form>

                {message && <p style={styles.success}>{message}</p>}
                {error && <p style={styles.error}>{error}</p>}
              </div>

              <div style={styles.materialCard}>
                <h2>Uploaded Materials</h2>

                {uploadedMaterials.length === 0 ? (
                  <p style={styles.empty}>
                    No materials uploaded yet. Upload your first study material!
                  </p>
                ) : (
                  uploadedMaterials.map((material, index) => (
                    <div
                      key={`${material.filename}-${index}`}
                      style={styles.materialRow}
                    >
                      <span style={{ fontSize: "25px" }}>
                        {material.type === "PDF" ? "📕" : "📊"}
                      </span>

                      <div style={{ flex: 1 }}>
                        <strong>{material.filename}</strong>
                        <p style={styles.fileType}>
                          {material.type} · Uploaded successfully
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {extractedText && (
                <div style={styles.textCard}>
                  <h2>Extracted Study Content</h2>
                  <p style={styles.subtitle}>
                    Text successfully extracted from your uploaded material.
                  </p>

                  <pre style={styles.extractedText}>
                    {extractedText}
                  </pre>

                  <button
                    style={styles.uploadButton}
                    onClick={() => setActivePage("AI Learning Tools")}
                  >
                    Ask Questions About This Material →
                  </button>
                </div>
              )}

            </section>
          )}

          {/* AI LEARNING TOOLS */}

          {activePage === "AI Learning Tools" && (
            <section style={styles.page}>

              <div style={styles.heading}>
                <span style={styles.eyebrow}>INTELLIGENT LEARNING</span>
                <h1 style={styles.title}>AI Learning Tools 🧠</h1>
                <p style={styles.subtitle}>
                  Explore AI-powered features to support your learning.
                </p>
              </div>

              {/* IMAGE RECOGNITION */}

              <div style={styles.aiCard}>
                <div style={styles.uploadIcon}>🖼️</div>
                <h2>AI Image Recognition</h2>

                <p style={styles.subtitle}>
                  Upload an image and let our AI model identify the object.
                </p>

                <form onSubmit={handleImagePrediction}>

                  <div style={styles.modelSelector}>
                    <h3 style={{ marginBottom: "12px" }}>
                      Select Recognition Model
                    </h3>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedModel("imagenet");
                        setPrediction(null);
                        setImageError("");
                      }}
                      style={{
                        ...styles.modelButton,
                        background: selectedModel === "imagenet"
                          ? "#5948ed" : "#eeeaff",
                        color: selectedModel === "imagenet"
                          ? "#ffffff" : "#5948ed",
                      }}
                    >
                      ImageNet · 1,000 Categories
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedModel("cifar");
                        setPrediction(null);
                        setImageError("");
                      }}
                      style={{
                        ...styles.modelButton,
                        background: selectedModel === "cifar"
                          ? "#5948ed" : "#eeeaff",
                        color: selectedModel === "cifar"
                          ? "#ffffff" : "#5948ed",
                      }}
                    >
                      CIFAR-10 · 10 Categories
                    </button>
                  </div>

                  <label style={styles.imageChooseLabel}>
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                      onChange={handleImageSelect}
                      style={{ display: "none" }}
                    />
                    <span style={styles.chooseButton}>Choose Image</span>
                  </label>

                  {selectedImage && (
                    <p style={styles.fileName}>
                      Selected: {selectedImage.name}
                    </p>
                  )}

                  {imagePreview && (
                    <div style={styles.previewContainer}>
                      <img
                        src={imagePreview}
                        alt="Selected image preview"
                        style={styles.previewImage}
                      />
                    </div>
                  )}

                  <p style={styles.hint}>
                    Supported formats: JPG, JPEG and PNG
                  </p>

                  <button
                    type="submit"
                    disabled={predicting || !selectedImage}
                    style={{
                      ...styles.uploadButton,
                      opacity: predicting || !selectedImage ? 0.6 : 1,
                    }}
                  >
                    {predicting ? "Analysing Image..." : "Predict Image ✨"}
                  </button>
                </form>

                {imageError && <p style={styles.error}>{imageError}</p>}

                {prediction && (
                  <div style={styles.resultCard}>
                    <h2>Prediction Results 🎯</h2>

                    <p style={styles.resultLabel}>Predicted Object</p>
                    <h1 style={styles.predictedClass}>
                      {prediction.predicted_class.toUpperCase()}
                    </h1>

                    <p style={styles.resultLabel}>Confidence Score</p>
                    <h2 style={styles.confidence}>
                      {prediction.confidence}%
                    </h2>

                    <div style={styles.resultDivider}></div>
                    <h3>Top Predictions</h3>

                    {prediction.all_predictions.map((item, index) => (
                      <div key={item.class} style={styles.predictionRow}>
                        <div style={styles.predictionInfo}>
                          <span>{index + 1}. {item.class}</span>
                          <strong>{item.confidence}%</strong>
                        </div>

                        <div style={styles.progressBackground}>
                          <div
                            style={{
                              ...styles.progressFill,
                              width: `${item.confidence}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}

                    <p style={styles.hint}>
                      Model: {selectedModel === "imagenet"
                        ? "MobileNetV3 · ImageNet (1,000 categories)"
                        : "Trained CIFAR-10 CNN (10 categories)"}
                    </p>
                  </div>
                )}
              </div>

              {/* NLP DOUBT SOLVER */}

              <div style={styles.aiCard}>
                <div style={styles.uploadIcon}>🧠</div>
                <h2>AI Smart Doubt Solver</h2>

                <p style={styles.subtitle}>
                  Ask a question using your uploaded study material.
                  Our trained SciQ model will rank the answer options.
                </p>

                <div style={styles.contextStatus}>
                  {extractedText
                    ? "✓ Study material is loaded and ready."
                    : "⚠ Please upload a PDF or PPTX first in My Materials."}
                </div>

                <form onSubmit={handleSolveDoubt} style={styles.doubtForm}>

                  <label style={styles.fieldLabel}>
                    Enter your question
                  </label>

                  <textarea
                    value={question}
                    onChange={(e) => {
                      setQuestion(e.target.value);
                      setAnswerResult(null);
                      setNlpError("");
                    }}
                    placeholder="Example: What is supervised learning?"
                    rows={3}
                    style={styles.questionInput}
                  />

                  <label style={styles.fieldLabel}>
                    Answer Options
                  </label>

                  {options.map((option, index) => (
                    <input
                      key={index}
                      type="text"
                      value={option}
                      onChange={(e) => {
                        const updated = [...options];
                        updated[index] = e.target.value;
                        setOptions(updated);
                        setAnswerResult(null);
                        setNlpError("");
                      }}
                      placeholder={`Option ${String.fromCharCode(65 + index)}`}
                      style={styles.optionInput}
                    />
                  ))}

                  <button
                    type="submit"
                    disabled={solving}
                    style={{
                      ...styles.uploadButton,
                      opacity: solving ? 0.6 : 1,
                    }}
                  >
                    {solving ? "Finding Answer..." : "Solve My Doubt ✨"}
                  </button>

                </form>

                {nlpError && <p style={styles.error}>{nlpError}</p>}

                {answerResult && (
                  <div style={styles.resultCard}>
                    <h2>AI Answer Results 🎯</h2>

                    <p style={styles.resultLabel}>Predicted Answer</p>

                    <h2 style={styles.predictedClass}>
                      {answerResult.predicted_answer}
                    </h2>

                    <p style={styles.resultLabel}>
                      Model Score
                    </p>

                    <h2 style={styles.confidence}>
                      {(answerResult.confidence_score * 100).toFixed(2)}%
                    </h2>

                    <div style={styles.resultDivider}></div>

                    <h3>Ranked Answer Options</h3>

                    {answerResult.all_predictions.map((item, index) => (
                      <div
                        key={`${item.option}-${index}`}
                        style={styles.predictionRow}
                      >
                        <div style={styles.predictionInfo}>
                          <span>{index + 1}. {item.option}</span>
                          <strong>
                            {(item.score * 100).toFixed(2)}%
                          </strong>
                        </div>

                        <div style={styles.progressBackground}>
                          <div
                            style={{
                              ...styles.progressFill,
                              width: `${Math.max(0, Math.min(100, item.score * 100))}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}

                    <p style={styles.hint}>
                      This is a model ranking score, not a guaranteed
                      probability of correctness.
                    </p>
                  </div>
                )}
              </div>

              <div style={styles.aiCard}>
                <h2>📚 Study Material Tools</h2>
                <p style={styles.subtitle}>
                  Upload your study material to extract its content.
                </p>

                <button
                  style={styles.uploadButton}
                  onClick={() => setActivePage("My Materials")}
                >
                  Go to My Materials →
                </button>
              </div>

            </section>
          )}

          {/* MY PROGRESS */}

          {activePage === "My Progress" && (
            <section style={styles.page}>
              <h1 style={styles.title}>My Learning Progress 📈</h1>
              <p style={styles.subtitle}>
                Materials uploaded: {uploadedMaterials.length}
              </p>
              <p style={styles.empty}>
                Your learning analytics will appear here as you use LearnSphere.
              </p>
            </section>
          )}

          <footer>
            LearnSphere · Your personal AI learning companion
          </footer>

        </main>
      </div>
    );
  }

  // LOGIN AND SIGNUP

  return (
    <main className="auth-page">
      <section className="auth-layout">

        <div className="auth-left">

          <div className="mobile-brand">
            <span className="brand-symbol">✦</span>
            <span>LearnSphere</span>
          </div>

          <div className="auth-form-wrap">

            <div className="brand-block">
              <div className="brand-symbol">✦</div>
              <h1>LearnSphere</h1>
              <p>Your personal AI learning companion</p>
            </div>

            <div className="auth-tabs">
              <button
                type="button"
                className={isLogin ? "active" : ""}
                onClick={() => setIsLogin(true)}
              >
                Login
              </button>

              <button
                type="button"
                className={!isLogin ? "active" : ""}
                onClick={() => setIsLogin(false)}
              >
                Sign Up
              </button>
            </div>

            <h2>
              {isLogin ? "Welcome back!" : "Create your account"}
            </h2>

            <p className="form-subtitle">
              {isLogin
                ? "Pick up where your learning journey left off."
                : "Create your account and learn a smarter way."}
            </p>

            <form onSubmit={handleAuth}>

              {!isLogin && (
                <label>
                  Full name
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your full name"
                    autoComplete="name"
                    required
                  />
                </label>
              )}

              <label>
                Email address
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </label>

              <label>
                Password
                <input
                  type="password"
                  placeholder="Enter your password"
                  autoComplete={isLogin ? "current-password" : "new-password"}
                  minLength={6}
                  required
                />
              </label>

              <button className="submit-btn" type="submit">
                {isLogin ? "Login to your account" : "Create my account"}
                <span>→</span>
              </button>

            </form>

            <p className="auth-footer">
              ✦ &nbsp; Your learning journey starts here
            </p>

          </div>

          <p className="left-copyright">
            © 2026 LearnSphere · Learn without limits
          </p>

        </div>

        <aside className="auth-right">
          <div className="decor decor-one"></div>
          <div className="decor decor-two"></div>

          <div className="hero-content">
            <div className="hero-pill">
              <span className="live-dot"></span>
              THE FUTURE OF PERSONALIZED LEARNING
            </div>

            <h2>
              Study smarter.
              <br />
              <span>Discover more.</span>
              <br />
              Become unstoppable.
            </h2>

            <p className="hero-description">
              Your study materials deserve more than a quick read.
              Turn them into knowledge you truly understand with your
              personal AI learning companion.
            </p>

            <div className="hero-features">
              {features.map((feature) => (
                <div className="hero-feature" key={feature.title}>
                  <div className="hero-feature-icon">{feature.icon}</div>

                  <div>
                    <h3>{feature.title}</h3>
                    <p>{feature.desc}</p>
                  </div>

                  <span className="hero-check">✓</span>
                </div>
              ))}
            </div>

            <div className="hero-bottom">
              <div className="hero-orbit">✦</div>

              <div>
                <strong>One platform. A smarter you.</strong>
                <p>Learn at your pace. Grow with every session.</p>
              </div>
            </div>
          </div>

          <div className="hero-footer">
            <span>BUILT FOR CURIOUS MINDS</span>
            <span>POWERED BY AI ✦</span>
          </div>

        </aside>
      </section>
    </main>
  );
}

// INLINE STYLES

const styles = {
  page: {
    padding: "30px 0",
    color: "#20264b",
  },

  heading: {
    marginBottom: "25px",
  },

  eyebrow: {
    color: "#6655ee",
    fontSize: "11px",
    fontWeight: "700",
    letterSpacing: "2px",
  },

  title: {
    fontSize: "30px",
    margin: "10px 0",
    color: "#242957",
  },

  subtitle: {
    color: "#7883a5",
    fontSize: "14px",
    lineHeight: 1.6,
  },

  uploadCard: {
    background: "#ffffff",
    border: "1px solid #e0e5f5",
    borderRadius: "16px",
    padding: "35px 25px",
    textAlign: "center",
    marginBottom: "25px",
  },

  aiCard: {
    background: "#ffffff",
    border: "1px solid #e0e5f5",
    borderRadius: "16px",
    padding: "30px 25px",
    textAlign: "center",
    marginBottom: "25px",
  },

  uploadIcon: {
    fontSize: "42px",
    marginBottom: "10px",
  },

  fileLabel: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "12px",
    margin: "25px 0 10px",
  },

  modelSelector: {
    margin: "20px 0",
  },

  modelButton: {
    border: "1px solid #e0e5f5",
    borderRadius: "9px",
    padding: "12px 16px",
    margin: "5px",
    fontWeight: "700",
    cursor: "pointer",
  },

  imageChooseLabel: {
    display: "block",
    margin: "25px 0 15px",
  },

  chooseButton: {
    display: "inline-block",
    background: "#eeeaff",
    color: "#5948e8",
    padding: "12px 20px",
    borderRadius: "9px",
    cursor: "pointer",
    fontWeight: "700",
    fontSize: "13px",
  },

  fileName: {
    color: "#7883a5",
    fontSize: "13px",
    marginTop: "10px",
    overflowWrap: "anywhere",
  },

  hint: {
    color: "#929bb5",
    fontSize: "12px",
    marginTop: "15px",
    lineHeight: 1.5,
  },

  uploadButton: {
    background: "#5948ed",
    color: "#ffffff",
    border: "none",
    borderRadius: "9px",
    padding: "13px 24px",
    fontWeight: "700",
    cursor: "pointer",
    marginTop: "15px",
  },

  success: {
    color: "#16834c",
    fontSize: "14px",
    marginTop: "18px",
  },

  error: {
    color: "#d43b45",
    fontSize: "14px",
    marginTop: "18px",
  },

  materialCard: {
    background: "#ffffff",
    border: "1px solid #e0e5f5",
    borderRadius: "16px",
    padding: "25px",
    marginBottom: "25px",
  },

  empty: {
    color: "#8992aa",
    fontSize: "14px",
    padding: "20px 0",
  },

  materialRow: {
    display: "flex",
    alignItems: "center",
    gap: "15px",
    borderTop: "1px solid #edf0f8",
    padding: "17px 0",
    overflowWrap: "anywhere",
  },

  fileType: {
    color: "#8992aa",
    fontSize: "12px",
    margin: "5px 0 0",
  },

  textCard: {
    background: "#ffffff",
    border: "1px solid #e0e5f5",
    borderRadius: "16px",
    padding: "25px",
    marginTop: "25px",
  },

  extractedText: {
    background: "#f7f8ff",
    borderRadius: "10px",
    padding: "18px",
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
    maxHeight: "450px",
    overflowY: "auto",
    fontSize: "13px",
    lineHeight: 1.7,
    color: "#343b60",
    fontFamily: "inherit",
  },

  previewContainer: {
    margin: "20px auto",
    maxWidth: "300px",
    padding: "10px",
    background: "#f7f8ff",
    borderRadius: "12px",
    border: "1px solid #e0e5f5",
  },

  previewImage: {
    width: "100%",
    maxHeight: "250px",
    objectFit: "contain",
    borderRadius: "8px",
  },

  resultCard: {
    marginTop: "30px",
    padding: "25px",
    background: "#f7f8ff",
    border: "1px solid #e0e5f5",
    borderRadius: "14px",
    textAlign: "left",
  },

  resultLabel: {
    color: "#7883a5",
    fontSize: "13px",
    marginTop: "20px",
  },

  predictedClass: {
    color: "#5948ed",
    fontSize: "25px",
    margin: "8px 0",
  },

  confidence: {
    color: "#16834c",
    fontSize: "25px",
    margin: "8px 0",
  },

  resultDivider: {
    height: "1px",
    background: "#e0e5f5",
    margin: "22px 0",
  },

  predictionRow: {
    marginTop: "17px",
  },

  predictionInfo: {
    display: "flex",
    justifyContent: "space-between",
    gap: "10px",
    color: "#343b60",
    fontSize: "13px",
    marginBottom: "7px",
  },

  progressBackground: {
    height: "8px",
    background: "#e2e5f2",
    borderRadius: "20px",
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
    background: "#6553ed",
    borderRadius: "20px",
  },

  contextStatus: {
    padding: "13px",
    background: "#f1f0ff",
    color: "#5948ed",
    borderRadius: "9px",
    fontSize: "13px",
    margin: "20px 0",
  },

  doubtForm: {
    maxWidth: "750px",
    margin: "0 auto",
    textAlign: "left",
  },

  fieldLabel: {
    display: "block",
    fontSize: "14px",
    fontWeight: "700",
    color: "#343b60",
    margin: "18px 0 8px",
  },

  questionInput: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #dfe3f2",
    borderRadius: "9px",
    padding: "13px",
    fontFamily: "inherit",
    fontSize: "14px",
    resize: "vertical",
    outlineColor: "#6553ed",
    color: "#343b60",
  },

  optionInput: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #dfe3f2",
    borderRadius: "9px",
    padding: "13px",
    fontFamily: "inherit",
    fontSize: "14px",
    marginBottom: "10px",
    outlineColor: "#6553ed",
    color: "#343b60",
  },
};

export default App;
