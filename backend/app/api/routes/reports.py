from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List
import os
from app.database import get_db
from app.models.models import SupervisionReport
from app.schemas.schemas import ReportOut
from app.api.deps import get_current_active_user
from app.models.models import User

router = APIRouter()


@router.get("/", response_model=List[ReportOut])
def list_reports(
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_active_user),
):
    return (
        db.query(SupervisionReport)
        .order_by(SupervisionReport.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


@router.get("/{report_id}", response_model=ReportOut)
def get_report(report_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_active_user)):
    report = db.query(SupervisionReport).filter(SupervisionReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report


@router.get("/{report_id}/download/pdf")
def download_pdf(report_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_active_user)):
    report = db.query(SupervisionReport).filter(SupervisionReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    if not report.pdf_path or not os.path.exists(report.pdf_path):
        raise HTTPException(status_code=404, detail="PDF file not found")
    return FileResponse(
        report.pdf_path,
        media_type="application/pdf",
        filename=f"{report.report_ref}.pdf",
    )


@router.get("/{report_id}/download/excel")
def download_excel(report_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_active_user)):
    report = db.query(SupervisionReport).filter(SupervisionReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    if not report.excel_path or not os.path.exists(report.excel_path):
        raise HTTPException(status_code=404, detail="Excel file not found")
    return FileResponse(
        report.excel_path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=f"{report.report_ref}.xlsx",
    )
