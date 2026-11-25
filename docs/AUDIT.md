# EarlyLearn Hub — Technical Schema, Storage, Dataset, & Dead-Code Audit

> **Scope & Baseline Notes**
> - Audited repository: `C:\earlyLearningHub\EarlyLearn-Hub-2` (read-only code inspection; zero code or SQL changes applied).
> - `EARLYLEARN_HUB_CONTEXT.md` and SQL migrations `001`–`006` are **not present** in this repository.
> - SQL definitions in version control exist solely in:
>   1. [supabase_security_and_rls.sql](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/supabase_security_and_rls.sql)
>   2. [sql/007_teacher_privacy.sql](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/sql/007_teacher_privacy.sql)
>   3. [sql/008_create_eccd_assessments.sql](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/sql/008_create_eccd_assessments.sql)

---

## 1. Tables & Columns: Code Usage vs. SQL Definitions

### 1.1 Table-Level Summary

| Table | `CREATE TABLE` DDL in Repo? | `ENABLE ROW LEVEL SECURITY` in Repo? | RLS Policies in Repo? | Code Operations (`src/`) | Key Schema / Policy Discrepancies |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `public.profiles` | **No** *(only `ALTER TABLE ADD COLUMN` in `supabase_security_and_rls.sql:12-14`)* | Yes (`supabase_security_and_rls.sql:44`) | `SELECT` (`authenticated`), `INSERT` (`authenticated, anon`), `UPDATE` (`authenticated`) — **no `DELETE` policy** | `SELECT`, `INSERT`/`UPSERT`, `UPDATE`, `DELETE` | Code calls `.delete()` (`AdminDashboard.jsx:176`, `curriculumData.js:1090`, `ManageTeachers.jsx:415`, dead `ManageUsers.jsx:284`), which RLS silently blocks unless a `DELETE` policy exists in live DB. Self-`INSERT`/`UPDATE` lacks column check on `role`. |
| `public.teachers` | **No** *(only `ALTER TABLE ADD COLUMN` + FK in `supabase_security_and_rls.sql:16-17, 29-31`)* | Yes (`supabase_security_and_rls.sql:45`) | `SELECT` (`anon, authenticated` `USING (true)`), `ALL` (`authenticated` self or `admin`/`superadmin`/`teacher`) | `SELECT`, `UPSERT`, `UPDATE`, `DELETE` | World-readable (`anon`) while `contact_number` stores plaintext `\|\|PASS:` credentials. Any `teacher` role can `UPDATE`/`DELETE` other teachers under `supabase_security_and_rls.sql:104-114`. |
| `public.learners` | **No** *(only `ALTER TABLE ADD COLUMN` + FK in `supabase_security_and_rls.sql:19-21, 37-39`)* | Yes (`supabase_security_and_rls.sql:46`, `007:40`) | Conflicting: `supabase_security_and_rls.sql:120-138` (`anon` `INSERT`, all `authenticated` `SELECT`, no `DELETE`) vs. `007:100-190` (strict per-CDC/barangay `SELECT`/`INSERT`/`UPDATE`, `DELETE` only for `admin`/`superadmin`) | `SELECT`, `INSERT`, `UPSERT`, `UPDATE`, `DELETE` | In `007:171-177`, `Students insert own learner row` requires `authenticated` (`id = auth.uid()`), breaking `SignUp.jsx:191` if `signUp` does not immediately establish an authenticated session. Read helper `learnersService.js:950` runs `.delete()` as a teacher (blocked under `007`). |
| `public.cdcs` | **No** *(only referenced by FK in `supabase_security_and_rls.sql:31, 39`)* | Yes (`supabase_security_and_rls.sql:47`) | `SELECT` (`anon, authenticated` `USING (true)`) — **no `INSERT`, `UPDATE`, or `DELETE` policy** | `SELECT`, `INSERT`, `UPDATE` | `ManageTeachers.jsx:431` inserts new CDCs and `curriculumData.js:861` updates `official_teacher_name`; both fail under RLS unless write policies exist out-of-band. |
| `public.categories` | **No** *(not mentioned anywhere in any `.sql` file)* | **Not in SQL** | **None in SQL** | `SELECT`, `INSERT`, `DELETE` | Entire table (`id`, `icon`, `name`, `created_at`) is absent from all 3 SQL scripts. |
| `public.materials` | **No** | Yes (`supabase_security_and_rls.sql:48`) | `SELECT` (`authenticated` `USING (true)`), `ALL` (`admin`/`superadmin`/`teacher`) | `SELECT`, `INSERT`, `UPDATE`, `DELETE` | `SignUp.jsx` / `Login.jsx` unauthenticated (`anon`) flows call `resolveTeacherForLogin` / `resolveParentForLogin` (`teacherAuthService.js:435, 551`), which `SELECT` from `materials`—blocked for `anon` by RLS! Conversely, logged-in `student` users can `SELECT` all rows, including `[TEACHER_CREDENTIAL_SYNC]`, `[PARENT_CREDENTIAL_SYNC]`, and `[ECCD_ASSESSMENT]`. |
| `public.submissions` | **No** | Yes (`supabase_security_and_rls.sql:49`, `007:41`) | `supabase_security_and_rls.sql:163-182` (`FOR ALL` for owner + `teacher`/`admin`) vs. `007:316-400` (`SELECT`/`UPDATE` per-CDC for teachers; **no `DELETE` policy** for teachers or students) | `SELECT`, `INSERT`, `UPDATE`, `DELETE` | Under `007`, `TeacherDashboard.jsx:2405` (`handlePermanentDeleteSubmission` `.delete()`) is blocked for teachers because `007` only grants `FOR ALL` to `admin`/`superadmin`. |
| `public.announcements` | **No** | Yes (`supabase_security_and_rls.sql:50`) | `SELECT` (`authenticated` `USING (true)`), `ALL` (`admin`/`superadmin`/`teacher`) | `SELECT`, `INSERT`, `DELETE` | `TeacherDashboard.jsx:1827` & `StudentDashboard.jsx:413` omit `created_by` in `.select('id, title, message, created_at')`, so `announcements` table rows cannot be filtered by CDC/teacher without `[TEACHER_ANNOUNCEMENT]` metadata in `materials`. |
| `public.eccd_assessments` | **Yes** (`supabase_security_and_rls.sql:201-222`, `007:11-32`, `008:11-32`) | Yes (all 3 `.sql` files) | **3 conflicting policy sets** across `supabase_security_and_rls.sql`, `007`, and `008` — **no `DELETE` policy for teachers** | `SELECT`, `INSERT`, `UPDATE` | `teacher_id` is `uuid REFERENCES public.profiles(id) ON DELETE SET NULL` in `supabase_security_and_rls.sql:209` & `007:19`, but plain `uuid` (no FK) in `008:19`. `008:100-106` adds `OR auth.uid() IS NOT NULL` on `INSERT` (any student can insert) and `008:143` grants `SELECT` to `anon`. |

---

### 1.2 Column-by-Column Matrix (Every Table)

#### `public.profiles`
| Column | SQL Definition / Reference | Code Usage (Files & Operations) | Status / Mismatch |
| :--- | :--- | :--- | :--- |
| `id` | Referenced in RLS (`id = auth.uid()`, `supabase_security_and_rls.sql:60, 80, 89`) & FK from `eccd_assessments.teacher_id` (`209`) | `SELECT`, `UPSERT`, `UPDATE .eq('id', ...)`, `DELETE .eq('id', ...)` across [ProtectedRoute.jsx](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/components/ProtectedRoute.jsx#L33-L36), [Login.jsx](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/pages/Login.jsx#L202-L232), [SignUp.jsx](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/pages/SignUp.jsx#L176-L183), [AdminDashboard.jsx](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/pages/AdminDashboard.jsx#L165-L176), [TeacherDashboard.jsx](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/pages/TeacherDashboard.jsx#L2530-L2532), [learnersService.js](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/lib/learnersService.js), [teacherAuthService.js](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/lib/teacherAuthService.js#L262), [curriculumData.js](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/lib/curriculumData.js#L826) | Base DDL missing; assumed `uuid PRIMARY KEY REFERENCES auth.users(id)` |
| `full_name` | Referenced in RLS (`supabase_security_and_rls.sql:323`, `008:128`) | `SELECT`, `UPSERT`, `UPDATE`, `.order('full_name')` in `Login.jsx`, `SignUp.jsx`, `AdminDashboard.jsx`, `TeacherDashboard.jsx` (via join `profiles(full_name, barangay, cdc_name)` at `2025`), `learnersService.js`, `teacherAuthService.js`, `curriculumData.js` | Base DDL missing (inferred `text`) |
| `role` | Referenced in `get_my_role()` (`supabase_security_and_rls.sql:60`, `007:52`, `008:73`) | `SELECT`, `UPSERT`, `UPDATE`, `.eq('role', 'teacher'\|'student')` in `Login.jsx`, `SignUp.jsx`, `AdminDashboard.jsx`, `curriculumData.js:1084`, `learnersService.js:975`, dead `ManageUsers.jsx:164, 387`. Note [roles.js](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/lib/roles.js#L137-L148) (`getDbRole`) maps `'superadmin'` $\rightarrow$ `'admin'` because DB constraint only permits `'student' \| 'teacher' \| 'admin'`. | Base DDL & `CHECK` constraint not in SQL files |
| `barangay` | Referenced in RLS (`supabase_security_and_rls.sql:252, 325-327`, `007:80`) | `SELECT`, `UPSERT`, `UPDATE`, `.ilike('barangay', ...)` across auth, admin, teacher, and learner services | Base DDL missing (inferred `text`) |
| `cdc_name` | `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cdc_name text` (`supabase_security_and_rls.sql:13`); used in RLS (`253`) | `SELECT`, `UPSERT` (`SignUp.jsx:181`, `learnersService.js:785`), joined in `TeacherDashboard.jsx:2025` (`profiles(full_name, barangay, cdc_name)`) | Defined via `ALTER TABLE` |
| `contact_number` | `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS contact_number text` (`supabase_security_and_rls.sql:14`) | `SELECT *`, `UPSERT` (`SignUp.jsx:182`, `teacherAuthService.js:268`, `learnersService.js:786`), `UPDATE` (`learnersService.js:700`) — **packed with `\|\|META:` JSON for students** | Defined via `ALTER TABLE` |
| `created_at` | **Not in SQL** | Selected ONLY in dead file [src/pages/ManageUsers.jsx](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/pages/ManageUsers.jsx#L70) (`.select('id, full_name, role, barangay, created_at')`) and via `.select('*')` | Unverified in SQL |

#### `public.teachers`
| Column | SQL Definition / Reference | Code Usage (Files & Operations) | Status / Mismatch |
| :--- | :--- | :--- | :--- |
| `id` | Referenced in RLS (`auth.uid() = id`, `supabase_security_and_rls.sql:108`, `007:67, 79`) | `SELECT`, `UPSERT`, `UPDATE .eq('id', ...)`, `DELETE .eq('id', ...)` in `teacherAuthService.js`, `learnersService.js`, `curriculumData.js`, `TeacherDashboard.jsx`, `ManageTeachers.jsx` | Base DDL missing (inferred `uuid PRIMARY KEY`) |
| `full_name` | **Not in SQL** | `SELECT`, `UPSERT`, `.order('full_name')` in `curriculumData.js:842, 1059`, `learnersService.js:124, 188, 359`, `teacherAuthService.js:278, 383`, `TeacherDashboard.jsx:2543, 2816` | Missing from SQL |
| `email` | **Not in SQL** | `SELECT`, `UPSERT` in `curriculumData.js:843, 1059`, `learnersService.js:188, 359`, `teacherAuthService.js:279, 383`, `TeacherDashboard.jsx:2543`, dead `ManageUsers.jsx:82` | Missing from SQL |
| `barangay` | Referenced in `get_my_teacher_barangay()` (`007:79`) | `SELECT`, `UPSERT`, `.ilike('barangay', ...)` across `curriculumData.js`, `learnersService.js`, `teacherAuthService.js`, `TeacherDashboard.jsx` | Base DDL missing |
| `cdc_id` | FK `teachers_cdc_id_fkey` $\rightarrow$ `public.cdcs(id) ON DELETE SET NULL` (`supabase_security_and_rls.sql:29-31`); used in `get_my_teacher_cdc_id()` (`007:65`) | `SELECT`, `UPSERT` (`curriculumData.js:848`, `teacherAuthService.js:281`), PostgREST join `cdcs(id, name, barangay)` / `cdcs(name)` | FK defined; base column DDL missing |
| `contact_number` | **Not in SQL** | `SELECT`, `UPSERT`, `UPDATE` in `learnersService.js:124, 158`, `teacherAuthService.js:282, 383`, `curriculumData.js:845, 1059`, `TeacherDashboard.jsx:2543, 2816` — **packed with `\|\|CODE:` and `\|\|PASS:`** | Missing from SQL |
| `must_change_password` | `ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS must_change_password boolean DEFAULT true` (`supabase_security_and_rls.sql:16-17`) | `SELECT *` (`Login.jsx:122` via `resolveTeacherForLogin`, `teacherAuthService.js:60`), `UPSERT` (`teacherAuthService.js:283` sets `true`), `UPDATE` ([src/pages/Login.jsx](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/pages/Login.jsx#L152) sets `false`) | Defined via `ALTER TABLE` |

#### `public.learners`
| Column | SQL Definition / Reference | Code Usage (Files & Operations) | Status / Mismatch |
| :--- | :--- | :--- | :--- |
| `id` | Referenced in RLS (`auth.uid() = id`, `supabase_security_and_rls.sql:136`, `007:168, 223, 330`, `008:135`) | `SELECT`, `UPSERT`, `UPDATE .eq('id', ...)`, `DELETE .eq('id', ...)` in `AdminDashboard.jsx`, `learnersService.js`, dead `ManageLearners.jsx` | Base DDL missing (inferred `uuid PRIMARY KEY DEFAULT gen_random_uuid()`) |
| `full_name` | Referenced in RLS (`007:223`, `008:136`) | `SELECT`, `INSERT`, `UPSERT`, `UPDATE`, `.ilike('full_name', ...)`, `.order('full_name')` in `AdminDashboard.jsx`, `learnersService.js`, dead `ManageLearners.jsx` | Base DDL missing |
| `birthdate` | **Not in SQL** | `SELECT`, `INSERT`, `UPSERT`, `UPDATE` in `AdminDashboard.jsx:121, 302`, `learnersService.js:494`, dead `ManageLearners.jsx:74, 147, 199` (ISO `YYYY-MM-DD` date string or `null`) | Missing from SQL |
| `barangay` | Referenced in RLS (`007:116, 228, 335`) | `SELECT`, `INSERT`, `UPSERT`, `UPDATE`, `.ilike('barangay', ...)` in `AdminDashboard.jsx`, `learnersService.js`, dead `ManageLearners.jsx` | Base DDL missing |
| `cdc_id` | FK `learners_cdc_id_fkey` $\rightarrow$ `public.cdcs(id) ON DELETE SET NULL` (`supabase_security_and_rls.sql:37-39`); used in RLS (`007:113, 225, 332`) | `SELECT`, `INSERT`, `UPSERT`, `UPDATE`, `.eq('cdc_id', ...)`, PostgREST join `cdcs(name)` / `cdcs(id, name, barangay)` in `AdminDashboard.jsx:121`, `learnersService.js:496, 938`, dead `ManageLearners.jsx:74` | FK defined; base column DDL missing |
| `parent_name` | `ALTER TABLE public.learners ADD COLUMN IF NOT EXISTS parent_name text` (`supabase_security_and_rls.sql:20`) | `SELECT`, `INSERT`, `UPSERT`, `UPDATE` in `AdminDashboard.jsx:121, 305`, `learnersService.js:497`, dead `ManageLearners.jsx:74, 150, 202` | Defined via `ALTER TABLE` |
| `parent_contact` | `ALTER TABLE public.learners ADD COLUMN IF NOT EXISTS parent_contact text` (`supabase_security_and_rls.sql:21`); used in RLS (`007:118`: `parent_contact ILIKE '%"teacher_id":"..."%'`) | `SELECT`, `INSERT`, `UPSERT`, `UPDATE` in `AdminDashboard.jsx`, `learnersService.js:498, 683, 1326`, `teacherAuthService.js:609` — **packed with `\|\|META:` JSON** | Defined via `ALTER TABLE` |
| `created_at` | **Not in SQL** | `.order('created_at', { ascending: false })` in `learnersService.js:935, 1485` and `SELECT *` | Missing from SQL |
| *(Bug: non-DB keys)* | **Not columns** (`cdc_name`, `enrollment_status`, `age`) | [EnrolleePopulation.jsx](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/components/admin/EnrolleePopulation.jsx#L129) calls `onUpdateLearner({ ...editingLearner, ...formData })`, passing 1 object to `handleUpdateLearner(id, updates)` in [AdminDashboard.jsx](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/pages/AdminDashboard.jsx#L313-L320) (`updates` = `undefined`, `id` = object). Even if fixed to 2 args without whitelisting columns, `editingLearner` contains client-computed `cdc_name`, `enrollment_status`, and `age` (`AdminDashboard.jsx:129-131`), which do not exist on `public.learners`. | Broken `.update()` call |

#### `public.cdcs`
| Column | SQL Definition / Reference | Code Usage (Files & Operations) | Status / Mismatch |
| :--- | :--- | :--- | :--- |
| `id` | Referenced by FKs `teachers_cdc_id_fkey` & `learners_cdc_id_fkey` (`supabase_security_and_rls.sql:31, 39`) | `SELECT`, `UPDATE .eq('id', ...)` in `AdminDashboard.jsx:100`, `ManageTeachers.jsx:126`, `curriculumData.js:756, 862`, dead `ManageLearners.jsx:86` | Base DDL missing |
| `name` | **Not in SQL** | `SELECT`, `INSERT` ([ManageTeachers.jsx](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/pages/ManageTeachers.jsx#L431)), `.order('barangay, name')`, joined as `cdcs(name)` / `cdcs(id, name, barangay)` | Missing from SQL + no RLS `INSERT` policy |
| `barangay` | **Not in SQL** | `SELECT`, `INSERT` ([ManageTeachers.jsx](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/pages/ManageTeachers.jsx#L431)), `.order('barangay, name')` | Missing from SQL + no RLS `INSERT` policy |
| `official_teacher_name` | **Not in SQL** | `UPDATE` in [src/lib/curriculumData.js](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/lib/curriculumData.js#L861) (`.update({ official_teacher_name: cleanName }).eq('id', resolvedCdcUuid)`, wrapped in `try/catch`) | **Unverified column** + no RLS `UPDATE` policy on `cdcs` |

#### `public.categories`
| Column | SQL Definition / Reference | Code Usage (Files & Operations) | Status / Mismatch |
| :--- | :--- | :--- | :--- |
| `id` | **Not in SQL** | `SELECT` (`AdminDashboard.jsx:191`, `TeacherDashboard.jsx:309, 1940`, `CurriculumGuides.jsx:443`, `curriculumData.js:914`, `learnersService.js:1361`, `teacherAuthService.js:334, 509`), `DELETE .eq('id', id)` (`AdminDashboard.jsx:218`), joined via `categories(id, name, icon)` / `categories(name)` | Entire table missing from SQL |
| `name` | **Not in SQL** | `SELECT`, `INSERT` (`AdminDashboard.jsx:205`), `.order('name')` (`TeacherDashboard.jsx:309`), joined from `materials` | Missing from SQL |
| `icon` | **Not in SQL** | `SELECT`, `INSERT` (`AdminDashboard.jsx:205`), joined in `StudentDashboard.jsx:465` | Missing from SQL |
| `created_at` | **Not in SQL** | `.order('created_at')` (`AdminDashboard.jsx:191`) | Missing from SQL |

#### `public.materials`
| Column | SQL Definition / Reference | Code Usage (Files & Operations) | Status / Mismatch |
| :--- | :--- | :--- | :--- |
| `id` | **Not in SQL** | `SELECT`, `UPDATE .eq('id', ...)`, `DELETE .eq('id', ...)` / `.in('id', ...)` across `AdminDashboard.jsx`, `CurriculumGuides.jsx`, `ProgramMonitoring.jsx`, `TeacherDashboard.jsx`, `StudentDashboard.jsx`, `curriculumData.js`, `learnersService.js`, `teacherAuthService.js` | Base DDL missing |
| `category_id` | **Not in SQL** | `SELECT *`, `INSERT`, `UPDATE`, `.eq('category_id', ...)` (`AdminDashboard.jsx:228`, `TeacherDashboard.jsx:1033, 1072, 1944`, `CurriculumGuides.jsx:450`, `mediaStorage.js:461`, `learnersService.js:1367`, `teacherAuthService.js:336, 511`, `curriculumData.js:917`), FK join `categories(...)` | Base DDL & FK missing from SQL |
| `type` | **Not in SQL** | `SELECT`, `INSERT`, `UPDATE` (values observed: `'lesson'`, `'worksheet'`, `'video'`, `'activity'`, `'story'`) | Base DDL & any `CHECK` constraint missing from SQL |
| `title` | **Not in SQL** | `SELECT`, `INSERT`, `UPDATE`, `DELETE .eq('title', ...)`, `.ilike('title', ...)`, `.like('title', ...)`, `.not('title', 'like', ...)` — **overloaded with 7 `[PREFIX]` namespaces** | Base DDL missing |
| `age_range` | **Not in SQL** | `SELECT`, `INSERT`, `UPDATE` (values observed: `'3-4'`, `'4-5'`, `'3-5'`) | Base DDL missing |
| `content_url` | **Not in SQL** | `SELECT`, `INSERT`, `UPDATE` (stores external URLs, `data:` URIs, `idb://` keys, `sbchunk://` keys, or `chunk:i/N` markers) | Base DDL missing |
| `content_text` | **Not in SQL** | `SELECT`, `INSERT`, `UPDATE` (stores JSON strings for metadata/sync records or 2 MB Base64 slices for `[MEDIA_CHUNK]`) | Base DDL missing |
| `status` | **Not in SQL** | `SELECT`, `INSERT`, `UPDATE`, `.eq('status', 'pending'\|'approved')` (lowercase `'pending'`, `'approved'`, `'rejected'` in DB vs. Title Case in UI state) | Base DDL & any `CHECK` constraint missing from SQL |
| `created_by` | **Not in SQL** | `SELECT`, `INSERT`, `.eq('created_by', teacherId)` (`learnersService.js:1521`), joined in `TeacherDashboard.jsx:2025` (`materials(id, title, created_by)`) | Base DDL & FK missing from SQL |
| `created_at` | **Not in SQL** | `SELECT`, `.order('created_at', { ascending: false\|true })` | Base DDL missing |

#### `public.submissions`
| Column | SQL Definition / Reference | Code Usage (Files & Operations) | Status / Mismatch |
| :--- | :--- | :--- | :--- |
| `id` | **Not in SQL** | `SELECT`, `UPDATE .eq('id', ...)`, `DELETE .eq('id', ...)` (`StudentDashboard.jsx:1182`, `TeacherDashboard.jsx:2025, 2247, 2323, 2368, 2405`) | Base DDL missing |
| `material_id` | **Not in SQL** | `SELECT`, `INSERT` (`StudentDashboard.jsx:1187` passes activity UUID; `StudentDashboard.jsx:1366` passes `null` for standalone uploads), FK join `materials(id, title, created_by)` | Must be nullable in DB for standalone uploads (`StudentDashboard.jsx:1366`) |
| `student_id` | Referenced in RLS (`student_id = auth.uid()`, `supabase_security_and_rls.sql:167, 176`, `007:330, 379`) | `SELECT`, `INSERT`, `.eq('student_id', currentUserId)` (`StudentDashboard.jsx:484, 1188, 1367`), FK join `profiles(full_name, barangay, cdc_name)` (`TeacherDashboard.jsx:2025`) | Base DDL & FK to `profiles(id)` missing from SQL |
| `answer_text` | **Not in SQL** | `SELECT`, `INSERT`, `UPDATE` (`StudentDashboard.jsx:1179, 1189, 1368`, `TeacherDashboard.jsx:2025, 2245, 2322, 2367`) — **overloaded with `__submission_meta` JSON** | Base DDL missing |
| `status` | **Not in SQL** | `SELECT`, `INSERT`, `UPDATE` (values: `'submitted'`, `'checked'`) | Base DDL missing |
| `created_at` | **Not in SQL** | `SELECT`, `.order('created_at', { ascending: false })` (`StudentDashboard.jsx:485`, `TeacherDashboard.jsx:2026`) | Base DDL missing |

#### `public.announcements`
| Column | SQL Definition / Reference | Code Usage (Files & Operations) | Status / Mismatch |
| :--- | :--- | :--- | :--- |
| `id` | **Not in SQL** | `SELECT` (`TeacherDashboard.jsx:1827`, `StudentDashboard.jsx:413`), `DELETE .eq('id', sbAnnId)` (`TeacherDashboard.jsx:2012`) | Base DDL missing |
| `title` | **Not in SQL** | `SELECT`, `INSERT` (`TeacherDashboard.jsx:1956`, `StudentDashboard.jsx:413`) | Base DDL missing |
| `message` | **Not in SQL** | `SELECT`, `INSERT` (`TeacherDashboard.jsx:1957`, `StudentDashboard.jsx:413`) | Base DDL missing |
| `created_by` | **Not in SQL** | `INSERT` (`TeacherDashboard.jsx:1958`) — **never selected on read** (`1827`, `StudentDashboard.jsx:413`) | Base DDL missing |
| `created_at` | **Not in SQL** | `SELECT`, `.order('created_at', { ascending: false })` | Base DDL missing |

#### `public.eccd_assessments`
| Column | SQL Definition (`supabase_security_and_rls.sql` / `007` / `008`) | Code Usage ([src/lib/learnersService.js](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/lib/learnersService.js#L1239-L1301) & `1455`) | Status / Mismatch |
| :--- | :--- | :--- | :--- |
| `id` | `uuid PRIMARY KEY DEFAULT gen_random_uuid()` | `SELECT`, `UPDATE .eq('id', existingRowId)` | Matches |
| `child_id` | `text` (indexed) | `SELECT`, `INSERT`, `UPDATE` (`normRecord.child_id ? String(normRecord.child_id) : null`) | Matches (`text`, not `uuid`, so non-UUID IDs like `'lrn-01'` fit) |
| `child_name` | `text NOT NULL` (expression-indexed) | `SELECT`, `INSERT`, `UPDATE`, `.ilike('child_name', ...)` | Matches |
| `age` | `integer DEFAULT 3` | `SELECT`, `INSERT`, `UPDATE` (`Number(normRecord.age) \|\| 3`) | Matches |
| `level` | `text DEFAULT 'PRE-K 1'` | `SELECT`, `INSERT`, `UPDATE` | Matches |
| `barangay` | `text` (indexed) | `SELECT`, `INSERT`, `UPDATE`, `.ilike('barangay', ...)` | Matches |
| `cdc_name` | `text` | `SELECT`, `INSERT`, `UPDATE` | Matches |
| `teacher_id` | `uuid REFERENCES public.profiles(id) ON DELETE SET NULL` (`supabase_security_and_rls.sql:209`, `007:19`) vs. `uuid` with **no FK** (`008:19`) | `SELECT`, `INSERT`, `UPDATE`, `.eq('teacher_id', teacherId)` | FK differs between `007` and `008` |
| `teacher_name` | `text` | `SELECT`, `INSERT`, `UPDATE` | Matches |
| `assessment_date` | `text DEFAULT (CURRENT_DATE)::text` | `SELECT`, `INSERT`, `UPDATE` (aliased to/from `date` in JS normalization at `learnersService.js:1089`) | Matches |
| `cognitive_status` | `text NOT NULL DEFAULT 'Developing as Expected'` | `SELECT`, `INSERT`, `UPDATE` | Matches |
| `physical_status` | `text NOT NULL DEFAULT 'Developing as Expected'` | `SELECT`, `INSERT`, `UPDATE` | Matches |
| `social_status` | `text NOT NULL DEFAULT 'Developing as Expected'` | `SELECT`, `INSERT`, `UPDATE` | Matches |
| `language_status` | `text NOT NULL DEFAULT 'Developing as Expected'` | `SELECT`, `INSERT`, `UPDATE` | Matches |
| `overall_status` | `text NOT NULL DEFAULT 'Developing as Expected'` | `SELECT`, `INSERT`, `UPDATE` | Matches |
| `observations` | `text DEFAULT ''` | `SELECT`, `INSERT`, `UPDATE` | Matches |
| `recommendation` | `text DEFAULT ''` | `SELECT`, `INSERT`, `UPDATE` | Matches |
| `mswd_verified` | `boolean DEFAULT false` | `SELECT`, `INSERT`, `UPDATE` | Matches |
| `created_at` | `timestamptz DEFAULT now()` | `SELECT *` | Matches |
| `updated_at` | `timestamptz DEFAULT now()` *(no DB trigger in any `.sql` file)* | `SELECT *`, `.order('updated_at', { ascending: false })`, manually set in JS (`updated_at: new Date().toISOString()` at `learnersService.js:1256`) | Matches |

### 1.3 SQL Functions & Edge Functions
- **SQL Helper Functions** (used inside RLS policies only; zero `supabase.rpc(...)` calls exist in `src/`):
  - `public.get_my_role()` — defined in all 3 `.sql` files; falls back to `auth.jwt() -> 'user_metadata' ->> 'role'` when no `profiles` row matches `auth.uid()`.
  - `public.get_my_teacher_cdc_id()` and `public.get_my_teacher_barangay()` — defined only in [sql/007_teacher_privacy.sql](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/sql/007_teacher_privacy.sql#L58-L83).
- **Supabase Edge Functions**:
  - `delete-teacher` — invoked via `supabase.functions.invoke('delete-teacher', { body: { teacherId: t.id } })` in [src/pages/ManageTeachers.jsx](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/pages/ManageTeachers.jsx#L401). Edge Function source (`supabase/functions/delete-teacher/`) is **not in the repository**.

---

## 2. Routes & Internal View Hierarchy

### 2.1 React Router Routes ([src/App.jsx](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/App.jsx))
| URL Path | Component | Access / `ProtectedRoute` `allowedRoles` | Additional Gate / Redirect Behavior |
| :--- | :--- | :--- | :--- |
| `/` | [src/pages/LandingPage.jsx](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/pages/LandingPage.jsx) | Public | None |
| `/login` | [src/pages/Login.jsx](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/pages/Login.jsx) | Public | Redirects active sessions to role dashboard; forces password-reset modal when `teachers.must_change_password === true`; signs out `pending`/`rejected` students |
| `/signup` | [src/pages/SignUp.jsx](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/pages/SignUp.jsx) | Public | Parent/student registration gated by Teacher Registration Code (`ELH-<BRGY>-<CODE>`) |
| `/student-dashboard` | [src/pages/StudentDashboard.jsx](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/pages/StudentDashboard.jsx) | `['student', 'parent']` | `ProtectedRoute` also runs `getStudentApprovalStatus()` (`ProtectedRoute.jsx:75`); if `'pending'` or `'rejected'`, signs out and redirects to `/login` |
| `/teacher-dashboard` | [src/pages/TeacherDashboard.jsx](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/pages/TeacherDashboard.jsx) | `['teacher']` | Wrong-role users redirected to their own role dashboard (`ProtectedRoute.jsx:108-114`) |
| `/admin-dashboard` | [src/pages/AdminDashboard.jsx](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/pages/AdminDashboard.jsx) | `['admin', 'superadmin']` | Role resolved via `getEffectiveRole()` in [src/lib/roles.js](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/lib/roles.js) |
| `*` | `<Navigate to="/" replace />` | Any | Catch-all client-side redirect to `/` *(no static-host SPA rewrite config in repo)* |

### 2.2 Internal Tab / Section Sub-Views
- **`/admin-dashboard` (`activeTab` in [src/pages/AdminDashboard.jsx](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/pages/AdminDashboard.jsx#L53-L62))**:
  - `overview` $\rightarrow$ [MswdOverview.jsx](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/components/admin/MswdOverview.jsx)
  - `enrollees` $\rightarrow$ [EnrolleePopulation.jsx](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/components/admin/EnrolleePopulation.jsx)
  - `centers` $\rightarrow$ [DaycareCenterMonitoring.jsx](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/components/admin/DaycareCenterMonitoring.jsx)
  - `reports` $\rightarrow$ [ReportsGeneration.jsx](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/components/admin/ReportsGeneration.jsx) — internal `reportType` sub-views: `population`, `cdcs`, `teachers`, `curriculum`, `attendance`, plus unreachable `development` (see Section 6)
  - `programs` $\rightarrow$ [ProgramMonitoring.jsx](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/components/admin/ProgramMonitoring.jsx)
  - `curriculum` $\rightarrow$ [CurriculumGuides.jsx](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/components/admin/CurriculumGuides.jsx)
  - `teachers` $\rightarrow$ [ManageTeachers.jsx](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/pages/ManageTeachers.jsx)
  - `categories` $\rightarrow$ Inline Categories CRUD view (`AdminDashboard.jsx:502-624`)
  - `users` *(BROKEN)* $\rightarrow$ Triggered by Superadmin `"Manage Users"` button in [MswdOverview.jsx](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/components/admin/MswdOverview.jsx#L156) (`onNavigateTab('users')`), which matches zero tab conditionals in `AdminDashboard.jsx` and renders an empty container.
- **`/teacher-dashboard` (`activeTab` in [src/pages/TeacherDashboard.jsx](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/pages/TeacherDashboard.jsx#L74-L83))**:
  - Sidebar tabs: `overview`, `assigned_topics`, `mylearners`, `child_development` ([TeacherChildDevelopment.jsx](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/components/teacher/TeacherChildDevelopment.jsx) + modal [TeacherReportSheet.jsx](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/components/teacher/TeacherReportSheet.jsx)), `upload` (+ modal [TeacherUploadModal.jsx](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/components/teacher/TeacherUploadModal.jsx)), `announcements`, `submissions`, `progress`, and `profile`.
- **`/student-dashboard` (`activeSection` in [src/pages/StudentDashboard.jsx](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/pages/StudentDashboard.jsx#L38))**:
  - `home` (announcements, stats, category launcher), `categories` (6 bilingual flashcard/story modules + modal), `activities` (assigned teacher activities, submission modal, standalone upload modal, completed work viewer), `profile` (child details + read-only 4-domain ECCD report).

---

## 3. Packed & Overloaded Columns / Tables

### 3.1 Delimiter-Packed String Columns
| Table.Column | Delimiter Pattern | Packed Fields | Read / Write Locations |
| :--- | :--- | :--- | :--- |
| `teachers.contact_number` | `"<phone> \|\|CODE:<code_str> \|\|PASS:<plaintext_pw>"` | Phone number, Parent Registration Code (`ELH-<BRGY>-<XXXX>`), and **plaintext teacher password** | `packTeacherContactFields()` / `parseTeacherContactFields()` in [teacherAuthService.js](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/lib/teacherAuthService.js#L18-L48) (`250`, `282`); `packTeacherContactAndCode()` / `parseTeacherContactAndCode()` in [learnersService.js](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/lib/learnersService.js#L64-L101) *(note: `learnersService.js:97` strips `\|\|CODE:` when regenerating codes—if `\|\|PASS:` follows `\|\|CODE:`, regex `\|\|CODE:([A-Za-z0-9-]+)` preserves or drops trailing tokens depending on order)* |
| `learners.parent_contact` | `"<phone> \|\|META:<json>"` | JSON `{ status: 'pending'\|'approved'\|'rejected', parent_auth_id, parent_email, teacher_id, adviser_name, cdc_name, child_age, registration_code, updated_at, eccd_assessment: {...} }` | `packLearnerContactMeta()` & `unpackLearnerRow()` in [learnersService.js](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/lib/learnersService.js#L244-L315), written on signup/approval/ECCD save (`498`, `683`, `1326`) |
| `profiles.contact_number` | `"<phone> \|\|META:<json>"` | Same `\|\|META:` JSON payload mirrored onto the student's `profiles` row | Written in [SignUp.jsx](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/pages/SignUp.jsx#L163-L183) and [learnersService.js](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/lib/learnersService.js#L700) (`786`) |
| `profiles.full_name` / `learners.full_name` | `"<Child Name> (Parent: <Parent Name>)"` | Legacy parent-annotation suffix stripped on read via regex `/\s*\((Parent|Guardian):[^)]*\)/gi` | Stripped in `cleanStudentName()` ([learnersService.js](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/lib/learnersService.js#L46-L52)) and RLS policy ([supabase_security_and_rls.sql](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/supabase_security_and_rls.sql#L323)) |

### 3.2 Overloaded Table: `public.materials` (8 Distinct Row Schemas)
`public.materials` acts as a global schemaless key-value and binary-chunk table discriminated by `title` prefix:

| Row Kind / `title` Pattern | `type` / `status` Written | `content_url` Payload | `content_text` JSON / Text Payload | Readers & Writers |
| :--- | :--- | :--- | :--- | :--- |
| **1. Teacher Activity Module** (normal title) | `'lesson'\|'worksheet'\|'video'\|'activity'`, `'pending'\|'approved'\|'rejected'` | External URL, `data:...` ($\le$ 2.4 MB), `idb://...`, or `sbchunk://<id>` | JSON `{ __metadata: true, description, level, quarter, week, theme, sub_theme, file_name, file_size, file_type, assignment_id, teacher_id, teacher_name, cdc_name, barangay, verified_by_mswd, mswd_comments, revision_notes, posted_to_students, posted_at, target_student_id, target_student_name, is_deleted, deleted_at }` | [TeacherDashboard.jsx](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/pages/TeacherDashboard.jsx#L995-L1105), [ProgramMonitoring.jsx](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/components/admin/ProgramMonitoring.jsx#L159-L635), [StudentDashboard.jsx](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/pages/StudentDashboard.jsx#L464-L565) |
| **2. `[MSWD_ASSIGNMENT] <id>`** | `'lesson'`, `'approved'` | `null` / omitted | JSON `{ __mswd_assignment: true, id, level, quarter, week, theme, subTheme, targetType, teacherId, teacherAuthId, teacherEmail, teacherName, barangay, cdcName, deadline, assignedDate, assignedBy, status, is_deleted, deleted_by_teacher }` | [CurriculumGuides.jsx](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/components/admin/CurriculumGuides.jsx#L69-L115) (`448-490`), [TeacherDashboard.jsx](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/pages/TeacherDashboard.jsx#L319-L430) (`1207-1235`, `1628-1752`) |
| **3. `[TEACHER_ANNOUNCEMENT] <title>`** | `'story'`, `'approved'` | `null` / omitted | JSON `{ __teacher_announcement: true, id, title, message, teacher_id, teacher_name, barangay, cdc_name, target_student_id, target_student_name, created_at }` | [TeacherDashboard.jsx](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/pages/TeacherDashboard.jsx#L1780-L2006), [StudentDashboard.jsx](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/pages/StudentDashboard.jsx#L381-L409) |
| **4. `[ECCD_ASSESSMENT] <child_name>`** | `'activity'`, `'approved'` | `null` / omitted | JSON `{ __eccd_assessment: true, ...normRecord }` (full 4-domain child evaluation & observations) | [learnersService.js](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/lib/learnersService.js#L1334-L1381) (`1515-1545`) |
| **5. `[TEACHER_PROFILE_SYNC] <key>`** | `'lesson'`, `'approved'` | `null` / omitted | JSON `{ __teacher_profile_sync: true, baseline_id, auth_id, full_name, email, contact_number, packed_contact, barangay, cdc_id, cdc_name, bio, updated_at }` | [curriculumData.js](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/lib/curriculumData.js#L868-L928) (`1104-1122`) |
| **6. `[TEACHER_CREDENTIAL_SYNC] <email>`** | `'lesson'`, `'approved'` | `null` / omitted | JSON `{ __credential_sync: true, email, teacherId, authId, fullName, barangay, cdcId, cdcName, registrationCode, password, updatedAt }` (**plaintext password**) | [teacherAuthService.js](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/lib/teacherAuthService.js#L318-L343) (`435-455`) |
| **7. `[PARENT_CREDENTIAL_SYNC] <email>`** | `'lesson'`, `'approved'` | `null` / omitted | JSON `{ __parent_credential_sync: true, email, identifier, authId, childName, parentName, barangay, cdcName, password, updatedAt }` (**plaintext password**) | [teacherAuthService.js](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/lib/teacherAuthService.js#L493-L518) (`551-571`) |
| **8. `[MEDIA_CHUNK]::<groupId>::<0000>`** | `'video'`, `'approved'` | `"chunk:<i>/<total>"` | Raw 2,000,000-character slice of a Base64 `data:` URI (up to ~34 rows per 50 MB video) | [mediaStorage.js](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/lib/mediaStorage.js#L457-L510) |

### 3.3 Overloaded Column: `public.submissions.answer_text`
- Plain string answers are replaced whenever metadata or attachments exist by JSON:
  `{ __submission_meta: true, comment, file_url, file_name, file_type, file_size, standalone_title, is_standalone_upload, is_deleted, deleted_at }`
  where `file_url` holds `data:...`, `idb://...`, or `sbchunk://...` ([src/pages/StudentDashboard.jsx](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/pages/StudentDashboard.jsx#L114-L165), `1161-1195`, `1352-1373`; [src/pages/TeacherDashboard.jsx](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/pages/TeacherDashboard.jsx#L2310-L2370)).

---

## 4. `localStorage` & `IndexedDB` Usage

### 4.1 `localStorage` Keys (17 Application Keys + Supabase Session)
*(Zero `sessionStorage` calls exist in the codebase.)*

| `localStorage` Key | Value Shape | Readers / Writers & Purpose | Security / Sync Notes |
| :--- | :--- | :--- | :--- |
| `sb-<project-ref>-auth-token` *(managed by `@supabase/supabase-js`)* | Supabase session JWTs | Primary `supabase` client ([supabaseClient.js](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/lib/supabaseClient.js#L24)); `supabaseSecondaryAuth` (`30-37`) sets `persistSession: false` so Admin/Teacher sub-account `signUp` calls do not overwrite the active session | Standard GoTrue token storage |
| `earlylearn_superadmin_ids` | `string[]` (UUIDs) | [roles.js](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/lib/roles.js#L17-L65) (`getSuperAdminIds`, `addSuperAdminId`, `removeSuperAdminId`), dead `ManageUsers.jsx:171-175` | **Client-side privilege escalation**: adding own UID in DevTools grants Superadmin UI |
| `earlylearn_teacher_credentials` | `Record<email, { password, ... }>` | [teacherAuthService.js](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/lib/teacherAuthService.js#L11) (`305-312`, `371`) | Stores **plaintext teacher passwords** locally |
| `earlylearn_parent_credentials` | `Record<key, { password, ... }>` | [teacherAuthService.js](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/lib/teacherAuthService.js#L460) (`482-487`, `534`) | Stores **plaintext parent passwords** locally |
| `earlylearn_teacher_profiles_override` | `Record<idOrName, ProfileSync>` | `curriculumData.js:394, 802, 1127`, `TeacherDashboard.jsx:2578, 2826`, `ReportsGeneration.jsx:45`, `AdminDashboard.jsx:368` | Overrides teacher name, phone, barangay, CDC, bio |
| `earlylearn_active_teacher_profile` | `ProfileSync` object | Written in [curriculumData.js](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/lib/curriculumData.js#L816) — **never read anywhere** | Write-only dead cache key |
| `earlylearn_curriculum_assignments` | `Assignment[]` | `CurriculumGuides.jsx:111, 432, 480`, `curriculumData.js:421, 486`, `TeacherDashboard.jsx:428, 1195, 1621, 1675, 1730, 3042` | Dual-persisted MSWD topic assignments |
| `earlylearn_deleted_assignment_ids` | `string[]` | `TeacherDashboard.jsx:377, 1731-1734` | Tracks assignments permanently dismissed by a teacher |
| `earlylearn_teacher_modules` | `TeacherModule[]` | `curriculumData.js:624, 1230`, `ProgramMonitoring.jsx`, `TeacherDashboard.jsx`, `StudentDashboard.jsx:204`, `ReportsGeneration.jsx:124` | Dual-persisted uploaded modules (strips large `data:` URLs before saving to avoid 5 MB quota errors) |
| `earlylearn_announcements` | `Announcement[]` | `TeacherDashboard.jsx:1770, 1929, 1984`, `StudentDashboard.jsx:445, 692` | Dual-persisted teacher announcements |
| `earlylearn_registered_learners` | `Learner[]` | `learnersService.js:6, 412, 552, 1397`, `AdminDashboard.jsx:355`, `TeacherDashboard.jsx:3021`, `TeacherChildDevelopment.jsx:83` | Dual-persisted learner roster & approval metadata |
| `earlylearn_student_adviser_<idOrEmail>` | `{ adviser_name, cdc_name, barangay, teacher_id }` | Written in `learnersService.js:554-561`; read in `StudentDashboard.jsx:63` | Maps student to assigned teacher/CDC |
| `earlylearn_teacher_eccd_assessments` | `EccdAssessment[]` | `learnersService.js:1064, 1108, 1394`, `ReportsGeneration.jsx:222`, `AdminDashboard.jsx:361`, `StudentDashboard.jsx:695`, `TeacherChildDevelopment.jsx:82` | Global local cache of all ECCD evaluations |
| `earlylearn_student_eccd_name_<child_name>` | `EccdAssessment` | Written in `learnersService.js:1424`; read in `learnersService.js:1700` | Per-child name-indexed ECCD lookup cache |
| `earlylearn_student_eccd_id_<child_id>` | `EccdAssessment` | Written in `learnersService.js:1427`; read in `learnersService.js:1708` | Per-child ID-indexed ECCD lookup cache |
| `earlylearn_done_<userId>` | `string[]` (material IDs) | `StudentDashboard.jsx:95, 493, 620, 1139` | Tracks completed activity IDs per student |
| `earlylearn_student_uploads` | `SubmissionItem[]` | `StudentDashboard.jsx:128, 1243, 1340`, `TeacherDashboard.jsx:2077, 2265, 2329, 2375, 2411` | Global local cache of student activity/standalone uploads |
| `earlylearn_student_uploads_<userId>` | `SubmissionItem[]` | `StudentDashboard.jsx:126, 639, 1242, 1336`, `TeacherDashboard.jsx:2275, 2339, 2385, 2418` | Per-student local cache of activity/standalone uploads |

### 4.2 `IndexedDB` Usage ([src/lib/mediaStorage.js](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/lib/mediaStorage.js#L227-L377))
- **Database Name & Version**: `earlylearn_media_db` (version `1`).
- **Object Store**: `media_files` (out-of-line keys; stores `File`/`Blob` instances or `data:` URL strings, paired with an in-memory `Map` `memoryBlobCache` that mints `blob:` object URLs via `URL.createObjectURL`).
- **Key Namespaces Written on Every Save (`saveMediaBlobToIndexedDB`)**:
  1. Primary key: `idb://<category>-<timestamp>-<safeFileName>` (e.g., `idb://video-1730000000000-lesson.mp4`) or `sbchunk://<chunkGroupId>` (when caching reassembled Supabase chunks).
  2. Filename alias key: `idb://filename/<lowercase_filename>` — fallback lookup by attachment name (`mediaStorage.js:308-309, 559`).
  3. Title alias key: `idb://title/<normalized_lowercase_title>` — fallback lookup by activity title (`mediaStorage.js:312-313, 566`).
  4. Category latest key (videos only): `idb://latest/video` — **overwritten by every video upload** (`mediaStorage.js:315, 328`); note `resolveViewableMediaUrl` (`573-577`) intentionally does **not** fall back to `idb://latest/video` unless matched by key/filename/title, leaving `idb://latest/video` as an unused write in IndexedDB.

---

## 5. Static Datasets Read by UI Instead of (or Merged Over) the Database

| File & Exported Symbol | Contents | UI Consumers & How It Replaces / Overrides DB Data |
| :--- | :--- | :--- |
| [src/lib/enrolleePopulationData.js](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/lib/enrolleePopulationData.js) — `enrolleePopulationSummary`, `barangayEnrolleesData` (63 rows), `barangayGroupedData` (22 barangays) | Hardcoded MSWDO census: **3,041 total enrollees** (ITED: 251, Pre-K1: 1,458, Pre-K2: 1,329, 5 y/o: 3); `totalCdcs` header says **62** while the array contains **63** centers | Read directly as the source of truth for municipal KPIs and barangay tables in [LandingPage.jsx](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/pages/LandingPage.jsx), [MswdOverview.jsx](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/components/admin/MswdOverview.jsx), [EnrolleePopulation.jsx](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/components/admin/EnrolleePopulation.jsx), [DaycareCenterMonitoring.jsx](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/components/admin/DaycareCenterMonitoring.jsx), and [ReportsGeneration.jsx](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/components/admin/ReportsGeneration.jsx). Online `public.learners` rows are shown in a separate "Registered Online Portal Learners" table rather than driving the 3,041 census totals. |
| [src/lib/curriculumData.js](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/lib/curriculumData.js) — `preK1Curriculum`, `preK2Curriculum` | Full Q1–Q4 weekly ECCD themes, sub-themes, objectives, and suggested activities for Pre-K1 (3–3.11 y/o) and Pre-K2 (4–4.11 y/o) | Rendered directly by [CurriculumGuides.jsx](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/components/admin/CurriculumGuides.jsx) and used to populate topic choices in [TeacherDashboard.jsx](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/pages/TeacherDashboard.jsx); curriculum definitions have **no database table**. |
| [src/lib/curriculumData.js](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/lib/curriculumData.js#L134-L386) — `realCdcsList` (64 CDCs) & `realTeachersList` (63 CDTs/CDWs) | Hardcoded directory of 64 Manolo Fortich CDCs (`cdc-mf-01`..`64`) and 63 named teachers (`tch-mf-01`..`63`) with designations & barangays *(comment on line 133 says "Real 46 Child Development Centers")* | Merged into `cdcs` and `teachers` state in [AdminDashboard.jsx](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/pages/AdminDashboard.jsx#L98-L159), [ManageTeachers.jsx](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/pages/ManageTeachers.jsx), [CurriculumGuides.jsx](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/components/admin/CurriculumGuides.jsx), [ProgramMonitoring.jsx](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/components/admin/ProgramMonitoring.jsx), [SignUp.jsx](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/pages/SignUp.jsx), and [TeacherDashboard.jsx](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/pages/TeacherDashboard.jsx). Unprovisioned baseline teachers appear across Admin & SignUp lists even when they have no `auth.users` or `public.teachers` row. |
| [src/lib/curriculumData.js](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/lib/curriculumData.js#L417-L418) & `619` — `initialCurriculumAssignments` (`[]`), `initialTeacherModules` (`[]`) | Empty baseline arrays | Used as empty fallback seeds when both `localStorage` and `public.materials` are empty. |
| [src/lib/studentLearningData.js](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/lib/studentLearningData.js) — `BILINGUAL_CATEGORIES` | 6 static English/Bisaya modules (`Alphabet`, `Numbers`, `Colors`, `Shapes`, `Animals`, `Stories`) with flashcards, phonics, and storybooks | Powers the entire `"Explore & Play"` (`categories`) learning experience in [StudentDashboard.jsx](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/pages/StudentDashboard.jsx#L3225-L3435) & `4017-4158` — **completely disconnected from `public.categories`** (changes made by Admins in the Categories tab do not affect `BILINGUAL_CATEGORIES`). |
| [src/lib/supabaseClient.js](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/lib/supabaseClient.js#L43-L66) — `barangays` | Static array of 22 Manolo Fortich barangay names | Populates every Barangay `<select>` filter/form across the entire app instead of querying distinct barangays from DB. |
| [src/lib/mswdData.js](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/lib/mswdData.js) — `baselineCdcs` (25 CDCs), `baselineLearners` (`[]`), `baselineAssessments` (6 fake child evaluations), `baselineActivityReports` (8 fake October 2026 activity reports) | Legacy static MSWDO demo datasets | `baselineActivityReports` initializes unused `activityReports` state in `AdminDashboard.jsx:76`; `baselineAssessments` is only imported in `learnersService.js` (never returned by active getters) and dead `ChildDevelopmentMonitoring.jsx`. |
| Hardcoded Component-Level Static Data / Fallbacks | • [EnrolleePopulation.jsx](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/components/admin/EnrolleePopulation.jsx#L490-L506): fallback CDC `'Maluko Child Development Center'`, parent `'Lovey Guinevere Tion'`, phone `'0929-320-5411'`<br>• [ReportsGeneration.jsx](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/components/admin/ReportsGeneration.jsx#L190-L216) & `996`: synthetic capacity (`Math.max(enrolled + 5, 35)`) and deterministic fake attendance (`91 + (idx % 6)` = 91%–96%), plus hardcoded signatory `'MARIA CRISTINA FLORES, RSW'`<br>• [DaycareCenterMonitoring.jsx](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/components/admin/DaycareCenterMonitoring.jsx#L817-L848): synthetic `<name>@earlylearn.ph` email display & static shift schedules<br>• [LandingPage.jsx](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/pages/LandingPage.jsx#L18-L175): static preview cards (`LETTERS_PREVIEW`, `NUMBERS_PREVIEW`, `COLORS_PREVIEW`, `SHAPES_PREVIEW`) | Displayed directly in tables, printouts, and modals without DB backing. |

---

## 6. Dead Code, Orphaned Modules, & Redundant Queries

### 6.1 Completely Unimported Files (7 Files — 3,996 Lines Total)
| File | Lines | Why It Is Dead & Notable Internal Defects |
| :--- | ---: | :--- |
| [src/pages/ManageUsers.jsx](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/pages/ManageUsers.jsx) | 1,147 | Never imported anywhere (`AdminDashboard.jsx` has no `users` tab renderer despite `MswdOverview.jsx:156` navigating to `'users'`). Also contains two `ReferenceError` bugs: calls undefined `loadData()` at line `251` and undefined `setAddUserModal(false)` at line `349`. |
| [src/pages/ManageLearners.jsx](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/pages/ManageLearners.jsx) | 836 | Never imported anywhere; superseded by [EnrolleePopulation.jsx](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/components/admin/EnrolleePopulation.jsx). |
| [src/components/AdminOverview.jsx](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/components/AdminOverview.jsx) | 710 | Never imported anywhere; superseded by [MswdOverview.jsx](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/components/admin/MswdOverview.jsx). Navigates to non-existent tabs `'users'`, `'learners'`, `'materials'`, `'approvals'`. |
| [src/components/admin/ChildRecordsManagement.jsx](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/components/admin/ChildRecordsManagement.jsx) | 664 | Never imported anywhere; superseded by [EnrolleePopulation.jsx](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/components/admin/EnrolleePopulation.jsx). |
| [src/components/admin/ChildDevelopmentMonitoring.jsx](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/components/admin/ChildDevelopmentMonitoring.jsx) | 410 | Never imported anywhere; ECCD evaluation was moved to teacher portal ([TeacherChildDevelopment.jsx](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/components/teacher/TeacherChildDevelopment.jsx)). |
| [src/components/teacher/TeacherActivityNotifications.jsx](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/components/teacher/TeacherActivityNotifications.jsx) | 266 | Never imported anywhere; `TeacherDashboard.jsx` renders its own inline notification/topic banners instead. |
| [src/lib/test_flows.js](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/lib/test_flows.js) | 73 | Standalone Node CLI script (`console.log` assertions); not imported by app or wired to `package.json` scripts. *(Note: sum above is 4,106 lines across all 7 files.)* |

### 6.2 Dead State, Queries, Handlers, & Unreachable JSX Inside Active Files
- **[src/pages/AdminDashboard.jsx](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/pages/AdminDashboard.jsx)**:
  - **Unused Imports**: `baselineCdcs` (`line 12`), `pillClass` (`line 35`), `IconUsers` (`line 45`), `IconMaterials` (`line 49` — used only in `TABS`, `IconApprovals` at `line 50` is completely unused).
  - **Dead State & Live Network Queries**: `loadUsers()` (`162-186`), `loadMaterials()` (`245-255`), and `loadApprovals()` (`267-279`) are executed on **every** Admin Dashboard mount and Realtime event (`343-348`, `389-391`), querying `profiles` and `materials` twice (`SELECT` without excluding `[MEDIA_CHUNK]` rows!) into `profiles`, `usersMsg`, `materials`, and `approvals` state variables that are **never rendered or passed as props**.
  - **Dead Handlers & Helpers**: `deleteMaterial()` (`257-264`), `decideApproval()` (`281-287`), `activityReports` / `handleVerifyReport()` (`76`, `335-339` — passed to nothing except `MswdOverview` which ignores `handleVerifyReport`), and `statusPillKind()` (`407-411`).
- **[src/components/admin/ReportsGeneration.jsx](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/components/admin/ReportsGeneration.jsx)**:
  - **Unreachable 6th Report View (`lines 912-989`)**: Renders `{reportType === 'development' && (...)}` (ECCD Development Milestones table) and supports `'development'` in CSV export (`lines 310-330`), but the `REPORT_TYPES` selector array (`lines 54-86`) only includes `'population'`, `'cdcs'`, `'teachers'`, `'curriculum'`, and `'attendance'`, making `'development'` impossible to select in the UI.
- **[src/components/admin/MswdOverview.jsx](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/components/admin/MswdOverview.jsx#L153-L160)**:
  - Broken Superadmin `"Manage Users"` quick-action button calls `onNavigateTab('users')`, which switches `AdminDashboard` to an unhandled `activeTab` value (`'users'`), rendering a blank main panel.

### 6.3 Unused Exported Symbols in `src/lib/` & Components
| File | Unused Export(s) | Notes |
| :--- | :--- | :--- |
| [src/lib/mswdData.js](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/lib/mswdData.js) | `baselineCdcs`, `baselineLearners`, `baselineAssessments` | `baselineCdcs` is imported in `AdminDashboard.jsx:12` and never used; `baselineLearners` is only imported in dead `ChildRecordsManagement.jsx`; `baselineAssessments` is only referenced in dead `ChildDevelopmentMonitoring.jsx` and unused import in `learnersService.js` |
| [src/lib/roles.js](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/lib/roles.js) | `ROLE_SUPERADMIN`, `ROLE_ADMIN`, `ROLE_TEACHER`, `ROLE_STUDENT`, `formatRoleLabel` | Exported (`lines 6-9`, `151`) and never imported by any active file (`addSuperAdminId` / `removeSuperAdminId` are only imported by dead `ManageUsers.jsx`) |
| [src/lib/mediaStorage.js](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/lib/mediaStorage.js) | `ACCEPTED_FILE_TYPES_STRING` (`line 17`), `formatFileSize` (`line 20` — used internally once, never imported externally) | Never imported outside `mediaStorage.js` |
| [src/lib/curriculumData.js](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/lib/curriculumData.js) | `isAuthenticLocalTeacherModule` (`line 650`), `earlylearn_active_teacher_profile` `localStorage` key (`line 816`) | `isAuthenticLocalTeacherModule` is only called internally once; `earlylearn_active_teacher_profile` is written and never read |
| [src/lib/learnersService.js](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/lib/learnersService.js) | `getTeachersForBarangaySync` (`line 331`) | Only called internally by `getTeachersForBarangay`; never imported externally |
| [src/components/Category3DBadges.jsx](file:///C:/earlyLearningHub/EarlyLearn-Hub-2/src/components/Category3DBadges.jsx) | Individual badge components if any beyond `CategoryBadge` | Only `CategoryBadge` is imported (`StudentDashboard.jsx:5`, `LandingPage.jsx:4`) |
