# Software Match Intelligence Portal

A full-stack prototype for managing a software resale inventory, receiving simulated
customer inquiries, and ranking suitable products with explainable match scores.

**Company website:** [www.lean2automate.com](https://www.lean2automate.com)

## Features

- Dashboard for inventory value, licensing, maintenance, renewals, and utilization
- Software inventory with INR/USD pricing and product metadata
- Product-level revenue, pipeline, deal, and CRM synchronization metadata
- Simulated email inbox for customer inquiries
- Ranked software recommendations with score breakdowns and requirement gaps
- Optional OpenAI analysis with a deterministic local matching fallback
- Demo roles: Admin, Sales, Viewer, and Customer
- Excel workbook used as the prototype database
- Inventory CRUD, Excel import/export, and side-by-side product comparison
- Sales opportunities, weighted forecasting, proposal PDFs, alerts, and audit logs
- Configuration-gated Salesforce, Gmail, and Microsoft Outlook connectors

## Run locally

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r backend\requirements.txt
python backend\scripts\seed_workbook.py
python -m uvicorn app.main:app --app-dir backend --reload
```

Open `http://127.0.0.1:8000`.

The inventory AI service runs separately on port `8000`, so the integrated portal now runs on:

```text
http://127.0.0.1:8080
```

Start the inventory AI service first from `C:\D\LLM_Software_Inventory`, then run this portal.

After dependencies are installed, the shorter Windows command is:

```powershell
.\run.ps1
```

## Deploy on Render

The repository includes [`render.yaml`](render.yaml) for a Render Blueprint deployment.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/nikskhore/software-match-intelligence-portal)

The Blueprint creates a Python web service in Singapore, deploys automatically from
`main`, checks `/api/health`, and registers `portal.lean2automate.com` as the custom
domain.

After Render creates the service:

1. Copy the service hostname shown by Render, such as
   `lean2automate-software-portal.onrender.com`.
2. In GoDaddy DNS, add a `CNAME` record with name `portal` and value set to that
   Render hostname.
3. Return to Render's **Settings > Custom Domains** section and verify the domain.

The free service filesystem is ephemeral. Excel data is regenerated after service
replacement or restart, so use a persistent disk or migrate the repository layer to
MySQL before using the portal for production data.

The workbook is created at `backend/data/portal_data.xlsx`. If it is missing, the
backend creates it automatically.

If `portal_data.xlsx` is open and locked by Microsoft Excel during a schema upgrade,
the portal temporarily uses `backend/data/portal_data_extended.xlsx`. Close Excel
and restart the portal to allow normal in-place migration.

## Salesforce-ready commercial data

Each software row includes synthetic lifetime revenue, current-year revenue, open
pipeline, closed-won deals, open opportunities, a CRM product ID, and a last-sync
date. These fields are structured for a future Salesforce integration:

- `crm_product_id` maps to Salesforce `Product2`
- Revenue and deal counts are aggregated from `Opportunity`
- Product-specific revenue is linked through `OpportunityLineItem`

The current prototype does not connect to a live Salesforce organization.

## Connector configuration

The portal runs all connector workflows in demo mode by default. Live credentials
are supplied only through `.env`:

```text
SALESFORCE_INSTANCE_URL=
SALESFORCE_ACCESS_TOKEN=
GMAIL_CREDENTIALS_JSON=
MICROSOFT_GRAPH_TOKEN=
```

Salesforce synchronization follows the `Product2`, `Opportunity`, and
`OpportunityLineItem` model. Gmail ingestion is structured around message list/get,
and Outlook ingestion is structured for Microsoft Graph mail resources.

## Optional OpenAI configuration

Create `.env` from `.env.example` and set a newly generated API key:

```text
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4.1-mini
```

Never commit `.env`. The application works without a key by using the deterministic
matching engine.

## Inventory AI integration

The portal backend securely proxies the inventory AI service. Browser code never receives the AI
JWT secret. Configure these values in the portal `.env`:

```text
INVENTORY_AI_URL=http://127.0.0.1:8000
INVENTORY_AI_JWT_SECRET=<same JWT_SECRET used by the inventory AI service>
```

Run both applications in separate terminals:

```powershell
# Terminal 1
cd C:\D\LLM_Software_Inventory
powershell.exe -ExecutionPolicy Bypass -File .\scripts\start-native.ps1

# Terminal 2
cd C:\D\software-match-intelligence-portal-main
powershell.exe -ExecutionPolicy Bypass -File .\run.ps1
```

Open `http://127.0.0.1:8080`, sign in, and select **AI insights**. The screen shows live inventory
analytics, recommendations, anomalies, replacement forecasts, citations, and conversational RAG
answers from the inventory AI service.

## Demo users

| Role | Email | Password |
|---|---|---|
| Admin | admin@lean2automate.demo | demo123 |
| Sales | sales@lean2automate.demo | demo123 |
| Viewer | viewer@lean2automate.demo | demo123 |
| Customer | priya@apexbank.demo | demo123 |

## API

- `POST /api/auth/login`
- `GET /api/dashboard`
- `GET /api/software`
- `GET /api/queries`
- `POST /api/queries/{query_id}/analyze`
- `GET /api/analyses/{query_id}`
- `GET /api/insights`

Authentication is intentionally demo-only. Replace it with password hashing, JWTs,
and persistent sessions before production use. The repository boundary is designed
so the Excel implementation can later be replaced by MySQL.
