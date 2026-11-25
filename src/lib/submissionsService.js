import { supabase } from './supabaseClient.js';

/**
 * Fetches submission history with student, assignment/topic, timestamps, status, and attached files.
 */
export async function fetchSubmissionsHistory({ studentId = null, assignmentId = null } = {}) {
  let query = supabase
    .from('submissions')
    .select(
      'id, assignment_id, student_id, notes, status, score, feedback, submitted_at, reviewed_at, ' +
      'students(id, first_name, last_name), ' +
      'assignments(id, title, due_at, topics(id, title)), ' +
      'submission_files(id, file_url, file_name, mime_type, file_size_bytes)'
    )
    .order('submitted_at', { ascending: false });

  if (studentId) query = query.eq('student_id', studentId);
  if (assignmentId) query = query.eq('assignment_id', assignmentId);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to load submissions: ${error.message}`);
  return data || [];
}

/**
 * Parents/students cannot edit or re-upload once submitted unless the teacher returned it.
 */
export function canEditSubmission(submission) {
  if (!submission) return true;
  return submission.status === 'returned';
}

export async function returnSubmissionForRevision(submissionId, feedback = '') {
  const { data, error } = await supabase
    .from('submissions')
    .update({
      status: 'returned',
      feedback: feedback || null,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', submissionId)
    .select()
    .single();

  if (error) throw new Error(`Failed to return submission: ${error.message}`);
  return data;
}
