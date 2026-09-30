"""Optional loopback tests; no external services, database or real credentials."""
import concurrent.futures
import http.client
import json
import os
import sys
import threading
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "app"))
from server import AgentServer, Settings


@unittest.skipUnless(os.environ.get("RUN_AGENT_HTTP_TESTS") == "1", "set RUN_AGENT_HTTP_TESTS=1 to bind a temporary loopback port")
class HttpIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = AgentServer(("127.0.0.1", 0), Settings(internal_token="fixture-token"))
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=2)

    def post(self, query, token="fixture-token"):
        connection = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=3)
        try:
            body = json.dumps({"query": query, "requestId": f"req_{query}"})
            connection.request("POST", "/v1/route-candidates", body, {
                "Content-Type": "application/json", "Authorization": f"Bearer {token}"})
            response = connection.getresponse()
            return response.status, json.loads(response.read())
        finally:
            connection.close()

    def test_parallel_requests_keep_identity_and_criteria(self):
        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
            responses = list(executor.map(self.post, [f"route{index}" for index in range(12)]))
        for index, (status, response) in enumerate(responses):
            self.assertEqual(200, status)
            self.assertEqual(f"req_route{index}", response["requestId"])
            self.assertEqual(f"route{index}", response["intent"]["query"])
            self.assertEqual([], response["items"])

    def test_token_rejection_over_socket(self):
        status, body = self.post("route", token="incorrect")
        self.assertEqual(401, status)
        self.assertEqual("UNAUTHORIZED", body["error"]["code"])


if __name__ == "__main__":
    unittest.main()
