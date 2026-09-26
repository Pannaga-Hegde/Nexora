import secrets
import uuid
from datetime import datetime, timedelta
from pydantic import BaseModel
from typing import List, Optional

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import get_current_user
from ..models import (
    Project,
    ProjectMember,
    User,
    Milestone,
    Task,
)
from ..schemas import (
    ProjectCreate,
    ProjectMemberResponse,
    ProjectResponse,
)
from ..templates.project_templates import (
    ACADEMIC_PROJECT_TEMPLATES,
    get_template_by_id,
)


router = APIRouter(
    prefix="/projects",
    tags=["Projects"],
)


@router.get("/templates")
def list_project_templates():
    """
    Returns available project templates for Academic Project Mode.
    """
    return ACADEMIC_PROJECT_TEMPLATES


# ============================================================
# POST /projects
# ============================================================

@router.post(
    "",
    response_model=ProjectResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_project(
    project_data: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Creates a new project. Supports template-driven structure initialization (Milestones & Tasks)
    within a single atomic database transaction. Rollbacks cleanly if any error occurs.
    """
    start_dt = None
    if project_data.start_date:
        try:
            start_dt = datetime.fromisoformat(project_data.start_date.replace("Z", "+00:00"))
        except Exception:
            start_dt = datetime.utcnow()
    else:
        start_dt = datetime.utcnow()

    end_dt = None
    if project_data.end_date:
        try:
            end_dt = datetime.fromisoformat(project_data.end_date.replace("Z", "+00:00"))
        except Exception:
            end_dt = None

    proj_type = project_data.project_type or (project_data.template_id if project_data.template_id else "custom")

    creator_user_id = uuid.UUID(current_user["id"]) if isinstance(current_user["id"], str) else current_user["id"]

    try:
        # Atomic Transaction
        project = Project(
            id=uuid.uuid4(),
            name=project_data.name,
            description=project_data.description,
            status=project_data.status or "Planning",
            project_type=proj_type,
            start_date=start_dt,
            end_date=end_dt,
        )

        db.add(project)
        db.flush()

        # Automatically make creator the project manager
        membership = ProjectMember(
            project_id=project.id,
            user_id=creator_user_id,
            project_role="manager",
        )
        db.add(membership)

        # Handle Initial Member Invites if passed
        if project_data.initial_member_emails:
            for email_str in project_data.initial_member_emails:
                clean_email = email_str.strip().lower()
                if clean_email:
                    target_user = db.query(User).filter(User.email == clean_email).first()
                    if target_user and target_user.id != creator_user_id:
                        # Add as project member
                        existing_m = db.scalar(
                            select(ProjectMember).where(
                                ProjectMember.project_id == project.id,
                                ProjectMember.user_id == target_user.id
                            )
                        )
                        if not existing_m:
                            db.add(ProjectMember(
                                project_id=project.id,
                                user_id=target_user.id,
                                project_role="member"
                            ))

        # Check if custom edited phases were provided by user
        if project_data.custom_phases and len(project_data.custom_phases) > 0:
            for idx, phase_item in enumerate(project_data.custom_phases):
                m_due = start_dt + timedelta(weeks=(idx + 1) * 2) if start_dt else None
                m_record = Milestone(
                    id=uuid.uuid4(),
                    project_id=project.id,
                    title=phase_item.name,
                    description=phase_item.description or f"Phase {idx + 1} of project",
                    due_date=m_due,
                    is_completed=False,
                )
                db.add(m_record)
                db.flush()

                if phase_item.tasks:
                    for t_item in phase_item.tasks:
                        t_due = m_due
                        task_record = Task(
                            id=uuid.uuid4(),
                            project_id=project.id,
                            milestone_id=m_record.id,
                            title=t_item.title,
                            description=t_item.description,
                            status="TODO",
                            priority=t_item.priority or "MEDIUM",
                            reporter_id=creator_user_id,
                            due_date=t_due,
                        )
                        db.add(task_record)

        # Otherwise check if predefined template_id was provided
        elif project_data.template_id and project_data.template_id != "custom":
            template = get_template_by_id(project_data.template_id)
            if template:
                for phase in template.get("phases", []):
                    rel_wk = phase.get("relative_week", 1)
                    m_due = start_dt + timedelta(weeks=rel_wk) if start_dt else None

                    m_record = Milestone(
                        id=uuid.uuid4(),
                        project_id=project.id,
                        title=phase.get("name"),
                        description=phase.get("description"),
                        due_date=m_due,
                        is_completed=False,
                    )
                    db.add(m_record)
                    db.flush()

                    for task_def in phase.get("tasks", []):
                        t_rel_wk = task_def.get("relative_week", rel_wk)
                        t_due = start_dt + timedelta(weeks=t_rel_wk) if start_dt else None

                        task_record = Task(
                            id=uuid.uuid4(),
                            project_id=project.id,
                            milestone_id=m_record.id,
                            title=task_def.get("title"),
                            description=task_def.get("description"),
                            status="TODO",
                            priority=task_def.get("priority", "MEDIUM"),
                            reporter_id=creator_user_id,
                            due_date=t_due,
                        )
                        db.add(task_record)

        db.commit()
        db.refresh(project)
        return project

    except Exception as err:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create project from template: {str(err)}"
        )


# ============================================================
# GET /projects
# ============================================================

@router.get(
    "",
    response_model=List[ProjectResponse],
)
def get_my_projects(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    statement = (
        select(Project)
        .join(
            ProjectMember,
            ProjectMember.project_id == Project.id,
        )
        .where(
            ProjectMember.user_id == current_user["id"]
        )
        .order_by(
            Project.created_at.desc()
        )
    )

    return db.scalars(statement).all()


# ============================================================
# POST /projects/{project_id}/members
# ============================================================

@router.post(
    "/{project_id}/members",
    response_model=ProjectMemberResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_project_member(
    project_id: uuid.UUID,
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(
            status_code=404,
            detail="Project not found",
        )

    current_membership = db.scalar(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == current_user["id"],
        )
    )

    if not current_membership:
        raise HTTPException(
            status_code=403,
            detail="You are not a member of this project",
        )

    if current_membership.project_role != "manager":
        raise HTTPException(
            status_code=403,
            detail="Only project managers can add members",
        )

    user = db.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

    existing_membership = db.scalar(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user_id,
        )
    )

    if existing_membership:
        raise HTTPException(
            status_code=409,
            detail="User is already a member of this project",
        )

    membership = ProjectMember(
        project_id=project_id,
        user_id=user_id,
        project_role="member",
    )

    db.add(membership)
    db.commit()
    db.refresh(membership)

    return membership


class InviteMemberPayload(BaseModel):
    email_or_username: str
    role: Optional[str] = "member"


@router.get("/{project_id}/members")
def get_project_members(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    user_id = uuid.UUID(current_user["id"]) if isinstance(current_user["id"], str) else current_user["id"]
    membership = db.scalar(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user_id,
        )
    )
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You are not a member of this project"
        )

    members = (
        db.query(User, ProjectMember.project_role, ProjectMember.joined_at)
        .join(ProjectMember, ProjectMember.user_id == User.id)
        .filter(ProjectMember.project_id == project_id)
        .all()
    )

    result = []
    for user, role, joined_at in members:
        result.append({
            "id": str(user.id),
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name or user.username,
            "project_role": role,
            "joined_at": joined_at.isoformat() if joined_at else None,
        })
    return result


@router.post("/{project_id}/invite")
def invite_member_by_identifier(
    project_id: uuid.UUID,
    payload: InviteMemberPayload,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    from app.services.email_service import send_project_invitation_email
    from app.auth import get_password_hash

    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    user_id = uuid.UUID(current_user["id"]) if isinstance(current_user["id"], str) else current_user["id"]
    membership = db.scalar(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user_id,
        )
    )
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You are not a member of this project"
        )

    identifier = payload.email_or_username.strip()
    target_user = db.query(User).filter(
        (User.email == identifier) | (User.username == identifier)
    ).first()

    inviter_name = current_user.get("full_name") or current_user.get("username") or "A team member"

    if not target_user:
        # If identifier looks like an email or new user, auto-provision an external user account
        if "@" in identifier:
            email_addr = identifier.lower()
            base_username = email_addr.split("@")[0]
            # Ensure unique username
            uniq_suffix = str(uuid.uuid4())[:4]
            username = f"{base_username}_{uniq_suffix}"
            
            # Generate cryptographically secure random unusable password hash
            unusable_password = secrets.token_urlsafe(64)
            target_user = User(
                id=uuid.uuid4(),
                username=username,
                email=email_addr,
                full_name=base_username.capitalize(),
                password_hash=get_password_hash(unusable_password),
                system_role="student"
            )
            db.add(target_user)
            db.commit()
            db.refresh(target_user)
        else:
            raise HTTPException(
                status_code=404,
                detail=f"No user found matching '{identifier}'. If inviting an external member, please enter their full email address."
            )

    existing = db.scalar(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == target_user.id,
        )
    )

    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"User {target_user.full_name or target_user.username} ({target_user.email}) is already a member of this project"
        )

    new_member = ProjectMember(
        project_id=project_id,
        user_id=target_user.id,
        project_role=payload.role or "member",
    )
    db.add(new_member)
    db.commit()

    # Dispatch email notification to recipient (whether existing or external user)
    send_project_invitation_email(
        recipient_email=target_user.email,
        project_name=project.name,
        inviter_name=inviter_name,
        role=payload.role or "member"
    )

    return {
        "message": f"Invitation successfully sent to {target_user.email}! Added to project as {payload.role or 'member'}.",
        "user": {
            "id": str(target_user.id),
            "username": target_user.username,
            "email": target_user.email,
            "full_name": target_user.full_name,
            "project_role": payload.role or "member"
        }
    }


# ============================================================
# LEAVE PROJECT (Non-destructive Project "Delete" / Leave)
# ============================================================

def handle_leave_project(
    project_id: uuid.UUID,
    db: Session,
    current_user: dict,
):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    user_id = uuid.UUID(current_user["id"]) if isinstance(current_user["id"], str) else current_user["id"]

    membership = db.scalar(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user_id,
        )
    )

    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You are not a member of this project"
        )

    # Check if this user is a manager/owner and other members exist
    all_members = db.scalars(
        select(ProjectMember).where(ProjectMember.project_id == project_id)
    ).all()

    other_members = [m for m in all_members if m.user_id != user_id]

    if membership.project_role in ["manager", "owner", "admin"] and other_members:
        # Check if there is another manager
        has_another_manager = any(m.project_role in ["manager", "owner", "admin"] for m in other_members)
        if not has_another_manager:
            # Promote the first remaining member to manager so the project maintains a lead
            other_members[0].project_role = "manager"

    # Remove ONLY the current user's membership
    db.delete(membership)
    db.commit()

    return {
        "status": "success",
        "message": "Successfully left the project. Project data has been preserved for remaining members.",
        "project_id": str(project_id),
    }


@router.post("/{project_id}/leave", status_code=status.HTTP_200_OK)
def leave_project_post(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Leave a project. Removes only the current user's membership while preserving
    all tasks, messages, files, milestones, and project history for other members.
    """
    return handle_leave_project(project_id, db, current_user)


@router.delete("/{project_id}", status_code=status.HTTP_200_OK)
def leave_project_delete(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Leave a project (non-destructive removal of the current user's membership).
    """
    return handle_leave_project(project_id, db, current_user)


