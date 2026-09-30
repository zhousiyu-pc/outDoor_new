#!/usr/bin/env python3
"""Internal Agent HTTP contract. No external provider or database is configured."""
from __future__ import annotations

import hmac
import json
import os
import socket
import uuid
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from candidates import now_iso, recommend
from contracts import ContractError, normalize_request

SERVICE_NAME = "phase-one-agent-python"
MAX_BODY_BYTES = 65536


@dataclass(frozen=True)
class Settings:
    environment: str = "development"
    internal_token: str = ""
    demo_mode: bool = False
    deadline_ms: int = 1000
    read_timeout_seconds: float = 5

    def __post_init__(self) -> None:
        if self.environment.lower() in ("production", "prod"):
            if not self.internal_token.strip():
                raise ValueError("AGENT_INTERNAL_TOKEN is required in production")
            if self.demo_mode:
                raise ValueError("AGENT_DEMO_MODE is prohibited in production")
        if type(self.deadline_ms) is not int or not 1 <= self.deadline_ms <= 10000:
            raise ValueError("AGENT_DEADLINE_MS must be an integer from 1 to 10000")
        if not 0 < self.read_timeout_seconds <= 30:
            raise ValueError("read timeout must be finite and at most 30 seconds")

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(environment=os.environ.get("APP_ENV", "development"),
                   internal_token=os.environ.get("AGENT_INTERNAL_TOKEN", ""),
                   demo_mode=os.environ.get("AGENT_DEMO_MODE", "false").lower() == "true",
                   deadline_ms=int(os.environ.get("AGENT_DEADLINE_MS", "1000")))


def reject_constant(value: str) -> None:
    raise ValueError("non-finite JSON number")


def reject_duplicate_keys(pairs: list[tuple]) -> dict:
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("duplicate JSON member")
        result[key] = value
    return result


class AgentServer(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, address: tuple, settings: Settings, connectors: tuple = ()):
        self.settings = settings
        self.connectors = tuple(connectors)
        super().__init__(address, Handler)

    def handle_error(self, request, client_address) -> None:
        # Never print a traceback containing provider requests or credentials.
        print(f"[{SERVICE_NAME}] INTERNAL_ERROR", flush=True)


class Handler(BaseHTTPRequestHandler):
    server_version = "OutdoorAgent"
    sys_version = ""

    def setup(self) -> None:
        super().setup()
        self.connection.settimeout(self.server.settings.read_timeout_seconds)

    def do_GET(self) -> None:  # noqa: N802
        if self.path == "/health":
            self.send_json(200, {"ok": True, "service": SERVICE_NAME, "time": now_iso()})
        else:
            self.send_failure(404, "NOT_FOUND", "Endpoint not found")

    def do_POST(self) -> None:  # noqa: N802
        self.request_id = f"agent_req_{uuid.uuid4().hex}"
        try:
            if self.path != "/v1/route-candidates":
                raise ContractError("Endpoint not found", "NOT_FOUND", 404)
            token = self.server.settings.internal_token
            authorization = self.headers.get("Authorization", "")
            if token and not hmac.compare_digest(authorization.encode(), f"Bearer {token}".encode()):
                raise ContractError("Internal authorization required", "UNAUTHORIZED", 401)
            request = normalize_request(self.read_json())
            self.request_id = request["requestId"]
            response = recommend(request, self.server.connectors,
                                 demo_mode=self.server.settings.demo_mode,
                                 deadline_ms=self.server.settings.deadline_ms)
            self.send_json(200, response)
        except ContractError as error:
            self.send_failure(error.status, error.code, str(error))
        except (TimeoutError, socket.timeout):
            self.send_failure(408, "REQUEST_TIMEOUT", "Request body timed out", retryable=True)
        except (BrokenPipeError, ConnectionResetError):
            return
        except Exception:
            self.send_failure(500, "INTERNAL_ERROR", "Agent request failed", retryable=True)

    def read_json(self) -> dict:
        if self.headers.get("Transfer-Encoding"):
            raise ContractError("Transfer-Encoding is not supported")
        lengths = self.headers.get_all("Content-Length", [])
        if len(lengths) != 1 or not lengths[0].isascii() or not lengths[0].isdigit():
            raise ContractError("A single Content-Length is required")
        if len(lengths[0].lstrip("0")) > 5:
            raise ContractError("Request body exceeds 65536 bytes", "REQUEST_TOO_LARGE", 413)
        length = int(lengths[0].lstrip("0") or "0")
        if length > MAX_BODY_BYTES:
            raise ContractError("Request body exceeds 65536 bytes", "REQUEST_TOO_LARGE", 413)
        if length == 0:
            raise ContractError("JSON body is required")
        if self.headers.get("Content-Type", "").split(";", 1)[0].strip().lower() != "application/json":
            raise ContractError("Content-Type must be application/json", "UNSUPPORTED_MEDIA_TYPE", 415)
        raw = self.rfile.read(length)
        if len(raw) != length:
            raise ContractError("Incomplete request body")
        try:
            return json.loads(raw.decode("utf-8"), parse_constant=reject_constant,
                              object_pairs_hook=reject_duplicate_keys)
        except (UnicodeDecodeError, ValueError, RecursionError):
            raise ContractError("Malformed JSON body") from None

    def send_failure(self, status: int, code: str, message: str, *, retryable: bool = False) -> None:
        self.send_json(status, {
            "ok": False, "error": {"code": code, "message": message, "retryable": retryable},
            "requestId": getattr(self, "request_id", f"agent_req_{uuid.uuid4().hex}"),
            "correlationId": f"corr_{uuid.uuid4().hex}",
        })

    def send_json(self, status: int, payload: dict) -> None:
        data = json.dumps(payload, ensure_ascii=False, allow_nan=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Connection", "close")
        self.end_headers()
        self.close_connection = True
        self.wfile.write(data)

    def log_request(self, code="-", size="-") -> None:
        # No query strings, locations, remote addresses, tokens or body content.
        print(f"[{SERVICE_NAME}] status={code}", flush=True)

    def log_message(self, fmt: str, *args) -> None:
        # BaseHTTPRequestHandler may include untrusted request lines in this log.
        return


def main() -> None:
    settings = Settings.from_env()
    port = int(os.environ.get("PORT", "19081"))
    server = AgentServer((os.environ.get("HOST", "127.0.0.1"), port), settings)
    print(f"{SERVICE_NAME} started on port {port}", flush=True)
    try:
        server.serve_forever()
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
