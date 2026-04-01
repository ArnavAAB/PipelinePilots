from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import json
import zipfile
import io
import os
from groq import Groq   # ✅ NEW

app = Flask(__name__)

# -----------------------------
# FIXED CORS
# -----------------------------
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

# -----------------------------
# GROQ API SETUP
# -----------------------------
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

if not GROQ_API_KEY:
    raise ValueError("Please set GROQ_API_KEY in environment variables.")

client = Groq(api_key=GROQ_API_KEY)

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

        all_logs = ""
        for file in z.namelist():
            all_logs += f"\n--- {file} ---\n"
            all_logs += z.read(file).decode("utf-8", errors="ignore")

        return jsonify({"logs": all_logs[:5000]})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# -----------------------------
# Analyze logs using GROQ 🔥
# -----------------------------
@app.route("/analyze", methods=["POST"])
def analyze():
    try:
        data = request.get_json(force=True)  # ✅ force=True handles missing Content-Type
        if not data or "logs" not in data:
            return jsonify({"error": "Missing 'logs' in request body"}), 400

        logs = data["logs"]

        prompt = f"""
You are a senior DevOps engineer. Analyze the following CI/CD log and do ALL of these:

1. Identify any errors, warnings, or anomalies — even subtle ones
2. If no explicit error exists, look for: missing steps, unexpected silences, slow durations, incomplete sequences, or config issues
3. State your confidence level (high / medium / low)
4. If the log appears truncated or incomplete, say so explicitly
5. Give a concrete fix for each finding — not generic advice

If nothing is wrong, say "No issues found" and explain why the log looks healthy.

LOG:
{logs}
"""

        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "You are a helpful DevOps assistant."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3
        )
        return jsonify({"analysis": response.choices[0].message.content})  # ✅ fixed

    except Exception as e:
        print("Error in analyze:", e)  # check your terminal for the exact error
        return jsonify({"error": str(e)}), 500
# -----------------------------
# Run app
# -----------------------------
if __name__ == "__main__":
    app.run(debug=True)