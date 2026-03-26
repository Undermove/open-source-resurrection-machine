#!/usr/bin/env python3
"""
Scrapes arena.ai/leaderboard/{text,code,vision} and produces arena-scores.json
with ELO ratings by category.

Run: python3 scripts/update-arena-scores.py
Output: arena-scores.json
"""

import json
import os
import re
import sys
import urllib.request
from datetime import datetime, timezone

BASE_URL = "https://arena.ai/leaderboard"
CATEGORIES = ["text", "code", "vision"]
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "arena-scores.json")


def fetch_html(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8")


def parse_arena(html):
    """Extract (modelDisplayName, rating) pairs from arena.ai HTML."""
    matches = re.findall(
        r'modelDisplayName\\":\\"([^\\]+)\\",\\"rating\\":([0-9.]+)', html
    )
    # Deduplicate: keep the rounded version (shorter) per model
    best = {}
    for name, rating in matches:
        r = float(rating)
        if name not in best or len(rating) < len(str(best[name])):
            best[name] = round(r, 2)
    return best


def main():
    result = {}

    for cat in CATEGORIES:
        url = f"{BASE_URL}/{cat}"
        print(f"Fetching {url}...")
        html = fetch_html(url)
        print(f"  HTML size: {len(html):,} bytes")

        models = parse_arena(html)
        print(f"  Models: {len(models)}")

        for name, rating in models.items():
            if name not in result:
                result[name] = {}
            result[name][cat] = rating

    print(f"\nTotal unique models: {len(result)}")

    # Add metadata
    result["_meta"] = {
        "fetched": datetime.now(timezone.utc).isoformat(),
        "source": BASE_URL,
        "categories": CATEGORIES,
        "description": "ELO ratings from arena.ai leaderboard by category",
    }

    with open(OUT, "w") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
