from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import zipfile
import io
import os
from openai import OpenAI  # NVIDIA-compatible OpenAI SDK

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

# -----------------------------
# NVIDIA API SETUP
# -----------------------------
NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY")
NVIDIA_BASE_URL = os.getenv("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1")

if not NVIDIA_API_KEY:
    raise ValueError("Please set NVIDIA_API_KEY in environment variables.")

client = OpenAI(api_key=NVIDIA_API_KEY, base_url=NVIDIA_BASE_URL)

# -----------------------------
# Helper: Extract repo from URL
# -----------------------------
def extract_repo(url):
    parts = url.split("/")
    if len(parts) < 5:
        raise ValueError("Invalid GitHub URL")
    return f"{parts[3]}/{parts[4]}"

# -----------------------------
# Fetch GitHub pipelines
# -----------------------------
@app.route("/pipelines", methods=["POST"])
def pipelines():
    try:
        data = request.json
        repo = extract_repo(data["repo_url"])
        token = data["token"]

        url = f"https://api.github.com/repos/{repo}/actions/runs"
        headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json"
        }

        res = requests.get(url, headers=headers)
        res.raise_for_status()
        return jsonify(res.json())
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# -----------------------------
# Fetch logs (single string for frontend)
# -----------------------------
@app.route("/logs", methods=["POST"])
def logs():
    try:
        data = request.json
        repo = data["repo"]
        run_id = data["run_id"]
        token = data["token"]

        url = f"https://api.github.com/repos/{repo}/actions/runs/{run_id}/logs"
        headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json"
        }

        res = requests.get(url, headers=headers)
        res.raise_for_status()
        z = zipfile.ZipFile(io.BytesIO(res.content))
        all_logs = []

        ignore_keywords = [
            "downloading", "extracting", "waiting", "preparing",
            "post-job", "cleaning up", "setup", "cache"
        ]

        for file in z.namelist():
            if file.startswith('.') or '/' in file:
                continue
            raw_content = z.read(file).decode("utf-8", errors="ignore")
            lines = raw_content.splitlines()
            cleaned_lines = []

            for line in lines:
                if len(line) > 30 and line[10] == 'T':
                    line = line[30:]
                if not any(key in line.lower() for key in ignore_keywords):
                    cleaned_lines.append(line.strip())

            if cleaned_lines:
                all_logs.append(f"--- File: {file} ---\n" + "\n".join(cleaned_lines))

        full_text = "\n".join(all_logs)

        # Optional: truncate if too large for frontend
        if len(full_text) > 2000000:
            full_text = "...(earlier logs omitted)...\n" + full_text[-2000000:]

        # Return as a single string (frontend safe)
        return jsonify({"logs": full_text})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# -----------------------------
# Analyze logs using NVIDIA API (chunked internally)
# -----------------------------
@app.route("/analyze", methods=["POST"])
def analyze():
    try:
        data = request.get_json(force=True)
        if not data or "logs" not in data:
            return jsonify({"error": "Missing 'logs' in request body"}), 400

        full_logs = data["logs"]
        chunk_size = 7000
        chunks = [full_logs[i:i + chunk_size] for i in range(0, len(full_logs), chunk_size)]
        results = []

        for idx, chunk in enumerate(chunks):
            prompt = f"""
You are a senior DevOps engineer. Analyze this section of CI/CD logs:

1. Identify errors, warnings, anomalies
2. Look for missing steps, unexpected silences, slow durations
3. State confidence level (high/medium/low)
4. Suggest concrete fixes

LOG SECTION:
{chunk}
"""
            response = client.chat.completions.create(
                model="meta/llama3-8b-instruct",
                messages=[
                    {"role": "system", "content": "You are a helpful DevOps assistant."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3
            )

            results.append(response.choices[0].message.content)

        # Join results into a single string for frontend
        final_analysis = "\n\n--- NEXT CHUNK ---\n\n".join(results)
        return jsonify({"analysis": final_analysis})

    except Exception as e:
        print("Error in analyze:", e)
        return jsonify({"error": str(e)}), 500

# -----------------------------
# Run app
# -----------------------------
if __name__ == "__main__":
    app.run(debug=True)