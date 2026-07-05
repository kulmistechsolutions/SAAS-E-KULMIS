# MASTER PRD — Enterprise School Management ERP System

> A comprehensive, web-based platform that digitalizes and automates every
> operational, academic, financial, and administrative process of a school —
> built on a modern, secure, and scalable enterprise technology stack.

---

## Document Control

| Field | Value |
|---|---|
| **Product** | Enterprise School Management ERP System |
| **Document type** | Master Product Requirements Document (PRD) |
| **Status** | Draft — v1.0 |
| **Audience** | Product owner, engineering team, QA, DevOps |
| **Scope** | Single-school ERP (multi-tenant is a future expansion) |
| **Modules** | 26 functional modules |
| **User roles** | 8 (Administrator, Teacher, Parent, Student, Attendance Officer, Finance Officer, Exam Manager, Reception) |

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Vision](#2-product-vision)
3. [Product Goals](#3-product-goals)
4. [Core Principles](#4-core-principles)
5. [Technology Stack](#5-technology-stack)
6. [System Architecture](#6-system-architecture)
7. [School Branding & Identity Rules](#7-school-branding--identity-rules)
8. [User Types & Role-Based Access Control (RBAC)](#8-user-types--role-based-access-control-rbac)
9. [Organizational & Academic Structure](#9-organizational--academic-structure)
10. [Class & Section Philosophy](#10-class--section-philosophy)
11. [Core Business Rules](#11-core-business-rules)
12. [Design System & UI Philosophy](#12-design-system--ui-philosophy)
13. [Dashboard Philosophy](#13-dashboard-philosophy)
14. [Functional Modules (1–26)](#14-functional-modules)
15. [Data Model — Core Entities](#15-data-model--core-entities)
16. [Non-Functional Requirements](#16-non-functional-requirements)
17. [Global Acceptance Criteria](#17-global-acceptance-criteria)
18. [Open Questions & Assumptions](#18-open-questions--assumptions)

---

## 1. Executive Summary

The **Enterprise School Management ERP System** is a comprehensive, web-based
platform designed to digitalize and automate every operational, academic,
financial, and administrative process within a school.

The system replaces manual paperwork and disconnected software with **one
centralized platform** where administrators, teachers, parents, students,
finance officers, attendance officers, and exam managers can perform their
responsibilities efficiently and securely.

The platform supports schools of all sizes — primary schools, secondary
schools, high schools, and private educational institutions.

The system provides complete management for:

- Students
- Parents
- Teachers
- Classes
- Sections
- Subjects
- Academic Years
- Attendance
- Monthly Fees
- Salaries
- Expenses
- Exams
- Results
- Promotions
- Online Quizzes
- Reports
- User Permissions
- School Branding
- Financial Reports

Every module is interconnected while maintaining **strict role-based security**.

---

## 2. Product Vision

To build a **modern, secure, scalable, and professional** School ERP platform
that digitizes every school process into one intelligent system while remaining
simple enough for daily school operations.

The platform must serve schools with **hundreds or thousands of students**
without performance degradation.

---

## 3. Product Goals

- Eliminate paper-based school administration.
- Automate repetitive school operations.
- Improve accuracy in attendance, examinations, and finance.
- Increase transparency between school, teachers, parents, and students.
- Reduce administrative workload.
- Provide real-time reports.
- Improve financial management.
- Deliver a professional digital learning environment.

---

## 4. Core Principles

**Simplicity** — Every page must be easy to understand. The interface must never
overwhelm users.

**Speed** — Pages load quickly. Filtering, searching, and reports respond
efficiently.

**Security** — Every action requires permission. Every module follows Role-Based
Access Control. Unauthorized users cannot access restricted pages.

**Scalability** — The system must support one school, hundreds of teachers,
thousands of students, multiple academic years, and years of historical data
**without requiring redesign**.

**Data Integrity** — The system must never allow:

- Duplicate students
- Duplicate parents
- Duplicate teacher assignments
- Duplicate fee charges
- Duplicate attendance
- Duplicate exam submissions
- Invalid marks
- Orphan records
- Broken relationships

---

## 5. Technology Stack

The entire platform is built on the following **enterprise technology stack**.
Each concern maps to a specific technology and to the layer of the system it
serves.

### 5.1 Frontend

| Technology | Purpose |
|---|---|
| **Next.js 15** | React framework (App Router, SSR/SSG, routing, API layer) |
| **React 19** | UI component library |
| **TypeScript** | Type-safe development |
| **Tailwind CSS** | Utility-first styling |
| **shadcn/ui** | Accessible, composable UI component system |
| **TanStack Query** | Server-state management, caching, data fetching |
| **TanStack Table** | Data tables with search, sort, filter, pagination |
| **React Hook Form** | Performant form state management |
| **Zod** | Runtime schema validation (shared with backend) |

### 5.2 Backend

| Technology | Purpose |
|---|---|
| **NestJS** | Modular, scalable Node.js backend framework |
| **TypeScript** | Type-safe backend development |
| **Prisma ORM** | Type-safe database access & migrations |

### 5.3 Data & Infrastructure

| Concern | Technology |
|---|---|
| **Database** | PostgreSQL |
| **Cache** | Redis |
| **Queue & Background Jobs** | BullMQ + Redis |
| **Object Storage** | MinIO (self-hosted) — logos, documents, imports, backups |
| **Search** | PostgreSQL Full-Text Search *(optional: Meilisearch)* |

### 5.4 Cross-Cutting Concerns

| Concern | Technology |
|---|---|
| **Authentication** | JWT + Refresh Tokens |
| **Authorization** | RBAC (Role-Based Access Control) |
| **Realtime** | Socket.IO (notifications, dashboards, live status) |
| **Reports & Documents** | PDFKit (PDF), ExcelJS (Excel/CSV) |
| **Logging** | Pino + Winston |
| **Email** | SMTP |

### 5.5 Operations & Delivery

| Concern | Technology |
|---|---|
| **Monitoring** | Uptime Kuma, Prometheus, Grafana |
| **Containerization** | Docker |
| **Deployment / PaaS** | Coolify |
| **Hosting** | Hostinger VPS |
| **Database hosting** | Self-hosted PostgreSQL (Coolify) or self-hosted Supabase (Coolify) |
| **Version control** | GitHub |
| **CI/CD** | GitHub Actions |

### 5.6 Stack → Capability Mapping

This table keeps the stack **aligned** with product capabilities so no concern
is left unassigned.

| Product capability | Primary technology |
|---|---|
| Login, sessions, auto-logout | JWT + Refresh Tokens, Redis |
| Role menus & permission enforcement | RBAC (NestJS Guards) |
| Duplicate prevention & validation | Zod (frontend) + Prisma constraints + NestJS pipes |
| Data tables (search/filter/sort/paginate) | TanStack Table + PostgreSQL |
| Global search | PostgreSQL Full-Text Search (opt. Meilisearch) |
| CSV / Excel import & export | ExcelJS, BullMQ (async large imports) |
| PDF receipts, invoices, results, reports | PDFKit + MinIO |
| Monthly fee charging, promotions, backups | BullMQ scheduled jobs |
| Notifications & live dashboards | Socket.IO + Redis pub/sub |
| File storage (logos, stamps, uploads) | MinIO |
| Audit logs & app logs | Pino/Winston + PostgreSQL |
| Uptime, metrics, alerting | Uptime Kuma, Prometheus, Grafana |

---

## 6. System Architecture

### 6.1 Layered Overview

```
┌─────────────────────────────────────────────────────────────┐
│  CLIENT (Next.js 15 / React 19 / TS / Tailwind / shadcn/ui)  │
│  TanStack Query · TanStack Table · React Hook Form · Zod     │
└───────────────┬─────────────────────────────┬───────────────┘
                │ REST / WebSocket             │
┌───────────────▼─────────────────────────────▼───────────────┐
│                    API LAYER (NestJS + TS)                    │
│  Auth (JWT+Refresh) · RBAC Guards · Validation · Modules     │
│  Socket.IO Gateway · Report Services (PDFKit/ExcelJS)        │
└───┬──────────────┬───────────────┬───────────────┬──────────┘
    │              │               │               │
┌───▼───┐   ┌──────▼─────┐   ┌─────▼─────┐   ┌─────▼──────┐
│Postgres│   │   Redis    │   │  BullMQ   │   │   MinIO    │
│ + FTS  │   │  (cache +  │   │  (jobs +  │   │  (object   │
│(Prisma)│   │  pub/sub)  │   │ schedules)│   │  storage)  │
└────────┘   └────────────┘   └───────────┘   └────────────┘

  Observability: Uptime Kuma · Prometheus · Grafana · Pino/Winston
  Delivery:      Docker · Coolify · Hostinger VPS · GitHub Actions
```

### 6.2 Architecture Rules

- **Every module** is an independent NestJS module with its own controller,
  service, DTOs (validated with Zod/class-validator), and Prisma access.
- **Every write operation** passes through a validation pipe and an RBAC guard.
- **Section isolation** (Class + Section) is enforced at the query layer for
  every academic operation — never Class alone.
- **Heavy work** (bulk imports, monthly fee charging, promotions, backups,
  large report generation) runs in **BullMQ background jobs**, never blocking
  the request.
- **All generated documents** (PDF/Excel) are streamed to the user and, where
  needed, stored in **MinIO**.
- **Realtime updates** (notifications, dashboard counters, exam submission
  status) are pushed over **Socket.IO**, backed by Redis pub/sub.

---

## 7. School Branding & Identity Rules

### 7.1 School Branding

Every school has its own identity. The **Settings** module must allow updating:

School Logo · School Name · School Motto · School Address · Phone Numbers ·
Email · Website · School Stamp · Principal Name · Academic Year ·
Default Currency · Timezone · Language · Student ID Prefix · Teacher ID Prefix ·
Parent ID Prefix · Receipt Footer · Report Footer · Result Footer.

> **All printed documents must automatically use the current school branding.**
> Logos and stamps are stored in **MinIO** and injected into every PDFKit
> document.

### 7.2 School Identity Rules

| Entity | Example IDs |
|---|---|
| **Student IDs** | `SHMM0001`, `SHMM0002` |
| **Teacher IDs** | `TSHMM0001`, `TSHMM0002` |
| **Parent IDs** | `PSHMM0001`, `PSHMM0002` |

- IDs must always be **unique**.
- IDs can **never be reused** after deletion.
- IDs are generated automatically from the configured school prefix and can
  never be edited manually.

---

## 8. User Types & Role-Based Access Control (RBAC)

The system supports the following users:

- Administrator
- Teacher
- Parent
- Student
- Attendance Officer
- Finance Officer
- Exam Manager
- Reception User

> **Each role only sees the menus assigned to it.** Menus render dynamically
> based on permissions; unauthorized URLs return **Access Denied**. RBAC is
> enforced by NestJS guards on every protected route and reflected in the
> Next.js navigation.

---

## 9. Organizational & Academic Structure

### 9.1 Organizational Hierarchy

```
School → Academic Year → Classes → Sections → Subjects → Students → Teachers → Parents
```

Every module must respect this hierarchy.

### 9.2 Academic Flow

```
Academic Year → Classes → Sections → Subjects → Teacher Assignment
→ Students → Attendance → Fees → Exams → Results → Promotion
```

---

## 10. Class & Section Philosophy

A **Section is not merely a label**. Each Section represents an **independent
classroom**.

Example: *Grade 12 A*, *Grade 12 B*, *Grade 12 C* are three completely separate
classrooms.

They may share only the **Grade Name**. They **never** share:

Students · Attendance · Exam Marks · Results · Teacher Assignments · Fee Lists · Reports.

> **Every operation in the system must always use `Class + Section`, never Class
> alone.** If a class has no sections, the section field remains optional.

---

## 11. Core Business Rules

The system must guarantee:

- One student belongs to one class.
- One student belongs to one section.
- One parent may have many students.
- One teacher may teach many classes.
- One teacher may teach many sections.
- One teacher may teach many subjects.
- One subject may be taught by different teachers in different sections.
- Students can never appear in another section.
- Teacher marks must never mix sections.
- Attendance must never mix sections.
- Reports must never mix sections.

---

## 12. Design System & UI Philosophy

The UI must be: **Modern · Minimal · Professional · Responsive · Fast · Clean · Consistent.**

**Forms** should have: comfortable spacing, rounded borders, smooth shadows,
clear labels, and professional validation (React Hook Form + Zod).

**Tables** should have: search, filters, sorting, pagination, sticky headers,
export, print, view, alternating row colors, and comfortable row height
(TanStack Table).

**Cards** should display important statistics clearly.

Animations must be subtle and professional. No unnecessary visual clutter.

---

## 13. Dashboard Philosophy

Every role has its own dashboard, each displaying **only** information relevant
to that role:

Administrator Dashboard · Teacher Dashboard · Student Dashboard ·
Parent Dashboard · Finance Dashboard · Exam Dashboard · Attendance Dashboard.

---

## 14. Functional Modules

### MODULE 1 — Student Management

**Overview.** The Student Management Module is the foundation of the entire
School ERP. Every other module (Attendance, Fees, Exams, Results, Reports,
Promotion, Parent Portal, Student Portal, Online Quiz, etc.) depends on accurate
student records. Each student must have **one unique identity** throughout the
system.

**Student Registration.** Administrators can register students individually or
import them in bulk. Registration must include:

- Student Full Name
- Gender
- Student Phone *(optional)*
- Parent / Responsible Person
- Parent Phone Number
- Class
- Section *(optional)*
- Monthly Fee
- Registration Date *(automatic)*
- Student Status: `Active` · `Inactive` · `Graduated`

Student IDs are generated automatically using the school prefix (e.g. `SHMM0001`,
`SHMM0002`) and can **never** be edited manually.

**Duplicate Prevention.** The system must prevent duplicate student records.
Duplicate validation compares: Student Name, Parent, Parent Phone, Class,
Section. If all fields match an existing student, registration is **rejected**.
Students with the same name are allowed **only** if their parent information
differs.

**Student Status:**

- **Active** — can attend classes, take exams, pay fees; appears in attendance,
  reports, and promotions.
- **Inactive** — cannot attend class, appear in attendance, take exams, or be
  charged fees. Inactive students remain available in history.
- **Graduated** — students completing the final class are automatically moved
  into the Graduated Module. They cannot appear inside active classes, but
  historical records remain available forever.

**Student Profile.** Each student has a complete profile page displaying:
Personal Information, Parent Information, Class, Section, Registration
Information, Monthly Fee, Attendance History, Fee History, Exam History, Quiz
History, Promotion History, Invoices, Payment Receipts, Academic Performance,
Current Status, and Reports. Supports **Print Profile** and **Download Profile**.

**Student Import (bulk).** Bulk registration supports CSV import. The
downloadable template must include: Student Name, Gender, Parent Name, Parent
Phone, Class, Section, Monthly Fee — with **sample Somali student names**
included inside the template. During import the system validates duplicate
students, invalid classes, invalid sections, missing parents, missing fees, and
invalid phone numbers. An **Import Summary** shows: Imported, Skipped, Failed,
Errors. *(Large imports run as BullMQ background jobs.)*

**Student Export.** Students can be exported using filters: Class, Section,
Gender, Status, Academic Year. Exports: CSV and Printable List. The **serial
number always starts from 1 after filtering**.

**Student Printing.** The printed student list includes: Serial Number, Student
ID, Name, Gender, Class, Section, Parent, Phone, School Logo, School Name, Print
Date.

**Student Edit.** Editing a student must **never** create a new Student ID, new
Parent Account, or new User Account. Editing only updates existing records.
Student IDs remain unchanged forever.

**Student Delete.** Deletion must respect parent relationships:

- If the parent has **only one** student → delete student **and** delete parent
  account.
- If the parent has **multiple** students → delete student, **keep** parent
  account.
- **No orphan parent accounts may exist.**

**Student Search.** Global search supports: Student Name, Student ID, Parent
Name, Parent Phone, Class, Section.

---

### MODULE 2 — Parent Management

**Overview.** Parents are **automatically created** from Student Registration.
Administrators never manually create parent accounts.

**Automatic Parent Account.** When registering a student the system checks
whether the Parent Phone already exists:

- **Yes** → reuse the existing parent account.
- **No** → create a new parent account.

**Parent IDs.** Automatically generated (e.g. `PSHMM0001`).

**Parent Username.** Automatically generated. If the parent name already exists,
the system appends random characters or the Parent ID (e.g. `Ahmed`, `Ahmed01`,
`AhmedPS12`).

**Parent Login.** Parents log in using Parent ID + Password.

**Parent Dashboard.** Parents can view: Children, Attendance, Exam Results, Quiz
Results, Fee Status, Invoices, Payments, School Notices, Academic Progress.

**Multiple Students.** One parent account may manage 1, 2, 5, or unlimited
students. Switching between children must be seamless.

**Parent Profile.** Displays: Parent Information, Children, Fee Summary,
Attendance Summary, Exam Summary, Payment History.

**Parent Security.** Parents can **never** view students belonging to another
parent.

---

### MODULE 3 — Teacher Management

**Teacher Registration.** Teacher information includes: Teacher ID, Full Name,
Phone, Gender, Salary, Shift (Morning / Afternoon), Employment Status,
Registration Date.

**Teacher IDs.** Automatically generated (e.g. `TSHMM0001`).

**Teacher Login.** Teachers log in using Teacher ID + Password.

**Teacher Dashboard.** Displays: Assigned Classes, Assigned Sections, Assigned
Subjects, Today's Classes, Pending Exams, Online Quizzes, Attendance, Salary
Summary *(optional)*.

**Teacher Profile.** Displays: Personal Information, Assignments, Attendance
History, Salary History, Exam Activities, Quiz Activities, Login Credentials.

**Import / Export / Print.** Teacher import supports CSV. Teacher export supports
CSV. Teacher print supports Teacher Details, Assignments, School Logo, School
Information.

---

### MODULE 4 — Teacher Assignment

**Overview.** Teacher Assignment determines what a teacher can see. **Nothing
appears inside the Teacher Portal unless assigned.**

**Assignment Structure.** Each assignment consists of: `Teacher → Class →
Section → Subject`.

**Assignment Rules.** A teacher may teach: multiple classes, multiple sections,
multiple subjects, the same subject in multiple sections, different subjects in
the same class, and unlimited assignments.

**"All Sections".** If a teacher is assigned to *Grade 12 → All Sections*, this
means the teacher teaches every section — **but** during exam entry the teacher
**must choose** one section (A **or** B **or** C). Marks are **never** entered
for "All Sections" together.

**Assignment Management.** Admin can Create, Edit, Delete, View, and Duplicate
assignments.

**Assignment View.** Displays: Teacher, Class, Section, Subject, Academic Year,
Status.

**Teacher Permissions.** Teachers only see assigned Classes, Sections, and
Subjects — nothing else. No unauthorized access is allowed.

**Data Integrity Rules.** Every assignment is unique; duplicate assignments are
rejected. No teacher may enter marks for a different subject, class, or section.
Everything is validated using: Teacher ID, Class ID, Section ID, Subject ID,
Academic Year.

---

### MODULE 5 — Student Attendance

**Overview.** Enables schools to record, monitor, and report daily attendance
accurately. Attendance records are permanently linked to the student's Academic
Year, Class, and Section, and integrate with student profiles, reports, the
parent portal, and administrative dashboards.

**Attendance Workflow.** Always follows this sequence:
`Academic Year → Class → Section (if applicable) → Student List → Mark
Attendance`. The system must **never mix students from different sections**.

**Attendance Status.** Each student can receive **one** status per day:
`Present` · `Absent` · `Late` · `Excused`. Each student may only have **one
record per day**.

**Daily Restrictions.** The system must prevent duplicate attendance, multiple
entries for the same student on the same date, and attendance for inactive or
graduated students.

**Attendance Dashboard.** Displays: Total Students, Present Today, Absent Today,
Late Today, Attendance Percentage. Filters: Academic Year, Date, Class, Section.

**Attendance Reports.** Support View, Search, Print, PDF, CSV Export.

**Student Attendance History.** Each profile displays: Daily Attendance, Monthly
Attendance, Attendance Percentage, Total Present, Total Absent, Total Late.

---

### MODULE 6 — Teacher Attendance

**Overview.** Teacher attendance is **independent** from student attendance.
Teachers are assigned **one shift only** (Morning or Afternoon).

**Teacher Shift.** Every teacher profile includes Morning or Afternoon.

**Attendance Workflow.** Morning teachers appear only in Morning Attendance;
afternoon teachers only in Afternoon Attendance. Teachers from different shifts
must never appear together.

**Daily Rule.** A teacher may only be marked **once per day**. If attendance
already exists, the attendance button is disabled.

**Teacher Attendance Dashboard.** Displays: Morning Teachers Present, Morning
Teachers Absent, Afternoon Teachers Present, Afternoon Teachers Absent, Overall
Attendance Rate.

**Teacher Attendance Reports.** Support Search, View, Print, PDF, CSV.

---

### MODULE 7 — Monthly Fees Management

**Overview.** The Fees Module handles Monthly Charges, Collections, Invoices,
Outstanding Balances, Advance Payments, Carry Forward, and Financial Reports.
Every transaction must be permanently recorded.

**Monthly Setup.** The system uses a Monthly Setup where only **one active
month** exists at a time. New month activation is allowed **only after the 25th
day** of the current month.

**Month Activation.** When the admin activates a month, the system automatically:
charges all active students, creates monthly fee records, skips students with
advance payments, and carries forward unpaid balances. *(Runs as a BullMQ job.)*

**Fees Dashboard — Summary Cards.** Total Outstanding, Outstanding This Month,
Total Collected This Month, Total Fully Paid, Total Partial Payments, Total
Advance Payments, Monthly Collection Percentage.

**Monthly Calendar Filter.** Dashboard supports Monthly Filter, Academic Year
Filter, and Date Range. Every statistic updates automatically.

**Recent Collections.** Display: Receipt Number, Student, Class, Section, Amount,
Payment Type, Collected By, Date.

**Fee Collection Flow.** `Class → Section → Student List → Pay Button`.

**Payment Types:**

- **This Month** — pays the current month only; disabled if already fully paid.
- **Partial** — enabled only if the student has an outstanding balance; displays
  Outstanding Months, Outstanding Amount, Remaining Balance.
- **Advance** — enabled only if the current month is fully paid and no
  outstanding balances exist. Admin enters the number of months; the system
  calculates the advance amount automatically.

**Advance Payment Rules.** Students with advance payments must never be charged
again for already-paid future months. Month Setup automatically skips those
months.

**Carry Forward.** If the previous month is unpaid, the balance automatically
carries into the next month, and continues until the balance becomes zero.

**Receipts.** Every payment generates a receipt containing: Receipt Number,
Student, Class, Section, Payment Type, Amount, Collected By, Date, School Logo,
School Name. Receipts support Print, PDF, Download *(PDFKit)*.

**Student Fee History.** Each profile displays: Monthly Charges, Payments,
Balances, Advance Months, Carry Forward, Invoices, Payment History.

**Fee Reports.** Support Search, Filter, View, Print, PDF, CSV. Reports:
Collection Report, Outstanding Report, Advance Payment Report, Partial Payment
Report, Student Ledger.

---

### MODULE 8 — Salary Management

**Overview.** Records salary payments for Teachers, Administrative Staff,
Attendance Officers, Finance Officers, and other employees.

**Salary Information.** Each record includes: Employee, Position, Salary Amount,
Month, Status, Payment Date, Notes.

**Salary Payment Status.** `Pending` · `Paid` · `Partial`.

**Salary Reports.** Monthly Salary Report, Teacher Salary Report, Department
Salary Report, Annual Salary Report.

---

### MODULE 9 — Expense Management

**Overview.** Schools can record every operational expense.

**Expense Categories.** Admin creates unlimited categories. Examples:
Electricity, Water, Internet, Transport, Maintenance, Cleaning, Furniture,
Office Supplies, Other.

**Expense Record.** Fields: Expense Title, Category, Amount, Date, Payment
Method, Notes, Recorded By.

**Expense Reports.** Support Search, Filter, View, Print, PDF, CSV.

---

### MODULE 10 — Finance Dashboard

**Overview.** Provides complete financial analytics.

**Income Sources.** Student Fees, Other Income *(future expansion)*.

**Expenses.** Operational Expenses, Teacher Salaries, Staff Salaries.

**Net Income.** Automatically calculated:

```
Net Income = Total Income − Expenses − Salaries
```

**Dashboard Cards.** Total Income, Total Expenses, Total Salaries, Net Income,
Outstanding Fees, Advance Collections, Collection Rate.

**Financial Reports.** Daily Report, Monthly Report, Annual Report, Outstanding
Report, Income Statement, Expense Report, Salary Report, Net Income Report.

**Printing.** Every financial report includes School Logo, School Name, Report
Title, Date, Prepared By, Signature Area — with Print, PDF, CSV.

**Finance Permissions.** Only **Administrator** and **Finance Officer** may
access Fees, Expenses, Salaries, and Financial Reports. Other users have no
access.

**Data Validation Rules.** The Finance Module must prevent: duplicate monthly
charges, duplicate payments, negative payments, duplicate receipts, paying the
same month twice, advance payment with an outstanding balance, invalid fee
calculations, duplicate expense records, duplicate salary payments.

---

### MODULE 11 — Examination Management

**Overview.** The academic core of the system. It manages the complete
examination lifecycle: exam creation, teacher mark submission, result
calculation, student access, result publication, and reporting.

It supports: Teacher Mark Entry, Teacher Excel Import, School Excel Import,
Multi-Term Exams, Final Academic Results, Result Publishing, Result Locking,
Student Result Portal, Exam Blocking, Reports, and Automatic Calculations. All
examination operations must strictly follow the **Class + Section** structure.

**Academic Structure.** Every examination belongs to:
`Academic Year → Exam Group (optional) → Term → Exam → Class → Section (optional)
→ Subjects → Students`.

**Exam Types (two methods):**

1. **Teacher Entry** — teachers enter marks directly, or import marks using
   Excel.
2. **School Import** — school administration imports all marks using an Excel
   template; teachers do not participate.

**Exam Creation.** Only **Administrator** and **Exam Manager** can create
examinations. Required information: Exam Name, Academic Year, Exam Type, Term,
Exam Maximum Marks, Exam Weight, Classes, Sections, Start Date, End Date, Status.

**Class Selection.** Admin may select All Classes or Specific Classes; multiple
classes may be selected simultaneously.

**Section Selection.** If a selected class has sections, section selection
becomes mandatory. Admin may choose All Sections or Specific Sections. **Each
selected section becomes an independent examination — students must never mix.**

**Subject Selection.** Subjects are **not** selected manually. The system
automatically loads subjects from Teacher Assignments (`Class → Section`). Every
class automatically inherits its assigned curriculum.

**Teacher Visibility.** Teachers only see examinations belonging to their
assigned Class, Section, and Subject. No teacher may view examinations outside
their assignments.

**Teacher Examination Dashboard.** Pending Exams, Completed Exams, Imported
Exams, Upcoming Exams, Quiz Assignments, Recent Results.

**Teacher Exam Workflow.** `Teacher Login → Exam Module → Select Class → Select
Section → Select Examination → Select Subject → Enter Marks OR Import Excel →
Submit`.

> **Important Rule.** A *Grade 12 → All Sections* assignment does **not** allow
> entering marks for all sections together. The teacher must choose Section A,
> B, or C. Each section is an independent classroom.

**Direct Mark Entry.** Teacher selects `Exam → Class → Section → Subject`; the
system loads only students of the selected section, sorted A → Z; the teacher
enters marks.

**Mark Validation.** Marks must never exceed the maximum. Example: maximum 50,
teacher enters 55 → **rejected** with error *"Maximum mark allowed is 50."*
Validation applies to manual entry, Excel import, and admin editing.

**Teacher Excel Import.** The system auto-generates a template containing **only**
Student ID, Student Name, Class, Section, and the Teacher's Subject(s) — no
unrelated subjects or students. Template always starts at cell **A1**.

Example: `| Student ID | Student Name | Class | Section | Mathematics |`
Flow: download → fill marks → import → validate → save.

**Teacher Import Validation.** Validates Wrong Student, Wrong Class, Wrong
Section, Wrong Subject, Duplicate Student, Duplicate Import, Marks Above Maximum,
Empty Marks, Duplicate Rows. Import Summary displays Imported, Skipped, Failed,
Errors.

**School Import Examination.** Admin chooses `Exam Type → School Import`. The
system creates an Excel template that includes only the selected class, selected
section, all students, and all subjects. School enters marks → imports → system
calculates results automatically.

**Examination Status.** `Draft` · `Open` · `In Progress` · `Completed` ·
`Locked` · `Published` · `Archived`.

**Lock Examination.** Only Administrator / Exam Manager may lock. After lock,
teachers cannot edit, delete, import, or modify — marks become **read only**.

**Publish Examination.** Only after lock may the administrator publish. Published
examinations become available inside the Student Portal, Parent Portal, and
Reports.

**Examination Delete.** Admin may delete an examination (confirmation required).
Deleting updates Final Results, Reports, and Statistics without affecting
unrelated examinations.

**Exam Monitoring Dashboard.** Admin sees all exams → each Class → each Section →
each Subject → assigned Teacher → Submission Status (Teacher Submitted, Pending,
Missing) → Completion Percentage.

**Exam Block Management.** Each examination includes a Blocked Students page.
Admin may Search Student → Block → Add Note (examples: Outstanding Fees, Office
Clearance, Disciplinary Case). Blocked students cannot view results.

**Unblock Student.** Admin may unblock; the student immediately regains access.

**Result Calculation.** Every examination automatically calculates Subject Total,
Overall Total, Average, Grade, Pass, Fail.

**Grade System.**

| Range | Grade |
|---|---|
| 90–100 | A |
| 80–89 | B |
| 70–79 | C |
| 60–69 | D |
| 50–59 | E |
| Below 50 | F |

**Pass Rule.** Average ≥ 50 → **PASS**; Average < 50 → **FAIL**.

**Result Calculation Formula.**

```
Total Marks = Sum of all subjects
Average     = Total Marks ÷ Number of Subjects
```

The system calculates dynamically — **no hardcoded subject count**.

**Term Management.** Supports Single Term, Two Terms, Three Terms, and unlimited
future expansion. Each exam belongs to one term (e.g. Term 1, Midterm, Final,
Semester One, Semester Two).

**Exam Groups.** Admin creates an Exam Group (e.g. *Academic Final*, *2026 Annual
Result*). A group contains 2 or 3 terms. Each examination has a weight (e.g.
Term 1 = 50% / Term 2 = 50%, or 30 / 30 / 40).

**Final Result Calculation.** The system combines selected examinations and
calculates the academic result. No duplicate storage — results are generated
dynamically.

**Student Result Portal.** Students access a public result portal using their
Student ID. The portal displays School Logo, School Name, Student Name, Class,
Section, Academic Year.

**Result Display.** Students first see individual term results (Term One: Subject,
Maximum, Obtained, Term Total), then Term Two, then the Final Academic Result
(Subject, Term One, Term Two, Final, Total, Average, Grade, Pass/Fail). Students
must clearly understand how the final result was produced.

**Parent Result Portal.** Parents see all children → each child's examination →
attendance → fees → results.

**Result Reports.** Support View, Search, Print, PDF, CSV. Filters: Academic
Year, Exam, Class, Section, Teacher, Subject.

---

### MODULE 12 — Online Quiz System

**Overview.** Teachers can conduct online assessments — Homework, Class Tests,
Practice Tests, Revision, Assignments.

**Quiz Types.** Multiple Choice, True / False, Fill in the Blank, Short Answer,
Essay, Mixed Questions.

**Quiz Creation.** Teacher defines: Title, Description, Class, Section,
Questions, Marks, Time Limit, Start Date, End Date, Attempts, Visibility.

**Question Bank.** Teachers may reuse questions between quizzes.

**Quiz Link.** Publishing a quiz automatically creates a secure URL. The teacher
shares the link with assigned students only.

**Student Quiz Portal.** `Student Login → My Quizzes → Available → Start Quiz`,
or access using the secure link.

**Quiz Restrictions.** Students only access their assigned Class, Section, and
Quiz. Timer supported. Automatic submission supported.

**Quiz Grading.** Automatic for MCQ and True/False; manual for Essay, Short
Answer, and Fill Blank *(optional)*.

**Teacher Quiz Dashboard.** Created Quizzes, Attempts, Average Score, Pending
Manual Reviews, Export Results.

**Administrator Quiz Dashboard.** All Teachers → All Quizzes → Assigned Classes →
Attempts → Average Scores → Completion. The administrator monitors without
modifying teacher assessments.

**Quiz Reports.** Support Search, View, Print, PDF, CSV.

**Data Validation Rules.** The Examination Module must prevent: Duplicate Marks,
Duplicate Imports, Wrong Sections, Wrong Subjects, Wrong Teachers, Marks Above
Maximum, Duplicate Results, Duplicate Publications, Duplicate Quiz Attempts,
Duplicate Exam Groups, Duplicate Student Results.

---

### MODULE 13 — Promotion Management

**Overview.** Automates student movement between academic years while preserving
complete academic history. Promotion is performed **only after the academic year
is completed**. The system must never lose historical student records.

**Academic Year Management.** Admin can create unlimited academic years (e.g.
2025–2026, 2026–2027, 2027–2028). Only **one** academic year can be Active;
previous years become **Read-Only**.

**Promotion Types:**

- **Individual Promotion** — promote a single student.
- **Class Promotion** — promote one class (e.g. Grade 5 → Grade 6).
- **School Promotion** — promote all classes simultaneously (Grade 1 → Grade 2,
  …, Grade 11 → Grade 12), executed with one action.

**Promotion Rules.** Only active students are promoted. Inactive students remain
in their current class. Graduated students are excluded.

**Graduated Students.** Students reaching the final grade are automatically
transferred into the Graduated Students Module (e.g. Grade 12 → Graduated). They
remain searchable forever. Historical records include Attendance, Fees, Exam
Results, Quiz Results, Promotion History, Certificates.

**Promotion Preview.** Before promotion the system displays: Current Class, New
Class, Student Count, Warnings, Graduating Students, Inactive Students. Admin
must confirm before execution.

**Promotion History.** Every promotion is permanently logged: Academic Year,
Previous Class, New Class, Promotion Date, Promoted By.

---

### MODULE 14 — Reports Module

**Overview.** Reports are **completely independent** from Management Modules.
Reports never redirect to CRUD pages. Each report opens inside its own dedicated
page.

**Available Reports.** Student, Teacher, Attendance, Fee, Salary, Expense,
Financial, Promotion, Exam, Quiz, Parent, User, Audit.

**Student Report.** Supports Search, Filter, View, Print, PDF, Excel Export.
Filters: Academic Year, Class, Section, Status, Gender.

**Teacher Report.** Displays Teacher Details, Assignments, Attendance Summary,
Salary Summary, Subjects, Classes, Sections. Print supported.

**Attendance Report.** Supports Daily, Weekly, Monthly, Annual reports.

**Examination Reports.** Displays Exam Results, Term Results, Academic Results,
Grades, Pass Rate, Fail Rate, Class Ranking, Section Ranking.

**Financial Reports.** Displays Income, Expenses, Salaries, Outstanding Fees,
Advance Payments, Net Income.

**Reports UI.** Every report page includes Search, Filters, Statistics, Table,
Print, PDF, Excel, Pagination, Sorting, and a professional layout.

**Printing Standards.** Every printed report includes School Logo, School Name,
Academic Year, Report Title, Print Date, Prepared By, Signature Area, Page
Numbers.

---

### MODULE 15 — User Management

**Overview.** The administrator controls every system user.

**User Roles.** Administrator, Teacher, Parent, Student, Attendance Officer,
Finance Officer, Exam Manager, Reception Officer.

**User Creation.** Fields: Full Name, Username, Password, Role, Phone, Status.

**User Status.** `Active` · `Inactive` · `Locked`.

**Permissions.** Each role has independent permissions. Menus appear
dynamically; users only see assigned modules. Unauthorized URLs must return
**Access Denied**.

**Password Reset.** Administrator may reset passwords. Users may change passwords
after login.

---

### MODULE 16 — System Settings

**School Information.** School Name, Logo, Motto, Address, Phone, Email, Website,
Principal, Currency, Timezone, Language, Academic Year, Receipt Footer, Report
Footer, Result Footer.

**Identity Settings.** Student Prefix, Teacher Prefix, Parent Prefix, Receipt
Prefix, Invoice Prefix, Certificate Prefix.

**Branding.** The school logo automatically appears on Reports, Invoices,
Receipts, Certificates, Result Slips, the Student Portal, and the Parent Portal.

---

### MODULE 17 — Notifications

The system supports internal, **role-based** notifications *(delivered in
realtime via Socket.IO)*. Examples: New Exam Published, Fee Collected, Student
Registered, Attendance Completed, Quiz Assigned, Promotion Completed, Result
Published, Salary Paid, Expense Added.

---

### MODULE 18 — Audit Logs

Every important action must be recorded. Examples: Login, Logout, Student Created,
Student Updated, Student Deleted, Teacher Updated, Fee Collected, Exam Created,
Marks Imported, Result Published, Quiz Created, Expense Added, Promotion
Executed, Settings Updated.

**Audit Information stored:** User, Role, Module, Action, Date, Time, IP Address.

---

### MODULE 19 — Backup & Restore

The administrator can: Create Manual Backup, Download Backup, Restore Backup,
schedule Automatic Backups, and View Backup History. *(Scheduled backups run as
BullMQ jobs; backup files are stored in MinIO.)*

---

### MODULE 20 — Security

System security rules: Role-Based Access Control, Password Encryption, Session
Management, Automatic Logout, CSRF Protection, Input Validation, Duplicate
Prevention, File Upload Validation, Permission Validation, Database Integrity.

---

### MODULE 21 — Search Engine

Global search supports: Student, Teacher, Parent, Receipt, Invoice, Exam, Quiz,
Expense, Attendance, User. Search must be **fast** and available throughout the
system *(PostgreSQL Full-Text Search; optional Meilisearch)*.

---

### MODULE 22 — Import / Export

Supports CSV Import, CSV Export, PDF, Printing. Every import validates:
Duplicate Data, Wrong Class, Wrong Section, Wrong Subject, Wrong Student, Wrong
Teacher, Missing Required Fields, Invalid Marks. An **Import Summary** is
displayed after every import.

---

### MODULE 23 — Dashboard Analytics

The Administrator Dashboard displays: Total Students, Total Teachers, Total
Parents, Attendance Today, Fees Collected, Outstanding Fees, Upcoming Exams,
Published Results, Monthly Income, Monthly Expenses, Net Income, Recent
Activities, Quick Actions, Charts, Statistics.

---

### MODULE 24 — Business Rules (Global)

The system must **never** allow:

- Duplicate Student IDs
- Duplicate Teacher IDs
- Duplicate Parent IDs
- Duplicate Attendance
- Duplicate Fee Charges
- Duplicate Receipts
- Duplicate Exam Marks
- Duplicate Teacher Assignments
- Duplicate Quiz Attempts
- Duplicate Promotion
- Duplicate Parent Accounts
- Students from different sections mixed together
- Teachers accessing unassigned classes
- Marks exceeding the maximum score
- Payment of the same month twice
- Advance payment when an outstanding balance exists
- A parent account without students
- Teacher attendance twice on the same day

---

### MODULE 25 — Performance Requirements

The system must: load dashboards quickly, handle thousands of students, support
concurrent users, optimize searches, use pagination for large datasets, generate
reports efficiently, and maintain responsive performance.

---

### MODULE 26 — Acceptance Criteria (Module-level)

Covered in full under [Global Acceptance Criteria](#17-global-acceptance-criteria).

---

## 15. Data Model — Core Entities

Derived from the business rules above; implemented with **Prisma + PostgreSQL**.
Relationships enforce section isolation and prevent orphan records.

| Entity | Key relationships |
|---|---|
| **School / Settings** | 1 school profile, branding, prefixes, footers |
| **AcademicYear** | one Active at a time; others Read-Only |
| **Class** | belongs to AcademicYear; has many Sections |
| **Section** | belongs to Class; **independent classroom** |
| **Subject** | linked via Teacher Assignment to Class + Section |
| **Student** | belongs to one Class + one Section; has one Parent |
| **Parent** | has many Students; auto-created from registration |
| **Teacher** | has many Assignments; one Shift |
| **TeacherAssignment** | Teacher × Class × Section × Subject × AcademicYear (unique) |
| **StudentAttendance** | Student × Date (one per day); Class + Section scoped |
| **TeacherAttendance** | Teacher × Date (one per day); Shift scoped |
| **MonthlyFee / Charge** | Student × Month; carry-forward & advance logic |
| **Payment / Receipt** | belongs to Student; type = This Month / Partial / Advance |
| **Salary** | Employee × Month; status Pending/Paid/Partial |
| **Expense** | Category × Date × Amount |
| **Exam** | AcademicYear → (ExamGroup) → Term → Class → Section → Subjects |
| **ExamMark** | Exam × Student × Subject; ≤ max marks; unique |
| **ExamGroup** | contains terms with weights; drives Final Result |
| **Result** | computed dynamically (no duplicate storage) |
| **BlockedStudent** | Exam × Student + note |
| **Quiz / Question / Attempt** | Teacher-owned; Class + Section scoped |
| **Promotion** | logs Prev Class → New Class per AcademicYear |
| **User** | Role, Status; drives RBAC menus |
| **Notification** | role-based; realtime |
| **AuditLog** | User, Role, Module, Action, Date, Time, IP |
| **Backup** | manual/scheduled; stored in MinIO |

**Cross-cutting invariants:** unique & non-reusable IDs; no orphan parents; no
section mixing; no duplicates across attendance/fees/marks/assignments/receipts;
marks never exceed maximum; historical data preserved forever.

---

## 16. Non-Functional Requirements

**Performance.** Fast dashboards, thousands of students, concurrent users,
optimized search, pagination for large datasets, efficient report generation,
responsive performance under load.

**Security.** RBAC on every route; password encryption; JWT + refresh-token
session management; automatic logout; CSRF protection; input validation
(Zod/class-validator); file-upload validation; permission validation; database
integrity constraints.

**Scalability.** Support a growing school, hundreds of teachers, thousands of
students, multiple academic years, and years of history without redesign.

**Observability.** Uptime Kuma (uptime), Prometheus + Grafana (metrics &
dashboards), Pino/Winston (structured application logs), Audit Logs (business
actions).

**Reliability & Recovery.** Manual and scheduled backups; restore capability;
backup history; durable object storage in MinIO.

**Delivery.** Dockerized services; deployment via Coolify on a Hostinger VPS;
GitHub for version control; GitHub Actions for CI/CD.

---

## 17. Global Acceptance Criteria

The system is considered complete when:

- Every module operates independently **and** together.
- Student, Teacher, Parent, Finance, Examination, Quiz, Promotion, and Reports
  modules are fully integrated.
- Role-based permissions are enforced throughout the application.
- Reports are printable and exportable.
- Financial calculations are accurate.
- Examination calculations, term grouping, and result publication function
  correctly.
- Attendance prevents duplicate entries.
- Fee management correctly handles current, partial, advance, and carry-forward
  payments.
- Sections are always isolated and never mixed.
- Data integrity is preserved during imports, edits, promotions, and deletions.
- Audit logs capture all critical operations.
- School branding appears consistently across the entire platform.
- The platform is **production-ready** for real-world school operations.

---

## 18. Open Questions & Assumptions

These items are **not** specified in the source material and should be confirmed
before implementation. Assumptions are marked where a sensible default was used.

1. **Multi-tenancy** — Assumed **single school** per deployment (multi-school is
   a future expansion). Confirm if one instance must serve multiple schools.
2. **Currency & payments** — Fees are recorded as amounts only; no payment
   gateway is specified. Assumed **manual/cash collection** recorded by staff.
   Confirm if online payment (e.g. mobile money / EVC / card) is required.
3. **Languages** — Settings include a "Language" field and Somali sample data.
   Confirm whether full **UI localization (English + Somali)** is required.
4. **Notifications channels** — Assumed **in-app + realtime** only. Confirm if
   **SMS/Email** notifications to parents are in scope (SMTP is in the stack).
5. **Grade scale** — The A–F scale and pass mark (≥ 50) are assumed **fixed**.
   Confirm whether these must be **configurable per school**.
6. **Certificates** — Referenced under graduated students and prefixes but not
   fully specified. Confirm the certificate template and generation rules.
7. **Meilisearch** — Marked optional. Confirm whether to ship with **PostgreSQL
   FTS only** at launch.
8. **Timezone/locale for dates** — Assumed driven by the school Settings
   timezone. Confirm handling of historical records across timezone changes.

---

*End of Master PRD — Enterprise School Management ERP System.*
