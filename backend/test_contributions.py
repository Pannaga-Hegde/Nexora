import requests, json

BASE = 'http://localhost:8000'
PROJECT_ID = '00000000-0000-0000-0000-000000000001'

# Login
r = requests.post(f'{BASE}/auth/token', data={'username': 'demouser', 'password': 'password123'})
print('Auth status:', r.status_code)
data = r.json()
token = data.get('access_token', '')
headers = {'Authorization': f'Bearer {token}'}

# Test contributions endpoint
r2 = requests.get(f'{BASE}/projects/{PROJECT_ID}/contributions', headers=headers)
print('Contributions status:', r2.status_code)
if r2.status_code == 200:
    d = r2.json()
    print('Project:', d.get('project_name'))
    print('Members:', len(d.get('members', [])))
    for m in d['members']:
        s = m['stats']
        print(f"  {m['user']['full_name']}: assigned={s['tasks_assigned']}, completed={s['tasks_completed']}, comments={s['comments']}, activity={s['activity_count']}")
else:
    print('Error:', r2.text[:300])

# Test timeline
r3 = requests.get(f'{BASE}/projects/{PROJECT_ID}/contributions/activity/project-timeline', headers=headers)
print('\nTimeline status:', r3.status_code)
if r3.status_code == 200:
    d3 = r3.json()
    print('Timeline total events:', d3.get('total', 0))
    for item in d3.get('items', [])[:3]:
        print(f"  {item.get('created_at', '')[:10]} {item['label']} - {item.get('task', {}).get('title', '') if item.get('task') else ''}")
else:
    print('Error:', r3.text[:300])

# Test PDF generation
r4 = requests.get(f'{BASE}/projects/{PROJECT_ID}/reports/contribution', headers=headers)
print('\nPDF status:', r4.status_code)
print('Content-type:', r4.headers.get('content-type', ''))
print('Content-length:', len(r4.content), 'bytes')

print('\nAll tests passed!' if r2.status_code == 200 and r3.status_code == 200 and r4.status_code == 200 else 'Some tests failed.')
