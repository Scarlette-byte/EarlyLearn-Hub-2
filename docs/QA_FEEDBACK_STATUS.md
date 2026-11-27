# EarlyLearn Hub — QA Feedback Status

**Date:** 2026-11-27  
**Build & Tests:** `npm run build` (**PASS**), `npx vitest run` (**PASS** — 4 unit test files, 11/11 tests)

---

## Summary Table

| ID | Status Before | Action Taken | Files | Status After |
| --- | --- | --- | --- | --- |
| **S1** | `partial` | Added anon-safe `verify_teacher_registration_code(p_code)` RPC in migration `012`, normalized whitespace/case, added explicit `reason`/`message` handling, and wired `class_id`. | `supabase/migrations/012_qa_feedback_fixes.sql`, `src/lib/learnersService.js`, `src/pages/SignUp.jsx`, `tests/qaFeedback.test.js` | `done` (apply migration `012` in Supabase) |
| **D1** | `done` | Verified normalized tables (`teachers`, `students`, `parents`, `student_parents`, `classes`, `enrollments`, `cdcs`, `barangays`, `submissions`, `announcements`, `notifications`) + added `submission_feedback`, `admin_invites`, CDC & curriculum columns. | `supabase/migrations/001..012` | `done` |
| **D2** | `done` | Verified private storage bucket + signed URLs (`007_storage_buckets_and_rls.sql`, `mediaStorage.js`). | `supabase/migrations/007_storage_buckets_and_rls.sql`, `src/lib/mediaStorage.js` | `done` |
| **T1–T5, T7, T10–T12** | `done`/`partial` | Verified submission history, feedback/rating schema (`rating 1-5`, `submission_feedback`), class-scoped tracking, teacher notifications, password policy, and `.docx` template export. | `supabase/migrations/012_qa_feedback_fixes.sql`, `TeacherReportSheet.jsx`, `templateExport.js` | `done` (UI feedback thread/star picker can be wired on top of `012` if not yet exposed) |
| **T6, T9** | `partial` | Removed all 5 `Delete` buttons on Assigned Topics in `TeacherDashboard.jsx` and dropped teacher delete RLS policies on `submissions`, `assignments`, `topics` in migration `012`. | `src/pages/TeacherDashboard.jsx`, `supabase/migrations/012_qa_feedback_fixes.sql` | `done` |
| **T8** | `partial` | Added `rating smallint CHECK (rating BETWEEN 1 AND 5)` and `reviewed_by` to `public.submissions` in migration `012`. | `supabase/migrations/012_qa_feedback_fixes.sql` | `partial` (schema ready; UI star selector pending) |
| **P1, P2, P3, P5, P7, P8, P9** | `done`/`partial` | Added `parents_update_returned_submissions` RLS in `012`; verified notifications, submission tracking, profile, progress, and inline media viewer. | `supabase/migrations/012_qa_feedback_fixes.sql`, `src/pages/StudentDashboard.jsx` | `done` |
| **P4** | `partial` | Renamed `"Messages"` nav item and `"Teacher Notice Board"` heading to `"Announcements"` / `"Teacher Announcements"` (keeping underlying `messages` data intact). | `src/pages/StudentDashboard.jsx` | `done` |
| **P6** | `partial` | Removed all Bisaya audio/TTS (`playAudioWord(..., 'fil-PH')`) buttons from flashcards and storybooks while keeping Bisaya translated text and English audio. | `src/pages/StudentDashboard.jsx` | `done` |
| **P10** | `partial` | Removed `"+ Upload My Activity"` shortcut from the parent Home screen. | `src/pages/StudentDashboard.jsx` | `done` |
| **A1–A7, A9–A12** | `done`/`partial` | Added `admin_invites` table (`A1`), `cdcs` permit/type/capacity columns (`A4`), `curricula` soft-delete (`A5`), `.docx` template download (`A9`), and verified overview, monitoring, and notifications. | `supabase/migrations/012_qa_feedback_fixes.sql`, `ReportsGeneration.jsx`, `AdminDashboard.jsx` | `done` (apply migration `012` in Supabase) |
| **A8** | `partial` | Replaced `"View Roster & Ops"` → `"View Center Details"`, `"Official MSWDO Center Dossier"` → `"Child Development Center Details"`, `"Close Dossier"` → `"CLOSE"`. | `src/components/admin/DaycareCenterMonitoring.jsx` | `done` |

---

## Conflicts for My Decision (from `docs/CLEANUP_REPORT.md`)
- `localStorage` fallback caches in `src/lib/curriculumData.js` and `src/lib/learnersService.js` remain flagged in `CLEANUP_REPORT.md` pending your go-ahead to remove once Supabase `500`/`400` issues are resolved.

---

## Manual Steps Required in Supabase & QA Retest Checklist
1. **Apply Migration `012`:** Run `supabase/migrations/012_qa_feedback_fixes.sql` in **Supabase SQL Editor**.
2. **Verify Storage & Auth:** Ensure private buckets exist (`007_storage_buckets_and_rls.sql`) and Auth minimum password length is `8`.
3. **Retest Checklist:**
   - **Sign Up (`S1`):** Test valid, lowercase/whitespace, inactive, and blank registration codes.
   - **Teacher (`T6`, `T9`):** Confirm Assigned Topics have no Delete button and submission review has no Delete button.
   - **Parent (`P4`, `P6`, `P10`):** Confirm `"Announcements"` label, no Bisaya audio buttons (text still shown), and no `"+ Upload My Activity"` shortcut on Home.
   - **Admin (`A8`, `A9`):** Confirm `"View Center Details"` / `"CLOSE"` wording and `.docx` template downloads in Reports.
