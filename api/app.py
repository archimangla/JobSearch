import os
import json
import requests
from http.server import BaseHTTPRequestHandler

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"

class handler(BaseHTTPRequestHandler):

    def do_OPTIONS(self):
        self.send_response(200)
        self._set_cors()
        self.end_headers()

    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)

        if not ANTHROPIC_API_KEY:
            self._respond(500, {"error": {"message": "ANTHROPIC_API_KEY not set in environment variables."}})
            return

        try:
            payload = json.loads(body)
            resp = requests.post(
                ANTHROPIC_URL,
                headers={
                    "Content-Type": "application/json",
                    "x-api-key": ANTHROPIC_API_KEY,
                    "anthropic-version": "2023-06-01",
                    "anthropic-beta": "pdfs-2024-09-25",
                },
                json=payload,
                timeout=60,
            )
            self._respond(resp.status_code, resp.json())
        except Exception as e:
            self._respond(500, {"error": {"message": str(e)}})

    def _set_cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _respond(self, status, data):
        self.send_response(status)
        self._set_cors()
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def log_message(self, format, *args):
        pass