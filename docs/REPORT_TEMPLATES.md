# EarlyLearn Hub — Report Templates & Export Audit

**Date:** 2026-11-27  
**Templates Folder:** `templates/reports/`  
**Registry:** `src/lib/reportRegistry.js`

---

## 1. Template Inventory & Registry Mapping

| Template File | What It Is | Closest Report(s) in `REPORT_REGISTRY` | Fields Needed & DB Source | Fields System Lacks |
| --- | --- | --- | --- | --- |
| `templates/reports/CHILD-DEVELOPMENT-CENTER-MONITORING-REPORT.docx` | MSWDO Child Development Center (CDC) Monitoring Report (`.docx`, 558 KB) | `class_enrollment`, `teachers_list` | CDC name (`cdcs.name`), Barangay (`cdcs.barangay`), CDW/Teacher (`teachers.full_name`), Enrollees (`students` / `enrollments`) | Physical facility checklist, feeding/session attendance counts, monitoring officer remarks |
| `templates/reports/COMMUNITY-MAPPING-2.0.docx` | Community Mapping 2.0 Household / Child Survey (`.docx`, 188 KB) | `class_enrollment` (closest) | Child name (`students.full_name`), DOB/Age (`students.birth_date`), Parent/Guardian (`parents.full_name`), Barangay (`cdcs.barangay`) | Household income, 4Ps/indigent flags, out-of-school youth indicators, disability/special-needs survey fields |
| `templates/reports/UPON-ENTRY-Nutritional-Status.docx` | Upon-Entry Nutritional Status Assessment Sheet (`.docx`, 172 KB) | `student_development` (closest) | Learner name (`students.full_name`), Sex/DOB (`students.sex`, `students.birth_date`), CDC/Barangay (`cdcs.name`, `cdcs.barangay`) | Weight (kg), Height (cm), Weight-for-Age / Height-for-Age / BMI-for-Age status, deworming/vitamin A dates |

---

## 2. Recommended Generation Method (100% Fidelity)
- **Method:** Fill the `.docx` templates directly using `pizzip` + `docxtemplater` (preserving all original Word tables, borders, logos, fonts, and signature blocks), then convert `.docx` → `.pdf` via a Supabase Edge Function (or LibreOffice headless service) on demand.
- **Security & Privacy:** Generate on demand only, enforce role/CDC scoping via RLS + Edge Function JWT verification, never cache/store generated PDFs in public buckets, and log every export via `log_event`.

---

## 3. Existing Export / Print Audit
- **CSV Export (`src/lib/reportRegistry.js`):** **Working** — role-scoped (`allowedRoles`), UTF-8 BOM-safe, escapes commas/quotes, and logs exports.
- **ECCD Report Sheet (`src/components/teacher/TeacherReportSheet.jsx`):** **Working** — uses `@media print` with `.no-print` hiding dashboard chrome.
