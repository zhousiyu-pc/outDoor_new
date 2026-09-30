#!/usr/bin/env python3
"""Isolated local Boot + Agent smoke test; never opens an existing database."""
from __future__ import annotations

import argparse
import json
import os
import secrets
import signal
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from contextlib import ExitStack
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
JAR = ROOT / "backend-java" / "target" / "outdoor-business-0.1.0.jar"
AGENT = ROOT / "agent-python" / "app" / "server.py"
HTTP = urllib.request.build_opener(urllib.request.ProxyHandler({}))


def check(condition, message):
    if not condition:
        raise AssertionError(message)


def available_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as server:
        server.bind(("127.0.0.1", 0))
        return server.getsockname()[1]


def isolated_environment():
    # Do not inherit datasource, Spring configuration, provider credentials,
    # proxy settings or production profiles from the caller's environment.
    return {name: os.environ[name] for name in
            ("PATH", "JAVA_HOME", "LANG", "LC_ALL", "TMPDIR", "SYSTEMROOT") if name in os.environ}


def request(url, payload=None, *, session="smoke_session", key=None, expected=200):
    headers = {"Content-Type": "application/json"}
    body = None
    if payload is not None:
        check(bool(key), "write request requires an idempotency key")
        body = json.dumps({**payload, "anonymousSessionId": session, "clientRequestId": key},
                          ensure_ascii=False).encode("utf-8")
        headers.update({"X-Anonymous-Session-Id": session, "Idempotency-Key": key, "X-Request-ID": key})
    req = urllib.request.Request(url, data=body, headers=headers)
    try:
        with HTTP.open(req, timeout=8) as response:
            status, raw = response.status, response.read()
    except urllib.error.HTTPError as error:
        status, raw = error.code, error.read()
    data = json.loads(raw.decode("utf-8"))
    check(status == expected, f"{req.get_method()} {url}: expected {expected}, got {status}: {data}")
    check(data.get("ok") is (200 <= status < 300), f"inconsistent response: {data}")
    return data


def stop_process(process):
    # A stored Popen handle is the only source of process ownership here.
    if process.poll() is not None:
        return
    process.terminate()
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait(timeout=5)


def start_process(stack, command, workdir, environment, label):
    logfile = workdir / f"{label}.log"
    output = stack.enter_context(logfile.open("w", encoding="utf-8"))
    process = subprocess.Popen(command, cwd=workdir, env=environment,
                               stdout=output, stderr=subprocess.STDOUT)
    stack.callback(stop_process, process)
    return process, logfile


def wait_health(process, url, logfile, service):
    deadline = time.monotonic() + 30
    last_error = None
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise RuntimeError(f"{service} exited before readiness; see captured service log")
        try:
            health = request(url)
            check(health.get("service") == service, f"unexpected service on {url}: {health}")
            if service == "outdoor-business":
                check(health.get("productionReady") is False, "local health must not claim production readiness")
            return
        except (OSError, ValueError, AssertionError) as error:
            last_error = error
            time.sleep(0.15)
    raise RuntimeError(f"health not ready: {url}: {last_error}; log: {logfile.name}")


def run_smoke(workdir, stack):
    token = secrets.token_urlsafe(32)
    database_url = (f"jdbc:h2:file:{workdir / 'business'};MODE=MySQL;"
                    "DATABASE_TO_LOWER=TRUE;DB_CLOSE_ON_EXIT=FALSE;LOCK_TIMEOUT=3000")
    logs = []
    sequence = 0

    def start_agent(demo=False):
        nonlocal sequence
        sequence += 1
        port = available_port()
        env = {**isolated_environment(), "HOST": "127.0.0.1", "PORT": str(port),
               "APP_ENV": "development", "AGENT_INTERNAL_TOKEN": token,
               "AGENT_DEMO_MODE": str(demo).lower(), "PYTHONDONTWRITEBYTECODE": "1"}
        process, logfile = start_process(stack, [sys.executable, str(AGENT)], workdir, env, f"agent-{sequence}")
        logs.append(logfile)
        base = f"http://127.0.0.1:{port}"
        wait_health(process, f"{base}/health", logfile, "phase-one-agent-python")
        return process, base

    def start_java(agent_base):
        nonlocal sequence
        sequence += 1
        port = available_port()
        env = {**isolated_environment(), "BIND_ADDRESS": "127.0.0.1", "PORT": str(port),
               "SPRING_PROFILES_ACTIVE": "local", "LOCAL_DB_URL": database_url,
               "AGENT_BASE_URL": agent_base, "AGENT_SERVICE_TOKEN": token}
        process, logfile = start_process(stack, ["java", "-jar", str(JAR)], workdir, env, f"java-{sequence}")
        logs.append(logfile)
        base = f"http://127.0.0.1:{port}"
        wait_health(process, f"{base}/health", logfile, "outdoor-business")
        return process, base

    try:
        agent_process, agent_base = start_agent()
        java_process, base = start_java(agent_base)
        search_path = "/api/v1/user/search/recommendations"
        search_body = {"query": "附近找条轻松绿道", "originLabel": "深圳", "city": "深圳",
                       "duration": "半天", "difficulty": "轻松", "safetyNeeds": ["厕所方便"]}
        result = request(base + search_path, search_body, key="smoke-search")
        check(result.get("status") == "NO_SEARCH_RESULTS" and result.get("items") == [], "default Agent must return no fabricated routes")
        check("SOURCE_NOT_CONFIGURED" in result.get("warnings", []), "missing explicit no-source warning")
        replay = request(base + search_path, search_body, key="smoke-search")
        check(replay == result, "identical search replay changed its response")
        conflict = request(base + search_path, {**search_body, "query": "不同需求"}, key="smoke-search", expected=409)
        check(conflict.get("error", {}).get("code") == "IDEMPOTENCY_CONFLICT", "changed-body replay was not rejected")
        print("PASS default no-source result, identical replay and changed-body conflict", flush=True)

        submission_body = {"title": "本地测试路线", "startPoint": "公园东门"}
        submission = request(base + "/api/v1/user/route-submissions", submission_body, key="smoke-submit", expected=201)
        check(bool(submission.get("submissionId")) and submission.get("status") == "REVIEW_PENDING", "minimal submission must await review")
        check("routeAssetId" not in submission, "submission must not create a formal route")
        geocode = request(base + "/api/v1/map/reverse-geocode", {"lng": 114.1, "lat": 22.7, "name": "测试起点"}, key="smoke-map")
        check(geocode.get("status") == "DEGRADED" and geocode.get("provider") is None
              and geocode.get("reason") == "MAP_PROVIDER_NOT_CONFIGURED"
              and geocode.get("label") == "测试起点", "map fallback must preserve the label and disclose unavailable provider")
        print("PASS minimal private submission and truthful map degradation", flush=True)

        stop_process(java_process)
        java_process, base = start_java(agent_base)
        check(request(base + search_path, search_body, key="smoke-search") == result, "search/idempotency state lost across restart")
        check(request(base + "/api/v1/user/route-submissions", submission_body, key="smoke-submit", expected=201) == submission,
              "submission/idempotency state lost across restart")
        print("PASS H2 file persistence across Java restart", flush=True)

        stop_process(java_process)
        stop_process(agent_process)
        agent_process, agent_base = start_agent(demo=True)
        java_process, base = start_java(agent_base)
        demo = request(base + search_path, search_body, key="smoke-demo")
        check(demo.get("status") == "DEGRADED" and demo.get("items"), "explicit demo mode must return marked preview candidates")
        for item in demo["items"]:
            check(item.get("previewOnly") is True and item.get("adoptionRequired") is False, "demo route is not clearly preview-only")
            check(any(source.get("accessMode") == "MOCK" for source in item.get("sourceEvidence", [])), "demo evidence must be MOCK")
        first = demo["items"][0]
        candidate_id = first["candidateId"]
        detail = request(base + f"/api/v1/user/candidates/{candidate_id}")
        check(detail.get("plan", {}).get("id") == candidate_id and detail["plan"].get("previewOnly") is True, "cold detail did not return the persisted preview")
        adoption = request(base + "/api/v1/user/routes/adoptions", {"requestId": demo["requestId"], "candidateId": candidate_id}, key="smoke-demo-adoption", expected=409)
        check(adoption.get("error", {}).get("code") == "CANDIDATE_NOT_ADOPTABLE", "preview route adoption must be rejected")
        print("PASS explicit preview search/detail and rejection of formal adoption", flush=True)
    except BaseException:
        for logfile in logs:
            print(f"--- {logfile.name} (last 25 lines) ---", file=sys.stderr)
            print("\n".join(logfile.read_text(encoding="utf-8", errors="replace").splitlines()[-25:]), file=sys.stderr)
        raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--skip-build", action="store_true", help="use the existing locally verified Boot JAR")
    args = parser.parse_args()
    if not args.skip_build:
        subprocess.run(["mvn", "-o", "-f", "backend-java/pom.xml", "package"], cwd=ROOT, check=True)
    if not JAR.is_file():
        parser.error(f"missing {JAR}; run mvn -o -f backend-java/pom.xml package first")

    def interrupted(signum, frame):
        raise KeyboardInterrupt

    previous_handler = signal.signal(signal.SIGTERM, interrupted)
    try:
        with tempfile.TemporaryDirectory(prefix="outdoor-smoke-") as temporary, ExitStack() as stack:
            run_smoke(Path(temporary), stack)
        print("phase-one smoke: PASS; owned processes stopped and temporary database removed", flush=True)
    finally:
        signal.signal(signal.SIGTERM, previous_handler)


if __name__ == "__main__":
    main()
