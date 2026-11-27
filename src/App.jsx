import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login.jsx';
import SignUp from './pages/SignUp.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import { DashboardTabSkeleton } from './components/ui/Skeleton.jsx';

const AdminDashboard = lazy(() => import('./pages/AdminDashboard.jsx'));
const TeacherDashboard = lazy(() => import('./pages/TeacherDashboard.jsx'));
const StudentDashboard = lazy(() => import('./pages/StudentDashboard.jsx'));

export default function App() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-ui-bg"><DashboardTabSkeleton /></div>}>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
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
            <ProtectedRoute allowedRoles={['teacher']}>
              {(profile) => <TeacherDashboard profile={profile} />}
            </ProtectedRoute>
          }
        />

        <Route
          path="/student-dashboard"
          element={
            <ProtectedRoute allowedRoles={['student']}>
              {(profile) => <StudentDashboard profile={profile} />}
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  );
}
