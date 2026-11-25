import { supabase } from './supabaseClient.js';

/**
 * DB-backed Curriculum, Topics, and Assignments service (replaces static curriculumData).
 * Supports soft delete via `deleted_at` where present.
 */
export async function fetchCurriculaFromDb({ level = null, schoolYear = null } = {}) {
  let query = supabase
    .from('curricula')
    .select('id, title, level, school_year, description, created_at, topics(id, title, quarter, sort_order)')
    .order('created_at', { ascending: false });

  if (level) query = query.eq('level', level);
  if (schoolYear) query = query.eq('school_year', schoolYear);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to load curricula: ${error.message}`);
  return data || [];
}

export async function createCurriculumInDb({ title, level, schoolYear, description = '' }) {
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('curricula')
    .insert({
      title: String(title || '').trim(),
      level,
      school_year: schoolYear,
      description: description || null,
      created_by: userData?.user?.id || null,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create curriculum: ${error.message}`);
  return data;
}

export async function createTopicInDb({ curriculumId, title, quarter = 1, sortOrder = 0 }) {
  const { data, error } = await supabase
    .from('topics')
    .insert({
      curriculum_id: curriculumId,
      title: String(title || '').trim(),
      quarter,
      sort_order: sortOrder,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create topic: ${error.message}`);
  return data;
}

export async function createAssignmentInDb({ topicId, classId, teacherId, title, instructions = '', dueAt = null, maxScore = null }) {
  const { data, error } = await supabase
    .from('assignments')
    .insert({
      topic_id: topicId || null,
      class_id: classId,
      teacher_id: teacherId,
      title: String(title || '').trim(),
      instructions: instructions || null,
      due_at: dueAt || null,
      max_score: maxScore,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create assignment: ${error.message}`);
  return data;
}
