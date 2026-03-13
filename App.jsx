import { useState, useRef, useEffect, useCallback } from "react";

/* ──────────────────────────────────────────────────────────────────────
   API_URL:
   - In dev (npm start):         http://localhost:8000
   - In docker-compose:          resolved via nginx proxy → /api
   We check if we're behind the nginx proxy by trying /api first.
   For simplicity in PoC we use env var or fallback to localhost.
   ────────────────────────────────────────────────────────────────────── */
const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";

// ─── Theme ───────────────────────────────────────────────────────────
const T = {
  bg:         "#111318",
  surface:    "#1a1d24",
  surfaceAlt: "#22262f",
  border:     "#2a2f3a",
  borderHi:   "#363c4a",
  text:       "#e8eaf0",
  textDim:    "#8b90a0",
  textMuted:  "#5c6070",
  orange:     "#e8722a",
  orangeGlow: "rgba(232,114,42,0.15)",
  orangeDim:  "rgba(232,114,42,0.08)",
  blue:       "#3b82f6",
  blueGlow:   "rgba(59,130,246,0.12)",
  blueDim:    "rgba(59,130,246,0.06)",
  danger:     "#ef4444",
  success:    "#22c55e",
};

function truncate(str, n = 120) {
  if (!str) return "";
  return str.length > n ? str.slice(0, n) + "…" : str;
}

// ─── Icons ───────────────────────────────────────────────────────────
function SendIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function BugIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a4 4 0 0 0-4 4v2H6a2 2 0 0 0-2 2v1h4" />
      <path d="M18 8h-2V6a4 4 0 0 0-4-4" />
      <path d="M20 10v1a2 2 0 0 1-2 2" />
      <rect x="8" y="10" width="8" height="10" rx="4" />
      <path d="M2 14h4" /><path d="M18 14h4" />
      <path d="M2 18h4" /><path d="M18 18h4" />
      <path d="M12 10v10" />
    </svg>
  );
}

function ChevronIcon({ open }) {
  return (
    <svg
      width="12" height="12" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.25s ease" }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function SmartLogLogo() {
  return (
    <svg width="32" height="32" viewBox="0 0 100 100" fill="none">
      <rect x="5" y="5" width="90" height="90" rx="20" fill={T.orange} />
      <path d="M25 62 C25 62, 35 48, 50 52 C65 56, 75 42, 75 42" stroke="white" strokeWidth="6" strokeLinecap="round" fill="none" />
      <circle cx="50" cy="52" r="5" fill="white" />
      <path d="M25 70 C25 70, 40 60, 55 64 C70 68, 75 58, 75 58" stroke="rgba(255,255,255,0.4)" strokeWidth="3" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function WavesBg() {
  return (
    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "200px", opacity: 0.03, pointerEvents: "none", overflow: "hidden" }}>
      <svg width="100%" height="200" viewBox="0 0 1440 200" preserveAspectRatio="none">
        <path d="M0,100 C360,150 720,50 1080,100 C1260,125 1380,80 1440,100 L1440,200 L0,200 Z" fill={T.orange} />
        <path d="M0,130 C360,170 720,90 1080,130 C1260,150 1380,110 1440,130 L1440,200 L0,200 Z" fill={T.blue} />
      </svg>
    </div>
  );
}

// ─── Debug Panel ─────────────────────────────────────────────────────
function DebugPanel({ debug }) {
  const [tab, setTab] = useState("chunks");
  if (!debug) return null;

  const tabs = [
    { key: "chunks", label: "Retrieved Chunks", count: debug.retrieved_chunks?.length || 0 },
    { key: "context", label: "LLM Context" },
    { key: "history", label: "History", count: debug.history?.length || 0 },
  ];

  return (
    <div style={{ marginTop: "8px", background: T.bg, border: `1px solid ${T.border}`, borderRadius: "10px", overflow: "hidden", animation: "debugSlide 0.3s ease" }}>
      <div style={{ display: "flex", gap: "2px", padding: "4px", background: T.surface, borderBottom: `1px solid ${T.border}` }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            flex: 1, padding: "6px 10px", fontSize: "11px", fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
            letterSpacing: "0.03em", color: tab === t.key ? T.orange : T.textDim,
            background: tab === t.key ? T.orangeDim : "transparent", border: "none", borderRadius: "6px", cursor: "pointer", transition: "all 0.2s ease",
          }}>
            {t.label}
            {t.count !== undefined && (
              <span style={{ marginLeft: "5px", padding: "1px 6px", fontSize: "10px", borderRadius: "10px",
                background: tab === t.key ? T.orangeGlow : T.surfaceAlt, color: tab === t.key ? T.orange : T.textMuted }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div style={{ padding: "12px", maxHeight: "300px", overflowY: "auto" }}>
        {tab === "chunks" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {(debug.retrieved_chunks || []).map((chunk, i) => (
              <div key={i} style={{ background: T.surfaceAlt, border: `1px solid ${T.border}`, borderRadius: "8px", padding: "10px 12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <span style={{ fontSize: "10px", fontWeight: 700, fontFamily: "'DM Mono', monospace", color: T.blue,
                    background: T.blueDim, padding: "2px 8px", borderRadius: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {chunk.section}
                  </span>
                  {chunk.distance != null && (
                    <span style={{ fontSize: "10px", fontFamily: "'DM Mono', monospace",
                      color: chunk.distance < 0.5 ? T.success : chunk.distance < 1.0 ? T.orange : T.danger }}>
                      dist: {chunk.distance.toFixed(4)}
                    </span>
                  )}
                </div>
                <p style={{ fontSize: "12px", lineHeight: "1.5", color: T.textDim, margin: 0,
                  fontFamily: "'DM Mono', monospace", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {chunk.doc}
                </p>
                {chunk.meta && Object.keys(chunk.meta).length > 0 && (
                  <div style={{ marginTop: "6px", paddingTop: "6px", borderTop: `1px solid ${T.border}`, display: "flex", flexWrap: "wrap", gap: "4px" }}>
                    {Object.entries(chunk.meta).map(([k, v]) => (
                      <span key={k} style={{ fontSize: "9px", padding: "2px 6px", background: T.bg, borderRadius: "3px",
                        color: T.textMuted, fontFamily: "'DM Mono', monospace" }}>
                        {k}: {typeof v === "string" ? truncate(v, 40) : JSON.stringify(v)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {(!debug.retrieved_chunks || debug.retrieved_chunks.length === 0) && (
              <p style={{ color: T.textMuted, fontSize: "12px", textAlign: "center", margin: "20px 0" }}>No chunks retrieved</p>
            )}
          </div>
        )}

        {tab === "context" && (
          <pre style={{ fontSize: "11px", lineHeight: "1.6", color: T.textDim, margin: 0,
            fontFamily: "'DM Mono', monospace", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {debug.context_sent_to_llm || "No context"}
          </pre>
        )}

        {tab === "history" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {(debug.history || []).map((h, i) => (
              <div key={i} style={{ background: T.surfaceAlt, borderRadius: "8px", padding: "10px 12px", border: `1px solid ${T.border}` }}>
                <div style={{ fontSize: "11px", color: T.orange, fontWeight: 600, marginBottom: "4px" }}>Q: {h.question}</div>
                <div style={{ fontSize: "11px", color: T.textDim, lineHeight: "1.5" }}>A: {truncate(h.answer, 200)}</div>
              </div>
            ))}
            {(!debug.history || debug.history.length === 0) && (
              <p style={{ color: T.textMuted, fontSize: "12px", textAlign: "center", margin: "20px 0" }}>No conversation history yet</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Chat Message ────────────────────────────────────────────────────
function ChatMessage({ message, isLast }) {
  const [showDebug, setShowDebug] = useState(false);
  const isUser = message.role === "user";

  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: "4px", animation: isLast ? "msgIn 0.35s ease" : "none" }}>
      <div style={{ maxWidth: "78%", minWidth: "60px" }}>
        <div style={{
          padding: "12px 16px", borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
          background: isUser ? `linear-gradient(135deg, ${T.orange}, #d4621f)` : T.surface,
          border: isUser ? "none" : `1px solid ${T.border}`, color: isUser ? "#fff" : T.text,
          fontSize: "14px", lineHeight: "1.6", fontFamily: "'DM Sans', sans-serif",
          boxShadow: isUser ? "0 2px 12px rgba(232,114,42,0.2)" : "0 1px 4px rgba(0,0,0,0.15)",
          whiteSpace: "pre-wrap", wordBreak: "break-word",
        }}>
          {message.content}
        </div>

        {!isUser && message.debug && (
          <div style={{ marginTop: "4px" }}>
            <button onClick={() => setShowDebug(!showDebug)} style={{
              display: "inline-flex", alignItems: "center", gap: "5px", padding: "4px 10px",
              fontSize: "11px", fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
              color: showDebug ? T.orange : T.textMuted, background: showDebug ? T.orangeDim : "transparent",
              border: `1px solid ${showDebug ? T.orange + "40" : T.border}`, borderRadius: "6px",
              cursor: "pointer", transition: "all 0.2s ease", letterSpacing: "0.02em",
            }}
              onMouseEnter={e => { if (!showDebug) { e.currentTarget.style.color = T.orange; e.currentTarget.style.borderColor = T.orange + "40"; } }}
              onMouseLeave={e => { if (!showDebug) { e.currentTarget.style.color = T.textMuted; e.currentTarget.style.borderColor = T.border; } }}
            >
              <BugIcon /> Debug <ChevronIcon open={showDebug} />
            </button>
            {showDebug && <DebugPanel debug={message.debug} />}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Typing Indicator ────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: "4px" }}>
      <div style={{ padding: "14px 20px", borderRadius: "16px 16px 16px 4px", background: T.surface, border: `1px solid ${T.border}`, display: "flex", gap: "5px", alignItems: "center" }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ width: "7px", height: "7px", borderRadius: "50%", background: T.blue, animation: `bounce 1.2s ease-in-out ${i * 0.15}s infinite` }} />
        ))}
      </div>
    </div>
  );
}

// ─── Main App ────────────────────────────────────────────────────────
export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [error, setError] = useState(null);
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, 50);
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, loading, scrollToBottom]);

  const sendMessage = async () => {
    const q = input.trim();
    if (!q || loading) return;

    setError(null);
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: q }]);
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, session_id: sessionId }),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);

      const data = await res.json();
      setSessionId(data.session_id);
      setMessages(prev => [...prev, { role: "assistant", content: data.answer, debug: data.debug }]);
    } catch (err) {
      setError(err.message || "Failed to connect to the server");
      setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I couldn't reach the server. Please check that the backend is running.", debug: null }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } };
  const handleNewChat = () => { setMessages([]); setSessionId(null); setError(null); };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=DM+Mono:wght@400;500&family=Sora:wght@600;700;800&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: ${T.bg}; font-family: 'DM Sans', sans-serif; color: ${T.text}; overflow: hidden; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: ${T.borderHi}; }
        @keyframes msgIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes debugSlide { from { opacity: 0; max-height: 0; } to { opacity: 1; max-height: 600px; } }
        @keyframes bounce { 0%, 80%, 100% { transform: translateY(0); } 40% { transform: translateY(-8px); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes pulseGlow { 0%, 100% { box-shadow: 0 0 0 0 rgba(232,114,42,0.3); } 50% { box-shadow: 0 0 0 6px rgba(232,114,42,0); } }
        textarea:focus { outline: none; }
      `}</style>

      <div style={{
        height: "100vh", display: "flex", flexDirection: "column", position: "relative",
        background: `radial-gradient(ellipse at 20% 0%, ${T.orangeDim} 0%, transparent 50%), radial-gradient(ellipse at 80% 100%, ${T.blueDim} 0%, transparent 50%), ${T.bg}`,
      }}>
        {/* Header */}
        <header style={{
          padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between",
          borderBottom: `1px solid ${T.border}`, background: `${T.surface}e6`, backdropFilter: "blur(12px)", position: "relative", zIndex: 10,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <SmartLogLogo />
            <div>
              <h1 style={{ fontSize: "18px", fontFamily: "'Sora', sans-serif", fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1 }}>
                <span style={{ color: T.orange }}>Smart</span><span style={{ color: T.text }}>Log</span>
                <span style={{ color: T.blue, fontSize: "12px", fontWeight: 600, marginLeft: "8px", fontFamily: "'DM Mono', monospace", letterSpacing: "0.05em" }}>COPILOT</span>
              </h1>
              <p style={{ fontSize: "11px", color: T.textMuted, marginTop: "2px", letterSpacing: "0.03em" }}>Maritime intelligence assistant</p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {sessionId && (
              <span style={{ fontSize: "10px", fontFamily: "'DM Mono', monospace", color: T.textMuted, background: T.surfaceAlt, padding: "4px 8px", borderRadius: "4px" }}>
                session: {sessionId.slice(0, 8)}…
              </span>
            )}
            <button onClick={handleNewChat} style={{
              padding: "7px 14px", fontSize: "12px", fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
              color: T.textDim, background: T.surfaceAlt, border: `1px solid ${T.border}`, borderRadius: "8px", cursor: "pointer", transition: "all 0.2s ease",
            }}
              onMouseEnter={e => { e.currentTarget.style.color = T.text; e.currentTarget.style.borderColor = T.borderHi; }}
              onMouseLeave={e => { e.currentTarget.style.color = T.textDim; e.currentTarget.style.borderColor = T.border; }}
            >+ New Chat</button>
          </div>
        </header>

        {/* Chat area */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px", position: "relative" }}>
          {messages.length === 0 && !loading && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", animation: "fadeIn 0.5s ease", textAlign: "center", padding: "40px" }}>
              <div style={{ width: "72px", height: "72px", borderRadius: "20px", background: `linear-gradient(135deg, ${T.orange}, ${T.blue})`,
                display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "20px", boxShadow: `0 8px 32px ${T.orangeGlow}` }}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M12 3C6.5 3 2 6.58 2 11c0 2.13 1.07 4.05 2.78 5.43L3 21l4.35-2.17C8.55 19.27 10.22 19.5 12 19.5c5.5 0 10-3.58 10-8S17.5 3 12 3z" />
                </svg>
              </div>
              <h2 style={{ fontFamily: "'Sora', sans-serif", fontSize: "22px", fontWeight: 700, marginBottom: "8px", letterSpacing: "-0.02em" }}>
                Ask <span style={{ color: T.orange }}>Smart</span>Log anything
              </h2>
              <p style={{ color: T.textMuted, fontSize: "14px", maxWidth: "380px", lineHeight: "1.6" }}>
                Query maritime reports, vessel data, and operational insights. Each answer includes a debug panel so you can inspect retrieved context.
              </p>
              <div style={{ display: "flex", gap: "8px", marginTop: "24px", flexWrap: "wrap", justifyContent: "center" }}>
                {["What is the vessel's last port of call?", "Summarize the cargo inspection report", "Any safety incidents reported?"].map((hint, i) => (
                  <button key={i} onClick={() => { setInput(hint); inputRef.current?.focus(); }} style={{
                    padding: "8px 14px", fontSize: "12px", color: T.textDim, background: T.surface,
                    border: `1px solid ${T.border}`, borderRadius: "20px", cursor: "pointer", transition: "all 0.2s ease", fontFamily: "'DM Sans', sans-serif",
                  }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = T.orange + "60"; e.currentTarget.style.color = T.orange; e.currentTarget.style.background = T.orangeDim; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textDim; e.currentTarget.style.background = T.surface; }}
                  >{hint}</button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (<ChatMessage key={i} message={msg} isLast={i === messages.length - 1} />))}
          {loading && <TypingIndicator />}
          <div ref={chatEndRef} />
          <WavesBg />
        </div>

        {/* Error banner */}
        {error && (
          <div style={{ padding: "8px 24px", background: "rgba(239,68,68,0.1)", borderTop: "1px solid rgba(239,68,68,0.2)", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "12px", color: T.danger }}>Connection error: {error}</span>
            <button onClick={() => setError(null)} style={{ background: "none", border: "none", color: T.danger, cursor: "pointer", fontSize: "16px", lineHeight: 1 }}>×</button>
          </div>
        )}

        {/* Input */}
        <div style={{ padding: "16px 24px 20px", borderTop: `1px solid ${T.border}`, background: `${T.surface}e6`, backdropFilter: "blur(12px)", position: "relative", zIndex: 10 }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: "10px", background: T.surfaceAlt, border: `1px solid ${T.border}`, borderRadius: "14px", padding: "4px 4px 4px 16px", transition: "border-color 0.2s ease" }}
            onFocus={e => e.currentTarget.style.borderColor = T.orange + "60"}
            onBlur={e => e.currentTarget.style.borderColor = T.border}
          >
            <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
              placeholder="Ask a question about maritime reports..." rows={1}
              style={{ flex: 1, border: "none", background: "transparent", color: T.text, fontSize: "14px",
                fontFamily: "'DM Sans', sans-serif", resize: "none", padding: "10px 0", lineHeight: "1.5", maxHeight: "120px", overflowY: "auto" }}
              onInput={e => { e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; }}
            />
            <button onClick={sendMessage} disabled={!input.trim() || loading} style={{
              width: "40px", height: "40px", display: "flex", alignItems: "center", justifyContent: "center",
              border: "none", borderRadius: "10px", cursor: input.trim() && !loading ? "pointer" : "default",
              background: input.trim() && !loading ? `linear-gradient(135deg, ${T.orange}, #d4621f)` : T.border,
              color: input.trim() && !loading ? "#fff" : T.textMuted, transition: "all 0.2s ease", flexShrink: 0,
              animation: input.trim() && !loading ? "pulseGlow 2s ease-in-out infinite" : "none",
            }}>
              <SendIcon />
            </button>
          </div>
          <p style={{ textAlign: "center", fontSize: "10px", color: T.textMuted, marginTop: "8px", letterSpacing: "0.03em" }}>
            SmartLog Copilot may produce inaccurate information. Verify critical data.
          </p>
        </div>
      </div>
    </>
  );
}
