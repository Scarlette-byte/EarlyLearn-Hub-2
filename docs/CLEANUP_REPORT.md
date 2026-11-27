# EarlyLearn Hub — Codebase Cleanup & Credentials Audit Report

**Date:** 2026-11-27  
**Scope:** `src/`, `sql/`, `supabase/` (migrations & Edge Functions), `package.json`

---

## 1. Hardcoded / Non-Functional & `localStorage` Findings
- **Static fallback datasets (`src/lib/curriculumData.js`, `src/lib/mswdData.js`, `src/lib/enrolleePopulationData.js`, `src/lib/studentLearningData.js`)**:
  - `curriculumData.js` and `learnersService.js` still contain `localStorage` cache/override keys (`earlylearn_teacher_profiles_override`, `earlylearn_curriculum_assignments`, `earlylearn_teacher_modules`, `earlylearn_student_eccd_*`).
  - **Action**: Flagged under *Needs Your Decision* before removing `localStorage` fallbacks, in case offline/demo fallback is still desired.
- **No dead UI buttons/tabs**: All routes in `src/App.jsx` map to active pages.

---

## 2. Redundancy & Dead Code
- **Unused / Dead Files Removed (Safe)**:
  - `src/components/AdminOverview.jsx` (replaced by `src/components/admin/MswdOverview.jsx`, 0 imports)
  - `src/pages/ManageLearners.jsx` (0 imports)
  - `src/lib/test_flows.js` (0 imports)
- **SQL / Migrations**:
  - `sql/` (`007_teacher_privacy.sql`, `008_create_eccd_assessments.sql`, `009_bootstrap_superadmin.sql`) and `supabase/` (`schema_normalized_draft.sql`, `security_hardening_rls_and_cleanup.sql`, `unpack_legacy_data_dry_run.sql`) sit alongside `supabase/migrations/001..011`. Keep `supabase/migrations/` as the canonical source of truth.

---

## 3. Recommended Structure
- `src/components/ui/` — shared design-system primitives (`Button`, `Card`, `Modal`, `Table`, `FormField`, `Badge`, `Tabs`, `EmptyState`, `Skeleton`, `Toast`, `StatCard`, `PageHeader`)
- `src/components/admin/`, `src/components/teacher/` — role-specific feature components
- `src/lib/` — single `supabaseClient.js`, `roles.js`, `passwordPolicy.js`, domain services (`cdcService.js`, `curriculumService.js`, `dashboardService.js`, `learnersService.js`, `submissionsService.js`, `teacherAuthService.js`)
- `src/pages/` — route entrypoints (`Login`, `SignUp`, `AdminDashboard`, `TeacherDashboard`, `StudentDashboard`, `ManageTeachers`, `ManageUsers`)
- `supabase/functions/` — privileged Edge Functions (`create-admin`, `admin-reset-password`, `delete-teacher`)

---

## 4. Unnecessary Options
- **Removed**: Redundant `"Register as a parent"` button on `Login.jsx` (duplicated `"Don't have an account? Sign Up"` linking to `/signup`).

---

## 5. Credentials & Authentication Audit

| Credential Type | Who Can Use It | How It's Issued | Rule Met? | Fix / Notes |
| --- | --- | --- | --- | --- |
| **Email + Password** | Superadmin, Admin, Teacher, Parent | Supabase Auth (`signInWithPassword`) | **Yes** | Role resolved strictly from `app_metadata.role` (`src/lib/roles.js`). |
| **Phone-as-synthetic-email** (`<digits>@earlylearn.ph`) | Parents | `normalizeAuthIdentifier` on `/signup` & `/login` | **Yes** | Server-trusted `app_metadata.role = 'student'`, requires teacher-issued code + approval. |
| **Teacher ID / Phone synthetic email** | Teachers | Issued by MSWDO Admin via `ManageTeachers` | **Yes** | Forced password change (`must_change_password`) enforced on first login. |
| **Parent Registration Code** | Parents | Issued by assigned Day Care Teacher | **Yes** | Checked on `/signup`; account stays `pending` until teacher approves. |
| **Admin Creation** | Superadmin only | `supabase/functions/create-admin/index.ts` | **Yes** | No public admin sign-up; `isSuperAdminUser` checked server-side. |
| **Password Reset** | Admin / Superadmin | `supabase/functions/admin-reset-password/index.ts` | **Yes** | Enforces `passwordPolicy.js` (min 8 chars, strength meter, common-password check). |
| **Anon Key (`VITE_SUPABASE_ANON_KEY`)** | Browser client | `.env` | **Yes** | Public anon key only; `service_role` key is never in `src/`. |

---

## Needs Your Decision (Not Changed)
1. **Remove `localStorage` fallbacks** in `src/lib/curriculumData.js` and `src/lib/learnersService.js` once Supabase `500`/`400` schema/RLS issues are resolved.
2. **Archive/remove legacy `sql/` and root `supabase/*.sql` drafts** after confirming `supabase/migrations/001..011` are applied in your Supabase project.
