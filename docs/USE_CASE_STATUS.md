# EarlyLearn Hub — Use Case Diagram Verification

**Date:** 2026-11-27  
**Build & Tests:** `npm run build` (**PASS**), `npx vitest run` (**PASS** — 3 files, 8/8 tests)

---

## 1. Use Case Matrix

| Use Case | Actor | Status | Evidence (Route / Component / Table / RLS) | Action |
| --- | --- | --- | --- | --- |
| **Log in / out** | MSWDO, Teacher, Parent/Guardian | `done` | `/login`, `Login.jsx`, `DashboardLayout.jsx` (`signOut`), `roles.js` (`app_metadata.role`) | Verified |
| **View Dashboard** | MSWDO, Teacher, Parent/Guardian, Learner | `done` | `/admin-dashboard`, `/teacher-dashboard`, `/student-dashboard`, `ProtectedRoute.jsx` | Verified |
| **Manage Teacher** | MSWDO (Admin/Superadmin) | `done` | `ManageTeachers.jsx`, `teachers` table, `admin-reset-password` Edge Function | Verified |
| **Review Teachers Activities** | MSWDO (Admin/Superadmin) | `done` | `ProgramMonitoring.jsx`, `AdminDashboard.jsx`, `materials` / `teacher_activities` | Verified |
| **Upload Curriculum Guide** | MSWDO (Admin/Superadmin) | `done` | `CurriculumGuides.jsx`, `curriculumService.js`, private storage | Verified |
| **View Enrollee Population** | MSWDO (Admin/Superadmin) | `done` | `EnrolleePopulation.jsx`, `students` / `enrollments` | Verified |
| **View Daycare Centers** | MSWDO (Admin/Superadmin) | `done` | `DaycareCenterMonitoring.jsx`, `cdcService.js`, `cdcs` | Verified |
| **Generate Reports** | MSWDO (Admin/Superadmin) | `done` | `ReportsGeneration.jsx`, `reportRegistry.js`, `templateExport.js` | Verified |
| **View Assigned Topics and Tasks** | Teacher | `done` | `TeacherDashboard.jsx` (`assigned_topics`), `curriculumService.js` | Verified |
| **View / Update Learner Progress** | Teacher | `done` | `TeacherChildDevelopment.jsx`, `TeacherReportSheet.jsx`, `eccd_assessments`, `submissionsService.js` | Verified |
| **Manage Announcements** | Teacher | `done` | `TeacherDashboard.jsx` (`announcements`), DB announcements table | Verified |
| **Manage Parent / Guardian Account** | Teacher | `done` | `TeacherDashboard.jsx` (approve/decline/create parent & learner), `learnersService.js` | Verified |
| **View Learner Progress** | Parent/Guardian | `done` | `StudentDashboard.jsx` (Progress tab), `eccd_assessments` | Verified |
| **View / Upload Learning Activities** | Learner | `done` | `StudentDashboard.jsx` (Activities & Submissions, locked after submit) | Verified |
| **View Announcements** | Learner | `done` | `StudentDashboard.jsx` (Announcements section) | Verified |

---

## 2. Negative Access Checks
- **Teacher** cannot access `/admin-dashboard`, `ManageTeachers`, `CurriculumGuides`, or municipal `EnrolleePopulation` (`ProtectedRoute` + `allowedRoles={['admin', 'superadmin']}` + RLS).
- **Parent / Learner** cannot access `/admin-dashboard` or `/teacher-dashboard`, nor read other children's records (`ProtectedRoute` + RLS).
- **MSWDO** does not post teacher-level classroom announcements.

---

## 3. Outside the Use Case (For Your Decision)
1. **Learning Categories management tab (`AdminDashboard.jsx`)** — **Keep** (supports curriculum & activity organization).
2. **Teacher standalone material uploads (`TeacherUploadModal.jsx`)** — **Keep** (supports `Review Teachers Activities`).
3. **Audit Logs (`supabase/migrations/009_audit_logs.sql`)** — **Keep** (required for MSWDO accountability & report export logging).

---

## 4. Conflicts (from `docs/CLEANUP_REPORT.md`)
- `localStorage` fallback caches in `src/lib/curriculumData.js` and `src/lib/learnersService.js` remain flagged under *Needs Your Decision*.

---

## 5. Summary Counts
- **Before & After:** `15 done`, `0 partial`, `0 missing`.
