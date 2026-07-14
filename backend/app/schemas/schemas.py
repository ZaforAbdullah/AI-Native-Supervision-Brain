from pydantic import BaseModel, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class RiskGradeEnum(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class Token(BaseModel):
    access_token: str
    token_type: str
    user: "UserOut"


class TokenData(BaseModel):
    email: Optional[str] = None


class UserBase(BaseModel):
    email: str
    full_name: str
    is_admin: bool = False
    receive_alerts: bool = True


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    receive_alerts: Optional[bool] = None
    password: Optional[str] = None


class UserOut(UserBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class LenderSpreadItem(BaseModel):
    lender: str
    percentage: float
    case_count: int


class ProviderSpreadItem(BaseModel):
    provider: str
    percentage: float
    case_count: int
    avg_commission_rate: Optional[float] = None
    is_high_commission: Optional[bool] = False


class FileReviewResult(BaseModel):
    month: str
    grade: str
    cases_reviewed: int
    passed: int
    failed: int


class FileReviewDeficiency(BaseModel):
    code: str
    description: str
    count: int
    lender_related: Optional[str] = None


class AdvisorBase(BaseModel):
    full_name: str
    firm_name: str
    firm_ref: str
    status: str = "active"


class AdvisorCreate(AdvisorBase):
    advisor_ref: str
    mortgage_lender_spread: Optional[List[LenderSpreadItem]] = None
    protection_provider_spread: Optional[List[ProviderSpreadItem]] = None
    file_review_results: Optional[List[FileReviewResult]] = None
    file_review_deficiencies: Optional[List[FileReviewDeficiency]] = None
    enhanced_financial_monitoring: bool = False


class AdvisorOut(AdvisorBase):
    id: int
    advisor_ref: str
    current_risk_grade: str
    current_risk_score: float
    last_analysed_at: Optional[datetime] = None
    created_at: datetime
    enhanced_financial_monitoring: bool

    class Config:
        from_attributes = True


class AdvisorDetail(AdvisorOut):
    mortgage_lender_spread: Optional[List[Dict]] = None
    protection_provider_spread: Optional[List[Dict]] = None
    file_review_results: Optional[List[Dict]] = None
    file_review_deficiencies: Optional[List[Dict]] = None
    findings: Optional[List["FindingOut"]] = None


class RiskRuleBase(BaseModel):
    name: str
    description: Optional[str] = None
    dataset: str
    condition_type: str
    threshold_value: float
    threshold_unit: str = "percent"
    risk_grade: str
    risk_weight: float = 1.0
    is_active: bool = True
    requires_edd: bool = False
    ai_prompt_hint: Optional[str] = None


class RiskRuleCreate(RiskRuleBase):
    pass


class RiskRuleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    threshold_value: Optional[float] = None
    risk_grade: Optional[str] = None
    risk_weight: Optional[float] = None
    is_active: Optional[bool] = None
    requires_edd: Optional[bool] = None
    ai_prompt_hint: Optional[str] = None


class RiskRuleOut(RiskRuleBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class FindingOut(BaseModel):
    id: int
    analysis_run_id: int
    advisor_id: int
    rule_id: Optional[int] = None
    finding_type: str
    risk_grade: str
    risk_score: float
    title: str
    description: Optional[str] = None
    evidence: Optional[Dict] = None
    triggered_value: Optional[float] = None
    threshold_value: Optional[float] = None
    requires_edd: bool
    edd_completed: bool
    edd_notes: Optional[str] = None
    ai_analysis: Optional[str] = None
    source: str = "rule"
    created_at: datetime

    class Config:
        from_attributes = True


class AnalysisRunOut(BaseModel):
    id: int
    run_ref: str
    status: str
    trigger: str
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    advisors_analysed: int
    risks_identified: int
    high_risk_count: int
    critical_risk_count: int
    error_message: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class TriggerAnalysisRequest(BaseModel):
    advisor_ids: Optional[List[int]] = None
    trigger: str = "manual"


class ReportOut(BaseModel):
    id: int
    report_ref: str
    analysis_run_id: int
    report_type: str
    title: str
    summary: Optional[str] = None
    total_advisors: int
    high_risk_count: int
    critical_risk_count: int
    pdf_path: Optional[str] = None
    excel_path: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class DashboardStats(BaseModel):
    total_advisors: int
    active_advisors: int
    critical_risk_count: int
    high_risk_count: int
    medium_risk_count: int
    low_risk_count: int
    last_analysis_run: Optional[datetime] = None
    total_reports: int
    risk_trend: List[Dict[str, Any]]
    top_risk_advisors: List[Dict[str, Any]]
    lender_concentration_alerts: int
    provider_concentration_alerts: int
    efm_flags_active: int


class IngestionResponse(BaseModel):
    success: bool
    advisors_ingested: int
    message: str


class AlertConfig(BaseModel):
    enabled: bool = True
    recipients: List[str] = []
    risk_threshold: str = "high"


class SystemConfigOut(BaseModel):
    key: str
    value: Optional[str] = None
    description: Optional[str] = None


AdvisorDetail.model_rebuild()
