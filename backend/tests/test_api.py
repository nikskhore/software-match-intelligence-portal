from pathlib import Path
import math

from fastapi.testclient import TestClient

from app import main
from app.repository import ExcelRepository
from app.seed_data import create_workbook


def test_role_aware_analysis_flow(tmp_path: Path):
    workbook = tmp_path / "portal_data.xlsx"
    create_workbook(workbook)
    main.repository = ExcelRepository(workbook)
    client = TestClient(main.app)

    assert client.get("/api/health").status_code == 200
    software = client.get("/api/software", headers={"X-User-Id": "USR-002"}).json()
    assert len(software) == 10
    assert software[0]["lifetime_revenue"] > software[0]["current_year_revenue"]
    assert software[0]["crm_product_id"].startswith("SF-PROD-")
    dashboard = client.get("/api/dashboard", headers={"X-User-Id": "USR-002"}).json()
    assert dashboard["metrics"]["current_year_revenue_inr"] > 0
    assert dashboard["metrics"]["pipeline_value_inr"] > 0
    assert len(dashboard["product_performance"]) == 10
    assert len(client.get("/api/queries", headers={"X-User-Id": "USR-004"}).json()) == 2
    assert client.post("/api/queries/QRY-1001/analyze", headers={"X-User-Id": "USR-003"}).status_code == 403

    response = client.post("/api/queries/QRY-1001/analyze", headers={"X-User-Id": "USR-002"})
    assert response.status_code == 200
    assert response.json()["matches"][0]["software_name"] == "SecureFlow IAM"

    saved = client.get("/api/analyses/QRY-1001", headers={"X-User-Id": "USR-004"})
    assert saved.status_code == 200
    assert saved.json()["matches"][0]["software_name"] == "SecureFlow IAM"


def test_inventory_ai_bridge(tmp_path: Path, monkeypatch):
    workbook = tmp_path / "portal_data.xlsx"
    create_workbook(workbook)
    main.repository = ExcelRepository(workbook)
    calls = []

    def fake_request(method, path, user, *, params=None, json_body=None):
        calls.append((method, path, user["id"], params, json_body))
        if path == "/ai/status":
            return {"status": "healthy", "pending_jobs": 0}
        if path == "/ai/chat":
            return {
                "answer": "Inventory answer",
                "intent": "inventory_lookup",
                "confidence": 0.9,
                "reasoning": [],
                "recommendations": [],
                "citations": [],
                "conversation_id": "00000000-0000-0000-0000-000000000000",
                "generated_at": "2026-06-15T00:00:00Z",
            }
        return {}

    monkeypatch.setattr(main, "inventory_ai_request", fake_request)
    client = TestClient(main.app)
    headers = {"X-User-Id": "USR-002"}

    status = client.get("/api/inventory-ai/status", headers=headers)
    chat = client.post(
        "/api/inventory-ai/chat",
        headers=headers,
        json={"question": "What is available?", "max_results": 8},
    )

    assert status.status_code == 200
    assert status.json()["status"] == "healthy"
    assert chat.status_code == 200
    assert chat.json()["answer"] == "Inventory answer"
    assert calls[-1][1] == "/ai/chat"
    assert calls[-1][4]["question"] == "What is available?"


def test_growth_operations_and_admin_workflows(tmp_path: Path):
    workbook = tmp_path / "portal_data.xlsx"
    create_workbook(workbook)
    main.repository = ExcelRepository(workbook)
    client = TestClient(main.app)
    admin = {"X-User-Id": "USR-001"}
    sales = {"X-User-Id": "USR-002"}
    viewer = {"X-User-Id": "USR-003"}

    assert client.get("/api/forecast", headers=sales).status_code == 200
    created = client.post("/api/opportunities", headers=sales, json={
        "query_id": "QRY-1001", "software_id": "SW-001",
        "name": "Apex IAM expansion", "owner": "Sara Sales",
        "stage": "Qualification", "probability": 30, "amount": 7200000,
        "currency": "INR", "expected_close": "2026-08-15",
    })
    assert created.status_code == 200
    assert client.post("/api/opportunities", headers=viewer, json=created.json()).status_code == 403

    analysis = client.post("/api/queries/QRY-1001/analyze", headers=sales)
    assert analysis.status_code == 200
    proposal = client.get("/api/proposals/QRY-1001", headers=sales)
    assert proposal.status_code == 200
    assert proposal.headers["content-type"] == "application/pdf"
    assert proposal.content.startswith(b"%PDF")

    feedback = client.post("/api/feedback", headers=sales, json={
        "query_id": "QRY-1001", "software_id": "SW-001",
        "rating": "approved", "comment": "Strong regulated banking fit",
    })
    assert feedback.status_code == 200

    inbox = client.get("/api/email-inbox", headers=sales).json()
    ingested = client.post(f"/api/email-inbox/{inbox[0]['id']}/ingest", headers=sales)
    assert ingested.status_code == 200
    assert ingested.json()["status"] == "New"

    sync = client.post("/api/integrations/salesforce/sync", headers=admin)
    assert sync.status_code == 200
    assert sync.json()["mode"] == "demo"
    assert client.post("/api/integrations/salesforce/sync", headers=sales).status_code == 403

    assert client.get("/api/admin/users", headers=admin).status_code == 200
    assert client.get("/api/admin/audit", headers=admin).json()
    assert client.get("/api/software-export", headers=sales).status_code == 200
    insight_rows = client.get("/api/insights", headers=sales).json()
    assert len(insight_rows[0]["evidence"]) == 4
    assert len(insight_rows[0]["actions"]) == 3
    assert client.post(f"/api/insights/{insight_rows[0]['id']}/apply", headers=sales).status_code == 200

    new_product = {
        "name": "Test Automation Suite", "vendor": "Lean2Automate",
        "category": "Automation", "description": "Test product",
        "capabilities": "workflow automation|api integration",
        "industries": "manufacturing|technology", "deployment": "cloud",
        "compliance": "iso 27001", "license_model": "per user",
        "currency": "INR", "unit_license_cost": 12000,
        "maintenance_pct": 15, "available_licenses": 100,
        "assigned_licenses": 10, "renewal_date": "2027-01-01",
        "status": "Active",
    }
    product = client.post("/api/software", headers=admin, json=new_product)
    assert product.status_code == 200
    product_id = product.json()["id"]
    assert client.put(f"/api/software/{product_id}", headers=admin, json={"status": "Review"}).json()["status"] == "Review"
    assert len(client.get(f"/api/software-compare?ids=SW-001,{product_id}", headers=sales).json()) == 2
    assert client.delete(f"/api/software/{product_id}", headers=admin).status_code == 200


def test_procurement_profitability_and_license_operations(tmp_path: Path):
    workbook = tmp_path / "portal_data.xlsx"
    create_workbook(workbook)
    main.repository = ExcelRepository(workbook)
    client = TestClient(main.app)
    admin = {"X-User-Id": "USR-001"}
    sales = {"X-User-Id": "USR-002"}

    analysis = client.get("/api/procurement/analysis", headers=sales).json()
    first = analysis[0]
    expected = round(math.sqrt(2 * first["annual_demand"] * first["order_cost"] / first["holding_cost_per_unit"]))
    assert first["eoq"] == expected
    assert any(row["dead_stock"] for row in analysis)

    vendors = client.get("/api/procurement/vendors", headers=sales).json()
    assert vendors[0]["overall_score"] >= vendors[-1]["overall_score"]
    assert "price_history" in vendors[0]

    po = client.post("/api/procurement/purchase-orders", headers=sales, json={
        "software_id": "SW-001", "vendor_id": "VEN-001",
        "quantity": 25, "unit_price": 74, "currency": "USD",
    })
    assert po.status_code == 200
    po_id = po.json()["id"]
    assert client.post(f"/api/procurement/purchase-orders/{po_id}/approve", headers=sales).status_code == 403
    assert client.post(f"/api/procurement/purchase-orders/{po_id}/approve", headers=admin).json()["status"] == "Approved"
    pdf = client.get(f"/api/procurement/purchase-orders/{po_id}/pdf", headers=sales)
    assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF")

    license_ops = client.get("/api/license-operations", headers=sales).json()
    assert license_ops["pools"][0]["days_to_expiry"] <= license_ops["pools"][-1]["days_to_expiry"]
    assert "tenant" in license_ops["allocations"][0]

    channels = client.get("/api/channels", headers=sales).json()
    assert client.post(f"/api/channels/{channels[2]['id']}/sync", headers=sales).json()["status"] == "Connected"

    roi = client.post("/api/roi", headers=sales, json={
        "holding_reduction": 20, "stockout_reduction": 35, "utilization_gain": 10,
    }).json()
    assert roi["total_reclaimed_cash_inr"] > 0
    assert len(client.get("/api/subscription-plans", headers=sales).json()) == 3
