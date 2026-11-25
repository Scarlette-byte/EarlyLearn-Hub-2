import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login.jsx';
import SignUp from './pages/SignUp.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import TeacherDashboard from './pages/TeacherDashboard.jsx';
import StudentDashboard from './pages/StudentDashboard.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import { supabase } from './lib/supabaseClient.js';
import { getEffectiveRole, getRoleDashboardPath } from './lib/roles.js';

function RootOrFallbackRedirect() {
  const [targetPath, setTargetPath] = useState(null);

  useEffect(() => {
    let active = true;

    async function resolveDestination() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user) {
          if (active) setTargetPath('/login');
          return;
        }

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          if (active) setTargetPath('/login');
          return;
        }

        const effectiveRole = getEffectiveRole({
          user,
          app_metadata: user.app_metadata,
          access_token: session.access_token,
        });

        if (active) {
          setTargetPath(getRoleDashboardPath(effectiveRole));
        }
      } catch {
        if (active) setTargetPath('/login');
      }
    }

    resolveDestination();
    return () => {
      active = false;
    };
  }, []);

  if (!targetPath) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dashbg text-dash-ink-soft font-nunito text-sm">
        Loading...
      </div>
    );
  }

  return <Navigate to={targetPath} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RootOrFallbackRedirect />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<SignUp />} />

      <Route
        path="/admin-dashboard"
        element={
          <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
            {(profile) => <AdminDashboard profile={profile} />}
          </ProtectedRoute>
        }
      />

      <Route
        path="/teacher-dashboard"
        element={
          <ProtectedRoute allowedRoles={['teacher', 'admin', 'superadmin']}>
            {(profile) => <TeacherDashboard profile={profile} />}
          </ProtectedRoute>
        }
      />

      <Route
        path="/student-dashboard"
        element={
          <ProtectedRoute allowedRoles={['student', 'parent', 'admin', 'superadmin']}>
            {(profile) => <StudentDashboard profile={profile} />}
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<RootOrFallbackRedirect />} />
    </Routes>
  );
}
