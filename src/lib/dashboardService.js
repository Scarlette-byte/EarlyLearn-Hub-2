import { supabase } from './supabaseClient';

/**
 * Fetches live aggregate counts for the Admin Dashboard from `v_admin_dashboard_summary`.
 */
export async function fetchAdminDashboardSummary() {
  const { data, error } = await supabase
    .from('v_admin_dashboard_summary')
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return data || {
    total_students: 0,
    enrolled_students: 0,
    total_cdcs: 0,
    total_teachers: 0,
    pending_materials: 0,
    approved_materials: 0,
    total_assessments: 0,
    pending_enrollments: 0,
  };
}

/**
 * Fetches live aggregate counts for a Teacher Dashboard from `v_teacher_dashboard_summary`.
 */
export async function fetchTeacherDashboardSummary(teacherId) {
  if (!teacherId) return null;
  const { data, error } = await supabase
    .from('v_teacher_dashboard_summary')
    .select('*')
    .eq('teacher_id', teacherId)
    .maybeSingle();
  if (error) throw error;
  return data || {
    teacher_id: teacherId,
    assigned_topics_total: 0,
    assigned_topics_pending: 0,
    materials_pending: 0,
    materials_approved: 0,
    materials_posted: 0,
    enrolled_students_count: 0,
    pending_parent_approvals: 0,
    pending_submissions: 0,
  };
}

/**
 * Fetches live aggregate counts for a Student Dashboard from `v_student_dashboard_summary`.
 */
export async function fetchStudentDashboardSummary(studentId) {
  if (!studentId) return null;
  const { data, error } = await supabase
    .from('v_student_dashboard_summary')
    .select('*')
    .eq('student_id', studentId)
    .maybeSingle();
  if (error) throw error;
  return data || {
    student_id: studentId,
    total_posted_activities: 0,
    submissions_count: 0,
    completed_activities: 0,
    announcements_count: 0,
    latest_assessment_at: null,
  };
}
