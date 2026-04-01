import { useState } from "react";
import axios from "axios";

function App() {
  const [repoUrl, setRepoUrl] = useState("");
  const [token, setToken] = useState("");
  const [runs, setRuns] = useState([]);
  const [selectedRun, setSelectedRun] = useState("");
  const [logs, setLogs] = useState("");
  const [analysis, setAnalysis] = useState("");

  const BASE_URL = "http://127.0.0.1:5000";

  // -----------------------------
  // Fetch pipelines
  // -----------------------------
  const fetchPipelines = async () => {
    try {
      const res = await axios.post(`${BASE_URL}/pipelines`, {
        repo_url: repoUrl,
        token,
      });

      setRuns(res.data.workflow_runs || []);
    } catch (err) {
      console.error(err);
    }
  };

  // -----------------------------
  // Fetch logs
  // -----------------------------
  const fetchLogs = async () => {
    try {
      const repo = repoUrl.split("/").slice(-2).join("/");

      const res = await axios.post(`${BASE_URL}/logs`, {
        repo,
        run_id: selectedRun,
        token,
      });

      setLogs(res.data.logs);
    } catch (err) {
      console.error(err);
    }
  };

  // -----------------------------
  // Analyze logs
  // -----------------------------
  const analyzeLogs = async () => {
    try {
      const res = await axios.post(`${BASE_URL}/analyze`, {
        logs,
      });

      setAnalysis(res.data.analysis);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div style={{ textAlign: "center", marginTop: "50px" }}>
      <h1>DevOps AI Agent 🚀</h1>

      <input
        placeholder="GitHub Repo URL"
        value={repoUrl}
        onChange={(e) => setRepoUrl(e.target.value)}
      />
      <br /><br />

      <input
        placeholder="GitHub Token"
        value={token}
        onChange={(e) => setToken(e.target.value)}
      />
      <br /><br />

      <button onClick={fetchPipelines}>Fetch Pipelines</button>

      <h3>Pipelines</h3>
      <select onChange={(e) => setSelectedRun(e.target.value)}>
        <option>Select Run</option>
        {runs.map((run) => (
          <option key={run.id} value={run.id}>
            {run.id} - {run.status}
          </option>
        ))}
      </select>

      <br /><br />
      <button onClick={fetchLogs}>Get Logs</button>

      <h3>Logs</h3>
      <textarea rows="10" cols="80" value={logs} readOnly />

      <br /><br />
      <button onClick={analyzeLogs}>Analyze</button>

      <h3>Analysis</h3>
      <textarea rows="10" cols="80" value={analysis} readOnly />
    </div>
  );
}

export default App;