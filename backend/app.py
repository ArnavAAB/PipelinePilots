from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import boto3
import json
import zipfile
import io

app = Flask(__name__)

# ✅ FIXED CORS
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

# ✅ Bedrock client (Claude)
client = boto3.client("bedrock-runtime", region_name="us-east-1")


# -----------------------------
# Claude Analysis Function
# -----------------------------
def analyze_logs_with_claude(logs):
    try:
        prompt = f"""
You are a DevOps expert.

Analyze the following CI/CD logs and answer:

1. What failed?
2. Why did it fail?
3. How to fix it?

Logs:
{logs}
"""

        body = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 500,
            "messages": [
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        }

        response = client.invoke_model(
            modelId="anthropic.claude-3-sonnet-20240229-v1:0",  # ✅ WORKING MODEL
            body=json.dumps(body)
        )

        result = json.loads(response["body"].read())
        return result["content"][0]["text"]

    except Exception as e:
        return f"Error from Bedrock: {str(e)}"


# -----------------------------
# Helper: Extract repo
# -----------------------------
def extract_repo(url):
    parts = url.split("/")
    return f"{parts[3]}/{parts[4]}"


# -----------------------------
# Fetch pipelines
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

        return jsonify(res.json())

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# -----------------------------
# Fetch logs (FIXED ZIP ISSUE)
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

        # ✅ GitHub returns ZIP → extract it
        z = zipfile.ZipFile(io.BytesIO(res.content))

        all_logs = ""

        for file in z.namelist():
            all_logs += f"\n--- {file} ---\n"
            all_logs += z.read(file).decode("utf-8", errors="ignore")

        return jsonify({"logs": all_logs[:5000]})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# -----------------------------
# Analyze logs using Claude
# -----------------------------
@app.route("/analyze", methods=["POST"])
def analyze():
    try:
        logs = request.json["logs"]
        result = analyze_logs_with_claude(logs)

        return jsonify({"analysis": result})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# -----------------------------
# Run app
# -----------------------------
if __name__ == "__main__":
    app.run(debug=True)