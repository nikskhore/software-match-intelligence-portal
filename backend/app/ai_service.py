from __future__ import annotations

import json
import os
from typing import Any

from .matching import rank_matches, split_terms


def analyze_query(query: dict[str, Any], customer: dict[str, Any], software: list[dict[str, Any]]) -> dict[str, Any]:
    deterministic = rank_matches(query, customer, software)
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        return {
            "summary": f"{customer['name']} is seeking {query['subject'].lower()}. The strongest fit is {deterministic[0]['software_name']}.",
            "extracted_requirements": sorted(split_terms(query["requirements"])),
            "confidence": min(94, deterministic[0]["score"] + 8),
            "matches": deterministic,
            "source": "deterministic",
        }

    try:
        from openai import OpenAI

        client = OpenAI(api_key=api_key)
        prompt = {
            "customer": customer,
            "query": query,
            "candidate_matches": deterministic,
            "instruction": "Validate the ranked candidates. Preserve all numeric score fields and costs. Improve only summary, extracted requirements, reasons, gaps, and confidence. Return JSON.",
        }
        response = client.responses.create(
            model=os.getenv("OPENAI_MODEL", "gpt-4.1-mini"),
            input=[
                {"role": "system", "content": "You are a software portfolio solution architect. Be concise, evidence-based, and never invent product capabilities."},
                {"role": "user", "content": json.dumps(prompt, default=str)},
            ],
            text={"format": {"type": "json_object"}},
        )
        result = json.loads(response.output_text)
        result["source"] = "openai"
        result["matches"] = result.get("matches", deterministic)
        return result
    except Exception:
        return {
            "summary": f"{customer['name']} is seeking {query['subject'].lower()}. The strongest fit is {deterministic[0]['software_name']}.",
            "extracted_requirements": sorted(split_terms(query["requirements"])),
            "confidence": min(90, deterministic[0]["score"] + 5),
            "matches": deterministic,
            "source": "deterministic",
        }

