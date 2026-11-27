# EarlyLearn Hub — End-to-End QA Report

**Date:** 2026-11-27  
**Build Status:** `npm run build` — **PASS** (0 errors)  
**Automated Tests:** `npx vitest run` (`tests/roles.test.js`) — **PASS**  
**Emoji Scan:** `scan_emojis.cjs` — **PASS** (0 emojis across `src/`, `sql/`, `supabase/`, `public/`, `index.html`)

---

## 1. Static Pass & Build Verification
- `npm run build` (`vite build`): **PASS** — 7,223 modules transformed cleanly.
- `npm run lint`: Not configured in `package.json` (`scripts` only defines `dev`, `build`, `preview`).
- Routes in `src/App.jsx`:
  - `/` → redirects to `/login`
  - `/login` → `Login.jsx`
  - `/signup` → `SignUp.jsx`
  - `/admin-dashboard` → `ProtectedRoute` (`allowedRoles={['admin', 'superadmin']}`) → `AdminDashboard.jsx`
  - `/teacher-dashboard` → `ProtectedRoute` (`allowedRoles={['teacher']}`) → `TeacherDashboard.jsx`
  - `/student-dashboard` → `ProtectedRoute` (`allowedRoles={['student']}`) → `StudentDashboard.jsx`
  - `*` → redirects to `/login`

---

## 2. Role-by-Route & Access Control Matrix

| Route | Anon | `student` / `parent` | `teacher` | `admin` | `superadmin` |
| --- | --- | --- | --- | --- | --- |
| `/login` | Allow | Redirect `/student-dashboard` | Redirect `/teacher-dashboard` | Redirect `/admin-dashboard` | Redirect `/admin-dashboard` |
| `/signup` | Allow | Allow | Allow | Allow | Allow |
| `/student-dashboard` | Redirect `/login` | **Allow** | Denied (redirect) | Denied (redirect) | Denied (redirect) |
| `/teacher-dashboard` | Redirect `/login` | Denied (redirect) | **Allow** | Denied (redirect) | Denied (redirect) |
| `/admin-dashboard` | Redirect `/login` | Denied (redirect) | Denied (redirect) | **Allow** | **Allow** |

- **Server-Trusted Claims (`src/lib/roles.js`)**: Verified by `tests/roles.test.js` that `getEffectiveRole` and `isSuperAdminUser` only trust `app_metadata` (never `user_metadata` or `localStorage`).

---

## 3. Bugs Fixed During QA
1. **Realtime Channel Crash (`src/components/NotificationBell.jsx:32`)** — **Fixed**: `supabase.channel('notifications:' + userId)` reused an already-subscribed channel instance on dual-topbar mount / React StrictMode, throwing `cannot add postgres_changes callbacks ... after subscribe()`. Updated to a unique per-mount channel name.
2. **Inconsistent Superadmin/Admin Sidebar (`src/components/DashboardLayout.jsx:56`)** — **Fixed**: Replaced leftover `bg-[#0F172A]` slate sidebar with `bg-ui-panel` and `md:h-screen md:sticky md:top-0 overflow-hidden` so the sidebar stays fixed and uniform across roles.
3. **Login Submit Button & Contrast (`src/pages/Login.jsx`)** — **Fixed**: Updated submit button to `bg-[#1B5139] hover:bg-[#123B29]` with white text, replaced `"SHOW"` text with `<Icon name="eye" />` / `<Icon name="eye-off" />`, and removed duplicate `"Register as a parent"` button.
4. **SignUp Layout Parity (`src/pages/SignUp.jsx`)** — **Fixed**: Updated to the same two-column card and `/login-landscape-bg.png` backdrop as `Login.jsx`.

---

## 4. Remaining Issues & Manual Supabase Actions Required
From observed browser console logs when connecting to Supabase:
1. **Localhost `.env` (`src/lib/supabaseClient.js:15`)**: Ensure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set in `.env` and restart `npm run dev` to avoid `Uncaught Error: supabaseUrl is required.`
2. **Supabase 500 / 400 / 409 Responses (Backend / RLS / Schema)**:
   - `GET /rest/v1/v_admin_dashboard_summary` returned **500** — verify the view exists and its underlying RLS/permissions are valid in Supabase SQL Editor.
   - `GET /rest/v1/materials` returned **500** — check RLS policies on `materials` for infinite recursion or missing helper functions.
   - `GET /rest/v1/eccd_assessments?order=updated_at.desc` returned **400** — verify `updated_at` column exists on `eccd_assessments`.
   - `DELETE /rest/v1/profiles` returned **409 Conflict** — foreign key constraints prevent deleting `profiles` rows that are still referenced by child tables.

---

## 5. Manual QA Checklist
- [ ] Verify `/login` and `/signup` at `360px`, `768px`, and `1280px` viewports.
- [ ] Verify `AdminDashboard` (all 8 tabs + `ManageTeachers` + `ManageUsers`).
- [ ] Verify `TeacherDashboard` (assigned topics, upload modal, child development, print `TeacherReportSheet`).
- [ ] Verify `StudentDashboard` (flashcards, storybooks, TTS audio, progress).
- [ ] Verify `prefers-reduced-motion` disables floating/entrance animations.
