"""Offline authorization checks; no real credentials or external requests."""
import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient
import main

class CacheStatsTests(unittest.TestCase):
    def test_stats_fail_closed_without_secret(self):
        with patch.object(main, "_CACHE_STATS_SECRET", ""):
            response = TestClient(main.app).get("/api/cache/stats")
            self.assertEqual(response.status_code, 403)

    def test_missing_and_wrong_headers_are_rejected(self):
        with patch.object(main, "_CACHE_STATS_SECRET", "unit-test-only"):
            client = TestClient(main.app)
            self.assertEqual(client.get("/api/cache/stats").status_code, 403)
            self.assertEqual(client.get("/api/cache/stats", headers={"X-Cache-Stats-Secret": "wrong"}).status_code, 403)

if __name__ == "__main__": unittest.main()
