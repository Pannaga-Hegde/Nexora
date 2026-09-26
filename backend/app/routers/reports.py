import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Project
from app.dependencies import get_current_user, verify_project_membership
from app.services.pdf_generator import generate_contribution_pdf

router = APIRouter(prefix="/projects/{project_id}/reports", tags=["Reports"])

from typing import Optional
from pydantic import BaseModel, EmailStr

class EmailReportPayload(BaseModel):
    recipient_email: EmailStr
    note: Optional[str] = None

@router.get("/contribution")
def download_contribution_report(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    user_id = current_user["id"] if isinstance(current_user["id"], uuid.UUID) else uuid.UUID(str(current_user["id"]))
    verify_project_membership(db, project_id, user_id)

    try:
        pdf_buffer = generate_contribution_pdf(db, project_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF Generation error: {str(e)}")

    filename = f"Gradesaver_Contribution_Report_{project.name.replace(' ', '_')}.pdf"
    
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )


@router.post("/email")
def email_contribution_report(
    project_id: uuid.UUID,
    payload: EmailReportPayload,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    from app.services.email_service import send_contribution_report_email

    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    user_id = current_user["id"] if isinstance(current_user["id"], uuid.UUID) else uuid.UUID(str(current_user["id"]))
    verify_project_membership(db, project_id, user_id)

    try:
        pdf_buffer = generate_contribution_pdf(db, project_id)
        pdf_bytes = pdf_buffer.getvalue()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF Generation error: {str(e)}")

    sender_name = current_user.get("full_name") or current_user.get("username") or "Team Member"
    
    success = send_contribution_report_email(
        recipient_email=payload.recipient_email,
        project_name=project.name,
        sender_name=sender_name,
        pdf_bytes=pdf_bytes,
        note=payload.note
    )

    if not success:
        raise HTTPException(status_code=500, detail="Failed to dispatch contribution report email.")

    return {
        "message": f"Contribution report PDF successfully emailed to {payload.recipient_email}!",
        "recipient": payload.recipient_email
    }

