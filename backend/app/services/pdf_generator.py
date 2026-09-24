import io
import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

from app.models import (
    ActivityType, FileStorage, Milestone, Project, ProjectMember,
    Task, TaskActivity, TaskComment, TaskStatus, User,
)


# ─────────────────────────────────────────────────────────────────
# Shared helpers
# ─────────────────────────────────────────────────────────────────

PRIMARY   = colors.HexColor("#312E81")   # Indigo-900
SECONDARY = colors.HexColor("#4F46E5")   # Indigo-600
TEXT      = colors.HexColor("#1E293B")   # Slate-800
SUBTEXT   = colors.HexColor("#64748B")   # Slate-500
HDR_BG    = colors.HexColor("#EEF2FF")   # Indigo-50
DONE_CLR  = colors.HexColor("#10B981")   # Emerald-500
WARN_CLR  = colors.HexColor("#F59E0B")   # Amber-500
LIGHT_BG  = colors.HexColor("#F8FAFC")   # Slate-50


def _make_styles():
    ss = getSampleStyleSheet()
    return {
        "title": ParagraphStyle("DocTitle", parent=ss["Heading1"], fontName="Helvetica-Bold",
                                fontSize=22, textColor=PRIMARY, spaceAfter=4),
        "subtitle": ParagraphStyle("DocSub", parent=ss["Normal"], fontName="Helvetica",
                                   fontSize=9, textColor=SUBTEXT, spaceAfter=12),
        "h2": ParagraphStyle("H2", parent=ss["Heading2"], fontName="Helvetica-Bold",
                             fontSize=13, textColor=PRIMARY, spaceBefore=14, spaceAfter=6),
        "h3": ParagraphStyle("H3", parent=ss["Heading3"], fontName="Helvetica-Bold",
                             fontSize=10, textColor=SECONDARY, spaceBefore=8, spaceAfter=4),
        "body": ParagraphStyle("Body", parent=ss["Normal"], fontName="Helvetica",
                               fontSize=9, textColor=TEXT, leading=13),
        "bold": ParagraphStyle("Bold", parent=ss["Normal"], fontName="Helvetica-Bold",
                               fontSize=9, textColor=TEXT, leading=13),
        "small": ParagraphStyle("Small", parent=ss["Normal"], fontName="Helvetica",
                                fontSize=8, textColor=SUBTEXT, leading=11),
        "disclaimer": ParagraphStyle("Disc", parent=ss["Normal"], fontName="Helvetica-Oblique",
                                     fontSize=8, textColor=SUBTEXT, leading=11,
                                     borderPad=6, backColor=LIGHT_BG, borderColor=colors.HexColor("#CBD5E1"),
                                     borderWidth=0.5, spaceBefore=6, spaceAfter=6),
    }


def _hr(story, color=SECONDARY):
    story.append(HRFlowable(width="100%", thickness=1.2, color=color, spaceAfter=10))


def _table_style(header_bg=HDR_BG):
    return TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), header_bg),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
    ])


def _activity_label(atype: str) -> str:
    labels = {
        "TASK_CREATED": "Created task",
        "TASK_COMPLETED": "Completed task",
        "TASK_REOPENED": "Reopened task",
        "TASK_ASSIGNED": "Assigned to task",
        "COMMENT_CREATED": "Commented on task",
        "REPLY_CREATED": "Replied in discussion",
        "STATUS_CHANGE": "Updated task status",
        "MILESTONE_COMPLETED": "Completed milestone",
        "FILE_UPLOADED": "Uploaded file",
        "MESSAGE_SENT": "Sent message",
        "COMMENT": "Commented",
        "ASSIGNMENT": "Task assigned",
        "ATTACHMENT_ADDED": "Added attachment",
    }
    return labels.get(atype, atype.replace("_", " ").title())


# ─────────────────────────────────────────────────────────────────
# Main generator
# ─────────────────────────────────────────────────────────────────

def generate_contribution_pdf(
    db: Session,
    project_id: uuid.UUID,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
) -> io.BytesIO:
    project = db.get(Project, project_id)
    if not project:
        raise ValueError("Project not found")

    styles = _make_styles()
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=letter,
        rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40,
    )

    story = []

    # ── Cover header ──────────────────────────────────────────────
    story.append(Paragraph("Project Contribution Report", styles["title"]))
    now_str = datetime.utcnow().strftime("%B %d, %Y at %H:%M UTC")
    period_str = ""
    if start_date or end_date:
        s = start_date.strftime("%b %d, %Y") if start_date else "Beginning"
        e = end_date.strftime("%b %d, %Y") if end_date else "Now"
        period_str = f"  |  Period: {s} – {e}"
    story.append(Paragraph(
        f"Project: <b>{project.name}</b>  |  Generated: {now_str}{period_str}",
        styles["subtitle"],
    ))
    _hr(story)

    # ── Integrity disclaimer ──────────────────────────────────────
    story.append(Paragraph(
        "⚠ Report Integrity Notice: This report summarises recorded project activity during the selected period. "
        "All counts are derived directly from activity records in the project database. "
        "These metrics reflect recorded actions only — they do NOT measure effort, quality, difficulty, "
        "or individual ownership. No contribution score or ranking is assigned to any team member.",
        styles["disclaimer"],
    ))
    story.append(Spacer(1, 8))

    # ── 1. Project overview ───────────────────────────────────────
    story.append(Paragraph("1. Project Overview", styles["h2"]))

    milestones = db.query(Milestone).filter(Milestone.project_id == project_id).all()
    all_tasks = db.query(Task).filter(Task.project_id == project_id).all()
    done_tasks = [t for t in all_tasks if t.status == TaskStatus.DONE]
    members = (
        db.query(User, ProjectMember.project_role)
        .join(ProjectMember, ProjectMember.user_id == User.id)
        .filter(ProjectMember.project_id == project_id)
        .all()
    )

    overview_data = [
        [Paragraph("<b>Field</b>", styles["bold"]), Paragraph("<b>Value</b>", styles["bold"])],
        [Paragraph("Project Name", styles["body"]), Paragraph(project.name, styles["body"])],
        [Paragraph("Status", styles["body"]), Paragraph(project.status, styles["body"])],
        [Paragraph("Project Type", styles["body"]), Paragraph(project.project_type.replace("_", " ").title(), styles["body"])],
        [Paragraph("Description", styles["body"]), Paragraph(project.description or "—", styles["body"])],
        [Paragraph("Team Size", styles["body"]), Paragraph(str(len(members)), styles["body"])],
        [Paragraph("Total Tasks", styles["body"]), Paragraph(str(len(all_tasks)), styles["body"])],
        [Paragraph("Completed Tasks", styles["body"]), Paragraph(str(len(done_tasks)), styles["body"])],
        [Paragraph("Milestones", styles["body"]), Paragraph(str(len(milestones)), styles["body"])],
    ]
    t = Table(overview_data, colWidths=[160, 340])
    t.setStyle(_table_style())
    story.append(t)
    story.append(Spacer(1, 14))

    # ── 2. Team summary table ─────────────────────────────────────
    story.append(Paragraph("2. Team Contribution Summary", styles["h2"]))
    story.append(Paragraph(
        "The table below shows recorded activity counts for each team member. "
        "These are factual counts from database records — not a performance ranking.",
        styles["body"],
    ))
    story.append(Spacer(1, 6))

    summary_data = [[
        Paragraph("<b>Member</b>", styles["bold"]),
        Paragraph("<b>Role</b>", styles["bold"]),
        Paragraph("<b>Tasks Assigned</b>", styles["bold"]),
        Paragraph("<b>Tasks Completed</b>", styles["bold"]),
        Paragraph("<b>Comments</b>", styles["bold"]),
        Paragraph("<b>Files</b>", styles["bold"]),
        Paragraph("<b>Milestones</b>", styles["bold"]),
        Paragraph("<b>Total Activity</b>", styles["bold"]),
    ]]

    member_details = []  # collect for section 3

    for user, role in members:
        # Tasks
        user_tasks = [t for t in all_tasks if t.assignee_id == user.id]
        assigned = len(user_tasks)
        completed = sum(1 for t in user_tasks if t.status == TaskStatus.DONE)

        # Comments
        comments_count = db.query(TaskComment).join(
            Task, Task.id == TaskComment.task_id
        ).filter(
            Task.project_id == project_id,
            TaskComment.author_id == user.id,
            TaskComment.parent_comment_id.is_(None),
        ).count()

        replies_count = db.query(TaskComment).join(
            Task, Task.id == TaskComment.task_id
        ).filter(
            Task.project_id == project_id,
            TaskComment.author_id == user.id,
            TaskComment.parent_comment_id.isnot(None),
        ).count()

        # Files
        files_count = db.query(FileStorage).filter(
            FileStorage.project_id == project_id,
            FileStorage.uploader_id == user.id,
        ).count()

        # Milestones via completed tasks
        ms_ids = {t.milestone_id for t in user_tasks if t.status == TaskStatus.DONE and t.milestone_id}

        # Total activity
        act_count = db.query(TaskActivity).filter(
            TaskActivity.project_id == project_id,
            TaskActivity.actor_id == user.id,
        ).count()

        name = user.full_name or user.username
        summary_data.append([
            Paragraph(f"<b>{name}</b><br/><font color='#64748B' size='7'>{user.email}</font>", styles["body"]),
            Paragraph(role.capitalize(), styles["body"]),
            Paragraph(str(assigned), styles["body"]),
            Paragraph(str(completed), styles["bold"]),
            Paragraph(str(comments_count + replies_count), styles["body"]),
            Paragraph(str(files_count), styles["body"]),
            Paragraph(str(len(ms_ids)), styles["body"]),
            Paragraph(str(act_count), styles["body"]),
        ])

        member_details.append({
            "user": user, "role": role,
            "assigned": assigned, "completed": completed,
            "comments": comments_count, "replies": replies_count,
            "files": files_count, "milestones": list(ms_ids),
            "act_count": act_count,
        })

    summary_table = Table(summary_data, colWidths=[130, 50, 55, 60, 55, 35, 60, 55])
    summary_table.setStyle(_table_style())
    story.append(summary_table)
    story.append(Spacer(1, 16))

    # ── 3. Per-member detail ──────────────────────────────────────
    story.append(Paragraph("3. Individual Member Activity Records", styles["h2"]))

    for md in member_details:
        u = md["user"]
        name = u.full_name or u.username
        section = []

        section.append(Paragraph(f"Member: {name} ({md['role'].capitalize()})", styles["h3"]))
        section.append(Paragraph(f"Email: {u.email}", styles["small"]))
        section.append(Spacer(1, 4))

        # Stats summary
        stats_data = [
            [Paragraph("<b>Category</b>", styles["bold"]), Paragraph("<b>Count</b>", styles["bold"]), Paragraph("<b>Notes</b>", styles["bold"])],
            [Paragraph("Tasks Assigned", styles["body"]), Paragraph(str(md["assigned"]), styles["body"]),
             Paragraph("Tasks where this member is the assignee", styles["small"])],
            [Paragraph("Tasks Completed", styles["body"]), Paragraph(str(md["completed"]), styles["bold"]),
             Paragraph("Derived from tasks with status DONE", styles["small"])],
            [Paragraph("Comments (top-level)", styles["body"]), Paragraph(str(md["comments"]), styles["body"]),
             Paragraph("Root-level comments in task discussions", styles["small"])],
            [Paragraph("Replies", styles["body"]), Paragraph(str(md["replies"]), styles["body"]),
             Paragraph("Threaded replies within discussions", styles["small"])],
            [Paragraph("Files Uploaded", styles["body"]), Paragraph(str(md["files"]), styles["body"]),
             Paragraph("Files attached to tasks or project", styles["small"])],
            [Paragraph("Milestones Contributed To", styles["body"]), Paragraph(str(len(md["milestones"])), styles["body"]),
             Paragraph("Milestones with at least one completed task by this member", styles["small"])],
            [Paragraph("Total Recorded Events", styles["body"]), Paragraph(str(md["act_count"]), styles["body"]),
             Paragraph("All activity events in the project activity log", styles["small"])],
        ]
        st = Table(stats_data, colWidths=[160, 50, 290])
        st.setStyle(_table_style())
        section.append(st)
        section.append(Spacer(1, 6))

        # Completed tasks list
        completed_tasks = [t for t in all_tasks if t.assignee_id == u.id and t.status == TaskStatus.DONE]
        if completed_tasks:
            section.append(Paragraph("Completed Tasks (verified from task records):", styles["bold"]))
            for t in completed_tasks[:15]:
                prio = t.priority.value if hasattr(t.priority, "value") else str(t.priority)
                section.append(Paragraph(f"  ✓  {t.title} [{prio}]", styles["small"]))
            if len(completed_tasks) > 15:
                section.append(Paragraph(f"  ... and {len(completed_tasks)-15} more", styles["small"]))
            section.append(Spacer(1, 4))

        # Recent activity timeline
        recent_acts = db.query(TaskActivity).filter(
            TaskActivity.project_id == project_id,
            TaskActivity.actor_id == u.id,
        ).order_by(TaskActivity.created_at.desc()).limit(8).all()

        if recent_acts:
            section.append(Paragraph("Recent Recorded Activity:", styles["bold"]))
            tl_data = [[
                Paragraph("<b>Date</b>", styles["bold"]),
                Paragraph("<b>Activity</b>", styles["bold"]),
                Paragraph("<b>Detail</b>", styles["bold"]),
            ]]
            for act in recent_acts:
                task_obj = db.get(Task, act.task_id) if act.task_id else None
                atype = act.activity_type.value if hasattr(act.activity_type, "value") else str(act.activity_type)
                date_str = act.created_at.strftime("%b %d, %Y %H:%M") if act.created_at else "—"
                detail = act.content or (task_obj.title if task_obj else "—")
                tl_data.append([
                    Paragraph(date_str, styles["small"]),
                    Paragraph(_activity_label(atype), styles["small"]),
                    Paragraph(str(detail)[:80] if detail else "—", styles["small"]),
                ])
            tl_table = Table(tl_data, colWidths=[100, 130, 270])
            tl_table.setStyle(_table_style())
            section.append(tl_table)

        section.append(Spacer(1, 4))
        _hr(section, color=colors.HexColor("#CBD5E1"))

        story.append(KeepTogether(section))

    # ── 4. Milestones ─────────────────────────────────────────────
    story.append(Paragraph("4. Project Milestones", styles["h2"]))
    if milestones:
        ms_data = [[
            Paragraph("<b>Milestone</b>", styles["bold"]),
            Paragraph("<b>Status</b>", styles["bold"]),
            Paragraph("<b>Due Date</b>", styles["bold"]),
        ]]
        for m in milestones:
            status_p = Paragraph(
                f"<font color='#10B981'><b>COMPLETED</b></font>" if m.is_completed else "<font color='#F59E0B'>IN PROGRESS</font>",
                styles["body"],
            )
            due = m.due_date.strftime("%b %d, %Y") if m.due_date else "—"
            ms_data.append([Paragraph(m.title, styles["body"]), status_p, Paragraph(due, styles["body"])])
        ms_table = Table(ms_data, colWidths=[300, 100, 100])
        ms_table.setStyle(_table_style())
        story.append(ms_table)
    else:
        story.append(Paragraph("No milestones recorded for this project.", styles["body"]))

    story.append(Spacer(1, 20))

    # ── Footer / sign-off ─────────────────────────────────────────
    _hr(story, color=colors.HexColor("#CBD5E1"))
    story.append(Paragraph(
        f"<b>Report generated by Project OS</b>  |  {now_str}  |  "
        "This document is an evidence-based activity record, not a performance evaluation.",
        styles["small"],
    ))
    story.append(Spacer(1, 8))
    story.append(Paragraph(
        "<b>Instructor / Reviewer Sign-off:</b> ___________________________   <b>Date:</b> _____________",
        styles["small"],
    ))

    doc.build(story)
    buffer.seek(0)
    return buffer
