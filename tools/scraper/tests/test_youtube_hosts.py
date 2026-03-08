import importlib.util
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def load_module(name: str, file_name: str):
    spec = importlib.util.spec_from_file_location(name, ROOT / file_name)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


mal_scraper = load_module("mal_scraper", "mal_scraper.py")
add_trailers = load_module("add_trailers", "add_trailers.py")


class YouTubeHostPolicyTests(unittest.TestCase):
    def test_add_trailers_accepts_known_youtube_hosts(self):
        self.assertEqual(
            add_trailers.extract_youtube_id("https://www.youtube.com/watch?v=abc123def45"),
            "abc123def45",
        )

    def test_add_trailers_rejects_lookalike_hosts(self):
        self.assertIsNone(
            add_trailers.extract_youtube_id("https://youtube.com.evil.example/watch?v=abc123def45")
        )

    def test_mal_scraper_accepts_known_youtube_hosts(self):
        scraper = mal_scraper.MALScraper()
        self.assertEqual(
            scraper._extract_youtube_id("https://www.youtube-nocookie.com/embed/abc123def45"),
            "abc123def45",
        )

    def test_mal_scraper_rejects_lookalike_hosts(self):
        scraper = mal_scraper.MALScraper()
        self.assertIsNone(
            scraper._extract_youtube_id("https://youtu.be.evil.example/abc123def45")
        )


if __name__ == "__main__":
    unittest.main()
