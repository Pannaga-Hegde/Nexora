import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, EmailStr, Field

from .models import TaskStatus, TaskPriority, DependencyType, ActivityType

# ============================================================
# USER
# ============================================================

class UserBase(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: EmailStr
    full_name: Optional[str] = Field(default=None, max_length=255)


class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=128)


class UserUpdate(BaseModel):
    username: Optional[str] = Field(default=None, min_length=3, max_length=50)
    email: Optional[EmailStr] = None
    full_name: Optional[str] = Field(default=None, max_length=255)


class UserResponse(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    system_role: str
    created_at: datetime


# ============================================================
# PROJECT
# ============================================================

class CustomTemplatePhaseTask(BaseModel):
    title: str
    description: Optional[str] = None
    priority: Optional[str] = "MEDIUM"

class CustomTemplatePhase(BaseModel):
    name: str
    description: Optional[str] = None
    tasks: Optional[List[CustomTemplatePhaseTask]] = Field(default_factory=list)

class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: Optional[str] = None
    status: str = Field(default="Planning", max_length=50)
    template_id: Optional[str] = None
    project_type: Optional[str] = "custom"
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    initial_member_emails: Optional[List[str]] = Field(default_factory=list)
    custom_phases: Optional[List[CustomTemplatePhase]] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = None
    status: Optional[str] = Field(default=None, max_length=50)
    project_type: Optional[str] = Field(default=None, max_length=50)
    start_date: Optional[str] = None
    end_date: Optional[str] = None


class ProjectMemberResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    project_id: uuid.UUID
    user_id: uuid.UUID
    project_role: str
    joined_at: datetime


class ProjectResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: Optional[str]
    status: str
    project_type: str
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


# ============================================================
# TASK
# ============================================================

class TaskBase(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: Optional[str] = None
    status: TaskStatus = TaskStatus.TODO
    priority: TaskPriority = TaskPriority.MEDIUM
    assignee_id: Optional[uuid.UUID] = None
    due_date: Optional[datetime] = None


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = None
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
    assignee_id: Optional[uuid.UUID] = None
    due_date: Optional[datetime] = None


class TaskResponse(TaskBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    reporter_id: Optional[uuid.UUID]
    created_at: datetime
    updated_at: datetime


# ============================================================
# TASK DEPENDENCY
# ============================================================

class TaskDependencyCreate(BaseModel):
    task_id: uuid.UUID
    depends_on_task_id: uuid.UUID
    dependency_type: DependencyType


class TaskDependencyResponse(TaskDependencyCreate):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime


# ============================================================
# TASK ATTACHMENT
# ============================================================

class TaskAttachmentCreate(BaseModel):
    task_id: uuid.UUID
    file_name: str
    file_url: str
    file_size_bytes: Optional[int] = None
    mime_type: Optional[str] = None


class TaskAttachmentResponse(TaskAttachmentCreate):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    uploader_id: Optional[uuid.UUID]
    created_at: datetime


# ============================================================
# TASK ACTIVITY
# ============================================================

class TaskActivityCreate(BaseModel):
    task_id: uuid.UUID
    activity_type: ActivityType
    content: Optional[str] = None
    old_value: Optional[str] = None
    new_value: Optional[str] = None


class TaskActivityResponse(TaskActivityCreate):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    actor_id: Optional[uuid.UUID]
    created_at: datetime


# ============================================================
# AVAILABILITY & SCHEDULING SCHEMAS
# ============================================================

class AvailabilityBlockBase(BaseModel):
    day_of_week: int = Field(ge=0, le=6, description="0=Monday, 6=Sunday")
    start_time: str = Field(description="Format HH:MM or HH:MM:SS")
    end_time: str = Field(description="Format HH:MM or HH:MM:SS")
    is_recurring: bool = True


class AvailabilityBlockCreate(AvailabilityBlockBase):
    pass


class AvailabilityBlockResponse(AvailabilityBlockBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID


class AvailabilityBatchUpdate(BaseModel):
    blocks: List[AvailabilityBlockCreate]


class MeetingSuggestionResponse(BaseModel):
    day_of_week: int
    day_name: str
    start_time: str
    end_time: str
    formatted_timeslot: str
    free_member_count: int
    total_member_count: int
    free_members: List[str]
    score: float

