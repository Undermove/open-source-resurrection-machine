#!/usr/bin/env python3
"""
Pulls Arena ELO ratings from the official lmarena-ai/leaderboard-dataset on
Hugging Face and produces arena-scores.json with ratings by category.

arena.ai itself sits behind a Cloudflare JS challenge (403 for scripts),
so we read the dataset's parquet files instead.

Requires: pip install pyarrow
Run: python3 scripts/update-arena-scores.py
Output: arena-scores.json
"""

import io
import json
import os
import re
import urllib.request
from datetime import datetime, timezone

import pyarrow.parquet as pq

DATASET = "lmarena-ai/leaderboard-dataset"
PARQUET_URL = "https://huggingface.co/datasets/{ds}/resolve/main/{cfg}/latest-00000-of-00001.parquet"
# our category -> dataset config ("code" arena on the site is the WebDev leaderboard)
CATEGORIES = {"text": "text", "code": "webdev", "vision": "vision"}
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "arena-scores.json")


def fetch_rows(config):
    req = urllib.request.Request(PARQUET_URL.format(ds=DATASET, cfg=config), headers={"User-Agent": "arena-scores-updater"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        table = pq.read_table(io.BytesIO(resp.read()), columns=["model_name", "rating", "category"])
    return [r for r in table.to_pylist() if r["category"] == "overall"]


def slugify(name):
    """'Claude Opus 5.5 (High)' -> 'claude-opus-5.5-high' (the slug format llm-pricing.html matches against)."""
    s = name.lower().replace("(", " ").replace(")", " ").replace(",", " ")
    return re.sub(r"\s+", "-", s.strip())


def main():
    result = {}

    for cat, config in CATEGORIES.items():
        print(f"Fetching {DATASET} [{config}]...")
        rows = fetch_rows(config)
        print(f"  Models: {len(rows)}")

        for r in rows:
            result.setdefault(slugify(r["model_name"]), {})[cat] = round(r["rating"], 2)

    print(f"\nTotal unique models: {len(result)}")
    if not result:
        raise SystemExit("No models fetched, refusing to overwrite arena-scores.json")

    result["_meta"] = {
        "fetched": datetime.now(timezone.utc).isoformat(),
        "source": f"https://huggingface.co/datasets/{DATASET}",
        "categories": list(CATEGORIES),
        "description": "ELO ratings from the Arena leaderboard dataset by category",
    }

    with open(OUT, "w") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
