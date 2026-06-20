from __future__ import annotations

import json
import os
import io
import base64
import hashlib
import hmac
import time
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Annotated, Any

from dotenv import load_dotenv
from fastapi import Body, Depends, FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response, StreamingResponse
from fastapi.staticfiles import StaticFiles
import httpx

from .ai_service import analyze_query
from .models import AnalysisResponse, FeedbackPayload, LoginRequest, OpportunityPayload, PurchaseOrderPayload, RoiPayload, SoftwarePayload, User
from .operations import (
    USD_TO_INR, audit, export_software, generate_proposal, generate_renewal_alerts,
    generate_po_pdf, import_software, ingest_simulated_email, now, procurement_analysis,
    roi_simulation, salesforce_sync, vendor_scorecards,
)
from .repository import ExcelRepository


BASE_DIR = Path(__file__).resolve().parents[2]
load_dotenv(BASE_DIR / ".env")


def workbook_path() -> Path:
    configured = os.getenv("PORTAL_DATA_PATH")
    primary = Path(configured) if configured else BASE_DIR / "backend" / "data" / "portal_data.xlsx"
    repo = ExcelRepository(primary)
    try:
        repo.all("opportunities")
        return primary
    except KeyError:
        extended = primary.with_name("portal_data_extended.xlsx")
        if not extended.exists():
            from .seed_data import create_workbook
            create_workbook(extended)
        return extended


repository = ExcelRepository(workbook_path())
INVENTORY_AI_URL = os.getenv("INVENTORY_AI_URL", "http://127.0.0.1:8000").rstrip("/")

app = FastAPI(title="Software Match Intelligence Portal", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def current_user(x_user_id: Annotated[str | None, Header()] = None) -> dict:
    user = repository.find("users", "id", x_user_id or "USR-001")
    if not user or user.get("active") is False:
        raise HTTPException(401, "Unknown demo user")
    return user


def require_role(user: dict, *roles: str) -> None:
    if user["role"] not in roles:
        raise HTTPException(403, "This role cannot perform this action")


def public_user(user: dict) -> dict:
    return {key: user.get(key) for key in ["id", "name", "email", "role", "customer_id"]}


def inventory_ai_token(user: dict) -> str:
    secret = os.getenv("INVENTORY_AI_JWT_SECRET", "").strip()
    if not secret:
        raise HTTPException(503, "Inventory AI JWT secret is not configured")
    role_map = {"admin": "admin", "sales": "manager", "viewer": "viewer", "customer": "viewer"}
    now_value = int(time.time())
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": f"portal:{user['id']}",
        "role": role_map.get(user["role"], "viewer"),
        "iat": now_value,
        "exp": now_value + 3600,
    }

    def encode(value: dict) -> str:
        raw = json.dumps(value, separators=(",", ":")).encode()
        return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()

    signing_input = f"{encode(header)}.{encode(payload)}"
    signature = hmac.new(secret.encode(), signing_input.encode(), hashlib.sha256).digest()
    return f"{signing_input}.{base64.urlsafe_b64encode(signature).rstrip(b'=').decode()}"


def inventory_ai_request(
    method: str,
    path: str,
    user: dict,
    *,
    params: dict[str, Any] | None = None,
    json_body: dict[str, Any] | None = None,
) -> Any:
    try:
        response = httpx.request(
            method,
            f"{INVENTORY_AI_URL}{path}",
            params=params,
            json=json_body,
            headers={"Authorization": f"Bearer {inventory_ai_token(user)}"},
            timeout=45,
        )
        response.raise_for_status()
        return response.json()
    except httpx.ConnectError as exc:
        raise HTTPException(503, "Inventory AI service is not running") from exc
    except httpx.HTTPStatusError as exc:
        detail = exc.response.text
        try:
            detail = exc.response.json().get("detail", detail)
        except ValueError:
            pass
        raise HTTPException(exc.response.status_code, detail) from exc


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "storage": "excel", "ai_enabled": bool(os.getenv("OPENAI_API_KEY"))}


@app.get("/api/inventory-ai/status")
def inventory_ai_status(user: dict = Depends(current_user)) -> dict:
    return inventory_ai_request("GET", "/ai/status", user)


@app.post("/api/inventory-ai/chat")
def inventory_ai_chat(payload: dict[str, Any] = Body(...), user: dict = Depends(current_user)) -> dict:
    return inventory_ai_request("POST", "/ai/chat", user, json_body=payload)


@app.get("/api/inventory-ai/analytics")
def inventory_ai_analytics(user: dict = Depends(current_user)) -> dict:
    return inventory_ai_request("GET", "/ai/analytics", user)


@app.get("/api/inventory-ai/recommendations")
def inventory_ai_recommendations(user: dict = Depends(current_user)) -> dict:
    return inventory_ai_request("GET", "/ai/recommendations", user)


@app.get("/api/inventory-ai/anomalies")
def inventory_ai_anomalies(user: dict = Depends(current_user)) -> dict:
    return inventory_ai_request("GET", "/ai/anomalies", user)


@app.get("/api/inventory-ai/forecast")
def inventory_ai_forecast(
    horizon_days: int = 90,
    user: dict = Depends(current_user),
) -> dict:
    return inventory_ai_request(
        "GET",
        "/ai/forecast",
        user,
        params={"horizon_days": horizon_days},
    )


@app.get("/api/inventory-ai/reports")
def inventory_ai_reports(
    horizon_days: int = 90,
    user: dict = Depends(current_user),
) -> dict:
    require_role(user, "admin", "sales")
    return inventory_ai_request(
        "GET",
        "/ai/reports",
        user,
        params={"horizon_days": horizon_days},
    )


@app.post("/api/auth/login", response_model=User)
def login(payload: LoginRequest) -> dict:
    user = repository.find("users", "email", payload.email.lower())
    if not user or user["password"] != payload.password or user.get("active") is False:
        raise HTTPException(401, "Invalid demo credentials")
    return public_user(user)


@app.get("/api/demo-users")
def demo_users() -> list[dict]:
    return [public_user(user) for user in repository.all("users")]


@app.get("/api/software")
def software(_: dict = Depends(current_user)) -> list[dict]:
    return repository.all("software")


@app.post("/api/software")
def create_software(payload: SoftwarePayload, user: dict = Depends(current_user)) -> dict:
    require_role(user, "admin")
    item = {
        "id": repository.next_id("software", "SW"),
        **payload.model_dump(),
        "revenue_currency": payload.currency,
        "lifetime_revenue": 0,
        "current_year_revenue": 0,
        "pipeline_value": 0,
        "closed_won_deals": 0,
        "open_opportunities": 0,
        "crm_product_id": "",
        "crm_last_sync": "",
    }
    repository.append("software", item)
    audit(repository, user["id"], "create", "software", item["id"], item["name"])
    return item


@app.put("/api/software/{software_id}")
def update_software(software_id: str, payload: dict[str, Any] = Body(...), user: dict = Depends(current_user)) -> dict:
    require_role(user, "admin")
    if not repository.find("software", "id", software_id):
        raise HTTPException(404, "Software not found")
    payload.pop("id", None)
    repository.update("software", "id", software_id, payload)
    audit(repository, user["id"], "update", "software", software_id, payload)
    return repository.find("software", "id", software_id)


@app.delete("/api/software/{software_id}")
def delete_software(software_id: str, user: dict = Depends(current_user)) -> dict:
    require_role(user, "admin")
    if not repository.delete("software", "id", software_id):
        raise HTTPException(404, "Software not found")
    audit(repository, user["id"], "delete", "software", software_id)
    return {"deleted": software_id}


@app.get("/api/software-export")
def software_export(user: dict = Depends(current_user)) -> Response:
    require_role(user, "admin", "sales")
    return Response(
        export_software(repository),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="software_inventory.xlsx"'},
    )


@app.post("/api/software-import")
async def software_import(file: UploadFile = File(...), user: dict = Depends(current_user)) -> dict:
    require_role(user, "admin")
    count = import_software(repository, await file.read())
    audit(repository, user["id"], "import", "software", "bulk", {"rows": count})
    return {"imported": count}


@app.get("/api/software-compare")
def software_compare(ids: str, _: dict = Depends(current_user)) -> list[dict]:
    requested = {value.strip() for value in ids.split(",") if value.strip()}
    return [row for row in repository.all("software") if row["id"] in requested]


@app.get("/api/queries")
def queries(user: dict = Depends(current_user)) -> list[dict]:
    rows = repository.all("queries")
    customers = {row["id"]: row for row in repository.all("customers")}
    if user["role"] == "customer":
        rows = [row for row in rows if row["customer_id"] == user["customer_id"]]
    return [{**row, "customer_name": customers[row["customer_id"]]["name"]} for row in rows]


@app.post("/api/queries/{query_id}/analyze", response_model=AnalysisResponse)
def analyze(query_id: str, user: dict = Depends(current_user)) -> dict:
    if user["role"] not in {"admin", "sales"}:
        raise HTTPException(403, "This role cannot run analyses")
    query = repository.find("queries", "id", query_id)
    if not query:
        raise HTTPException(404, "Query not found")
    customer = repository.find("customers", "id", query["customer_id"])
    result = analyze_query(query, customer, repository.all("software"))
    timestamp = datetime.now().isoformat(timespec="seconds")
    rows = []
    for match in result["matches"]:
        rows.append({
            "query_id": query_id,
            **match,
            "reasons": json.dumps(match["reasons"]),
            "gaps": json.dumps(match["gaps"]),
            "summary": result["summary"],
            "extracted_requirements": json.dumps(result["extracted_requirements"]),
            "confidence": result["confidence"],
            "source": result["source"],
            "analyzed_at": timestamp,
        })
    repository.replace_analysis(query_id, rows)
    repository.update("queries", "id", query_id, {"status": "Analyzed"})
    audit(repository, user["id"], "analyze", "query", query_id, {"source": result["source"]})
    return {"query_id": query_id, **result}


@app.get("/api/analyses/{query_id}", response_model=AnalysisResponse)
def analysis(query_id: str, user: dict = Depends(current_user)) -> dict:
    query = repository.find("queries", "id", query_id)
    if not query:
        raise HTTPException(404, "Query not found")
    if user["role"] == "customer" and query["customer_id"] != user["customer_id"]:
        raise HTTPException(403, "This inquiry is not visible to this customer")
    rows = [row for row in repository.all("analyses") if row["query_id"] == query_id]
    if not rows:
        raise HTTPException(404, "No analysis has been run")
    first = rows[0]
    matches = []
    for row in rows:
        matches.append({
            "software_id": row["software_id"], "software_name": row["software_name"],
            "score": row["score"], "capability_score": row["capability_score"],
            "industry_score": row["industry_score"], "deployment_score": row["deployment_score"],
            "budget_score": row["budget_score"], "compliance_score": row["compliance_score"],
            "reasons": json.loads(row["reasons"]), "gaps": json.loads(row["gaps"]),
            "annual_cost": row["annual_cost"], "currency": row["currency"],
        })
    return {
        "query_id": query_id, "summary": first["summary"],
        "extracted_requirements": json.loads(first["extracted_requirements"]),
        "confidence": first["confidence"], "matches": matches, "source": first["source"],
    }


@app.get("/api/opportunities")
def opportunities(user: dict = Depends(current_user)) -> list[dict]:
    rows = repository.all("opportunities")
    if user["role"] == "customer":
        rows = [row for row in rows if row["customer_id"] == user["customer_id"]]
    return rows


@app.post("/api/opportunities")
def create_opportunity(payload: OpportunityPayload, user: dict = Depends(current_user)) -> dict:
    require_role(user, "admin", "sales")
    query = repository.find("queries", "id", payload.query_id)
    if not query:
        raise HTTPException(404, "Query not found")
    item = {
        "id": repository.next_id("opportunities", "OPP"),
        "customer_id": query["customer_id"],
        **payload.model_dump(),
        "source": "Portal",
        "crm_id": "",
        "updated_at": now(),
    }
    repository.append("opportunities", item)
    audit(repository, user["id"], "create", "opportunity", item["id"], item)
    return item


@app.put("/api/opportunities/{opportunity_id}")
def update_opportunity(opportunity_id: str, payload: dict[str, Any] = Body(...), user: dict = Depends(current_user)) -> dict:
    require_role(user, "admin", "sales")
    payload["updated_at"] = now()
    try:
        repository.update("opportunities", "id", opportunity_id, payload)
    except KeyError:
        raise HTTPException(404, "Opportunity not found")
    audit(repository, user["id"], "update", "opportunity", opportunity_id, payload)
    return repository.find("opportunities", "id", opportunity_id)


@app.get("/api/forecast")
def forecast(user: dict = Depends(current_user)) -> dict:
    rows = opportunities(user)
    stages: dict[str, dict[str, float]] = {}
    total = weighted = 0.0
    for row in rows:
        conversion = USD_TO_INR if row["currency"] == "USD" else 1
        amount = float(row["amount"] or 0) * conversion
        probability = float(row["probability"] or 0) / 100
        total += amount
        weighted += amount * probability
        stage = stages.setdefault(row["stage"], {"amount_inr": 0, "weighted_inr": 0, "count": 0})
        stage["amount_inr"] += amount
        stage["weighted_inr"] += amount * probability
        stage["count"] += 1
    return {
        "total_pipeline_inr": round(total),
        "weighted_forecast_inr": round(weighted),
        "stages": [{"stage": key, **{name: round(value) for name, value in values.items()}} for key, values in stages.items()],
        "opportunities": rows,
    }


@app.get("/api/proposals/{query_id}")
def proposal(query_id: str, user: dict = Depends(current_user)) -> Response:
    require_role(user, "admin", "sales", "customer")
    query = repository.find("queries", "id", query_id)
    if user["role"] == "customer" and (not query or query["customer_id"] != user["customer_id"]):
        raise HTTPException(403, "Proposal is not visible to this customer")
    try:
        content = generate_proposal(repository, query_id)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    audit(repository, user["id"], "generate", "proposal", query_id)
    return Response(content, media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="proposal-{query_id}.pdf"'})


@app.post("/api/feedback")
def feedback(payload: FeedbackPayload, user: dict = Depends(current_user)) -> dict:
    require_role(user, "admin", "sales")
    item = {
        "id": repository.next_id("feedback", "FDB"),
        **payload.model_dump(),
        "user_id": user["id"],
        "created_at": now(),
    }
    repository.append("feedback", item)
    audit(repository, user["id"], payload.rating, "recommendation", f"{payload.query_id}:{payload.software_id}", payload.comment)
    return item


@app.get("/api/feedback")
def feedback_list(_: dict = Depends(current_user)) -> list[dict]:
    return repository.all("feedback")


@app.get("/api/alerts")
def alerts(_: dict = Depends(current_user)) -> list[dict]:
    return repository.all("alerts")


@app.post("/api/alerts/generate")
def alerts_generate(user: dict = Depends(current_user)) -> dict:
    require_role(user, "admin", "sales")
    created = generate_renewal_alerts(repository)
    audit(repository, user["id"], "generate", "alerts", "renewals", {"created": created})
    return {"created": created, "alerts": repository.all("alerts")}


@app.put("/api/alerts/{alert_id}")
def alerts_update(alert_id: str, payload: dict[str, Any] = Body(...), user: dict = Depends(current_user)) -> dict:
    require_role(user, "admin", "sales")
    repository.update("alerts", "id", alert_id, payload)
    audit(repository, user["id"], "update", "alert", alert_id, payload)
    return repository.find("alerts", "id", alert_id)


@app.get("/api/email-inbox")
def email_inbox(user: dict = Depends(current_user)) -> list[dict]:
    require_role(user, "admin", "sales")
    return repository.all("email_inbox")


@app.post("/api/email-inbox/{mail_id}/ingest")
def email_ingest(mail_id: str, user: dict = Depends(current_user)) -> dict:
    require_role(user, "admin", "sales")
    try:
        query = ingest_simulated_email(repository, mail_id)
    except KeyError:
        raise HTTPException(404, "Email not found")
    audit(repository, user["id"], "ingest", "email", mail_id, {"query_id": query["id"]})
    return query


@app.get("/api/integrations")
def integrations(user: dict = Depends(current_user)) -> dict:
    require_role(user, "admin", "sales")
    settings = {row["key"]: row["value"] for row in repository.all("settings")}
    return {
        "salesforce": {"mode": settings.get("salesforce_mode", "demo"), "configured": bool(os.getenv("SALESFORCE_INSTANCE_URL") and os.getenv("SALESFORCE_ACCESS_TOKEN"))},
        "gmail": {"configured": bool(os.getenv("GMAIL_CREDENTIALS_JSON")), "mode": "live-ready" if os.getenv("GMAIL_CREDENTIALS_JSON") else "demo"},
        "outlook": {"configured": bool(os.getenv("MICROSOFT_GRAPH_TOKEN")), "mode": "live-ready" if os.getenv("MICROSOFT_GRAPH_TOKEN") else "demo"},
        "openai": {"configured": bool(os.getenv("OPENAI_API_KEY")), "mode": "live" if os.getenv("OPENAI_API_KEY") else "deterministic"},
    }


@app.post("/api/integrations/salesforce/sync")
def integration_salesforce_sync(user: dict = Depends(current_user)) -> dict:
    require_role(user, "admin")
    result = salesforce_sync(repository)
    audit(repository, user["id"], "sync", "integration", "salesforce", result)
    return result


@app.get("/api/admin/users")
def admin_users(user: dict = Depends(current_user)) -> list[dict]:
    require_role(user, "admin")
    return [public_user(row) | {"active": row.get("active", True)} for row in repository.all("users")]


@app.put("/api/admin/users/{user_id}")
def admin_user_update(user_id: str, payload: dict[str, Any] = Body(...), user: dict = Depends(current_user)) -> dict:
    require_role(user, "admin")
    allowed = {key: value for key, value in payload.items() if key in {"name", "role", "customer_id", "active"}}
    repository.update("users", "id", user_id, allowed)
    audit(repository, user["id"], "update", "user", user_id, allowed)
    return public_user(repository.find("users", "id", user_id)) | {"active": repository.find("users", "id", user_id).get("active", True)}


@app.get("/api/admin/audit")
def admin_audit(user: dict = Depends(current_user)) -> list[dict]:
    require_role(user, "admin")
    return list(reversed(repository.all("audit_logs")))[0:100]


@app.get("/api/admin/settings")
def admin_settings(user: dict = Depends(current_user)) -> list[dict]:
    require_role(user, "admin")
    return repository.all("settings")


@app.put("/api/admin/settings/{key}")
def admin_setting_update(key: str, payload: dict[str, Any] = Body(...), user: dict = Depends(current_user)) -> dict:
    require_role(user, "admin")
    repository.update("settings", "key", key, {"value": payload.get("value", "")})
    audit(repository, user["id"], "update", "setting", key, payload)
    return repository.find("settings", "key", key)


@app.get("/api/dashboard")
def dashboard(user: dict = Depends(current_user)) -> dict:
    software_rows = repository.all("software")
    query_rows = repository.all("queries")
    if user["role"] == "customer":
        query_rows = [row for row in query_rows if row["customer_id"] == user["customer_id"]]

    inventory_inr = 0.0
    license_inr = 0.0
    maintenance_inr = 0.0
    lifetime_revenue_inr = 0.0
    current_year_revenue_inr = 0.0
    pipeline_value_inr = 0.0
    category_costs: dict[str, float] = {}
    category_revenue: dict[str, float] = {}
    product_performance = []
    renewals = []
    today = date.today()
    for item in software_rows:
        conversion = 84 if item["currency"] == "USD" else 1
        licenses = float(item["available_licenses"] or 0)
        unit = float(item["unit_license_cost"] or 0) * conversion
        item_value = licenses * unit
        inventory_inr += item_value
        license_inr += float(item["assigned_licenses"] or 0) * unit
        maintenance_inr += item_value * float(item["maintenance_pct"] or 0) / 100
        category_costs[item["category"]] = category_costs.get(item["category"], 0) + item_value
        revenue_conversion = 84 if item.get("revenue_currency") == "USD" else 1
        lifetime_revenue = float(item.get("lifetime_revenue") or 0) * revenue_conversion
        current_revenue = float(item.get("current_year_revenue") or 0) * revenue_conversion
        pipeline = float(item.get("pipeline_value") or 0) * revenue_conversion
        lifetime_revenue_inr += lifetime_revenue
        current_year_revenue_inr += current_revenue
        pipeline_value_inr += pipeline
        category_revenue[item["category"]] = category_revenue.get(item["category"], 0) + current_revenue
        product_performance.append({
            "id": item["id"],
            "name": item["name"],
            "category": item["category"],
            "revenue_inr": round(current_revenue),
            "pipeline_inr": round(pipeline),
            "closed_won_deals": int(item.get("closed_won_deals") or 0),
            "open_opportunities": int(item.get("open_opportunities") or 0),
        })
        renewal = item["renewal_date"]
        if hasattr(renewal, "date"):
            renewal = renewal.date()
        if isinstance(renewal, date):
            days = (renewal - today).days
            if days <= 90:
                renewals.append({"name": item["name"], "date": renewal.isoformat(), "days": days})

    assigned = sum(int(item["assigned_licenses"] or 0) for item in software_rows)
    available = sum(int(item["available_licenses"] or 0) for item in software_rows)
    return {
        "metrics": {
            "products": len(software_rows), "inventory_value_inr": round(inventory_inr),
            "annual_license_cost_inr": round(license_inr),
            "annual_maintenance_inr": round(maintenance_inr),
            "lifetime_revenue_inr": round(lifetime_revenue_inr),
            "current_year_revenue_inr": round(current_year_revenue_inr),
            "pipeline_value_inr": round(pipeline_value_inr),
            "pipeline_coverage": round(pipeline_value_inr / max(current_year_revenue_inr, 1), 2),
            "utilization": round(100 * assigned / max(available, 1), 1),
            "open_queries": sum(1 for row in query_rows if row["status"] == "New"),
        },
        "category_costs": [{"category": key, "value": round(value)} for key, value in sorted(category_costs.items(), key=lambda pair: pair[1], reverse=True)],
        "category_revenue": [{"category": key, "value": round(value)} for key, value in sorted(category_revenue.items(), key=lambda pair: pair[1], reverse=True)],
        "product_performance": sorted(product_performance, key=lambda item: item["revenue_inr"], reverse=True),
        "renewals": sorted(renewals, key=lambda row: row["days"]),
        "query_status": {
            "new": sum(1 for row in query_rows if row["status"] == "New"),
            "analyzed": sum(1 for row in query_rows if row["status"] == "Analyzed"),
        },
    }


@app.get("/api/insights")
def insights(_: dict = Depends(current_user)) -> list[dict]:
    return [
        {
            "id": "INS-001", "type": "warning", "priority": "Medium",
            "title": "License utilization opportunity",
            "message": "ContractSphere CLM is below 40% utilization. Consider bundling it with legal operations proposals.",
            "impact": "Potential INR 8.6L optimization", "confidence": 91,
            "owner": "Portfolio Manager", "target_date": "2026-07-10",
            "affected_products": ["ContractSphere CLM"],
            "evidence": [
                {"label": "Purchased licenses", "value": "300"},
                {"label": "Assigned licenses", "value": "118"},
                {"label": "Current utilization", "value": "39.3%"},
                {"label": "Unused annual value", "value": "INR 8.6L"},
            ],
            "actions": [
                "Bundle 60 CLM licenses into active banking and technology proposals.",
                "Offer a 30-day adoption workshop to current legal operations customers.",
                "Review license volume before the next vendor renewal.",
            ],
        },
        {
            "id": "INS-002", "type": "critical", "priority": "Critical",
            "title": "Renewal action required",
            "message": "VaultBackup Enterprise renews within 30 days. Consolidate expected healthcare and banking demand before negotiation.",
            "impact": "Negotiation window open", "confidence": 96,
            "owner": "Commercial Director", "target_date": "2026-06-20",
            "affected_products": ["VaultBackup Enterprise"],
            "evidence": [
                {"label": "Days to renewal", "value": "14 days"},
                {"label": "Current utilization", "value": "80%"},
                {"label": "Open pipeline", "value": "INR 5.2Cr"},
                {"label": "Active opportunities", "value": "6"},
            ],
            "actions": [
                "Consolidate forecast demand before opening vendor negotiations.",
                "Request volume pricing for an additional 20 capacity licenses.",
                "Prepare a renewal decision pack with margin and pipeline scenarios.",
            ],
        },
        {
            "id": "INS-003", "type": "positive", "priority": "High",
            "title": "Demand signal detected",
            "message": "Security products represent the strongest recent inquiry cluster. Preserve capacity in IAM, backup, and cloud compliance.",
            "impact": "3 high-priority opportunities", "confidence": 88,
            "owner": "Sales Operations", "target_date": "2026-06-30",
            "affected_products": ["SecureFlow IAM", "VaultBackup Enterprise", "CloudGuard CSPM"],
            "evidence": [
                {"label": "Security inquiries", "value": "3 of 6"},
                {"label": "Combined pipeline", "value": "INR 14.6Cr"},
                {"label": "Average match score", "value": "87%"},
                {"label": "Available capacity", "value": "407 units"},
            ],
            "actions": [
                "Create a regulated-industry security solution bundle.",
                "Reserve implementation capacity for the three active opportunities.",
                "Launch a banking and healthcare campaign using the matched use cases.",
            ],
        },
    ]


@app.post("/api/insights/{insight_id}/apply")
def apply_insight(insight_id: str, user: dict = Depends(current_user)) -> dict:
    require_role(user, "admin", "sales")
    insight = next((item for item in insights(user) if item["id"] == insight_id), None)
    if not insight:
        raise HTTPException(404, "Insight not found")
    audit(repository, user["id"], "apply", "insight", insight_id, {
        "title": insight["title"], "owner": insight["owner"], "target_date": insight["target_date"],
    })
    return {"id": insight_id, "status": "Action started", "owner": insight["owner"], "target_date": insight["target_date"]}


@app.get("/api/procurement/analysis")
def procurement(user: dict = Depends(current_user)) -> list[dict]:
    require_role(user, "admin", "sales", "viewer")
    return procurement_analysis(repository)


@app.get("/api/procurement/vendors")
def procurement_vendors(user: dict = Depends(current_user)) -> list[dict]:
    require_role(user, "admin", "sales", "viewer")
    return vendor_scorecards(repository)


@app.get("/api/procurement/purchase-orders")
def purchase_orders(user: dict = Depends(current_user)) -> list[dict]:
    require_role(user, "admin", "sales", "viewer")
    return list(reversed(repository.all("purchase_orders")))


@app.post("/api/procurement/purchase-orders")
def create_purchase_order(payload: PurchaseOrderPayload, user: dict = Depends(current_user)) -> dict:
    require_role(user, "admin", "sales")
    vendor = repository.find("vendors", "id", payload.vendor_id)
    if not repository.find("software", "id", payload.software_id) or not vendor:
        raise HTTPException(404, "Software or vendor not found")
    item = {
        "id": repository.next_id("purchase_orders", "PO"),
        **payload.model_dump(),
        "total": round(payload.quantity * payload.unit_price, 2),
        "status": "Pending Approval",
        "requested_by": user["name"],
        "approved_by": "",
        "created_at": now(),
        "expected_date": (date.today() + timedelta(days=int(vendor["actual_lead_days"] or 30))).isoformat(),
    }
    repository.append("purchase_orders", item)
    audit(repository, user["id"], "create", "purchase_order", item["id"], item)
    return item


@app.post("/api/procurement/purchase-orders/{po_id}/approve")
def approve_purchase_order(po_id: str, user: dict = Depends(current_user)) -> dict:
    require_role(user, "admin")
    po = repository.find("purchase_orders", "id", po_id)
    if not po:
        raise HTTPException(404, "Purchase order not found")
    repository.update("purchase_orders", "id", po_id, {"status": "Approved", "approved_by": user["name"]})
    audit(repository, user["id"], "approve", "purchase_order", po_id)
    return repository.find("purchase_orders", "id", po_id)


@app.get("/api/procurement/purchase-orders/{po_id}/pdf")
def purchase_order_pdf(po_id: str, user: dict = Depends(current_user)) -> Response:
    require_role(user, "admin", "sales", "viewer")
    po = repository.find("purchase_orders", "id", po_id)
    if not po:
        raise HTTPException(404, "Purchase order not found")
    content = generate_po_pdf(repository, po)
    return Response(content, media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="{po_id}.pdf"'})


@app.get("/api/license-operations")
def license_operations(user: dict = Depends(current_user)) -> dict:
    require_role(user, "admin", "sales", "viewer")
    pools = repository.all("license_pools")
    allocations = repository.all("allocations")
    customers = {row["id"]: row["name"] for row in repository.all("customers")}
    software = {row["id"]: row["name"] for row in repository.all("software")}
    today = date.today()
    enriched_pools = []
    for pool in pools:
        expiry = pool["expiry_date"]
        if hasattr(expiry, "date"):
            expiry = expiry.date()
        if isinstance(expiry, datetime):
            expiry = expiry.date()
        if isinstance(expiry, str):
            expiry = date.fromisoformat(expiry[:10])
        enriched_pools.append({
            **pool, "software_name": software.get(pool["software_id"], pool["software_id"]),
            "available": int(pool["quantity"]) - int(pool["assigned"]),
            "days_to_expiry": (expiry - today).days if isinstance(expiry, date) else None,
        })
    enriched_allocations = [{**row, "customer_name": customers.get(row["customer_id"], row["customer_id"]), "software_name": software.get(row["software_id"], row["software_id"])} for row in allocations]
    return {
        "pools": sorted(enriched_pools, key=lambda row: row["days_to_expiry"] if row["days_to_expiry"] is not None else 99999),
        "allocations": enriched_allocations,
        "picking_policy": "FIFO - allocate the earliest-expiring active license pool first",
    }


@app.get("/api/channels")
def channels(user: dict = Depends(current_user)) -> list[dict]:
    require_role(user, "admin", "sales", "viewer")
    return repository.all("channels")


@app.post("/api/channels/{channel_id}/sync")
def sync_channel(channel_id: str, user: dict = Depends(current_user)) -> dict:
    require_role(user, "admin", "sales")
    channel = repository.find("channels", "id", channel_id)
    if not channel:
        raise HTTPException(404, "Channel not found")
    repository.update("channels", "id", channel_id, {"status": "Connected", "last_sync": now(), "products_synced": len(repository.all("software"))})
    audit(repository, user["id"], "sync", "channel", channel_id)
    return repository.find("channels", "id", channel_id)


@app.post("/api/roi")
def roi(payload: RoiPayload, _: dict = Depends(current_user)) -> dict:
    return roi_simulation(repository, payload.holding_reduction, payload.stockout_reduction, payload.utilization_gain)


@app.get("/api/subscription-plans")
def subscription_plans(_: dict = Depends(current_user)) -> list[dict]:
    return repository.all("subscription_plans")


FRONTEND_DIR = BASE_DIR / "frontend"
app.mount("/assets", StaticFiles(directory=FRONTEND_DIR / "assets"), name="assets")


@app.get("/{path:path}")
def frontend(path: str) -> FileResponse:
    requested = FRONTEND_DIR / path
    if path and requested.exists() and requested.is_file():
        return FileResponse(requested)
    return FileResponse(FRONTEND_DIR / "index.html")
