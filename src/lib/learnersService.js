import { supabase } from './supabaseClient.js';
import { realTeachersList, realCdcsList } from './curriculumData.js';
import { baselineLearners } from './mswdData.js';

const REGISTERED_LEARNERS_STORAGE_KEY = 'earlylearn_registered_learners';

/**
 * Returns a synchronous list of teachers for a specific barangay based on MSWDO baseline records.
 * Instant, zero-latency response for UI dropdowns.
 */
export function getTeachersForBarangaySync(barangay) {
  if (!barangay) return [];
  const normalized = (barangay || '').trim().toLowerCase();
  return realTeachersList.filter(
    (t) => (t.barangay || '').trim().toLowerCase() === normalized
  );
}

/**
 * Asynchronously loads teachers for a specific barangay from both Supabase and MSWDO records.
 */
export async function getTeachersForBarangay(barangay) {
  if (!barangay) return [];
  const normalized = (barangay || '').trim().toLowerCase();
  const baseline = realTeachersList.filter(
    (t) => (t.barangay || '').trim().toLowerCase() === normalized
  );

  try {
    const { data: dbTeachers, error } = await supabase
      .from('teachers')
      .select('id, full_name, barangay, contact_number, email, cdc_id, cdcs(id, name, barangay)')
      .ilike('barangay', barangay);

    if (!error && dbTeachers && dbTeachers.length > 0) {
      const existingNames = new Set(dbTeachers.map((t) => (t.full_name || '').toLowerCase()));
      const nonDuplicateBaseline = baseline.filter(
        (b) => !existingNames.has((b.full_name || '').toLowerCase())
      );
      return [
        ...dbTeachers.map((t) => ({
          ...t,
          cdc_name: t.cdcs?.name || `${barangay} Child Development Center`,
        })),
        ...nonDuplicateBaseline,
      ];
    }
  } catch {
    // Fall back to baseline
  }

  return baseline;
}

/**
 * Gets the primary/default teacher for a specific barangay if none is explicitly chosen.
 */
export function getDefaultTeacherForBarangay(barangay) {
  const teachers = getTeachersForBarangaySync(barangay);
  return teachers.length > 0 ? teachers[0] : null;
}

/**
 * Finds the default or matching CDC for a given barangay.
 */
export function getCdcForBarangay(barangay) {
  if (!barangay) return null;
  const normalized = (barangay || '').trim().toLowerCase();
  const match = realCdcsList.find(
    (c) => (c.barangay || '').trim().toLowerCase() === normalized
  );
  return match || { id: null, name: `${barangay} Child Development Center`, barangay };
}

/**
 * Retrieves all registered learners stored locally.
 */
export function getStoredLearners() {
  try {
    const raw = localStorage.getItem(REGISTERED_LEARNERS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Saves or updates a learner record in local persistent storage and attempts Supabase sync.
 */
export async function recordRegisteredLearner(learnerData) {
  if (!learnerData || !learnerData.full_name) return null;

  const current = getStoredLearners();
  const normalizedName = (learnerData.full_name || '').trim().toLowerCase();
  const normalizedBarangay = (learnerData.barangay || '').trim().toLowerCase();

  const existingIndex = current.findIndex((item) => {
    if (learnerData.id && item.id === learnerData.id) return true;
    const itemName = (item.full_name || '').trim().toLowerCase();
    const itemBrgy = (item.barangay || '').trim().toLowerCase();
    return itemName === normalizedName && (!normalizedBarangay || itemBrgy === normalizedBarangay);
  });

  const record = {
    id: learnerData.id || `lrn-${Date.now()}`,
    full_name: (learnerData.full_name || '').trim(),
    birthdate: learnerData.birthdate || learnerData.child_age || 'Age 3–4',
    child_age: learnerData.child_age || '3-4',
    barangay: learnerData.barangay || '',
    parent_name: (learnerData.parent_name || '').trim(),
    parent_contact: (learnerData.parent_contact || '').trim(),
    adviser_name: (learnerData.adviser_name || '').trim(),
    teacher_id: learnerData.teacher_id || null,
    cdc_name: learnerData.cdc_name || (learnerData.barangay ? `${learnerData.barangay} Child Development Center` : ''),
    cdc_id: learnerData.cdc_id || null,
    status: 'Enrolled & Active',
    last_login: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (existingIndex >= 0) {
    current[existingIndex] = {
      ...current[existingIndex],
      ...record,
      // Preserve original registration if exists
      created_at: current[existingIndex].created_at || new Date().toISOString(),
    };
  } else {
    record.created_at = new Date().toISOString();
    current.push(record);
  }

  try {
    localStorage.setItem(REGISTERED_LEARNERS_STORAGE_KEY, JSON.stringify(current));
    // Also save quick student adviser cache
    if (record.id) {
      localStorage.setItem(
        `earlylearn_student_adviser_${record.id}`,
        JSON.stringify({
          adviser_name: record.adviser_name,
          cdc_name: record.cdc_name,
          barangay: record.barangay,
        })
      );
    }
    // Broadcast event across same window
    window.dispatchEvent(
      new CustomEvent('earlylearn_learners_updated', { detail: record })
    );
  } catch (err) {
    console.warn('Failed saving learner to localStorage:', err);
  }

  // Best effort sync to Supabase learners table
  try {
    await supabase.from('learners').upsert({
      full_name: record.full_name,
      birthdate: record.birthdate?.includes('-') ? record.birthdate : null,
      barangay: record.barangay,
      cdc_id: record.cdc_id || null,
      parent_name: record.parent_name || null,
      parent_contact: record.parent_contact || null,
    });
  } catch {
    // Ignore RLS policy errors on learners table
  }

  return record;
}

/**
 * Synchronizes student registration and login into the teacher's jurisdiction.
 * Called on parent signup, user login, and student dashboard initialization.
 */
export async function syncStudentLogin(user, profile) {
  if (!user && !profile) return null;

  const metadata = user?.user_metadata || profile?.user_metadata || {};

  // Extract clean child name
  let childName = metadata.child_name || '';
  if (!childName) {
    const fullName = profile?.full_name || metadata.full_name || user?.email?.split('@')[0] || '';
    if (fullName.includes('(Parent:')) {
      childName = fullName.split(' (Parent:')[0].trim();
    } else {
      childName = fullName.trim();
    }
  }

  // Extract parent name
  let parentName = metadata.parent_name || '';
  if (!parentName) {
    const fullName = profile?.full_name || metadata.full_name || '';
    if (fullName.includes('(Parent:')) {
      const match = fullName.match(/\(Parent:\s*([^)]+)\)/);
      if (match && match[1]) parentName = match[1].trim();
    }
  }

  const barangay =
    profile?.barangay || metadata.barangay || user?.user_metadata?.barangay || '';

  // Get cached adviser if available
  let cachedAdviser = null;
  const userId = user?.id || profile?.id;
  if (userId) {
    try {
      const raw = localStorage.getItem(`earlylearn_student_adviser_${userId}`);
      if (raw) cachedAdviser = JSON.parse(raw);
    } catch {
      // ignore
    }
  }

  let adviserName =
    metadata.adviser_name ||
    metadata.teacher_name ||
    profile?.adviser_name ||
    cachedAdviser?.adviser_name ||
    '';

  let cdcName =
    metadata.cdc_name ||
    profile?.cdc_name ||
    cachedAdviser?.cdc_name ||
    '';

  let cdcId = metadata.cdc_id || cachedAdviser?.cdc_id || null;
  let teacherId = metadata.teacher_id || null;

  // Fallback to default teacher if barangay exists but adviser was not set
  if (!adviserName && barangay) {
    const defaultTch = getDefaultTeacherForBarangay(barangay);
    if (defaultTch) {
      adviserName = defaultTch.full_name;
      teacherId = defaultTch.id;
      cdcName = defaultTch.cdc_name || `${barangay} Child Development Center`;
    }
  }

  const contact =
    metadata.contact_number ||
    metadata.email_or_phone ||
    metadata.email ||
    user?.email ||
    '';

  return recordRegisteredLearner({
    id: userId,
    full_name: childName,
    birthdate: metadata.child_age === '5-6' ? 'Age 5–6' : 'Age 3–4',
    child_age: metadata.child_age || '3-4',
    barangay: barangay,
    parent_name: parentName,
    parent_contact: contact,
    adviser_name: adviserName,
    teacher_id: teacherId,
    cdc_name: cdcName || (barangay ? `${barangay} Child Development Center` : ''),
    cdc_id: cdcId,
  });
}

/**
 * Returns all learners that belong to a specific teacher's barangay, CDC, or direct advisership.
 */
export async function getLearnersForTeacher({ teacherName, barangay, cdcName, cdcId }) {
  const normBarangay = (barangay || '').trim().toLowerCase();
  const normTeacherName = (teacherName || '').trim().toLowerCase();
  const normCdcName = (cdcName || '').trim().toLowerCase();

  // 1. Gather from local registered learners
  const stored = getStoredLearners();

  // 2. Gather from baseline learners
  const baseline = (baselineLearners || []).map((l) => ({
    ...l,
    cdc_name: l.cdc_name || `${l.barangay} Child Development Center`,
  }));

  // 3. Gather from Supabase learners table
  let dbLearners = [];
  try {
    let query = supabase.from('learners').select('*');
    if (cdcId) {
      query = query.eq('cdc_id', cdcId);
    } else if (barangay) {
      query = query.ilike('barangay', barangay);
    }
    const { data, error } = await query;
    if (!error && data) {
      dbLearners = data;
    }
  } catch {
    // Ignore fetch error
  }

  const combined = [...stored, ...dbLearners, ...baseline];

  // Filter based on teacher's scope:
  // Match by teacher's assigned barangay OR teacher's adviser name OR CDC
  const seenKeys = new Set();
  const results = [];

  for (const learner of combined) {
    if (!learner || !learner.full_name) continue;

    const lName = (learner.full_name || '').trim().toLowerCase();
    const lBarangay = (learner.barangay || '').trim().toLowerCase();
    const lAdviser = (learner.adviser_name || '').trim().toLowerCase();
    const lCdc = (learner.cdc_name || '').trim().toLowerCase();

    // Check if learner matches this teacher
    const matchesBarangay = normBarangay && lBarangay === normBarangay;
    const matchesAdviser =
      normTeacherName &&
      lAdviser &&
      (lAdviser === normTeacherName ||
        lAdviser.includes(normTeacherName) ||
        normTeacherName.includes(lAdviser));
    const matchesCdc =
      (cdcId && learner.cdc_id && String(learner.cdc_id) === String(cdcId)) ||
      (normCdcName && lCdc && lCdc === normCdcName);

    // Strict barangay isolation: if teacher belongs to a barangay, learner must belong to that barangay or be directly advised by teacher
    if (normBarangay) {
      if (matchesBarangay || matchesAdviser || (matchesCdc && (!lBarangay || lBarangay === normBarangay))) {
        const dedupKey = `${lName}|${lBarangay}`;
        if (!seenKeys.has(dedupKey)) {
          seenKeys.add(dedupKey);
          results.push(learner);
        }
      }
    } else if (matchesAdviser || matchesCdc) {
      const dedupKey = `${lName}|${lBarangay}`;
      if (!seenKeys.has(dedupKey)) {
        seenKeys.add(dedupKey);
        results.push(learner);
      }
    }
  }

  // Sort by full name
  results.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
  return results;
}
