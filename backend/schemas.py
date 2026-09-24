import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, EmailStr
from models import TaskStatus, TaskPriority, DependencyType, ActivityType

# Base config helper for ORM mode compatibility
class BaseSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# --- USER SCHEMAS ---
class UserBase(BaseModel):
    username: str
    email: EmailStr

class UserCreate(UserBase):
    pass

class UserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[EmailStr] = None

class UserResponse(UserBase, BaseSchema):
    id: uuid.UUID
    created_at: datetime


# --- PROJECT SCHEMAS ---
class ProjectBase(BaseModel):
    name: str
    description: Optional[str] = None

class ProjectCreate(ProjectBase):
    owner_id: Optional[uuid.UUID] = None  # If not provided, set from logged in user

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class ProjectResponse(ProjectBase, BaseSchema):
    id: uuid.UUID
    owner_id: uuid.UUID
    created_at: datetime
    updated_at: datetime


# --- TASK DEPENDENCY SCHEMAS ---
class TaskDependencyBase(BaseModel):
    depends_on_task_id: uuid.UUID
    dependency_type: DependencyType

class TaskDependencyCreate(TaskDependencyBase):
    pass

class TaskDependencyResponse(TaskDependencyBase, BaseSchema):
    id: uuid.UUID
    task_id: uuid.UUID
    created_at: datetime


# --- TASK ATTACHMENT SCHEMAS ---
class TaskAttachmentBase(BaseModel):
    file_name: str
    file_url: str
    file_size_bytes: Optional[int] = None
    mime_type: Optional[str] = None

class TaskAttachmentCreate(TaskAttachmentBase):
    uploader_id: Optional[uuid.UUID] = None

class TaskAttachmentResponse(TaskAttachmentBase, BaseSchema):
    id: uuid.UUID
    task_id: uuid.UUID
    uploader_id: Optional[uuid.UUID] = None
    created_at: datetime


# --- TASK ACTIVITY SCHEMAS ---
class TaskActivityBase(BaseModel):
    activity_type: ActivityType
    content: Optional[str] = None
    old_value: Optional[str] = None
    new_value: Optional[str] = None

class TaskActivityCreate(TaskActivityBase):
    actor_id: Optional[uuid.UUID] = None

class TaskActivityResponse(TaskActivityBase, BaseSchema):
    id: uuid.UUID
    task_id: uuid.UUID
    actor_id: Optional[uuid.UUID] = None
    created_at: datetime


# --- TASK SCHEMAS ---
class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    status: TaskStatus = TaskStatus.TODO
    priority: TaskPriority = TaskPriority.MEDIUM
    due_date: Optional[datetime] = None

class TaskCreate(TaskBase):
    project_id: Optional[uuid.UUID] = None
    assignee_id: Optional[uuid.UUID] = None

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
    project_id: Optional[uuid.UUID] = None
    assignee_id: Optional[uuid.UUID] = None
    due_date: Optional[datetime] = None

class TaskResponse(TaskBase, BaseSchema):
    id: uuid.UUID
    project_id: Optional[uuid.UUID] = None
    reporter_id: Optional[uuid.UUID] = None
    assignee_id: Optional[uuid.UUID] = None
    created_at: datetime
    updated_at: datetime


# Detailed Task Response including nested data
class TaskDetailResponse(TaskResponse):
    attachments: List[TaskAttachmentResponse] = []
    activities: List[TaskActivityResponse] = []
    dependencies: List[TaskDependencyResponse] = []
