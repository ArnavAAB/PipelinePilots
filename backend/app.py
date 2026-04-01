from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import zipfile
import io
import os
from openai import OpenAI  # ✅ NVIDIA-compatible OpenAI SDK

app = Flask(__name__)

# -----------------------------
# FIXED CORS
# -----------------------------
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

# -----------------------------
# NVIDIA API SETUP
# -----------------------------
NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY")
NVIDIA_BASE_URL = os.getenv("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1")  # replace with your endpoint

if not NVIDIA_API_KEY:
    raise ValueError("Please set NVIDIA_API_KEY in environment variables.")

# OpenAI-compatible NVIDIA client
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
# Fetch logs (ZIP from GitHub)
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

        # Keywords to IGNORE (The "Noise")
        ignore_keywords = [
            "downloading", "extracting", "waiting", "preparing", 
            "post-job", "cleaning up", "setup", "cache"
        ]

        for file in z.namelist():
            # Skip hidden files or metadata in the zip
            if file.startswith('.') or '/' in file:
                continue
                
            raw_content = z.read(file).decode("utf-8", errors="ignore")
            lines = raw_content.splitlines()
            
            cleaned_lines = []
            for line in lines:
                # 1. Strip the leading timestamp (usually 30 characters like '2026-04-01T...')
                # This saves massive token space
                if len(line) > 30 and line[10] == 'T':
                    line = line[30:]

                # 2. Filter out noisy progress lines
                if not any(key in line.lower() for key in ignore_keywords):
                    cleaned_lines.append(line.strip())

            if cleaned_lines:
                all_logs.append(f"--- File: {file} ---\n" + "\n".join(cleaned_lines))

        # Join everything back together
        full_text = "\n".join(all_logs)

        # 3. TAIL SELECTION: Take the last 7,000 characters. 
        # Most errors happen at the end of the log.
        if len(full_text) > 7000:
            full_text = "...(earlier logs omitted)...\n" + full_text[-7000:]

        return jsonify({"logs": full_text})

    except Exception as e:
        return jsonify({"error": str(e)}), 500
# -----------------------------
# Analyze logs using NVIDIA API 🔥
# -----------------------------
@app.route("/analyze", methods=["POST"])
def analyze():
    try:
        data = request.get_json(force=True)
        if not data or "logs" not in data:
            return jsonify({"error": "Missing 'logs' in request body"}), 400

        logs = data["logs"]

        prompt = f"""
You are a senior DevOps engineer. Analyze the following CI/CD log and do ALL of these:

1. Identify any errors, warnings, or anomalies — even subtle ones
2. If no explicit error exists, look for missing steps, unexpected silences, slow durations, incomplete sequences, or config issues
3. State your confidence level (high / medium / low)
4. If the log appears truncated or incomplete, say so explicitly
5. Give a concrete fix for each finding

If nothing is wrong, say "No issues found" and explain why the log looks healthy.

LOG:
{logs}
"""

        response = client.chat.completions.create(
            model="meta/llama3-8b-instruct",  # ✅ Replace with your NVIDIA model
            messages=[
                {"role": "system", "content": "You are a helpful DevOps assistant."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3
        )

        return jsonify({"analysis": response.choices[0].message.content})

    except Exception as e:
        print("Error in analyze:", e)
        return jsonify({"error": str(e)}), 500

# -----------------------------
# Run app
# -----------------------------
if __name__ == "__main__":
    app.run(debug=True)