import json, datetime

with open('firebase_backup_recovery.json', 'r', encoding='utf-8') as f:
    d = json.load(f)

new_exams = [
    {
        'id': 1789650950001,
        'name': 'Mat215 Diferansiyel Denklemler',
        'date': '2026-08-28',
        'time': '14:30',
        'duration': 120,
        'type': 'Final',
        'location': 'Derslik 1',
        'lecturer': 'Prof. Dr. Mansur İSGENDEROĞLU (İSMAİLOV)',
        'proctorId': 3,
        'proctorIds': [3],
        'proctorName': 'Serdal Çömlekçi',
        'score': 120.0,
        'katsayi': 1.0,
        'isDraft': False,
        'isNonExam': False
    },
    {
        'id': 1789650950002,
        'name': 'Math 102 Calculus II Final',
        'date': '2026-08-31',
        'time': '13:30',
        'duration': 90,
        'type': 'Final',
        'location': 'Derslik 3',
        'lecturer': 'Dr. Öğr. Üyesi Keremcan DOĞAN',
        'proctorId': 4,
        'proctorIds': [4],
        'proctorName': 'Aslıhan Gür',
        'score': 90.0,
        'katsayi': 1.0,
        'isDraft': False,
        'isNonExam': False
    }
]

existing_keys = set((e.get('date'), e.get('time'), e.get('name').strip()) for e in d['exams'])

for ne in new_exams:
    key = (ne['date'], ne['time'], ne['name'].strip())
    if key not in existing_keys:
        d['exams'].append(ne)
        print('Added new exam: ' + ne['name'] + ' on ' + ne['date'] + ' ' + ne['time'])
    else:
        print('Already exists: ' + ne['name'] + ' on ' + ne['date'])

# Sort exams
d['exams'].sort(key=lambda x: (x.get('date', ''), x.get('time', '')))

# Recalculate staff scores
staff_map = {s['id']: s for s in d['staff']}
for s in d['staff']:
    s['totalScore'] = float(s.get('baseScore', 0))
    s['taskCount'] = 0
    s['nonExamScore'] = 0
    s['nonExamTaskCount'] = 0

non_exam_split = datetime.date(2026, 6, 20)

for e in d['exams']:
    score = float(e.get('score', 0))
    is_non_exam = e.get('isNonExam', False)
    date_str = e.get('date', '')
    p_ids = e.get('proctorIds', [])
    if not p_ids and e.get('proctorId'):
        p_ids = [e.get('proctorId')]
    
    parts = [int(p) for p in date_str.split('-')] if '-' in date_str else [2026, 1, 1]
    e_date = datetime.date(parts[0], parts[1], parts[2])
    counts_as_non_exam = is_non_exam and (e_date >= non_exam_split)
    
    for pid in p_ids:
        if pid in staff_map:
            st = staff_map[pid]
            if counts_as_non_exam:
                st['nonExamScore'] = round(st['nonExamScore'] + score, 2)
                st['nonExamTaskCount'] += 1
            else:
                st['totalScore'] = round(st['totalScore'] + score, 2)
                st['taskCount'] += 1

d['auditLogs'].insert(0, {
    'id': int(datetime.datetime.now().timestamp() * 1000),
    'timestamp': datetime.datetime.now().strftime('%d.%m.%Y %H:%M:%S'),
    'action': 'Sınav Programı Güncelleme',
    'category': 'admin',
    'details': 'Mat215 ve Math 102 Final sınavları mükerrer kontrolüyle eklendi.'
})

with open('firebase_backup_recovery.json', 'w', encoding='utf-8') as f:
    json.dump(d, f, ensure_ascii=False, indent=2)

print('Total exams in database now: ' + str(len(d['exams'])))
print('\n--- UPDATED STAFF SCORES ---')
for s in sorted(d['staff'], key=lambda x: x.get('totalScore', 0), reverse=True):
    print(s['name'].ljust(22) + ' | Taban: ' + str(s['baseScore']).rjust(4) + ' | Sınav Görev: ' + str(s['taskCount']).rjust(2) + ' | Toplam: ' + str(s['totalScore']).rjust(7) + ' | Sınav Dışı: ' + str(s['nonExamScore']))
