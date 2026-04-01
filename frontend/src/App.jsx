import { useState, useRef, useEffect } from "react";
import axios from "axios";

const BASE_URL = "http://127.0.0.1:5000";

/* ── Inline styles as JS objects ── */
const S = {
  root: {
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    background: "#0d0f14",
    color: "#e8ecf8",
    minHeight: "100vh",
    display: "grid",
    gridTemplateRows: "auto 1fr",
  },
  topbar: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "14px 24px",
    borderBottom: "0.5px solid rgba(100,120,200,0.18)",
    background: "#151820",
  },
  logoBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    background: "linear-gradient(135deg,#4f8ef7,#7c6af7)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 16,
    flexShrink: 0,
  },
  logoText: { fontSize: 15, fontWeight: 700, letterSpacing: "0.03em", fontFamily: "'Syne','Segoe UI',sans-serif" },
  statusLabel: { fontSize: 11, color: "#7a85a8", marginLeft: "auto", letterSpacing: "0.12em" },
  main: { display: "grid", gridTemplateColumns: "300px 1fr", minHeight: 0, overflow: "hidden" },
  sidebar: {
    background: "#151820",
    borderRight: "0.5px solid rgba(100,120,200,0.18)",
    padding: 20,
    display: "flex",
    flexDirection: "column",
    gap: 16,
    overflowY: "auto",
  },
  fieldLabel: {
    fontSize: 10,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "#7a85a8",
    marginBottom: 5,
    fontWeight: 500,
  },
  input: {
    background: "#1c2130",
    border: "0.5px solid rgba(100,120,200,0.28)",
    borderRadius: 8,
    padding: "9px 12px",
    color: "#e8ecf8",
    fontSize: 13,
    fontFamily: "inherit",
    width: "100%",
    outline: "none",
    boxSizing: "border-box",
  },
  divider: { height: "0.5px", background: "rgba(100,120,200,0.15)" },
  content: { display: "grid", gridTemplateRows: "1fr 1fr", minHeight: 0, overflow: "hidden" },
  panel: { display: "flex", flexDirection: "column", minHeight: 0, borderBottom: "0.5px solid rgba(100,120,200,0.15)" },
  panelHeader: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 20px",
    borderBottom: "0.5px solid rgba(100,120,200,0.15)",
    background: "#151820",
    flexShrink: 0,
  },
  panelTitle: { fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "#7a85a8", fontWeight: 600, flex: 1 },
  panelBadge: {
    fontSize: 10,
    padding: "2px 8px",
    borderRadius: 4,
    background: "#1c2130",
    color: "#7a85a8",
    border: "0.5px solid rgba(100,120,200,0.2)",
  },
  panelBody: {
    flex: 1,
    overflowY: "auto",
    overflowX: "hidden",
    padding: "14px 20px",
    fontSize: 12,
    lineHeight: 1.75,
    color: "#b0bcd8",
    maxHeight: 280,
    minHeight: 0,
  },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    color: "#3a4060",
    gap: 8,
    fontSize: 12,
  },
};

/* ── Tiny UI primitives ── */
function Pulsedot({ color = "#34d27b" }) {
  return (
    <div style={{
      width: 8, height: 8, borderRadius: "50%",
      background: color, flexShrink: 0,
      boxShadow: `0 0 6px ${color}`,
      animation: "devops-pulse 2s infinite",
    }} />
  );
}

function Btn({ children, variant = "primary", disabled, onClick, style }) {
  const base = {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    padding: "9px 14px", borderRadius: 8, fontSize: 13,
    fontFamily: "'Syne','Segoe UI',sans-serif", fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
    border: "none", transition: "all 0.12s", opacity: disabled ? 0.45 : 1,
    letterSpacing: "0.02em", width: "100%",
  };
  const variants = {
    primary: { background: "#4f8ef7", color: "#fff" },
    ghost: { background: "#1c2130", color: "#e8ecf8", border: "0.5px solid rgba(100,120,200,0.28)" },
    danger: { background: "rgba(244,95,95,0.15)", color: "#f45f5f", border: "0.5px solid rgba(244,95,95,0.3)" },
  };
  return (
    <button style={{ ...base, ...variants[variant], ...style }} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}

function RunCard({ run, active, onClick }) {
  const dotColor = run.status === "success" ? "#34d27b" : run.status === "failure" ? "#f45f5f" : run.status === "in_progress" ? "#f4a732" : "#7a85a8";
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "9px 12px", borderRadius: 8, cursor: "pointer",
        background: active ? "rgba(79,142,247,0.08)" : "#1c2130",
        border: `0.5px solid ${active ? "#4f8ef7" : "rgba(100,120,200,0.2)"}`,
        transition: "all 0.12s", fontSize: 12,
      }}
    >
      <div style={{
        width: 8, height: 8, borderRadius: "50%", background: dotColor, flexShrink: 0,
        boxShadow: run.status === "in_progress" ? `0 0 6px ${dotColor}` : "none",
      }} />
      <span style={{ color: "#4f8ef7", flex: 1, fontWeight: 500 }}>#{run.id}</span>
      <span style={{ color: "#7a85a8", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>{run.status}</span>
    </div>
  );
}

function LogLine({ text, num }) {
  const ll = text.toLowerCase();
  const color =
    ll.includes("error") || ll.includes("fatal") || ll.includes("fail") ? "#f45f5f"
    : ll.includes("warn") ? "#f4a732"
    : ll.includes("success") || ll.includes("passed") || ll.includes("✓") || ll.includes("done") ? "#34d27b"
    : "#b0bcd8";
  return (
    <div style={{ display: "flex", gap: 12 }}>
      <span style={{ color: "#3a4060", minWidth: 28, textAlign: "right", flexShrink: 0, userSelect: "none" }}>{num}</span>
      <span style={{ color, flex: 1, wordBreak: "break-word" }}>{text}</span>
    </div>
  );
}

function Spinner() {
  return (
    <div style={{
      width: 16, height: 16, borderRadius: "50%",
      border: "2px solid rgba(100,120,200,0.2)",
      borderTopColor: "#4f8ef7",
      animation: "devops-spin 0.7s linear infinite",
      flexShrink: 0,
    }} />
  );
}

function LoadingRow({ text }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#7a85a8", fontSize: 12, padding: "8px 0" }}>
      <Spinner />
      <span>{text}</span>
    </div>
  );
}

/* ── Main App ── */
export default function App() {
  const [repoUrl, setRepoUrl] = useState("");
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [runs, setRuns] = useState([]);
  const [selectedRun, setSelectedRun] = useState(null);
  const [logs, setLogs] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [loading, setLoading] = useState({ pipelines: false, logs: false, analyze: false });
  const [statusLabel, setStatusLabel] = useState("IDLE");
  const [error, setError] = useState({});
  const logsRef = useRef(null);

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Syne:wght@400;600;700&display=swap');
      @keyframes devops-spin { to { transform: rotate(360deg); } }
      @keyframes devops-pulse { 0%,100%{opacity:1} 50%{opacity:0.35} }
      ::-webkit-scrollbar { width: 4px; height: 4px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: #232940; border-radius: 2px; }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  const busy = loading.pipelines || loading.logs || loading.analyze;
  const dotColor = busy ? "#f4a732" : error.global ? "#f45f5f" : "#34d27b";

  /* ── API calls ── */
  async function fetchPipelines() {
    if (!repoUrl.trim()) return;
    setLoading(l => ({ ...l, pipelines: true }));
    setStatusLabel("FETCHING...");
    setError({});
    try {
      const res = await axios.post(`${BASE_URL}/pipelines`, { repo_url: repoUrl, token });
      setRuns(res.data.workflow_runs || []);
      setStatusLabel("READY");
    } catch (e) {
      setError({ pipelines: e.message });
      setStatusLabel("ERROR");
    }
    setLoading(l => ({ ...l, pipelines: false }));
  }

  async function fetchLogs() {
    if (!selectedRun) return;
    const repo = repoUrl.split("/").slice(-2).join("/");
    setLoading(l => ({ ...l, logs: true }));
    setStatusLabel("LOADING LOGS...");
    setLogs("");
    setAnalysis("");
    setError({});
    try {
      const res = await axios.post(`${BASE_URL}/logs`, { repo, run_id: selectedRun, token });
      setLogs(res.data.logs || "");
      setStatusLabel("READY");
    } catch (e) {
      setError({ logs: e.message });
      setStatusLabel("ERROR");
    }
    setLoading(l => ({ ...l, logs: false }));
  }

  async function analyzeLogs() {
    if (!logs) return;
    setLoading(l => ({ ...l, analyze: true }));
    setStatusLabel("ANALYZING...");
    setAnalysis("");
    setError({});
    try {
      const res = await axios.post(`${BASE_URL}/analyze`, { logs });
      setAnalysis(res.data.analysis || "");
      setStatusLabel("DONE");
    } catch (e) {
      setError({ analyze: e.message });
      setStatusLabel("ERROR");
    }
    setLoading(l => ({ ...l, analyze: false }));
  }

  function copyLogs() {
    if (logs) navigator.clipboard.writeText(logs).catch(() => {});
  }

  const logLines = logs ? logs.split("\n") : [];
  const analysisBlocks = analysis
    ? analysis.split(/\n{2,}/).filter(Boolean).map(sec => {
        const lines = sec.trim().split("\n");
        if (lines.length > 1) {
          return { head: lines[0].replace(/^#+\s*/, "").replace(/[:\-]+$/, "").trim(), body: lines.slice(1).join("\n").trim() };
        }
        return { head: null, body: sec.trim() };
      })
    : [];

  return (
    <div style={S.root}>
      {/* Topbar */}
      <div style={S.topbar}>
        <div style={S.logoBox}>🚀</div>
        <span style={S.logoText}>DevOps AI Agent</span>
        <Pulsedot color={dotColor} />
        <span style={S.statusLabel}>{statusLabel}</span>
      </div>

      <div style={S.main}>
        {/* Sidebar */}
        <div style={S.sidebar}>
          <div>
            <div style={S.fieldLabel}>Repository URL</div>
            <input
              style={S.input}
              type="text"
              placeholder="https://github.com/org/repo"
              value={repoUrl}
              onChange={e => setRepoUrl(e.target.value)}
              onKeyDown={e => e.key === "Enter" && fetchPipelines()}
            />
          </div>

          <div>
            <div style={S.fieldLabel}>GitHub Token</div>
            <div style={{ position: "relative" }}>
              <input
                style={{ ...S.input, paddingRight: 44 }}
                type={showToken ? "text" : "password"}
                placeholder="ghp_xxxxxxxxxxxx"
                value={token}
                onChange={e => setToken(e.target.value)}
              />
              <button
                onClick={() => setShowToken(v => !v)}
                style={{
                  position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer", color: "#7a85a8",
                  fontSize: 11, fontFamily: "inherit", padding: 4,
                }}
              >
                {showToken ? "hide" : "show"}
              </button>
            </div>
          </div>

          <Btn onClick={fetchPipelines} disabled={loading.pipelines || !repoUrl.trim()}>
            {loading.pipelines ? <Spinner /> : <span>⟳</span>}
            Fetch Pipelines
          </Btn>

          {error.pipelines && <div style={{ fontSize: 11, color: "#f45f5f" }}>{error.pipelines}</div>}

          <div style={S.divider} />

          <div>
            <div style={S.fieldLabel}>Workflow Runs</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
              {loading.pipelines ? (
                <LoadingRow text="fetching pipelines..." />
              ) : runs.length === 0 ? (
                <div style={{ color: "#3a4060", fontSize: 11, padding: "8px 0" }}>no runs loaded</div>
              ) : (
                runs.map(run => (
                  <RunCard
                    key={run.id}
                    run={run}
                    active={selectedRun === run.id}
                    onClick={() => setSelectedRun(run.id)}
                  />
                ))
              )}
            </div>
          </div>

          <Btn variant="ghost" onClick={fetchLogs} disabled={!selectedRun || loading.logs}>
            {loading.logs ? <Spinner /> : <span>☰</span>}
            Get Logs
          </Btn>

          <div style={S.divider} />

          <Btn variant="danger" onClick={analyzeLogs} disabled={!logs || loading.analyze}>
            {loading.analyze ? <Spinner /> : <span>✦</span>}
            Analyze with AI
          </Btn>

          {error.analyze && <div style={{ fontSize: 11, color: "#f45f5f" }}>{error.analyze}</div>}
        </div>

        {/* Content panels */}
        <div style={S.content}>
          {/* Logs panel */}
          <div style={S.panel}>
            <div style={S.panelHeader}>
              <span style={S.panelTitle}>Logs</span>
              {logLines.length > 0 && (
                <span style={S.panelBadge}>{logLines.length} lines</span>
              )}
              <button
                onClick={copyLogs}
                disabled={!logs}
                style={{
                  background: "none", border: "0.5px solid rgba(100,120,200,0.2)",
                  borderRadius: 6, color: "#7a85a8", cursor: logs ? "pointer" : "not-allowed",
                  fontSize: 11, padding: "3px 10px", fontFamily: "inherit",
                  opacity: logs ? 1 : 0.4,
                }}
              >
                copy
              </button>
            </div>
            <div style={S.panelBody} ref={logsRef}>
              {loading.logs ? (
                <LoadingRow text="streaming logs..." />
              ) : error.logs ? (
                <div style={{ color: "#f45f5f", fontSize: 12 }}>{error.logs}</div>
              ) : logLines.length > 0 ? (
                logLines.map((line, i) => <LogLine key={i} text={line} num={i + 1} />)
              ) : (
                <div style={S.emptyState}>
                  <span style={{ fontSize: 28 }}>📋</span>
                  <span>Select a run and fetch logs</span>
                </div>
              )}
            </div>
          </div>

          {/* Analysis panel */}
          <div style={{ ...S.panel, borderBottom: "none" }}>
            <div style={S.panelHeader}>
              <span style={S.panelTitle}>AI Analysis</span>
              {analysis && <span style={{ ...S.panelBadge, color: "#34d27b", borderColor: "rgba(52,210,123,0.3)", background: "rgba(52,210,123,0.08)" }}>complete</span>}
              {loading.analyze && <span style={S.panelBadge}>running...</span>}
            </div>
            <div style={S.panelBody}>
              {loading.analyze ? (
                <LoadingRow text="AI is analyzing your logs..." />
              ) : error.analyze ? (
                <div style={{ color: "#f45f5f", fontSize: 12 }}>{error.analyze}</div>
              ) : analysisBlocks.length > 0 ? (
                analysisBlocks.map((block, i) => (
                  <div
                    key={i}
                    style={{
                      marginBottom: 16, paddingBottom: 16,
                      borderBottom: i < analysisBlocks.length - 1 ? "0.5px solid rgba(100,120,200,0.15)" : "none",
                    }}
                  >
                    {block.head && (
                      <div style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "#7c6af7", marginBottom: 7, fontWeight: 600 }}>
                        {block.head}
                      </div>
                    )}
                    <div style={{ fontSize: 12, lineHeight: 1.75, color: "#b0bcd8", whiteSpace: "pre-wrap" }}>
                      {block.body}
                    </div>
                  </div>
                ))
              ) : (
                <div style={S.emptyState}>
                  <span style={{ fontSize: 28 }}>🤖</span>
                  <span>Fetch logs, then click Analyze</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}