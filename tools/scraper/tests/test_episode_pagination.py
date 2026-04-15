import importlib.util
import unittest
from pathlib import Path

from bs4 import BeautifulSoup


ROOT = Path(__file__).resolve().parents[1]


def load_module(name: str, file_name: str):
    spec = importlib.util.spec_from_file_location(name, ROOT / file_name)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


mal_scraper = load_module("mal_scraper", "mal_scraper.py")


class EpisodePaginationTests(unittest.TestCase):
    def test_extract_next_episode_page_url_uses_rel_next_link(self):
        scraper = mal_scraper.MALScraper()
        soup = BeautifulSoup(
            '<html><head><link rel="next" href="/anime/21/One_Piece/episode?offset=100" /></head></html>',
            "lxml",
        )

        next_url = scraper._extract_next_episode_page_url(
            soup,
            "https://myanimelist.net/anime/21/One_Piece/episode",
        )

        self.assertEqual(
            next_url,
            "https://myanimelist.net/anime/21/One_Piece/episode?offset=100",
        )

    def test_scrape_episode_scores_follows_paginated_episode_pages(self):
        scraper = mal_scraper.MALScraper()
        pages = {
            "https://myanimelist.net/anime/21/One_Piece/episode": BeautifulSoup(
                """
                <html>
                  <head>
                    <link rel="next" href="/anime/21/One_Piece/episode?offset=100" />
                  </head>
                  <body>
                    <table class="mt8">
                      <tr><td>1</td><td></td><td></td><td>average 4.10</td></tr>
                      <tr><td>2</td><td></td><td></td><td>average 4.20</td></tr>
                    </table>
                  </body>
                </html>
                """,
                "lxml",
            ),
            "https://myanimelist.net/anime/21/One_Piece/episode?offset=100": BeautifulSoup(
                """
                <html>
                  <body>
                    <table class="mt8">
                      <tr><td>101</td><td></td><td></td><td>average 4.30</td></tr>
                      <tr><td>102</td><td></td><td></td><td>average 4.40</td></tr>
                    </table>
                  </body>
                </html>
                """,
                "lxml",
            ),
        }

        requested_urls = []

        def fake_fetch(url: str):
            requested_urls.append(url)
            return pages[url]

        scraper._fetch_page = fake_fetch

        episodes = scraper.scrape_episode_scores(21, "One_Piece")

        self.assertEqual(
            episodes,
            [
                {"episode": 1, "score": 4.1},
                {"episode": 2, "score": 4.2},
                {"episode": 101, "score": 4.3},
                {"episode": 102, "score": 4.4},
            ],
        )
        self.assertEqual(
            requested_urls,
            [
                "https://myanimelist.net/anime/21/One_Piece/episode",
                "https://myanimelist.net/anime/21/One_Piece/episode?offset=100",
            ],
        )


if __name__ == "__main__":
    unittest.main()
