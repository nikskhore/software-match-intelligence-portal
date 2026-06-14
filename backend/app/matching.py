from __future__ import annotations

import re
from typing import Any


USD_TO_INR = 84.0


def split_terms(value: Any) -> set[str]:
    return {part.strip().lower() for part in str(value or "").split("|") if part.strip()}


def normalize(text: str) -> str:
    return re.sub(r"[^a-z0-9\s-]", " ", text.lower())


def annual_cost(software: dict[str, Any], query_currency: str) -> float:
    base = float(software["unit_license_cost"] or 0)
    used = max(int(software["assigned_licenses"] or 1), 1)
    units = min(used, 100) if software["license_model"] in {"per user", "per employee", "per agent"} else 1
    cost = base * units * (1 + float(software["maintenance_pct"] or 0) / 100)
    if software["currency"] == query_currency:
        return round(cost, 2)
    if query_currency == "INR":
        return round(cost * USD_TO_INR, 2)
    return round(cost / USD_TO_INR, 2)


def rank_matches(query: dict[str, Any], customer: dict[str, Any], software_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    requirements = split_terms(query["requirements"])
    query_text = normalize(f"{query['subject']} {query['email_body']}")
    industry = str(customer["industry"]).lower()
    deployment = str(query["preferred_deployment"]).lower()
    budget = float(query["budget"] or 0)
    currency = str(query["currency"])
    results = []

    for software in software_rows:
        capabilities = split_terms(software["capabilities"])
        matched = {term for term in requirements if term in capabilities or term in query_text and term in normalize(str(software["description"]))}
        capability_score = round(55 * len(matched) / max(len(requirements), 1))
        industry_score = 12 if industry in split_terms(software["industries"]) else 3
        deployment_score = 10 if deployment in split_terms(software["deployment"]) else 2

        compliance_terms = split_terms(software["compliance"])
        requested_compliance = {term for term in compliance_terms if term in query_text}
        compliance_score = 10 if requested_compliance else (5 if compliance_terms else 0)

        cost = annual_cost(software, currency)
        budget_score = 13 if not budget or cost <= budget else (7 if cost <= budget * 1.2 else 1)
        score = min(capability_score + industry_score + deployment_score + compliance_score + budget_score, 100)

        reasons = []
        if matched:
            reasons.append(f"Matches {len(matched)} core requirements: {', '.join(sorted(matched)[:4])}")
        if industry_score == 12:
            reasons.append(f"Designed for the {industry} industry")
        if deployment_score == 10:
            reasons.append(f"Supports the preferred {deployment} deployment")
        if requested_compliance:
            reasons.append(f"Includes requested controls: {', '.join(sorted(requested_compliance))}")
        if budget_score == 13:
            reasons.append(f"Estimated annual cost is within the stated {currency} budget")

        gaps = sorted(requirements - capabilities)
        results.append({
            "software_id": software["id"],
            "software_name": software["name"],
            "score": score,
            "capability_score": capability_score,
            "industry_score": industry_score,
            "deployment_score": deployment_score,
            "budget_score": budget_score,
            "compliance_score": compliance_score,
            "reasons": reasons or ["Partial contextual match"],
            "gaps": gaps[:5],
            "annual_cost": cost,
            "currency": currency,
        })

    return sorted(results, key=lambda item: item["score"], reverse=True)[:4]

