"""Offline contract tests. All source records are injected fixtures."""
import copy
import io
import json
import sys
import threading
import time
import unittest
from email.message import Message
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "app"))
from candidates import DemoConnector, recommend
from contracts import ContractError, normalize_request, parse_intent
from server import Handler, Settings


def fixture(source="AMAP_POI", identifier="test_map", title="测试路线"):
    return {
        "id": identifier, "title": title,
        "sourceEvidence": [{"sourceId": identifier, "type": source, "label": "测试注入来源",
                            "accessMode": "AUTHORIZED_API", "collectedAt": "2026-09-29T01:00:00Z"}],
        "geo": {"name": title, "address": "测试地址", "lng": 114.0, "lat": 22.5},
        "missingItems": ["开放时间未知"], "riskWarnings": ["出发前确认"],
    }


class FixtureConnector:
    def __init__(self, source="AMAP_POI", items=None):
        self.source_type = source
        self.items = items if items is not None else [fixture(source)]
        self.calls = []

    def fetch(self, intent, *, deadline):
        self.calls.append((intent, deadline))
        return copy.deepcopy(self.items)


def run_handler(raw, *, headers=None, settings=None):
    """Exercise actual POST handling with in-memory HTTP headers/body."""
    handler = Handler.__new__(Handler)
    handler.path = "/v1/route-candidates"
    handler.server = SimpleNamespace(settings=settings or Settings(), connectors=())
    handler.headers = Message()
    for name, value in (headers if headers is not None else {
            "Content-Length": str(len(raw)), "Content-Type": "application/json"}).items():
        handler.headers[name] = value
    handler.rfile = io.BytesIO(raw)
    response = []
    handler.send_json = lambda status, payload: response.append((status, payload))
    handler.do_POST()
    return response[0]


class RequestContractTests(unittest.TestCase):
    def test_complete_nested_criteria_preserved_and_explicit_filters_win(self):
        payload = {
            "requestId": "req_criteria", "query": "带孩子轻松走森林步道",
            "origin": {"label": "深圳", "city": "深圳", "lng": 114.0579, "lat": 22.5431, "source": "wx_location"},
            "preferences": {"ageRange": "6-10岁", "duration": "半天", "difficulty": "moderate",
                            "transport": "自驾", "driveLimitMinutes": 45, "scenePreferences": ["海边"],
                            "safetyNeeds": ["可随时折返"], "companions": [], "activityType": "cycling"},
            "departureTime": {"mode": "TODAY_PM", "iso": "2026-09-29T07:00:00.000Z",
                              "timezone": "Asia/Shanghai", "date": "2026-09-29", "time": "15:00", "label": "今天下午"},
            "sourcePolicy": {"includeSystem": False, "includeMap": True, "includeGuide": False,
                             "includeUserShared": False, "limit": 3},
            "anonymousSessionId": "session_a",
        }
        intent = parse_intent(normalize_request(payload))
        for field in ("query", "origin", "preferences", "departureTime", "sourcePolicy", "anonymousSessionId"):
            self.assertEqual(payload[field], intent[field])
        self.assertEqual([], intent["companions"])
        self.assertEqual("moderate", intent["difficulty"])
        self.assertEqual(["海边"], intent["scenery"])
        self.assertEqual("cycling", intent["activityType"])

    def test_legacy_flat_fields_and_nested_override(self):
        request = normalize_request({
            "message": "走走", "originLabel": "深圳", "city": "深圳",
            "originPoint": {"longitude": 114, "latitude": 22},
            "ageRange": "6-10岁", "duration": "半天", "difficulty": "简单", "transport": "自驾",
            "driveLimitMinutes": 45, "scenePreferences": ["公园"], "safetyNeeds": ["停车方便"],
            "preferences": {"difficulty": "中等", "scenePreferences": []}, "limit": 2,
        })
        self.assertEqual({"label": "深圳", "city": "深圳", "lng": 114, "lat": 22}, request["origin"])
        self.assertEqual("6-10岁", request["preferences"]["ageRange"])
        self.assertEqual("中等", request["preferences"]["difficulty"])
        self.assertEqual([], request["preferences"]["scenePreferences"])
        self.assertEqual(2, request["sourcePolicy"]["limit"])

    def test_bad_types_and_limits(self):
        invalid = [None, [], "query", {}, {"query": " "}, {"query": "a" * 121}, {"query": 123},
                   {"query": "x", "origin": "深圳"}, {"query": "x", "preferences": None},
                   {"query": "x", "sourcePolicy": {"limit": 0}},
                   {"query": "x", "sourcePolicy": {"limit": 51}},
                   {"query": "x", "sourcePolicy": {"limit": True}},
                   {"query": "x", "sourcePolicy": {"includeMap": "false"}},
                   {"query": "x", "driveLimitMinutes": True},
                   {"query": "x", "scenePreferences": "森林"},
                   {"query": "x", "safetyNeeds": [None]},
                   {"query": "x", "departureTime": "today"},
                   {"query": "x", "departureTime": {"iso": "not-date"}},
                   {"query": "x", "departureTime": {"iso": "2026-09-29T07:00:00"}},
                   {"query": "x", "requestId": "unsafe\nvalue"},
                   {"query": "x", "anonymousSessionId": 12}]
        for payload in invalid:
            with self.subTest(payload=payload), self.assertRaises(ContractError):
                normalize_request(payload)

    def test_coordinates_are_finite_and_china_bound(self):
        for origin in ({"lng": True, "lat": 22}, {"lng": 114}, {"lng": float("nan"), "lat": 22},
                       {"lng": 181, "lat": 22}):
            with self.subTest(origin=origin), self.assertRaises(ContractError):
                normalize_request({"query": "x", "origin": origin})
        request = normalize_request({"query": "x", "origin": {"label": "深圳", "lng": -122.4, "lat": 37.8}})
        self.assertEqual({"label": "深圳"}, request["origin"])
        self.assertIn("ORIGIN_COORDINATES_IGNORED", request["warnings"])


class OrchestrationTests(unittest.TestCase):
    def test_no_provider_does_not_fabricate_routes(self):
        response = recommend(normalize_request({"query": "附近走走"}))
        self.assertTrue(response["ok"])
        self.assertEqual("NO_SEARCH_RESULTS", response["status"])
        self.assertEqual([], response["items"])
        self.assertIn("SOURCE_NOT_CONFIGURED", response["warnings"])

    def test_demo_is_explicit_mock_and_non_adoptable(self):
        request = normalize_request({"query": "附近走走", "sourcePolicy": {"limit": 1}})
        self.assertEqual([], recommend(request, (DemoConnector(),))["items"])
        response = recommend(request, demo_mode=True)
        self.assertEqual("DEGRADED", response["status"])
        self.assertEqual(1, len(response["items"]))
        for item in response["items"]:
            self.assertTrue(item["previewOnly"])
            self.assertFalse(item["adoptionRequired"])
            self.assertEqual("LOCAL_PREVIEW", item["sourceType"])
            self.assertEqual("MOCK", item["sourceEvidence"][0]["accessMode"])
            self.assertNotIn("lng", item["geo"])

    def test_source_flags_prevent_calls_including_demo(self):
        connectors = tuple(FixtureConnector(source) for source in ("SYSTEM_LIBRARY", "AMAP_POI", "GUIDE_PUBLIC", "USER_SHARED"))
        request = normalize_request({"query": "附近", "sourcePolicy": {
            "includeSystem": False, "includeMap": False, "includeGuide": False, "includeUserShared": False}})
        response = recommend(request, connectors, demo_mode=True)
        self.assertEqual([], response["items"])
        for connector in connectors:
            self.assertEqual([], connector.calls)

    def test_deduplication_retains_evidence_and_limits_after_merge(self):
        map_source = FixtureConnector(items=[fixture(), fixture(identifier="test_other", title="另一条路线")])
        guide_source = FixtureConnector("GUIDE_PUBLIC", [fixture("GUIDE_PUBLIC", "test_guide")])
        response = recommend(normalize_request({"query": "走走", "limit": 1}), (map_source, guide_source))
        self.assertEqual("READY", response["status"])
        self.assertEqual(1, len(response["items"]))
        self.assertEqual({"AMAP_POI", "GUIDE_PUBLIC"}, {entry["type"] for entry in response["items"][0]["sourceEvidence"]})
        self.assertEqual(1, response["items"][0]["rank"])
        self.assertEqual("走走", map_source.calls[0][0]["query"])

    def test_missing_or_fabricated_evidence_dropped(self):
        for field, value in (("accessMode", "MOCK"), ("type", "GUIDE_PUBLIC"), ("collectedAt", "invalid")):
            item = fixture()
            item["sourceEvidence"][0][field] = value
            response = recommend(normalize_request({"query": "走走"}), (FixtureConnector(items=[item]),))
            self.assertEqual([], response["items"])
            self.assertEqual("DEGRADED", response["status"])
        item = fixture()
        item.pop("sourceEvidence")
        response = recommend(normalize_request({"query": "走走"}), (FixtureConnector(items=[item]),))
        self.assertIn("SOURCE_INVALID_EVIDENCE", response["warnings"])

    def test_deadline_does_not_wait_for_stalled_provider(self):
        unblock = threading.Event()

        class StalledConnector:
            source_type = "AMAP_POI"

            def fetch(self, intent, *, deadline):
                unblock.wait(2)
                return []

        start = time.monotonic()
        try:
            response = recommend(normalize_request({"query": "走走"}), (StalledConnector(),), deadline_ms=25)
            self.assertLess(time.monotonic() - start, 0.5)
            self.assertEqual("DEGRADED", response["status"])
            self.assertIn("AGENT_TIMEOUT", response["warnings"])
        finally:
            unblock.set()


class HttpBoundaryTests(unittest.TestCase):
    def test_bad_json_and_top_level_types(self):
        for raw in (b"{", b"[]", b"null", b'"abc"', b'\xff', b'{"query":NaN}', b'{"query":"a","query":"b"}', b'{"query":"\\ud800"}'):
            with self.subTest(raw=raw):
                status, body = run_handler(raw)
                self.assertEqual(400, status)
                self.assertFalse(body["ok"])
                self.assertEqual("INVALID_REQUEST", body["error"]["code"])
                self.assertIn("requestId", body)
                self.assertIn("correlationId", body)

    def test_content_type_and_body_size(self):
        status, body = run_handler(b"x", headers={"Content-Length": "65537", "Content-Type": "application/json"})
        self.assertEqual((413, "REQUEST_TOO_LARGE"), (status, body["error"]["code"]))
        status, body = run_handler(b"x", headers={"Content-Length": "1", "Content-Type": "text/plain"})
        self.assertEqual(415, status)
        for length in ("bad", "-1", "0", "2"):
            status, _ = run_handler(b"x", headers={"Content-Length": length, "Content-Type": "application/json"})
            self.assertEqual(400, status)

    def test_authentication_and_valid_response(self):
        raw = json.dumps({"query": "走走", "requestId": "req_test"}).encode()
        settings = Settings(internal_token="fixture-only-token")
        status, _ = run_handler(raw, settings=settings)
        self.assertEqual(401, status)
        headers = {"Content-Length": str(len(raw)), "Content-Type": "application/json",
                   "Authorization": "Bearer fixture-only-token"}
        status, body = run_handler(raw, headers=headers, settings=settings)
        self.assertEqual(200, status)
        self.assertEqual("req_test", body["requestId"])
        self.assertEqual("NO_SEARCH_RESULTS", body["status"])

    def test_production_requires_token_and_prohibits_demo(self):
        with self.assertRaises(ValueError):
            Settings(environment="production")
        with self.assertRaises(ValueError):
            Settings(environment="production", internal_token="fixture-token", demo_mode=True)
        self.assertFalse(Settings(environment="production", internal_token="fixture-token").demo_mode)
        for deadline in (0, 10001, True):
            with self.assertRaises(ValueError):
                Settings(deadline_ms=deadline)


if __name__ == "__main__":
    unittest.main()
