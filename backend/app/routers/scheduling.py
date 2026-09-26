import uuid
from datetime import time, datetime, timedelta
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.database import get_db
from app.models import AvailabilityBlock, Project, ProjectMember, User
from app.dependencies import get_current_user, verify_project_membership
from app.schemas import (
    AvailabilityBlockCreate,
    AvailabilityBlockResponse,
    AvailabilityBatchUpdate,
    MeetingSuggestionResponse,
)

router = APIRouter(prefix="/scheduling", tags=["Scheduling & Availability"])

DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def parse_time_str(val: str) -> time:
    """Parses HH:MM or HH:MM:SS string into a datetime.time object."""
    if isinstance(val, time):
        return val
    parts = val.split(":")
    return time(hour=int(parts[0]), minute=int(parts[1]), second=int(parts[2]) if len(parts) > 2 else 0)


def format_time_12h(t: time) -> str:
    """Formats a datetime.time object into a clean 12-hour string (e.g., '2:00 PM')."""
    hour_12 = t.hour % 12
    if hour_12 == 0:
        hour_12 = 12
    am_pm = "AM" if t.hour < 12 else "PM"
    if t.minute == 0:
        return f"{hour_12}:00 {am_pm}"
    return f"{hour_12}:{t.minute:02d} {am_pm}"


@router.get("/users/me/availability", response_model=List[AvailabilityBlockResponse])
def get_my_availability(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = uuid.UUID(current_user["id"]) if isinstance(current_user["id"], str) else current_user["id"]
    blocks = db.scalars(
        select(AvailabilityBlock)
        .where(AvailabilityBlock.user_id == user_id)
        .order_by(AvailabilityBlock.day_of_week, AvailabilityBlock.start_time)
    ).all()

    return [
        {
            "id": b.id,
            "user_id": b.user_id,
            "day_of_week": b.day_of_week,
            "start_time": b.start_time.strftime("%H:%M"),
            "end_time": b.end_time.strftime("%H:%M"),
            "is_recurring": b.is_recurring,
        }
        for b in blocks
    ]


@router.put("/users/me/availability", response_model=List[AvailabilityBlockResponse])
def update_my_availability(
    payload: AvailabilityBatchUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = uuid.UUID(current_user["id"]) if isinstance(current_user["id"], str) else current_user["id"]

    # Delete existing availability blocks for the user to perform clean batch overwrite
    existing_blocks = db.scalars(
        select(AvailabilityBlock).where(AvailabilityBlock.user_id == user_id)
    ).all()
    for block in existing_blocks:
        db.delete(block)

    # Insert new blocks
    new_blocks = []
    for item in payload.blocks:
        start_t = parse_time_str(item.start_time)
        end_t = parse_time_str(item.end_time)

        if start_t >= end_t:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid time block: start_time ({item.start_time}) must be before end_time ({item.end_time})."
            )

        block = AvailabilityBlock(
            id=uuid.uuid4(),
            user_id=user_id,
            day_of_week=item.day_of_week,
            start_time=start_t,
            end_time=end_t,
            is_recurring=item.is_recurring,
        )
        db.add(block)
        new_blocks.append(block)

    db.commit()
    for b in new_blocks:
        db.refresh(b)

    return [
        {
            "id": b.id,
            "user_id": b.user_id,
            "day_of_week": b.day_of_week,
            "start_time": b.start_time.strftime("%H:%M"),
            "end_time": b.end_time.strftime("%H:%M"),
            "is_recurring": b.is_recurring,
        }
        for b in new_blocks
    ]


@router.get("/projects/{project_id}/suggestions", response_model=List[MeetingSuggestionResponse])
def get_project_meeting_suggestions(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Time-Intersection Calculation Engine:
    1. Fetches all members of the specified project.
    2. Retrieves weekly unavailability blocks for all team members.
    3. Evaluates 30-minute intervals between 08:00 and 22:00 for each day (Mon-Sun).
    4. Combines contiguous free slots of >= 1 hour.
    5. Returns ranked recommended meeting windows with member availability badges.
    """
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    user_id = current_user["id"] if isinstance(current_user["id"], uuid.UUID) else uuid.UUID(str(current_user["id"]))
    verify_project_membership(db, project_id, user_id)

    members = db.scalars(
        select(User)
        .join(ProjectMember, ProjectMember.user_id == User.id)
        .where(ProjectMember.project_id == project_id)
    ).all()

    if not members:
        return []

    total_members_count = len(members)
    member_map = {m.id: (m.full_name or m.username) for m in members}

    # Fetch all availability (busy) blocks for project members
    member_ids = list(member_map.keys())
    blocks = db.scalars(
        select(AvailabilityBlock).where(AvailabilityBlock.user_id.in_(member_ids))
    ).all()

    # Organize busy blocks by day_of_week -> user_id -> list of (start_minutes, end_minutes)
    busy_by_day: Dict[int, Dict[uuid.UUID, List[tuple]]] = {d: {m_id: [] for m_id in member_ids} for d in range(7)}

    for b in blocks:
        s_min = b.start_time.hour * 60 + b.start_time.minute
        e_min = b.end_time.hour * 60 + b.end_time.minute
        if b.day_of_week in busy_by_day and b.user_id in busy_by_day[b.day_of_week]:
            busy_by_day[b.day_of_week][b.user_id].append((s_min, e_min))

    # Daily window: 8 AM to 10 PM (480 mins to 1320 mins) in 30-minute slots
    START_WINDOW_MINS = 8 * 60   # 08:00
    END_WINDOW_MINS = 22 * 60   # 22:00
    SLOT_DURATION = 30         # 30 mins

    suggestions: List[Dict[str, Any]] = []

    for day in range(7):
        # Determine for each 30-min slot which members are free
        slots = []
        curr_min = START_WINDOW_MINS
        while curr_min < END_WINDOW_MINS:
            slot_end = curr_min + SLOT_DURATION
            free_users_in_slot = []
            
            for m_id, user_name in member_map.items():
                is_busy = False
                for (b_start, b_end) in busy_by_day[day][m_id]:
                    # Check overlap
                    if max(curr_min, b_start) < min(slot_end, b_end):
                        is_busy = True
                        break
                if not is_busy:
                    free_users_in_slot.append(user_name)

            slots.append({
                "start": curr_min,
                "end": slot_end,
                "free_users": free_users_in_slot,
                "count": len(free_users_in_slot),
            })
            curr_min = slot_end

        # Merge contiguous slots with identical or max free members into continuous blocks
        i = 0
        while i < len(slots):
            # Target minimum duration: 60 mins (2 slots of 30 mins)
            best_block = None
            
            # Find contiguous sequence where free count is high (at least majority or max available)
            j = i
            current_free_users = set(slots[i]["free_users"])
            
            while j < len(slots):
                common_free = current_free_users.intersection(set(slots[j]["free_users"]))
                # If adding this slot drops free user count below 50% or 1 member minimum, break
                if len(common_free) == 0 and total_members_count > 1:
                    break
                if j > i and len(common_free) < min(2, total_members_count):
                    break
                current_free_users = common_free
                j += 1

            block_start_min = slots[i]["start"]
            block_end_min = slots[j-1]["end"] if j > i else slots[i]["end"]
            duration_mins = block_end_min - block_start_min

            if duration_mins >= 60 and len(current_free_users) > 0:
                start_t = time(hour=block_start_min // 60, minute=block_start_min % 60)
                end_t = time(hour=block_end_min // 60, minute=block_end_min % 60)
                
                start_str_12 = format_time_12h(start_t)
                end_str_12 = format_time_12h(end_t)
                day_name = DAY_NAMES[day]
                formatted_str = f"{day_name}, {start_str_12} - {end_str_12}"

                free_list = sorted(list(current_free_users))
                free_cnt = len(free_list)
                
                # Score formula: (free_count / total) * 10 + (duration_hours * 2)
                score = (free_cnt / total_members_count) * 10.0 + (duration_mins / 60.0) * 2.0

                suggestions.append({
                    "day_of_week": day,
                    "day_name": day_name,
                    "start_time": start_t.strftime("%H:%M"),
                    "end_time": end_t.strftime("%H:%M"),
                    "formatted_timeslot": formatted_str,
                    "free_member_count": free_cnt,
                    "total_member_count": total_members_count,
                    "free_members": free_list,
                    "score": round(score, 2),
                })
                i = j  # Move pointer forward
            else:
                i += 1

    # Sort suggestions by highest score (best attendance & optimal meeting length)
    suggestions.sort(key=lambda x: x["score"], reverse=True)

    # Return top 8 best meeting suggestions
    return suggestions[:8]
