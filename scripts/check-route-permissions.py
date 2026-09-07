#!/usr/bin/env python3
"""
Every role that reaches a route today must still hold a permission it requires.

Phase 3 moved the API from "which roles" to "which permission". Getting one
mapping wrong locks a school's staff out of their own work, and it would only
be found by the person it happened to. This reads the controllers and the
shared permission table and reports every role that would lose access.

Run before deploying a change to @RequirePermission or to PERMISSIONS_BY_ROLE:
    python scripts/check-route-permissions.py
"""
import io, re, glob, sys

src = io.open('packages/shared/src/rbac/role-modules.ts', encoding='utf-8').read()
block = src[src.index('export const PERMISSIONS_BY_ROLE'):src.index('// Legacy value, same desk')]
FULL = ["view","create","update","delete","import","export","print","approve"]
READ = ["view","export","print"]
ALLM = [x.strip().strip('"') for x in
        re.search(r'export const ALL_MODULES[^=]*= \[(.*?)\];', src, re.S).group(1).split(',')
        if x.strip()]

table = {}
for m in re.finditer(r'\[UserRole\.(\w+)\]: \{(.*?)\n  \},', block, re.S):
    grants = {}
    for g in re.finditer(r'(\w+): (FULL|READ|\[[^\]]*\])', m.group(2)):
        v = g.group(2)
        grants[g.group(1)] = (FULL if v == 'FULL' else READ if v == 'READ'
                              else [x.strip().strip('"') for x in v.strip('[]').split(',') if x.strip()])
    table[m.group(1)] = grants
table['SUPER_ADMINISTRATOR'] = {m: FULL for m in ALLM}
adm = {m: FULL for m in ALLM if m not in ('users', 'audit', 'sms')}
adm.update({'users': ["view","create","update","export","print"],
            'audit': ["view","export"], 'sms': ["view","create","export"]})
table['ADMINISTRATOR'] = adm
table['RECEPTION'] = table.get('RECEPTION_OFFICER', {})

# Narrowings that are the point of the change, not an accident.
#
# Each is an API door that stood open while no page these roles can reach ever
# used it. Listing them here keeps the check meaningful — anything NOT on this
# list that would lose access is a mistake — and records why each was closed.
INTENTIONAL = {
    ('attendance/student-attendance.controller.ts', r, 'attendance.view'):
        "the register itself: who was absent today is not a finance, library, "
        "reception, exam or academic desk's business, and no page they can "
        "open has ever called it"
    for r in ('FINANCE_OFFICER', 'LIBRARIAN', 'RECEPTION', 'RECEPTION_OFFICER',
              'EXAM_MANAGER', 'ACADEMIC_MANAGER')
}

problems = []
for path in sorted(glob.glob('apps/api/src/**/*.controller.ts', recursive=True)):
    s = io.open(path, encoding='utf-8').read()
    if 'RequirePermission' not in s:
        continue
    lines = s.split('\n')
    cm = re.search(r'@Roles\(([^)]*)\)\s*\n@Controller', s, re.S)
    cls_roles = cm.group(1) if cm else None
    for i, l in enumerate(lines):
        if not l.strip().startswith('@RequirePermission'):
            continue
        perms = re.findall(r'"([^"]+)"', '\n'.join(lines[i:i + 8]).split(')')[0])
        roles_src = None
        for j in range(i - 1, max(-1, i - 14), -1):
            if '@Roles(' in lines[j]:
                chunk = '\n'.join(lines[j:j + 8])
                roles_src = chunk[chunk.index('(') + 1:chunk.index(')')] if ')' in chunk else chunk
                break
            if re.match(r'^\s*@(Get|Post|Patch|Put|Delete)\(', lines[j]):
                break
        roles_src = roles_src if roles_src is not None else cls_roles
        if roles_src is None:
            continue
        roles = ([r for r in table if r not in ('PARENT', 'STUDENT', 'SUPER_ADMINISTRATOR')]
                 if 'STAFF_ROLES' in roles_src
                 else re.findall(r'UserRole\.(\w+)', roles_src))
        for r in roles:
            if r == 'SUPER_ADMINISTRATOR':
                continue
            g = table.get(r, {})
            if not any(p.split('.')[1] in g.get(p.split('.')[0], []) for p in perms):
                key = (path.replace(chr(92), '/').replace('apps/api/src/', ''), r, ','.join(perms))
                if key not in INTENTIONAL:
                    problems.append(key)

if problems:
    print(f"{len(problems)} role/route pairs would lose access UNINTENTIONALLY:")
    for p in sorted(set(problems)):
        print('  ', p[0], p[1], p[2])
    sys.exit(1)
print(f"OK — every role keeps every route it reaches today "
      f"({len(INTENTIONAL)} deliberate narrowings recorded).")
