
import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./App.css";

const API_URL = "http://127.0.0.1:5000";

const features = [
  { icon: "📚", title: "AI Notes Preparation", desc: "Upload PDF or PPT and prepare structured study notes.", page: "AI Notes" },
  { icon: "🖼️", title: "AI Image Recognition", desc: "Recognize images using ImageNet and CIFAR-10 models.", page: "Image Recognition" },
  { icon: "🤖", title: "AI Smart Chatbot", desc: "Ask anything and get detailed AI-powered explanations.", page: "Smart Chatbot" }
];

function App() {
  const [isLogin, setIsLogin] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [activePage, setActivePage] = useState("Overview");

  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadedMaterials, setUploadedMaterials] = useState([]);
  const [latestFilename, setLatestFilename] = useState("");
  const [extractedText, setExtractedText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [generatingNotes, setGeneratingNotes] = useState(false);
  const [notes, setNotes] = useState([]);
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [notesError, setNotesError] = useState("");

  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [selectedModel, setSelectedModel] = useState("imagenet");
  const [predicting, setPredicting] = useState(false);
  const [prediction, setPrediction] = useState(null);
  const [imageError, setImageError] = useState("");

  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, chatLoading]);

  function handleAuth(e) {
    e.preventDefault();
    const studentName = name.trim() || email.split("@")[0] || "Student";
    setName(studentName);
    setLoggedIn(true);
    setActivePage("Overview");
  }

  async function handleUpload(e) {
    e.preventDefault();

    if (!selectedFile) {
      setUploadError("Please select a PDF or PPTX file.");
      return;
    }

    setUploading(true);
    setUploadError("");
    setUploadMessage("");
    setNotes([]);
    setExtractedText("");

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const response = await fetch(`${API_URL}/upload`, {
        method: "POST",
        body: formData
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Upload failed.");

      const savedName = data.filename || selectedFile.name;
      setLatestFilename(savedName);
      setExtractedText(data.extracted_text || "");
      setUploadMessage(data.message || "Material uploaded successfully!");
      setUploadedMaterials((old) => [
        ...old,
        {
          filename: savedName,
          type: selectedFile.name.toLowerCase().endsWith(".pdf") ? "PDF" : "PPTX"
        }
      ]);
      setSelectedFile(null);
      e.target.reset();
    } catch (err) {
      setUploadError(
        err.message === "Failed to fetch"
          ? "Cannot connect to backend. Start Flask server."
          : err.message
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleGenerateNotes() {
    if (!latestFilename) {
      setNotesError("Please upload a PDF or PPTX first.");
      return;
    }

    setGeneratingNotes(true);
    setNotesError("");
    setNotes([]);

    try {
      const response = await fetch(`${API_URL}/generate-notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: latestFilename })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Notes generation failed.");

      setNotes(data.notes || []);
      if (!data.notes?.length) {
        setNotesError("No topic-wise notes were found in this document.");
      }
    } catch (err) {
      setNotesError(
        err.message === "Failed to fetch"
          ? "Cannot connect to backend."
          : err.message
      );
    } finally {
      setGeneratingNotes(false);
    }
  }

  function handleImageSelect(e) {
    const file = e.target.files?.[0];
    setSelectedImage(null);
    setImagePreview("");
    setPrediction(null);
    setImageError("");

    if (!file) return;

    if (!["image/jpeg", "image/png"].includes(file.type)) {
      setImageError("Please select a JPG, JPEG or PNG image.");
      e.target.value = "";
      return;
    }

    setSelectedImage(file);
    setImagePreview(URL.createObjectURL(file));
  }

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
      const endpoint = selectedModel === "imagenet"
        ? "/predict-imagenet"
        : "/predict-image";

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        body: formData
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Prediction failed.");

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

  async function handleSendMessage(e) {
    e.preventDefault();

    const message = chatInput.trim();
    if (!message || chatLoading) return;

    const updatedMessages = [
      ...chatMessages,
      { role: "user", content: message }
    ];

    setChatMessages(updatedMessages);
    setChatInput("");
    setChatLoading(true);
    setChatError("");

    try {
      const response = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          context: extractedText,
          history: chatMessages.slice(-10)
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Chat request failed.");

      setChatMessages((old) => [
        ...old,
        { role: "model", content: data.answer || "No answer received." }
      ]);
    } catch (err) {
      setChatError(
        err.message === "Failed to fetch"
          ? "Cannot connect to Gemini backend. Check Flask server."
          : err.message
      );
    } finally {
      setChatLoading(false);
    }
  }

  function openPage(page) {
    setActivePage(page);
  }

  function renderOverview() {
    return (
      <>
        <section className="welcome-section">
          <div>
            <span className="welcome-badge">✦ YOUR AI LEARNING SPACE</span>
            <h1>Welcome back, {name}!</h1>
            <p>Your personal AI companion for smarter learning starts here.</p>
            <button className="primary-btn welcome-btn" onClick={() => openPage("AI Notes")}>
              Start Learning <span>→</span>
            </button>
          </div>
          <div className="welcome-art">✧</div>
        </section>

        <section className="section-heading">
          <span className="section-eyebrow">YOUR AI TOOLKIT</span>
          <h2>Explore your learning tools</h2>
          <p>Everything you need in one simple workspace.</p>
        </section>

        <section className="feature-grid">
          {features.map((feature, index) => (
            <button
              className="feature-card"
              key={feature.title}
              onClick={() => openPage(feature.page)}
            >
              <div className={`feature-icon feature-${index}`}>{feature.icon}</div>
              <h3>{feature.title}</h3>
              <p>{feature.desc}</p>
              <span className="feature-link">Open tool <span>↗</span></span>
            </button>
          ))}
        </section>

        <section className="overview-materials">
          <div>
            <span className="section-eyebrow">YOUR LIBRARY</span>
            <h2>Study materials</h2>
            <p>{uploadedMaterials.length} document(s) uploaded</p>
          </div>
          <button className="secondary-btn" onClick={() => openPage("AI Notes")}>
            Manage materials →
          </button>
        </section>
      </>
    );
  }

  function renderNotes() {
    return (
      <section className="content-page">
        <div className="page-heading">
          <span className="section-eyebrow">LEARN WITH YOUR MATERIAL</span>
          <h1>AI Notes Preparation 📚</h1>
          <p>Upload your PDF or PowerPoint and prepare structured topic-wise notes.</p>
        </div>

        <div className="content-card upload-card">
          <div className="large-icon">📄</div>
          <h2>Upload Study Material</h2>
          <p>Select a PDF or PPTX file from your computer.</p>

          <form onSubmit={handleUpload}>
            <label className="file-picker">
              <input
                type="file"
                accept=".pdf,.pptx"
                onChange={(e) => {
                  setSelectedFile(e.target.files?.[0] || null);
                  setUploadError("");
                  setUploadMessage("");
                }}
              />
              <span>Choose File</span>
              <small>{selectedFile ? selectedFile.name : "No file selected"}</small>
            </label>

            <button className="primary-btn" type="submit" disabled={uploading || !selectedFile}>
              {uploading ? "Uploading..." : "Upload Material ↑"}
            </button>
          </form>

          {uploadMessage && <p className="success-message">{uploadMessage}</p>}
          {uploadError && <p className="error-message">{uploadError}</p>}
        </div>

        {uploadedMaterials.length > 0 && (
          <div className="content-card">
            <h2>Uploaded Materials</h2>
            {uploadedMaterials.map((item, index) => (
              <div className="material-row" key={`${item.filename}-${index}`}>
                <span className="material-icon">{item.type === "PDF" ? "📕" : "📊"}</span>
                <div>
                  <strong>{item.filename}</strong>
                  <small>{item.type} · Uploaded successfully</small>
                </div>
              </div>
            ))}
          </div>
        )}

        {latestFilename && (
          <div className="content-card notes-action">
            <div>
              <h2>Generate your notes</h2>
              <p>Your uploaded document is ready for topic-wise note preparation.</p>
            </div>
            <button className="primary-btn" onClick={handleGenerateNotes} disabled={generatingNotes}>
              {generatingNotes ? "Preparing Notes..." : "Generate Notes ✨"}
            </button>
            {notesError && <p className="error-message">{notesError}</p>}
          </div>
        )}

        {notes.length > 0 && (
          <div className="content-card notes-results">
            <span className="section-eyebrow">YOUR STUDY NOTES</span>
            <h2>Generated Notes</h2>
            <p className="muted-text">{notes.length} topic(s) found in your document.</p>
            {notes.map((note, index) => (
              <article className="note-item" key={`${note.topic}-${index}`}>
                <h3>{index + 1}. {note.topic}</h3>
                <p>{note.detailed_content}</p>
                {note.important_points?.length > 0 && (
                  <>
                    <h4>Important Points</h4>
                    <ul>
                      {note.important_points.map((point, i) => <li key={i}>{point}</li>)}
                    </ul>
                  </>
                )}
              </article>
            ))}
          </div>
        )}

        {extractedText && (
          <div className="content-card">
            <h2>Extracted Document Text</h2>
            <pre className="extracted-text">{extractedText}</pre>
            <button className="secondary-btn" onClick={() => openPage("Smart Chatbot")}>
              Ask questions about this material →
            </button>
          </div>
        )}
      </section>
    );
  }

  function renderImageRecognition() {
    return (
      <section className="content-page">
        <div className="page-heading">
          <span className="section-eyebrow">COMPUTER VISION</span>
          <h1>AI Image Recognition 🖼️</h1>
          <p>Upload an image and let the trained AI model recognize its contents.</p>
        </div>

        <div className="content-card image-card">
          <h2>Select Recognition Model</h2>
          <div className="model-selector">
            <button
              type="button"
              className={selectedModel === "imagenet" ? "model-btn active" : "model-btn"}
              onClick={() => { setSelectedModel("imagenet"); setPrediction(null); setImageError(""); }}
            >
              ImageNet <small>1,000 categories</small>
            </button>
            <button
              type="button"
              className={selectedModel === "cifar" ? "model-btn active" : "model-btn"}
              onClick={() => { setSelectedModel("cifar"); setPrediction(null); setImageError(""); }}
            >
              CIFAR-10 <small>10 categories</small>
            </button>
          </div>

          <form onSubmit={handleImagePrediction}>
            <label className="image-picker">
              <input type="file" accept=".jpg,.jpeg,.png,image/jpeg,image/png" onChange={handleImageSelect} />
              <span className="large-icon">🖼️</span>
              <strong>Choose an image</strong>
              <small>{selectedImage ? selectedImage.name : "JPG, JPEG or PNG"}</small>
            </label>

            {imagePreview && (
              <div className="image-preview">
                <img src={imagePreview} alt="Selected preview" />
              </div>
            )}

            <button className="primary-btn" type="submit" disabled={predicting || !selectedImage}>
              {predicting ? "Analysing Image..." : "Predict Image ✨"}
            </button>
          </form>

          {imageError && <p className="error-message">{imageError}</p>}
        </div>

        {prediction && (
          <div className="content-card prediction-card">
            <span className="section-eyebrow">MODEL OUTPUT</span>
            <h2>Prediction Results</h2>
            <p className="muted-text">Predicted Object</p>
            <h1 className="predicted-class">{prediction.predicted_class}</h1>
            <p className="muted-text">Confidence Score</p>
            <h2 className="confidence-score">{prediction.confidence}%</h2>
            <div className="result-divider" />
            <h3>Top Predictions</h3>
            {prediction.all_predictions?.map((item, index) => (
              <div className="prediction-row" key={`${item.class}-${index}`}>
                <div className="prediction-info">
                  <span>{index + 1}. {item.class}</span>
                  <strong>{item.confidence}%</strong>
                </div>
                <div className="progress-background">
                  <div className="progress-fill" style={{ width: `${item.confidence}%` }} />
                </div>
              </div>
            ))}
            <p className="muted-text model-caption">
              Model: {selectedModel === "imagenet"
                ? "MobileNetV3 · ImageNet (1,000 categories)"
                : "Trained CIFAR-10 CNN (10 categories)"}
            </p>
          </div>
        )}
      </section>
    );
  }

  function renderChatbot() {
    return (
      <section className="content-page chatbot-page">
        <div className="page-heading">
          <span className="section-eyebrow">GEMINI AI ASSISTANT</span>
          <h1>AI Smart Chatbot 🤖</h1>
          <p>Ask questions naturally. Learn concepts with detailed explanations.</p>
        </div>

        <div className="chat-card">
          <div className="chat-header">
            <div className="chat-avatar">✦</div>
            <div>
              <strong>LearnSphere AI</strong>
              <small><span className="online-dot" /> Gemini assistant</small>
            </div>
            <button className="clear-chat" onClick={() => { setChatMessages([]); setChatError(""); }}>
              New chat
            </button>
          </div>

          <div className="chat-messages">
            {chatMessages.length === 0 && (
              <div className="chat-welcome">
                <div className="chat-welcome-icon">✦</div>
                <h2>Hey {name}! How can I help you?</h2>
                <p>Ask me anything. I can also answer using your uploaded study material.</p>
                <div className="suggestion-list">
                  {["What is Machine Learning?", "Explain Deep Learning in simple words.", "What is Computer Vision?"].map((q) => (
                    <button key={q} onClick={() => setChatInput(q)}>{q} <span>↗</span></button>
                  ))}
                </div>
                <p className="context-hint">
                  {extractedText ? "✓ Uploaded study material is available as context." : "Tip: Upload a PDF/PPT in AI Notes to ask questions about it."}
                </p>
              </div>
            )}

            {chatMessages.map((item, index) => (
              <div className={`chat-message ${item.role === "user" ? "user-message" : "ai-message"}`} key={index}>
                {item.role !== "user" && <span className="message-avatar">✦</span>}
                <div className="message-bubble">
                  <small>{item.role === "user" ? "You" : "LearnSphere AI"}</small>
                  <div className="markdown-content">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {item.content}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            ))}

            {chatLoading && (
              <div className="chat-message ai-message">
                <span className="message-avatar">✦</span>
                <div className="message-bubble typing">Thinking<span>.</span><span>.</span><span>.</span></div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {chatError && <p className="error-message chat-error">{chatError}</p>}

          <form className="chat-input-area" onSubmit={handleSendMessage}>
            <textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Ask anything... (e.g. Explain Neural Networks)"
              rows={2}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e);
                }
              }}
            />
            <button type="submit" disabled={!chatInput.trim() || chatLoading}>
              {chatLoading ? "..." : "↑"}
            </button>
          </form>
          <p className="chat-footnote">AI can make mistakes. Verify important information.</p>
        </div>
      </section>
    );
  }

  if (loggedIn) {
    return (
      <div className="dashboard-layout">
        <aside className="sidebar">
          <div className="side-brand"><span>✦</span> LearnSphere</div>
          <p className="nav-label">YOUR WORKSPACE</p>

          <button className={`nav-item ${activePage === "Overview" ? "selected" : ""}`} onClick={() => openPage("Overview")}>
            <span>⌂</span> Overview
          </button>
          <button className={`nav-item ${activePage === "AI Notes" ? "selected" : ""}`} onClick={() => openPage("AI Notes")}>
            <span>▤</span> AI Notes
          </button>
          <button className={`nav-item ${activePage === "Image Recognition" ? "selected" : ""}`} onClick={() => openPage("Image Recognition")}>
            <span>▧</span> Image Recognition
          </button>
          <button className={`nav-item ${activePage === "Smart Chatbot" ? "selected" : ""}`} onClick={() => openPage("Smart Chatbot")}>
            <span>✧</span> Smart Chatbot
          </button>

          <div className="sidebar-bottom">
            <div className="avatar">{name.charAt(0).toUpperCase()}</div>
            <div className="profile-info">
              <strong>{name}</strong>
              <small>Student account</small>
            </div>
            <button className="logout" title="Log out" onClick={() => setLoggedIn(false)}>↪</button>
          </div>
        </aside>

        <main className="dashboard-main">
          <header className="topbar">
            <span>My workspace <span className="breadcrumb-slash">/</span> {activePage}</span>
            <div className="topbar-right">
              <span className="topbar-status"><span className="online-dot" /> AI Workspace</span>
              <div className="top-avatar">{name.charAt(0).toUpperCase()}</div>
            </div>
          </header>

          {activePage === "Overview" && renderOverview()}
          {activePage === "AI Notes" && renderNotes()}
          {activePage === "Image Recognition" && renderImageRecognition()}
          {activePage === "Smart Chatbot" && renderChatbot()}

          <footer>LearnSphere · Your personal AI learning companion</footer>
        </main>
      </div>
    );
  }

  return (
    <main className="auth-page">
      <section className="auth-layout">
        <div className="auth-left">
          <div className="mobile-brand"><span className="brand-symbol">✦</span><span>LearnSphere</span></div>
          <div className="auth-form-wrap">
            <div className="brand-block">
              <div className="brand-symbol">✦</div>
              <h1>LearnSphere</h1>
              <p>Your personal AI learning companion</p>
            </div>

            <div className="auth-tabs">
              <button type="button" className={isLogin ? "active" : ""} onClick={() => setIsLogin(true)}>Login</button>
              <button type="button" className={!isLogin ? "active" : ""} onClick={() => setIsLogin(false)}>Sign Up</button>
            </div>

            <h2>{isLogin ? "Welcome back!" : "Create your account"}</h2>
            <p className="form-subtitle">{isLogin ? "Pick up where your learning journey left off." : "Create your account and learn a smarter way."}</p>

            <form onSubmit={handleAuth}>
              {!isLogin && (
                <label>Full name
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter your full name" autoComplete="name" required />
                </label>
              )}
              <label>Email address
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required />
              </label>
              <label>Password
                <input type="password" placeholder="Enter your password" autoComplete={isLogin ? "current-password" : "new-password"} minLength={6} required />
              </label>
              <button className="submit-btn" type="submit">
                {isLogin ? "Login to your account" : "Create my account"} <span>→</span>
              </button>
            </form>
            <p className="auth-footer">✦ &nbsp; Your learning journey starts here</p>
          </div>
          <p className="left-copyright">© 2026 LearnSphere · Learn without limits</p>
        </div>

        <aside className="auth-right">
          <div className="decor decor-one" />
          <div className="decor decor-two" />
          <div className="hero-content">
            <div className="hero-pill"><span className="live-dot" /> THE FUTURE OF SMART LEARNING</div>
            <h2>Study smarter.<br /><span>Discover more.</span><br />Become unstoppable.</h2>
            <p className="hero-description">Turn your study materials into knowledge you truly understand with your personal AI learning companion.</p>
            <div className="hero-features">
              {features.map((feature) => (
                <div className="hero-feature" key={feature.title}>
                  <div className="hero-feature-icon">{feature.icon}</div>
                  <div><h3>{feature.title}</h3><p>{feature.desc}</p></div>
                  <span className="hero-check">✓</span>
                </div>
              ))}
            </div>
            <div className="hero-bottom">
              <div className="hero-orbit">✦</div>
              <div><strong>One platform. A smarter you.</strong><p>Learn at your pace. Grow with every session.</p></div>
            </div>
          </div>
          <div className="hero-footer"><span>BUILT FOR CURIOUS MINDS</span><span>POWERED BY AI ✦</span></div>
        </aside>
      </section>
    </main>
  );
}

export default App;
