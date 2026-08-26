# EarlyLearn Hub — React + Tailwind

A full React (Vite) + Tailwind CSS rebuild of the original static
EarlyLearn Hub site (`index.html`, `SignUp.html`, `admin-dashboard.html`,
`teacher-dashboard.html`, `student-dashboard.html`).

Same visual design, same layout, same Supabase-backed functionality —
now as a proper single-page app with client-side routing.

## What changed vs. the original HTML files

- Each page is now a React component under `src/pages/`.
- Routing (`/login`, `/signup`, `/admin-dashboard`, `/teacher-dashboard`,
  `/student-dashboard`) is handled by `react-router-dom` instead of
  full page reloads / `window.location.href`.
- Role-based access checks (the `checkAdminAccess()` /
  `checkTeacherAccess()` / `checkStudentAccess()` functions from the
  original `<script>` tags) are now a single reusable
  `<ProtectedRoute allowedRoles={[...]}>` component.
- All Supabase calls (`auth.signInWithPassword`, `auth.signUp`,
  `.from('profiles')`, `.from('categories')`, `.from('materials')`,
  `.from('announcements')`, `.from('submissions')`, etc.) are preserved
  exactly — same tables, same columns, same queries.
- Every CSS design (colors, fonts, cards, sidebar, buttons, badges,
  the sunrise illustration, the kid-friendly category grid) has been
  translated into Tailwind utility classes using the exact same hex
  values from the original `:root` CSS variables.
- Layouts are responsive from phone → desktop (sidebar collapses to a
  toggleable mobile menu on the Admin/Teacher dashboards; grids and
  forms reflow on the auth pages and student dashboard).

## Setup

```bash
npm install
cp .env.example .env
# edit .env and paste your Supabase project URL + anon key
npm run dev
```

The app will run at `http://localhost:5173`.

If you skip the `.env` step, the app falls back to the same Supabase
project URL/key that were hard-coded in the original HTML files, so
it will still work against your existing database.

## Build for production

```bash
npm run build
```

Output goes to `dist/` — deploy that folder to any static host
(Netlify, Vercel, GitHub Pages, etc.).

## Expected Supabase tables

These are unchanged from the original project — the app assumes they
already exist in your Supabase project:

- `profiles` (`id`, `full_name`, `role`, `barangay`)
- `categories` (`id`, `icon`, `name`, `created_at`)
- `materials` (`id`, `category_id`, `type`, `title`, `age_range`,
  `content_url`, `content_text`, `status`, `created_by`, `created_at`)
- `announcements` (`id`, `title`, `message`, `created_by`, `created_at`)
- `submissions` (`id`, `material_id`, `student_id`, `answer_text`,
  `status`, `created_at`)

## Project structure

```
src/
  lib/
    supabaseClient.js   # Supabase client + barangay list
    ui.js               # shared Tailwind class strings for tables/cards/pills
  components/
    ProtectedRoute.jsx  # auth + role guard for dashboard routes
    DashboardLayout.jsx # shared sidebar shell for Admin & Teacher dashboards
  pages/
    Login.jsx
    SignUp.jsx
    AdminDashboard.jsx
    TeacherDashboard.jsx
    StudentDashboard.jsx
  App.jsx               # route definitions
  main.jsx              # app entry point
  index.css             # Tailwind directives + a few keyframe animations
```
