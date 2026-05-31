"""Shared parity contract for migrated data pipeline adapters."""

from __future__ import annotations

from typing import Any, Dict, List


PLACEHOLDER_TIMESTAMP = "<generated-at>"


def representative_catalog_input() -> Dict[str, Any]:
    episodes_alpha = [{"episode": episode, "score": 4.4 - (episode * 0.03)} for episode in range(1, 13)]
    episodes_beta = [{"episode": episode, "score": 4.0 + (episode * 0.02)} for episode in range(1, 11)]
    return {
        "anime": [
            {
                "id": "alpha",
                "malId": 101,
                "anilistId": 201,
                "title": "Alpha",
                "titleEnglish": "Alpha",
                "titleJapanese": "アルファ",
                "cover": "https://cdn.myanimelist.net/images/anime/1/1.jpg",
                "type": "TV",
                "year": 2024,
                "season": "Spring",
                "studio": "Studio A",
                "source": "Manga",
                "score": 8.1,
                "genres": ["Action", "Adventure"],
                "themes": ["School"],
                "demographic": "Shounen",
                "trailer": {
                    "id": "abc123",
                    "url": "https://www.youtube.com/watch?v=abc123",
                    "embedUrl": "https://www.youtube.com/embed/abc123",
                },
                "episodes": episodes_alpha,
            },
            {
                "id": "beta",
                "malId": 102,
                "anilistId": 202,
                "title": "Beta",
                "cover": "https://cdn.myanimelist.net/images/anime/2/2.jpg",
                "type": "TV",
                "year": 2023,
                "season": "Fall",
                "studio": "Studio B",
                "source": "Original",
                "score": 7.7,
                "genres": ["Drama"],
                "themes": ["Music"],
                "trailer": {
                    "id": "def456",
                    "url": "https://youtu.be/def456",
                    "embedUrl": "https://www.youtube.com/embed/def456",
                },
                "episodes": episodes_beta,
            },
        ]
    }


def validation_payload() -> Dict[str, Any]:
    return {
        "generatedAt": "2026-01-01T00:00:00.000Z",
        "scoreProfile": {"p35": 4.05, "p50": 4.12, "p65": 4.2, "sampleSize": 2000, "source": "fixture"},
        "anime": [
            {
                "id": "alpha",
                "title": "Alpha",
                "cover": "https://cdn.myanimelist.net/images/anime/1/1.jpg",
                "year": 2024,
                "season": "Spring",
                "studio": "Studio A",
                "source": "Manga",
                "score": 8.1,
                "anilistId": 201,
                "genres": ["Action"],
                "themes": ["School"],
                "episodes": [{"episode": 1, "score": 4.2}],
                "trailer": {
                    "id": "abc123",
                    "url": "https://www.youtube.com/watch?v=abc123",
                    "embedUrl": "https://www.youtube.com/embed/abc123",
                },
                "stats": {"retentionScore": 80},
            }
        ],
    }


def trailer_policy_vectors() -> List[Dict[str, Any]]:
    return [
        {
            "name": "trusted watch and embed URLs",
            "trailer": {
                "id": "abc123",
                "url": "https://www.youtube.com/watch?v=abc123",
                "embedUrl": "https://www.youtube.com/embed/abc123",
            },
            "valid": True,
        },
        {
            "name": "evil youtube subdomain lookalike",
            "trailer": {
                "id": "bad",
                "url": "https://youtube.com.evil.example/watch?v=bad",
                "embedUrl": "https://youtube.com.evil.example/embed/bad",
            },
            "valid": False,
        },
    ]


def contract_manifest() -> Dict[str, Any]:
    return {
        "version": 1,
        "generatedBy": "tools/pipeline_parity_contract.py",
        "normalizations": [
            "generatedAt fields use <generated-at>",
            "quality report buildId uses <generated-at>",
            "quality report duration uses 0",
            "temporary fixture paths use <fixture-workdir>",
        ],
        "fixtures": [
            "catalog-input.json",
            "catalog-full.json",
            "catalog-preview.json",
            "embedded-data.js",
            "quality-report.json",
            "validation-success.txt",
            "validation-failure.txt",
        ],
    }
