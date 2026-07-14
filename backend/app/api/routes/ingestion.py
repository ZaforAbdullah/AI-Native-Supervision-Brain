from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
import json
import csv
import io
from typing import List
from app.database import get_db
from app.models.models import Advisor
from app.schemas.schemas import IngestionResponse
from app.api.deps import require_admin
from app.models.models import User

router = APIRouter()


@router.post("/json", response_model=IngestionResponse)
async def ingest_json(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    try:
        content = await file.read()
        data = json.loads(content)
        if not isinstance(data, list):
            data = [data]

        ingested = 0
        for record in data:
            existing = db.query(Advisor).filter(Advisor.advisor_ref == record.get("advisor_ref")).first()
            if existing:
                for k, v in record.items():
                    if hasattr(existing, k):
                        setattr(existing, k, v)
            else:
                advisor = Advisor(**{k: v for k, v in record.items() if hasattr(Advisor, k)})
                db.add(advisor)
            ingested += 1

        db.commit()
        return IngestionResponse(success=True, advisors_ingested=ingested, message=f"Ingested {ingested} advisor records")

    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON file")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sample", response_model=IngestionResponse)
def load_sample_data(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    from app.seed_data import seed_sample_advisors
    count = seed_sample_advisors(db)
    return IngestionResponse(
        success=True,
        advisors_ingested=count,
        message=f"Loaded {count} sample advisor records with synthetic data"
    )
