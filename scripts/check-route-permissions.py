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
adm = {m: FULL for m in ALLM if m not in ('users', 'audit')}
adm.update({'users': ["view","create","update","export","print"],
            'audit': ["view","export"]})
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

# A report needs the module it reports on. The pages already work this way and
# have since the route table moved onto permissions; these entries are the API
# catching up, so the menu and the endpoint answer the same question.
INTENTIONAL.update({
    ('reports/reports.controller.ts', 'FINANCE_OFFICER', p): reason
    for p, reason in {
        'students.view': "student reporting belongs to the student office",
        'students.export': "as above",
        'students.export,students.print': "as above",
        'teachers.view': "staff reporting belongs to whoever manages staff",
        'examinations.view': "exam reporting belongs to the exam desk",
        'promotions.view': "promotion reporting belongs to the academic office",
        'quiz.view': "quiz reporting belongs to the exam desk",
    }.items()
})
# Exporting a list is its own action in this product, separate from reading
# it — a role holding students.view has not thereby been given the register
# as a file. Both can be granted back in one click.
INTENTIONAL.update({
    ('reports/reports.controller.ts', r, p): "export is a separate grant from view"
    for r in ('LIBRARIAN', 'RECEPTION_OFFICER', 'RECEPTION')
    for p in ('students.export', 'students.export,students.print')
})

# Attendance and promotion reporting: same rule, same reason as the rest.
INTENTIONAL.update({
    ('reports/reports.controller.ts', r, p): "the report follows its own module"
    for r in ('FINANCE_OFFICER', 'EXAM_MANAGER', 'ACADEMIC_MANAGER')
    for p in ('attendance.view', 'promotions.view')
})
INTENTIONAL.update({
    ('reports/reports.controller.ts', 'EXAM_MANAGER', p): "the report follows its own module"
    for p in ('students.view', 'students.export', 'students.export,students.print',
              'teachers.view')
})

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
        # A handler's decorators are a contiguous block, and @Roles may sit
        # either side of the verb - reading only upward missed every route in
        # sms.controller.ts and quietly fell back to the class-level list,
        # reporting breaks that were not there and hiding ones that were.
        top = i
        # A multi-line @Roles(...) has continuation lines that do not start
        # with '@', so stopping at the first of those read the class-level
        # list instead and reported breaks that were not real. The block ends
        # at a blank line or the previous handler's closing brace.
        while top > 0 and lines[top - 1].strip() not in ('', '}'):
            top -= 1
        bottom = i
        while bottom < len(lines) - 1 and not re.match(
                r'^  [a-zA-Z]\w*\s*\(', lines[bottom + 1]):
            bottom += 1
        block = ('\n').join(lines[top:bottom + 2])
        rm = re.search(r'@Roles\((.*?)\)', block, re.S)
        roles_src = rm.group(1) if rm else cls_roles
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
