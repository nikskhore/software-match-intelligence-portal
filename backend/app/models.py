from typing import Literal

from pydantic import BaseModel, Field


Role = Literal["admin", "sales", "viewer", "customer"]


class LoginRequest(BaseModel):
    email: str
    password: str


class User(BaseModel):
    id: str
    name: str
    email: str
    role: Role
    customer_id: str | None = None


class MatchResult(BaseModel):
    software_id: str
    software_name: str
    score: int = Field(ge=0, le=100)
    capability_score: int
    industry_score: int
    deployment_score: int
    budget_score: int
    compliance_score: int
    reasons: list[str]
    gaps: list[str]
    annual_cost: float
    currency: str


class AnalysisResponse(BaseModel):
    query_id: str
    summary: str
    extracted_requirements: list[str]
    confidence: int = Field(ge=0, le=100)
    matches: list[MatchResult]
    source: Literal["deterministic", "openai"]


class SoftwarePayload(BaseModel):
    name: str
    vendor: str
    category: str
    description: str
    capabilities: str
    industries: str
    deployment: str
    compliance: str
    license_model: str
    currency: str
    unit_license_cost: float
    maintenance_pct: float = 0
    available_licenses: int = 0
    assigned_licenses: int = 0
    renewal_date: str
    status: str = "Active"


class OpportunityPayload(BaseModel):
    query_id: str
    software_id: str
    name: str
    owner: str
    stage: str = "Qualification"
    probability: int = Field(default=25, ge=0, le=100)
    amount: float
    currency: str
    expected_close: str


class FeedbackPayload(BaseModel):
    query_id: str
    software_id: str
    rating: Literal["approved", "rejected"]
    comment: str = ""


class PurchaseOrderPayload(BaseModel):
    software_id: str
    vendor_id: str
    quantity: int = Field(gt=0)
    unit_price: float = Field(gt=0)
    currency: str


class RoiPayload(BaseModel):
    holding_reduction: float = Field(default=20, ge=0, le=100)
    stockout_reduction: float = Field(default=35, ge=0, le=100)
    utilization_gain: float = Field(default=10, ge=0, le=100)
