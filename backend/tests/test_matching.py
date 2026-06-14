from app.matching import rank_matches


def test_matching_prefers_capability_overlap():
    query = {
        "subject": "Need SSO and MFA", "email_body": "Hybrid deployment",
        "requirements": "sso|mfa", "preferred_deployment": "hybrid",
        "budget": 100000, "currency": "USD",
    }
    customer = {"industry": "banking"}
    rows = [
        {"id": "1", "name": "IAM", "description": "", "capabilities": "sso|mfa", "industries": "banking", "deployment": "hybrid", "compliance": "soc 2", "unit_license_cost": 10, "assigned_licenses": 10, "maintenance_pct": 10, "license_model": "per user", "currency": "USD"},
        {"id": "2", "name": "CRM", "description": "", "capabilities": "campaigns", "industries": "retail", "deployment": "cloud", "compliance": "", "unit_license_cost": 10, "assigned_licenses": 10, "maintenance_pct": 10, "license_model": "per user", "currency": "USD"},
    ]
    result = rank_matches(query, customer, rows)
    assert result[0]["software_name"] == "IAM"
    assert result[0]["score"] > result[1]["score"]

