from app.services.risk_engine import evaluate_task_risk
from app.models import Task, TaskStatus, TaskPriority
import uuid
from datetime import datetime, timezone, timedelta

now = datetime.utcnow()

# 1. Test BLOCKED task
t_blocked = Task(id=uuid.uuid4(), title='Blocked Task', status=TaskStatus.BLOCKED, priority=TaskPriority.HIGH)
risk_b = evaluate_task_risk(t_blocked, now=now)
print(f"Blocked Task -> Status: {risk_b['status']}, Primary: {risk_b['primary_reason']}")
assert risk_b['status'] == 'BLOCKED'

# 2. Test OVERDUE task
t_overdue = Task(id=uuid.uuid4(), title='Overdue Task', status=TaskStatus.IN_PROGRESS, priority=TaskPriority.HIGH, due_date=now - timedelta(days=2))
risk_o = evaluate_task_risk(t_overdue, now=now)
print(f"Overdue Task -> Status: {risk_o['status']}, Primary: {risk_o['primary_reason']}")
assert risk_o['status'] == 'AT_RISK'
assert any(r['code'] == 'deadline_overdue' for r in risk_o['reasons'])

# 3. Test APPROACHING DEADLINE task
t_soon = Task(id=uuid.uuid4(), title='Approaching Deadline Task', status=TaskStatus.IN_PROGRESS, priority=TaskPriority.HIGH, due_date=now + timedelta(hours=12))
risk_s = evaluate_task_risk(t_soon, now=now)
print(f"Approaching Task -> Status: {risk_s['status']}, Primary: {risk_s['primary_reason']}")
assert risk_s['status'] == 'AT_RISK'
assert any(r['code'] == 'deadline_approaching' for r in risk_s['reasons'])

# 4. Test ON TRACK task
t_ontrack = Task(id=uuid.uuid4(), title='Healthy Task', status=TaskStatus.DONE, priority=TaskPriority.MEDIUM)
risk_h = evaluate_task_risk(t_ontrack, now=now)
print(f"Completed Task -> Status: {risk_h['status']}, Reasons: {risk_h['reasons']}")
assert risk_h['status'] == 'ON_TRACK'

print("\nTASK RISK HIERARCHY VERIFIED: BLOCKED > AT_RISK > ON_TRACK: PASS")
