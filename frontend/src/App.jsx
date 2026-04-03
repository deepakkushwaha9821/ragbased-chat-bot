import { Link, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import api from "./api";

function TypewriterText({ text, animate, onDone }) {
  const [visibleText, setVisibleText] = useState(animate ? "" : text);

  useEffect(() => {
    if (!animate) {
      setVisibleText(text);
      return;
    }

    setVisibleText("");
    let index = 0;
    const intervalId = window.setInterval(() => {
      index += 1;
      setVisibleText(text.slice(0, index));

      if (index >= text.length) {
        window.clearInterval(intervalId);
        onDone?.();
      }
    }, 16);

    return () => window.clearInterval(intervalId);
  }, [text, animate, onDone]);

  return <>{visibleText}</>;
}

function AuthPage({ mode }) {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setError("");

    try {
      if (mode === "register") {
        await api.post("/auth/register", { username, password });
      }

      const response = await api.post("/auth/login", { username, password });
      localStorage.setItem("token", response.data.access_token);
      navigate("/");
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Request failed");
    }
  };

  return (
    <div className="auth-shell">
      <form className="auth-card" onSubmit={submit}>
        <h2>{mode === "login" ? "Welcome Back" : "Create Account"}</h2>
        <input
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="Username"
          required
        />
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
          required
        />
        <button type="submit">{mode === "login" ? "Login" : "Register"}</button>
        {error ? <p className="error-text">{error}</p> : null}
        <p>
          {mode === "login" ? "No account?" : "Already have an account?"} {" "}
          <Link to={mode === "login" ? "/register" : "/login"}>
            {mode === "login" ? "Register" : "Login"}
          </Link>
        </p>
      </form>
    </div>
  );
}

function AboutPage() {
  const [info, setInfo] = useState(null);

  useEffect(() => {
    api.get("/about").then((response) => setInfo(response.data));
  }, []);

  return (
    <div className="page-card">
      <h1>About</h1>
      <p>{info?.app_name || "AI Chatbot"}</p>
      <p>{(info?.stack || []).join(" | ")}</p>
      <Link to="/">Back to Chat</Link>
    </div>
  );
}

function ChatPage() {
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);
  const [me, setMe] = useState(null);
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [typingMessageId, setTypingMessageId] = useState(null);
  const [files, setFiles] = useState([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");

  const activeChat = useMemo(
    () => chats.find((chat) => chat.id === activeChatId) || null,
    [chats, activeChatId]
  );

  const loadChats = async () => {
    const response = await api.get("/chats");
    setChats(response.data);
    if (!activeChatId && response.data.length > 0) {
      setActiveChatId(response.data[0].id);
    }
  };

  const loadChatDetail = async (chatId) => {
    const response = await api.get(`/chats/${chatId}`);
    setMessages(response.data.messages);
    setFiles(response.data.files);
  };

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const user = await api.get("/auth/me");
        setMe(user.data);
        await loadChats();
      } catch {
        localStorage.removeItem("token");
        navigate("/login");
      }
    };

    bootstrap();
  }, []);

  useEffect(() => {
    if (activeChatId) {
      loadChatDetail(activeChatId);
    } else {
      setMessages([]);
      setTypingMessageId(null);
      setFiles([]);
    }
  }, [activeChatId]);

  useEffect(() => {
    if (typingMessageId && !messages.some((message) => message.id === typingMessageId)) {
      setTypingMessageId(null);
    }
  }, [messages, typingMessageId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  useEffect(() => {
    if (!typingMessageId) {
      return;
    }

    const intervalId = window.setInterval(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
    }, 50);

    return () => window.clearInterval(intervalId);
  }, [typingMessageId]);

  const createChat = async () => {
    const response = await api.post("/chats");
    await loadChats();
    setActiveChatId(response.data.id);
  };

  const sendMessage = async (event) => {
    event.preventDefault();
    if (!activeChatId || !text.trim()) {
      return;
    }

    setError("");
    try {
      const response = await api.post(`/chats/${activeChatId}/messages`, { message: text });
      setText("");
      setTypingMessageId(response.data.id);
      await loadChatDetail(activeChatId);
      await loadChats();
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Failed to send message");
    }
  };

  const upload = async (event) => {
    if (!activeChatId) {
      return;
    }

    const selected = event.target.files?.[0];
    if (!selected) {
      return;
    }

    const form = new FormData();
    form.append("file", selected);

    setError("");
    try {
      await api.post(`/chats/${activeChatId}/upload`, form, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      await loadChatDetail(activeChatId);
      await loadChats();
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Failed to upload file");
    } finally {
      event.target.value = "";
    }
  };

  const togglePin = async (chatId) => {
    await api.post(`/chats/${chatId}/pin`);
    await loadChats();
  };

  const archiveChat = async (chatId) => {
    await api.post(`/chats/${chatId}/archive`);
    if (activeChatId === chatId) {
      setActiveChatId(null);
    }
    await loadChats();
  };

  const deleteChat = async (chatId) => {
    await api.delete(`/chats/${chatId}`);
    if (activeChatId === chatId) {
      setActiveChatId(null);
    }
    await loadChats();
  };

  const logout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  return (
    <div className="layout">
      <aside className="sidebar">
        <h2>AI Chatbot</h2>
        <p className="muted">Signed in as {me?.username}</p>
        <button onClick={createChat}>New Chat</button>
        <input type="file" onChange={upload} disabled={!activeChat} />

        <div className="chat-list">
          {chats.map((chat) => (
            <div key={chat.id} className={chat.id === activeChatId ? "chat-row active" : "chat-row"}>
              <button className="chat-title" onClick={() => setActiveChatId(chat.id)}>
                {chat.title}
              </button>
              <div className="row-actions">
                <button onClick={() => togglePin(chat.id)}>{chat.is_pinned ? "Pinned" : "Pin"}</button>
                <button onClick={() => archiveChat(chat.id)}>Archive</button>
                <button onClick={() => deleteChat(chat.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>

        <div className="footer-links">
          <Link to="/about">About</Link>
          <button onClick={logout}>Logout</button>
        </div>
      </aside>

      <main className="chat-main">
        <h1>{activeChat?.title || "Select a chat"}</h1>

        <section className="files-panel">
          {files.map((file) => (
            <p key={file.id}>File: {file.filename}</p>
          ))}
        </section>

        <section className="messages">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`bubble ${message.role} ${
                message.role === "ai" && message.content.split("\n").length > 10
                  ? "long"
                  : ""
              }`}
            >
              <TypewriterText
                text={message.content}
                animate={message.role === "ai" && message.id === typingMessageId}
                onDone={() => setTypingMessageId((current) => (current === message.id ? null : current))}
              />
            </div>
          ))}
          <div ref={messagesEndRef} />
        </section>

        {activeChat ? (
          <form className="message-form" onSubmit={sendMessage}>
            <input
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Ask about your document or use tools..."
            />
            <button type="submit">Send</button>
          </form>
        ) : null}

        {error ? <p className="error-text">{error}</p> : null}
      </main>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const token = localStorage.getItem("token");
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/register" element={<AuthPage mode="register" />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <ChatPage />
          </ProtectedRoute>
        }
      />
      <Route path="/about" element={<AboutPage />} />
    </Routes>
  );
}
