"""Turns what someone typed ("I want to open a tea stall") into one procedure id.

1. Keyword match in all six languages (fast, free, same as the frontend).
2. If nothing matches and an LLM key is set, ask the LLM to pick from OUR list only. It cannot invent a procedure:
   any answer that is not one of our ids is treated as "no match".
"""
import json
import logging

import httpx

from .config import Settings

log = logging.getLogger(__name__)


def keyword_match(text: str, tasks: list[dict]) -> str | None:
    q = text.lower()
    # Most keyword hits wins; on a tie, the more specific match (longer matched words) wins,
    # so "sweet shop" picks food ("sweet shop") over general business ("shop").
    def score(t: dict) -> tuple[int, int]:
        hits = [k for k in t.get("keywords", []) if k.lower() in q]
        return len(hits), sum(len(k) for k in hits)

    scored = sorted(((score(t), t["task_id"]) for t in tasks), reverse=True)
    return scored[0][1] if scored and scored[0][0][0] > 0 else None


def llm_match(text: str, tasks: list[dict], s: Settings) -> str | None:
    if not s.anthropic_key:
        return None
    options = "\n".join(f"- {t['task_id']}: {t.get('title', '')}" for t in tasks)
    prompt = (
        "A citizen in India typed a request. Pick the ONE procedure id from the list that best matches it, "
        "or answer none if nothing fits. Reply with JSON only: {\"task_id\": \"<id or none>\"}.\n\n"
        f"Procedures:\n{options}\n\nRequest (may be in any Indian language): {text[:300]}"
    )
    try:
        r = httpx.post(
            "https://api.anthropic.com/v1/messages",
            headers={"x-api-key": s.anthropic_key, "anthropic-version": "2023-06-01", "content-type": "application/json"},
            json={"model": s.llm_model, "max_tokens": 50, "messages": [{"role": "user", "content": prompt}]},
            timeout=12,
        )
        r.raise_for_status()
        raw = "".join(b.get("text", "") for b in r.json().get("content", []))
        pick = json.loads(raw[raw.find("{"): raw.rfind("}") + 1]).get("task_id")
    except Exception as e:  # network, quota, bad JSON: fall back to "no match" rather than failing the search
        log.warning("llm search failed: %s", type(e).__name__)
        return None
    ids = {t["task_id"] for t in tasks}
    return pick if pick in ids else None


def find_task(text: str, tasks: list[dict], s: Settings) -> tuple[str | None, str]:
    hit = keyword_match(text, tasks)
    if hit:
        return hit, "keywords"
    hit = llm_match(text, tasks, s)
    return (hit, "llm") if hit else (None, "none")
