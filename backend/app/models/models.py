from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, JSON, Enum, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.database import Base


class RiskGrade(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class AnalysisStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_admin = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    receive_alerts = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Advisor(Base):
    __tablename__ = "advisors"

    id = Column(Integer, primary_key=True, index=True)
    advisor_ref = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=False)
    firm_name = Column(String, nullable=False)
    firm_ref = Column(String, nullable=False)
    status = Column(String, default="active")
    joined_date = Column(DateTime(timezone=True))

    mortgage_lender_spread = Column(JSON)
    protection_provider_spread = Column(JSON)
    file_review_results = Column(JSON)
    file_review_deficiencies = Column(JSON)
    enhanced_financial_monitoring = Column(Boolean, default=False)

    current_risk_grade = Column(String, default=RiskGrade.LOW)
    current_risk_score = Column(Float, default=0.0)
    last_analysed_at = Column(DateTime(timezone=True))
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    findings = relationship("Finding", back_populates="advisor", cascade="all, delete-orphan")


class RiskRule(Base):
    __tablename__ = "risk_rules"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text)
    dataset = Column(String, nullable=False)
    condition_type = Column(String, nullable=False)
    threshold_value = Column(Float, nullable=False)
    threshold_unit = Column(String, default="percent")
    risk_grade = Column(String, nullable=False)
    risk_weight = Column(Float, default=1.0)
    is_active = Column(Boolean, default=True)
    requires_edd = Column(Boolean, default=False)
    ai_prompt_hint = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    findings = relationship("Finding", back_populates="rule")


class AnalysisRun(Base):
    __tablename__ = "analysis_runs"

    id = Column(Integer, primary_key=True, index=True)
    run_ref = Column(String, unique=True, index=True)
    status = Column(String, default=AnalysisStatus.PENDING)
    trigger = Column(String, default="manual")
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    advisors_analysed = Column(Integer, default=0)
    risks_identified = Column(Integer, default=0)
    high_risk_count = Column(Integer, default=0)
    critical_risk_count = Column(Integer, default=0)
    error_message = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    triggered_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    findings = relationship("Finding", back_populates="analysis_run", cascade="all, delete-orphan")
    reports = relationship("SupervisionReport", back_populates="analysis_run", cascade="all, delete-orphan")


class Finding(Base):
    __tablename__ = "findings"

    id = Column(Integer, primary_key=True, index=True)
    analysis_run_id = Column(Integer, ForeignKey("analysis_runs.id"), nullable=False)
    advisor_id = Column(Integer, ForeignKey("advisors.id"), nullable=False)
    rule_id = Column(Integer, ForeignKey("risk_rules.id"), nullable=True)

    finding_type = Column(String, nullable=False)
    risk_grade = Column(String, nullable=False)
    risk_score = Column(Float, default=0.0)
    title = Column(String, nullable=False)
    description = Column(Text)
    evidence = Column(JSON)
    triggered_value = Column(Float)
    threshold_value = Column(Float)
    requires_edd = Column(Boolean, default=False)
    edd_completed = Column(Boolean, default=False)
    edd_notes = Column(Text)
    ai_analysis = Column(Text)
    source = Column(String, default="rule", nullable=False)  # "rule" | "ai"
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    advisor = relationship("Advisor", back_populates="findings")
    rule = relationship("RiskRule", back_populates="findings")
    analysis_run = relationship("AnalysisRun", back_populates="findings")


class SupervisionReport(Base):
    __tablename__ = "supervision_reports"

    id = Column(Integer, primary_key=True, index=True)
    report_ref = Column(String, unique=True, index=True)
    analysis_run_id = Column(Integer, ForeignKey("analysis_runs.id"), nullable=False)
    report_type = Column(String, default="network")
    title = Column(String, nullable=False)
    summary = Column(Text)
    total_advisors = Column(Integer, default=0)
    high_risk_count = Column(Integer, default=0)
    critical_risk_count = Column(Integer, default=0)
    pdf_path = Column(String)
    excel_path = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    analysis_run = relationship("AnalysisRun", back_populates="reports")


class SystemConfig(Base):
    __tablename__ = "system_config"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, nullable=False)
    value = Column(Text)
    description = Column(String)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
