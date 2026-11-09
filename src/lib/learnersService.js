import { supabase, supabaseSecondaryAuth, normalizeAuthIdentifier } from './supabaseClient.js';
import { realTeachersList, realCdcsList } from './curriculumData.js';
import { baselineLearners } from './mswdData.js';

const REGISTERED_LEARNERS_STORAGE_KEY = 'earlylearn_registered_learners';
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(val) {
  return Boolean(val && UUID_REGEX.test(String(val).trim()));
}

/**
 * Strips any "(Parent: ...)" or "(Guardian: ...)" suffix from a student's name so ONLY the student's name is displayed.
 */
export function cleanStudentName(rawName) {
  if (!rawName) return '';
  return String(rawName)
    .replace(/\s*\(Parent:[^)]*\)/gi, '')
    .replace(/\s*\(Guardian:[^)]*\)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks whether a student name is a generic placeholder or test account
 * ("Student Test", "Student User", "Hannah Mae Tion", etc.) that should be excluded.
 */
export function isPlaceholderStudentName(rawName) {
  const cleaned = cleanStudentName(rawName).toLowerCase();
  if (!cleaned) return true;
  return (
    cleaned === 'student test' ||
    cleaned === 'student user' ||
    cleaned === 'test student' ||
    cleaned === 'demo student' ||
    cleaned === 'student' ||
    cleaned === 'learner' ||
    cleaned === 'hannah mae tion'
  );
}

/**
 * Extracts clean contact number and optional embedded registration code from a teacher's contact_number field.
 * Format supported: "09268900411 ||CODE:ELH-DALIRIG-327F"
 */
export function parseTeacherContactAndCode(rawContact) {
  if (!rawContact) return { contactNumber: '', registrationCode: '' };
  const str = String(rawContact);
  const marker = '||CODE:';
  const idx = str.indexOf(marker);
  if (idx === -1) {
    return { contactNumber: str.trim(), registrationCode: '' };
  }
  return {
    contactNumber: str.slice(0, idx).trim(),
    registrationCode: str.slice(idx + marker.length).trim().toUpperCase(),
  };
}

/**
 * Encodes a teacher's contact number and registration code so it persists in Supabase `teachers.contact_number`.
 */
export function packTeacherContactAndCode(contactNumber, registrationCode) {
  const cleanContact = parseTeacherContactAndCode(contactNumber).contactNumber;
  const cleanCode = (registrationCode || '').trim().toUpperCase();
  if (!cleanCode) return cleanContact || null;
  return `${cleanContact} ||CODE:${cleanCode}`.trim();
}

/**
 * Generates a deterministic, easy-to-type Registration Code for a teacher.
 * Example: "ELH-DALIRIG-327F" or "ELH-DALIRIG-JP"
 */
export function buildDefaultTeacherCode({ id, full_name, barangay } = {}) {
  const brgySlug = (barangay || 'MF')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 7) || 'MF';

  const idStr = String(id || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (idStr.length >= 4 && !idStr.startsWith('TCH0')) {
    return `ELH-${brgySlug}-${idStr.slice(0, 4)}`;
  }

  const cleanName = String(full_name || 'TEACHER')
    .replace(/^Teacher\s+/i, '')
    .replace(/\s*\(.*?\)\s*/g, '')
    .trim()
    .toUpperCase();
  const words = cleanName.split(/\s+/).filter(Boolean);
  const initials = words.map((w) => w[0]).join('').slice(0, 3) || 'CDC';
  const suffix = idStr.slice(-2) || '01';
  return `ELH-${brgySlug}-${initials}${suffix}`;
}

/**
 * Generates a fresh random registration code for a teacher's barangay.
 */
export function generateNewTeacherCode(barangay) {
  const brgySlug = (barangay || 'MF')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 7) || 'MF';
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let rand = '';
  for (let i = 0; i < 4; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `ELH-${brgySlug}-${rand}`;
}

/**
 * Fetches the active Registration Code for a teacher from Supabase `teachers` (or deterministic default).
 */
export async function getTeacherRegistrationCode({ teacherId, teacherName, barangay }) {
  try {
    if (teacherId && isValidUuid(teacherId)) {
      const { data } = await supabase
        .from('teachers')
        .select('id, full_name, barangay, contact_number')
        .eq('id', teacherId)
        .single();
      if (data) {
        const { registrationCode } = parseTeacherContactAndCode(data.contact_number);
        if (registrationCode) return registrationCode;
        return buildDefaultTeacherCode({
          id: data.id,
          full_name: data.full_name || teacherName,
          barangay: data.barangay || barangay,
        });
      }
    }
  } catch {
    // Fallback below
  }

  return buildDefaultTeacherCode({ id: teacherId, full_name: teacherName, barangay });
}

/**
 * Saves a teacher's unique Registration Code directly to Supabase `teachers` and Auth metadata
 * so parents on any device can verify and register using that code.
 */
export async function saveTeacherRegistrationCode({ teacherId, contactNumber, registrationCode }) {
  const cleanCode = (registrationCode || '').trim().toUpperCase();
  if (!cleanCode) return null;

  const packedContact = packTeacherContactAndCode(contactNumber, cleanCode);

  if (teacherId && isValidUuid(teacherId)) {
    try {
      await supabase
        .from('teachers')
        .update({ contact_number: packedContact })
        .eq('id', teacherId);
    } catch (err) {
      console.warn('Could not update teacher registration code in teachers table:', err);
    }
  }

  try {
    await supabase.auth.updateUser({
      data: { registration_code: cleanCode },
    });
  } catch {
    // ignore
  }

  return cleanCode;
}

/**
 * Verifies a Teacher Registration Code entered by a Parent on /signup against Supabase `teachers`
 * and accredited MSWDO teacher records. Works across devices even before the parent logs in.
 */
export async function verifyTeacherRegistrationCode(codeInput) {
  const cleanInput = (codeInput || '').trim().toUpperCase();
  if (!cleanInput) return { valid: false };

  // 1. Check live Supabase `teachers` table (publicly readable on /signup)
  try {
    const { data: dbTeachers } = await supabase
      .from('teachers')
      .select('id, full_name, barangay, contact_number, email, cdc_id, cdcs(id, name, barangay)');

    if (Array.isArray(dbTeachers)) {
      for (const t of dbTeachers) {
        const { contactNumber, registrationCode } = parseTeacherContactAndCode(t.contact_number);
        const defaultCode = buildDefaultTeacherCode(t);
        const shortBrgyCode = t.barangay
          ? `ELH-${t.barangay.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7)}`
          : '';

        if (
          (registrationCode && registrationCode.toUpperCase() === cleanInput) ||
          defaultCode.toUpperCase() === cleanInput ||
          (shortBrgyCode && shortBrgyCode === cleanInput)
        ) {
          const fallbackCdc = getCdcForBarangay(t.barangay);
          return {
            valid: true,
            code: registrationCode || defaultCode,
            teacherId: t.id,
            teacherName: t.full_name,
            barangay: t.barangay || fallbackCdc?.barangay || 'Dalirig',
            cdcId: t.cdc_id || null,
            cdcName:
              t.cdcs?.name ||
              fallbackCdc?.name ||
              `${t.barangay || 'Manolo Fortich'} Child Development Center`,
            contactNumber,
          };
        }
      }
    }
  } catch (err) {
    console.warn('Supabase teacher code lookup warning:', err);
  }

  // 2. Also check accredited MSWDO teacher baseline list
  for (const t of realTeachersList) {
    const defaultCode = buildDefaultTeacherCode(t);
    const shortBrgyCode = t.barangay
      ? `ELH-${t.barangay.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7)}`
      : '';
    if (defaultCode.toUpperCase() === cleanInput || (shortBrgyCode && shortBrgyCode === cleanInput)) {
      return {
        valid: true,
        code: defaultCode,
        teacherId: t.id,
        teacherName: t.full_name,
        barangay: t.barangay,
        cdcId: null,
        cdcName: t.cdc_name || `${t.barangay} Child Development Center`,
        contactNumber: t.contact_number || '',
      };
    }
  }

  return { valid: false };
}

export function formatLearnerAgeLabel(ageVal) {
  const s = String(ageVal || '').toLowerCase();
  if (s.includes('4-4.11') || s.includes('5-6') || s.includes('pre-k2') || s.includes('5–6') || s === '4') {
    return '4 to 4.11 months (Pre-K2)';
  }
  return '3 to 3.11 months (Pre-K1)';
}

/**
 * Packs learner metadata (approval_status, teacher_id, adviser_name, cdc_name, child_age, registration_code)
 * into `parent_contact` so all fields persist in the existing Supabase `learners` table across devices.
 */
export function packLearnerContactMeta(cleanContact, metaObj = {}) {
  const baseContact = String(cleanContact || '').split('||META:')[0].trim();
  const payload = {
    status: metaObj.approval_status || metaObj.status || 'approved',
    teacher_id: metaObj.teacher_id || null,
    adviser_name: metaObj.adviser_name || null,
    cdc_name: metaObj.cdc_name || null,
    child_age: metaObj.child_age || '3-3.11',
    registration_code: metaObj.registration_code || null,
    ...(metaObj.eccd_assessment ? { eccd_assessment: metaObj.eccd_assessment } : {}),
  };
  return `${baseContact} ||META:${JSON.stringify(payload)}`.trim();
}

/**
 * Unpacks a row from Supabase `learners` (or local storage), extracting any embedded `||META:` JSON
 * and returning a clean learner object with `approval_status`, `parent_contact`, `adviser_name`, etc.
 */
export function unpackLearnerRow(row) {
  if (!row) return null;
  const rawContact = String(row.parent_contact || '');
  let cleanContact = rawContact;
  let meta = {};

  const marker = '||META:';
  const idx = rawContact.indexOf(marker);
  if (idx !== -1) {
    cleanContact = rawContact.slice(0, idx).trim();
    const jsonPart = rawContact.slice(idx + marker.length).trim();
    try {
      meta = JSON.parse(jsonPart) || {};
    } catch {
      meta = {};
    }
  }

  const approvalStatus =
    row.approval_status ||
    meta.status ||
    meta.approval_status ||
    'approved';

  const barangay = row.barangay || meta.barangay || '';
  const cdcName =
    row.cdc_name ||
    meta.cdc_name ||
    (barangay ? `${barangay} Child Development Center` : '');

  const rawAge = row.child_age || meta.child_age || (row.birthdate?.includes('4') || row.birthdate?.includes('5') ? '4-4.11' : '3-3.11');
  const normalizedAgeCode =
    String(rawAge).includes('4-4.11') || String(rawAge).includes('5-6') ? '4-4.11' : '3-3.11';

  return {
    ...row,
    full_name: cleanStudentName(row.full_name),
    parent_contact: cleanContact,
    approval_status: approvalStatus,
    status:
      approvalStatus === 'pending'
        ? 'Pending Teacher Approval'
        : approvalStatus === 'rejected'
          ? 'Registration Declined'
          : 'Enrolled & Approved',
    teacher_id: row.teacher_id || meta.teacher_id || null,
    adviser_name: row.adviser_name || meta.adviser_name || '',
    cdc_name: cdcName,
    child_age: normalizedAgeCode,
    birthdate:
      row.birthdate && /^\d{4}-\d{2}-\d{2}$/.test(String(row.birthdate))
        ? row.birthdate
        : formatLearnerAgeLabel(normalizedAgeCode),
    registration_code: row.registration_code || meta.registration_code || null,
    eccd_assessment: row.eccd_assessment || meta.eccd_assessment || null,
  };
}

/**
 * Returns a synchronous list of teachers for a specific barangay based on MSWDO baseline records.
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
        ...dbTeachers.map((t) => {
          const { contactNumber, registrationCode } = parseTeacherContactAndCode(t.contact_number);
          return {
            ...t,
            contact_number: contactNumber,
            registration_code: registrationCode || buildDefaultTeacherCode(t),
            cdc_name: t.cdcs?.name || `${barangay} Child Development Center`,
          };
        }),
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
 * Retrieves cached learners stored locally (used only as instant cache; Supabase is primary).
 */
export function getStoredLearners() {
  try {
    const raw = localStorage.getItem(REGISTERED_LEARNERS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed) ? parsed : [];
    const seenNames = new Set();
    const filtered = [];
    list.forEach((l) => {
      if (!l) return;
      const unpacked = unpackLearnerRow(l);
      const cleaned = cleanStudentName(unpacked.full_name);
      const norm = cleaned.toLowerCase();
      if (!norm || isPlaceholderStudentName(cleaned) || unpacked.id === 'lrn-real-001') return;
      if (!seenNames.has(norm)) {
        seenNames.add(norm);
        filtered.push({ ...unpacked, full_name: cleaned });
      }
    });
    return filtered;
  } catch {
    return [];
  }
}

/**
 * Saves or updates a learner record directly in Supabase `learners` (and updates local cache).
 */
export async function recordRegisteredLearner(learnerData) {
  if (!learnerData || !learnerData.full_name) return null;

  const cleanedFullName = cleanStudentName(learnerData.full_name);
  if (isPlaceholderStudentName(cleanedFullName)) return null;

  const unpackedInput = unpackLearnerRow(learnerData);
  const approvalStatus = learnerData.approval_status || unpackedInput.approval_status || 'approved';

  const record = {
    id: learnerData.id || `lrn-${Date.now()}`,
    full_name: cleanedFullName,
    birthdate:
      learnerData.birthdate && /^\d{4}-\d{2}-\d{2}$/.test(String(learnerData.birthdate))
        ? learnerData.birthdate
        : formatLearnerAgeLabel(learnerData.child_age || unpackedInput.child_age || '3-3.11'),
    child_age: learnerData.child_age || unpackedInput.child_age || '3-3.11',
    barangay: learnerData.barangay || '',
    parent_name: (learnerData.parent_name || '').trim(),
    parent_contact: unpackedInput.parent_contact || '',
    adviser_name: (learnerData.adviser_name || unpackedInput.adviser_name || '').trim(),
    teacher_id: learnerData.teacher_id || unpackedInput.teacher_id || null,
    cdc_name:
      learnerData.cdc_name ||
      unpackedInput.cdc_name ||
      (learnerData.barangay ? `${learnerData.barangay} Child Development Center` : ''),
    cdc_id: isValidUuid(learnerData.cdc_id) ? learnerData.cdc_id : null,
    approval_status: approvalStatus,
    registration_code: learnerData.registration_code || unpackedInput.registration_code || null,
    status:
      approvalStatus === 'pending'
        ? 'Pending Teacher Approval'
        : approvalStatus === 'rejected'
          ? 'Registration Declined'
          : 'Enrolled & Approved',
    last_login: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // 1. Primary persistence: Save directly to Supabase `learners` table
  try {
    const packedContact = packLearnerContactMeta(record.parent_contact, {
      approval_status: record.approval_status,
      teacher_id: record.teacher_id,
      adviser_name: record.adviser_name,
      cdc_name: record.cdc_name,
      child_age: record.child_age,
      registration_code: record.registration_code,
    });

    const isDateIso = /^\d{4}-\d{2}-\d{2}$/.test(String(record.birthdate || ''));
    const sbPayload = {
      full_name: record.full_name,
      birthdate: isDateIso ? record.birthdate : null,
      barangay: record.barangay || null,
      cdc_id: isValidUuid(record.cdc_id) ? record.cdc_id : null,
      parent_name: record.parent_name || null,
      parent_contact: packedContact,
    };

    if (isValidUuid(record.id)) {
      sbPayload.id = record.id;
      const { error: sbErr } = await supabase.from('learners').upsert(sbPayload);
      if (sbErr) {
        console.warn('Supabase learners upsert by id note:', sbErr.message);
      }
    } else {
      // Check if learner with same full_name already exists in Supabase
      const { data: existingRows } = await supabase
        .from('learners')
        .select('id')
        .ilike('full_name', record.full_name)
        .limit(1);

      if (existingRows && existingRows.length > 0) {
        record.id = existingRows[0].id;
        await supabase.from('learners').update(sbPayload).eq('id', record.id);
      } else {
        const { data: inserted } = await supabase
          .from('learners')
          .insert(sbPayload)
          .select('id')
          .single();
        if (inserted?.id) record.id = inserted.id;
      }
    }
  } catch (err) {
    console.warn('Failed syncing learner to Supabase:', err);
  }

  // 2. Update local cache for instant UI responsiveness
  try {
    const current = getStoredLearners();
    const normalizedName = cleanedFullName.toLowerCase();
    const existingIndex = current.findIndex((item) => {
      if (record.id && item.id === record.id) return true;
      return cleanStudentName(item.full_name).toLowerCase() === normalizedName;
    });

    if (existingIndex >= 0) {
      // If Supabase or existing cache already had an explicit approval status and caller didn't override it
      current[existingIndex] = {
        ...current[existingIndex],
        ...record,
        created_at: current[existingIndex].created_at || new Date().toISOString(),
      };
    } else {
      record.created_at = new Date().toISOString();
      current.push(record);
    }

    localStorage.setItem(REGISTERED_LEARNERS_STORAGE_KEY, JSON.stringify(current));
    if (record.id) {
      localStorage.setItem(
        `earlylearn_student_adviser_${record.id}`,
        JSON.stringify({
          adviser_name: record.adviser_name,
          cdc_name: record.cdc_name,
          barangay: record.barangay,
          approval_status: record.approval_status,
        })
      );
    }
    window.dispatchEvent(new CustomEvent('earlylearn_learners_updated', { detail: record }));
  } catch (err) {
    console.warn('Failed saving learner cache:', err);
  }

  return record;
}

/**
 * Checks a student/parent account's current teacher approval status directly from Supabase
 * (`learners` and `profiles`) so changes made by a teacher on another device take effect immediately.
 */
export async function getStudentApprovalStatus(user, profile) {
  const userId = user?.id || profile?.id;
  const meta = user?.user_metadata || profile?.user_metadata || {};
  const rawName =
    meta.child_name ||
    profile?.child_name ||
    profile?.full_name ||
    meta.full_name ||
    '';
  const childName = cleanStudentName(rawName);

  // 1. Check Supabase `learners` table by UUID first, then by child's full_name
  try {
    let learnerRow = null;
    if (isValidUuid(userId)) {
      const { data } = await supabase
        .from('learners')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      if (data) learnerRow = data;
    }

    if (!learnerRow && childName) {
      const { data: byName } = await supabase
        .from('learners')
        .select('*')
        .ilike('full_name', childName)
        .limit(1);
      if (byName && byName.length > 0) learnerRow = byName[0];
    }

    if (learnerRow) {
      const unpacked = unpackLearnerRow(learnerRow);
      return {
        approval_status: unpacked.approval_status || 'approved',
        adviser_name: unpacked.adviser_name || meta.adviser_name || '',
        cdc_name: unpacked.cdc_name || meta.cdc_name || '',
        barangay: unpacked.barangay || profile?.barangay || meta.barangay || '',
        learner: unpacked,
      };
    }
  } catch (err) {
    console.warn('Error checking student approval in Supabase learners:', err);
  }

  // 2. Check Supabase `profiles.contact_number` if status was encoded there
  try {
    if (isValidUuid(userId)) {
      const { data: profData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      if (profData?.contact_number && profData.contact_number.includes('||META:')) {
        const unpackedProf = unpackLearnerRow({
          full_name: profData.full_name,
          barangay: profData.barangay,
          cdc_name: profData.cdc_name,
          parent_contact: profData.contact_number,
        });
        return {
          approval_status: unpackedProf.approval_status || 'approved',
          adviser_name: unpackedProf.adviser_name || meta.adviser_name || '',
          cdc_name: profData.cdc_name || unpackedProf.cdc_name || '',
          barangay: profData.barangay || '',
          learner: unpackedProf,
        };
      }
    }
  } catch {
    // ignore
  }

  // 3. Fallback to user_metadata.approval_status (defaulting to 'approved' for legacy accounts)
  const fallbackStatus = meta.approval_status || 'approved';
  return {
    approval_status: fallbackStatus,
    adviser_name: meta.adviser_name || meta.teacher_name || '',
    cdc_name: profile?.cdc_name || meta.cdc_name || '',
    barangay: profile?.barangay || meta.barangay || '',
    learner: null,
  };
}

/**
 * Updates a parent/learner's approval status ('approved' | 'rejected' | 'pending') directly in Supabase
 * (`learners` and `profiles`) so the parent can log in from any device once approved.
 */
export async function updateParentApprovalStatus(learner, newStatus = 'approved') {
  if (!learner) return null;
  const unpacked = unpackLearnerRow(learner);
  const updatedMeta = {
    approval_status: newStatus,
    teacher_id: unpacked.teacher_id || null,
    adviser_name: unpacked.adviser_name || null,
    cdc_name: unpacked.cdc_name || null,
    child_age: unpacked.child_age || '3-4',
    registration_code: unpacked.registration_code || null,
  };
  const packedContact = packLearnerContactMeta(unpacked.parent_contact, updatedMeta);

  // 1. Update in Supabase `learners`
  try {
    if (isValidUuid(unpacked.id)) {
      await supabase
        .from('learners')
        .update({ parent_contact: packedContact })
        .eq('id', unpacked.id);
    } else if (unpacked.full_name) {
      await supabase
        .from('learners')
        .update({ parent_contact: packedContact })
        .ilike('full_name', unpacked.full_name);
    }
  } catch (err) {
    console.warn('Error updating learner approval in Supabase learners:', err);
  }

  // 2. Also update `profiles.contact_number` if `unpacked.id` is a user UUID
  try {
    if (isValidUuid(unpacked.id)) {
      await supabase
        .from('profiles')
        .update({ contact_number: packedContact })
        .eq('id', unpacked.id);
    }
  } catch {
    // ignore
  }

  // 3. Sync via recordRegisteredLearner
  return recordRegisteredLearner({
    ...unpacked,
    approval_status: newStatus,
  });
}

/**
 * Allows a Teacher to directly create a Parent & Learner account from the Teacher Dashboard
 * without logging out the teacher. Accounts created directly by the teacher are pre-approved.
 */
export async function createParentAccountByTeacher({
  parentName,
  childName,
  childAge = '3-3.11',
  identifier,
  password,
  teacherId,
  teacherName,
  barangay,
  cdcName,
  cdcId,
  registrationCode,
}) {
  const { authEmail, display } = normalizeAuthIdentifier(identifier);
  if (!authEmail) {
    throw new Error('Please provide a valid mobile phone number or email address.');
  }

  const cleanChild = cleanStudentName(childName);
  const cleanParent = (parentName || '').trim();
  const effectiveCdcName = cdcName || (barangay ? `${barangay} Child Development Center` : '');

  // Use secondary non-persisting auth client so the Teacher stays logged in
  const { data: authData, error: authErr } = await supabaseSecondaryAuth.auth.signUp({
    email: authEmail,
    password,
    options: {
      data: {
        full_name: cleanChild,
        parent_name: cleanParent,
        child_name: cleanChild,
        child_age: childAge,
        role: 'student',
        barangay,
        cdc_name: effectiveCdcName,
        cdc_id: isValidUuid(cdcId) ? cdcId : null,
        teacher_id: teacherId || null,
        adviser_name: teacherName || null,
        teacher_name: teacherName || null,
        contact_number: display,
        registration_code: registrationCode || null,
        approval_status: 'approved',
      },
    },
  });

  if (authErr) {
    throw new Error(authErr.message);
  }

  const createdUserId = authData?.user?.id;
  const packedContact = packLearnerContactMeta(display, {
    approval_status: 'approved',
    teacher_id: teacherId || null,
    adviser_name: teacherName || null,
    cdc_name: effectiveCdcName,
    child_age: childAge,
    registration_code: registrationCode || null,
  });

  if (createdUserId) {
    try {
      await supabase.from('profiles').upsert({
        id: createdUserId,
        full_name: cleanChild,
        role: 'student',
        barangay: barangay || null,
        cdc_name: effectiveCdcName || null,
        contact_number: packedContact,
      });
    } catch (err) {
      console.warn('Profile upsert note:', err);
    }
  }

  const learnerRecord = await recordRegisteredLearner({
    id: createdUserId,
    full_name: cleanChild,
    birthdate: formatLearnerAgeLabel(childAge),
    child_age: childAge,
    barangay,
    parent_name: cleanParent,
    parent_contact: display,
    adviser_name: teacherName,
    teacher_id: teacherId,
    cdc_name: effectiveCdcName,
    cdc_id: isValidUuid(cdcId) ? cdcId : null,
    registration_code: registrationCode || null,
    approval_status: 'approved',
  });

  return {
    user: authData?.user,
    learner: learnerRecord,
    credentials: {
      parentName: cleanParent,
      childName: cleanChild,
      identifier: display,
      authEmail,
      password,
      barangay,
      cdcName: effectiveCdcName,
      teacherName,
    },
  };
}

/**
 * Synchronizes student registration and login into the teacher's jurisdiction.
 * Preserves existing approval_status in Supabase so a pending account is never accidentally auto-approved.
 */
export async function syncStudentLogin(user, profile) {
  if (!user && !profile) return null;

  const metadata = user?.user_metadata || profile?.user_metadata || {};
  const userId = user?.id || profile?.id;

  // Check current status in Supabase first so we preserve teacher approval state
  const existingCheck = await getStudentApprovalStatus(user, profile);
  const currentApprovalStatus =
    existingCheck?.learner?.approval_status ||
    metadata.approval_status ||
    'approved';

  let childName = metadata.child_name || '';
  if (!childName) {
    const fullName = profile?.full_name || metadata.full_name || user?.email?.split('@')[0] || '';
    childName = cleanStudentName(fullName);
  }

  let parentName = metadata.parent_name || existingCheck?.learner?.parent_name || '';
  if (!parentName) {
    const fullName = profile?.full_name || metadata.full_name || '';
    if (fullName.includes('(Parent:')) {
      const match = fullName.match(/\(Parent:\s*([^)]+)\)/);
      if (match && match[1]) parentName = match[1].trim();
    }
  }

  const barangay =
    profile?.barangay ||
    metadata.barangay ||
    existingCheck?.barangay ||
    '';

  let adviserName =
    existingCheck?.adviser_name ||
    metadata.adviser_name ||
    metadata.teacher_name ||
    profile?.adviser_name ||
    '';

  let cdcName =
    existingCheck?.cdc_name ||
    metadata.cdc_name ||
    profile?.cdc_name ||
    '';

  let cdcId = metadata.cdc_id || existingCheck?.learner?.cdc_id || null;
  let teacherId = metadata.teacher_id || existingCheck?.learner?.teacher_id || null;

  if (!adviserName && barangay) {
    const defaultTch = getDefaultTeacherForBarangay(barangay);
    if (defaultTch) {
      adviserName = defaultTch.full_name;
      teacherId = defaultTch.id;
      cdcName = defaultTch.cdc_name || `${barangay} Child Development Center`;
    }
  }

  const rawContact =
    existingCheck?.learner?.parent_contact ||
    metadata.contact_number ||
    metadata.email_or_phone ||
    metadata.email ||
    user?.email ||
    '';

  return recordRegisteredLearner({
    id: userId,
    full_name: childName,
    birthdate: formatLearnerAgeLabel(metadata.child_age || existingCheck?.learner?.child_age || '3-3.11'),
    child_age: metadata.child_age || existingCheck?.learner?.child_age || '3-3.11',
    barangay,
    parent_name: parentName,
    parent_contact: rawContact,
    adviser_name: adviserName,
    teacher_id: teacherId,
    cdc_name: cdcName || (barangay ? `${barangay} Child Development Center` : ''),
    cdc_id: cdcId,
    registration_code: metadata.registration_code || existingCheck?.learner?.registration_code || null,
    approval_status: currentApprovalStatus,
  });
}

/**
 * Returns all learners that belong to a specific teacher's barangay, CDC, or direct advisership.
 * Queries Supabase `learners` and `profiles` first so cross-device registrations appear immediately.
 */
export async function getLearnersForTeacher({ teacherId, teacherName, barangay, cdcName, cdcId }) {
  const normBarangay = (barangay || '').trim().toLowerCase();
  const normTeacherName = (teacherName || '').replace(/\s*\(.*?\)\s*/g, '').trim().toLowerCase();
  const normCdcName = (cdcName || '').trim().toLowerCase();
  const strTeacherId = teacherId ? String(teacherId).trim() : '';

  // 1. Gather from Supabase `learners` table (Primary cross-device source of truth)
  let dbLearners = [];
  try {
    const { data: allLearners, error } = await supabase
      .from('learners')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(allLearners)) {
      dbLearners = allLearners.map((row) => unpackLearnerRow(row)).filter(Boolean);
    }
  } catch {
    // Ignore fetch error
  }

  // 2. Also check Supabase `profiles` where role = 'student' in case a profile was created
  let profileLearners = [];
  try {
    const { data: studentProfiles } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'student');

    if (Array.isArray(studentProfiles)) {
      profileLearners = studentProfiles
        .map((p) =>
          unpackLearnerRow({
            id: p.id,
            full_name: p.full_name,
            barangay: p.barangay,
            cdc_name: p.cdc_name,
            parent_contact: p.contact_number || '',
            created_at: p.created_at,
          })
        )
        .filter(Boolean);
    }
  } catch {
    // Ignore
  }

  // 3. Gather from local cache & baseline learners
  const stored = getStoredLearners();
  const baseline = (baselineLearners || []).map((l) =>
    unpackLearnerRow({
      ...l,
      cdc_name: l.cdc_name || `${l.barangay} Child Development Center`,
      approval_status: 'approved',
    })
  );

  // Prioritize Supabase `dbLearners` first, then `profileLearners`, then `stored`, then `baseline`
  const combined = [...dbLearners, ...profileLearners, ...stored, ...baseline];

  const seenKeys = new Set();
  const results = [];

  for (const learner of combined) {
    if (!learner || !learner.full_name) continue;

    const cleanedName = cleanStudentName(learner.full_name);
    if (!cleanedName || isPlaceholderStudentName(cleanedName)) continue;

    const lName = cleanedName.toLowerCase();
    const lBarangay = (learner.barangay || '').trim().toLowerCase();
    const lAdviser = (learner.adviser_name || '').replace(/\s*\(.*?\)\s*/g, '').trim().toLowerCase();
    const lCdc = (learner.cdc_name || '').trim().toLowerCase();
    const lTeacherId = learner.teacher_id ? String(learner.teacher_id).trim() : '';

    // Direct teacher ID link
    const matchesTeacherId = Boolean(strTeacherId && lTeacherId && lTeacherId === strTeacherId);

    // Name matching
    const matchesAdviser = Boolean(
      normTeacherName &&
      lAdviser &&
      (lAdviser === normTeacherName ||
        lAdviser.includes(normTeacherName) ||
        normTeacherName.includes(lAdviser))
    );

    // Barangay matching
    const matchesBarangay = Boolean(normBarangay && lBarangay === normBarangay);

    // CDC matching
    const matchesCdc = Boolean(
      (cdcId && learner.cdc_id && String(learner.cdc_id) === String(cdcId)) ||
      (normCdcName && lCdc && lCdc === normCdcName)
    );

    if (matchesTeacherId || matchesAdviser || matchesBarangay || matchesCdc) {
      const dedupKey = lName;
      if (!seenKeys.has(dedupKey)) {
        seenKeys.add(dedupKey);
        results.push({
          ...learner,
          full_name: cleanedName,
        });
      }
    }
  }

  results.sort((a, b) => {
    // Show pending approvals at the top so teachers notice them immediately
    if (a.approval_status === 'pending' && b.approval_status !== 'pending') return -1;
    if (a.approval_status !== 'pending' && b.approval_status === 'pending') return 1;
    return (a.full_name || '').localeCompare(b.full_name || '');
  });
  return results;
}

// ============================================================================
// OBJECTIVE 6: CHILD DEVELOPMENT ASSESSMENT & PROGRESS TRACKING (SUPABASE SYNC)
// ============================================================================
const ECCD_ASSESSMENTS_STORAGE_KEY = 'earlylearn_teacher_eccd_assessments';

/**
 * Normalizes a raw ECCD assessment row (from `eccd_assessments`, `materials` sync bridge, or localStorage)
 * into a consistent assessment object.
 */
export function normalizeEccdAssessmentRecord(raw) {
  if (!raw) return null;
  const childName = cleanStudentName(raw.child_name || '');
  if (!childName || isPlaceholderStudentName(childName)) return null;

  const parsedAge = parseInt(String(raw.age ?? '3').replace(/[^0-9]/g, ''), 10);
  const ageNum = Number.isFinite(parsedAge) && parsedAge > 0 ? parsedAge : 3;

  return {
    id: raw.id || `ass-${Date.now()}`,
    child_id: raw.child_id ? String(raw.child_id).trim() : '',
    child_name: childName,
    age: ageNum,
    level: raw.level || (ageNum >= 4 ? 'PRE-K 2' : 'PRE-K 1'),
    barangay: raw.barangay || '',
    cdc_name: raw.cdc_name || (raw.barangay ? `${raw.barangay} Child Development Center` : ''),
    teacher_id: raw.teacher_id || null,
    teacher_name: raw.teacher_name || 'Child Development Teacher',
    date: raw.date || raw.assessment_date || new Date().toISOString().split('T')[0],
    assessment_date: raw.assessment_date || raw.date || new Date().toISOString().split('T')[0],
    cognitive_status: raw.cognitive_status || 'Developing as Expected',
    physical_status: raw.physical_status || 'Developing as Expected',
    social_status: raw.social_status || 'Developing as Expected',
    language_status: raw.language_status || 'Developing as Expected',
    overall_status: raw.overall_status || 'Developing as Expected',
    observations: raw.observations || '',
    recommendation: raw.recommendation || '',
    mswd_verified: Boolean(raw.mswd_verified),
    updated_at: raw.updated_at || raw.created_at || new Date().toISOString(),
  };
}

/**
 * Reads cached ECCD assessments from browser localStorage (used as offline cache & migration source).
 */
export function getLocalCachedEccdAssessments() {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(ECCD_ASSESSMENTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeEccdAssessmentRecord).filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Deduplicates a list of ECCD assessments (1 latest assessment per child_id / child_name).
 */
export function deduplicateEccdAssessments(list = []) {
  const byChildKey = new Map();
  for (const item of list) {
    const norm = normalizeEccdAssessmentRecord(item);
    if (!norm) continue;
    const nameKey = norm.child_name.toLowerCase();
    const idKey = norm.child_id ? `id:${norm.child_id}` : null;
    const existing = (idKey && byChildKey.get(idKey)) || byChildKey.get(nameKey);

    if (!existing) {
      byChildKey.set(nameKey, norm);
      if (idKey) byChildKey.set(idKey, norm);
    } else {
      const existingTime = Date.parse(existing.updated_at || existing.date || '') || 0;
      const newTime = Date.parse(norm.updated_at || norm.date || '') || 0;
      if (newTime >= existingTime) {
        const merged = {
          ...existing,
          ...norm,
          child_id: norm.child_id || existing.child_id || '',
        };
        byChildKey.set(nameKey, merged);
        if (merged.child_id) byChildKey.set(`id:${merged.child_id}`, merged);
      }
    }
  }

  const unique = [];
  const seenNames = new Set();
  for (const val of byChildKey.values()) {
    const nk = val.child_name.toLowerCase();
    if (!seenNames.has(nk)) {
      seenNames.add(nk);
      unique.push(val);
    }
  }
  return unique;
}

/**
 * Verifies that a teacher is authorized to manage assessments for a specific learner.
 * Ensures teachers can only manage assessments for their assigned learners.
 */
export function canTeacherManageLearnerAssessment(
  learnerOrRecord,
  teacherProfile,
  assignedLearners = [],
  teacherBarangay = '',
  cdcName = ''
) {
  if (!learnerOrRecord || !teacherProfile) return false;
  const role = (teacherProfile.role || '').toLowerCase();
  if (role === 'admin' || role === 'superadmin') return true;

  const targetId = String(learnerOrRecord.child_id || learnerOrRecord.id || '').trim();
  const targetName = cleanStudentName(
    learnerOrRecord.child_name || learnerOrRecord.full_name || ''
  ).toLowerCase();

  // 1. If the teacher's assigned learners roster is provided, check membership first
  if (Array.isArray(assignedLearners) && assignedLearners.length > 0) {
    const inAssignedRoster = assignedLearners.some((l) => {
      const lId = String(l.id || l.profile_id || '').trim();
      const lName = cleanStudentName(l.full_name || '').toLowerCase();
      return (targetId && lId && targetId === lId) || (targetName && lName && targetName === lName);
    });
    if (inAssignedRoster) return true;
  }

  // 2. Check direct teacher_id / adviser_name / barangay / CDC match on the learner/record itself
  const myId = String(teacherProfile.id || '').trim();
  const myName = cleanStudentName(teacherProfile.full_name || '')
    .replace(/^Teacher\s+/i, '')
    .toLowerCase();
  const myBrgy = (teacherBarangay || teacherProfile.barangay || '').trim().toLowerCase();
  const myCdc = (cdcName || teacherProfile.cdc_name || '').trim().toLowerCase();

  const recTeacherId = String(learnerOrRecord.teacher_id || '').trim();
  const recTeacherName = cleanStudentName(
    learnerOrRecord.teacher_name || learnerOrRecord.adviser_name || ''
  )
    .replace(/^Teacher\s+/i, '')
    .toLowerCase();
  const recBrgy = (learnerOrRecord.barangay || '').trim().toLowerCase();
  const recCdc = (learnerOrRecord.cdc_name || '').trim().toLowerCase();

  // If the learner/record explicitly specifies a different barangay or CDC, deny access
  if (recBrgy && myBrgy && recBrgy !== myBrgy) {
    return false;
  }
  if (recCdc && myCdc && recCdc !== myCdc) {
    return false;
  }

  if (myId && recTeacherId && myId === recTeacherId) return true;
  if (myName && recTeacherName && (myName.includes(recTeacherName) || recTeacherName.includes(myName))) {
    return true;
  }
  if (myCdc && recCdc && myCdc === recCdc) return true;
  if (myBrgy && recBrgy && myBrgy === recBrgy) return true;

  return false;
}

/**
 * Helper to persist a single normalized assessment record into Supabase (`eccd_assessments` primary table,
 * plus `learners` metadata and `materials` sync bridge if the dedicated table is not yet created).
 */
async function upsertSingleAssessmentInSupabase(normRecord) {
  let savedRecord = { ...normRecord };
  let savedToDedicatedTable = false;

  // 1. Primary: Try `public.eccd_assessments` table
  try {
    const dbPayload = {
      child_id: normRecord.child_id ? String(normRecord.child_id) : null,
      child_name: normRecord.child_name,
      age: Number(normRecord.age) || 3,
      level: normRecord.level || 'PRE-K 1',
      barangay: normRecord.barangay || null,
      cdc_name: normRecord.cdc_name || null,
      teacher_id: isValidUuid(normRecord.teacher_id) ? normRecord.teacher_id : null,
      teacher_name: normRecord.teacher_name || null,
      assessment_date: normRecord.date,
      cognitive_status: normRecord.cognitive_status,
      physical_status: normRecord.physical_status,
      social_status: normRecord.social_status,
      language_status: normRecord.language_status,
      overall_status: normRecord.overall_status,
      observations: normRecord.observations || '',
      recommendation: normRecord.recommendation || '',
      mswd_verified: Boolean(normRecord.mswd_verified),
      updated_at: normRecord.updated_at || new Date().toISOString(),
    };

    // Check if an assessment already exists for this child in `eccd_assessments`
    let existingRowId = isValidUuid(normRecord.id) ? normRecord.id : null;
    if (!existingRowId) {
      const { data: existingRows, error: findErr } = await supabase
        .from('eccd_assessments')
        .select('id, child_id, child_name')
        .ilike('child_name', normRecord.child_name)
        .limit(5);

      if (!findErr && Array.isArray(existingRows) && existingRows.length > 0) {
        const exact =
          existingRows.find(
            (r) =>
              (normRecord.child_id && String(r.child_id) === String(normRecord.child_id)) ||
              cleanStudentName(r.child_name).toLowerCase() === normRecord.child_name.toLowerCase()
          ) || existingRows[0];
        if (exact?.id) existingRowId = exact.id;
      }
    }

    if (existingRowId) {
      const { data: updated, error: updErr } = await supabase
        .from('eccd_assessments')
        .update(dbPayload)
        .eq('id', existingRowId)
        .select()
        .single();
      if (!updErr && updated) {
        savedRecord = normalizeEccdAssessmentRecord({ ...normRecord, ...updated, date: updated.assessment_date });
        savedToDedicatedTable = true;
      }
    }

    if (!savedToDedicatedTable) {
      const { data: inserted, error: insErr } = await supabase
        .from('eccd_assessments')
        .insert(dbPayload)
        .select()
        .single();
      if (!insErr && inserted) {
        savedRecord = normalizeEccdAssessmentRecord({ ...normRecord, ...inserted, date: inserted.assessment_date });
        savedToDedicatedTable = true;
      }
    }
  } catch {
    // Fallback below if `eccd_assessments` table is not yet created in Supabase
  }

  // 2. Sync into `public.learners` row metadata so cross-device retrieval works in all environments
  try {
    const { data: existingLearnerRows } = await supabase
      .from('learners')
      .select('*')
      .ilike('full_name', normRecord.child_name)
      .limit(1);

    if (Array.isArray(existingLearnerRows) && existingLearnerRows.length > 0) {
      const row = existingLearnerRows[0];
      const unpacked = unpackLearnerRow(row);
      const updatedPackedContact = packLearnerContactMeta(unpacked.parent_contact, {
        approval_status: unpacked.approval_status || 'approved',
        teacher_id: unpacked.teacher_id || normRecord.teacher_id || null,
        adviser_name: unpacked.adviser_name || normRecord.teacher_name || null,
        cdc_name: unpacked.cdc_name || normRecord.cdc_name || null,
        child_age: unpacked.child_age || (normRecord.level?.includes('2') ? '4-4.11' : '3-3.11'),
        registration_code: unpacked.registration_code || null,
        eccd_assessment: savedRecord,
      });
      await supabase
        .from('learners')
        .update({ parent_contact: updatedPackedContact })
        .eq('id', row.id);
    } else {
      const packedContact = packLearnerContactMeta('', {
        approval_status: 'approved',
        teacher_id: normRecord.teacher_id || null,
        adviser_name: normRecord.teacher_name || null,
        cdc_name: normRecord.cdc_name || null,
        child_age: normRecord.level?.includes('2') ? '4-4.11' : '3-3.11',
        eccd_assessment: savedRecord,
      });
      const insertPayload = {
        full_name: normRecord.child_name,
        barangay: normRecord.barangay || null,
        parent_contact: packedContact,
      };
      if (isValidUuid(normRecord.child_id)) {
        insertPayload.id = normRecord.child_id;
      }
      await supabase.from('learners').upsert(insertPayload);
    }
  } catch {
    // Ignore learners sync note
  }

  // 3. Cross-Device Sync Bridge via `public.materials` (`[ECCD_ASSESSMENT] <child_name>`)
  try {
    const syncTitle = `[ECCD_ASSESSMENT] ${normRecord.child_name}`;
    const payloadJson = JSON.stringify({
      __eccd_assessment: true,
      ...savedRecord,
    });

    const { data: existingMat } = await supabase
      .from('materials')
      .select('id, title')
      .ilike('title', syncTitle)
      .limit(1);

    if (Array.isArray(existingMat) && existingMat.length > 0 && existingMat[0]?.id) {
      await supabase
        .from('materials')
        .update({
          title: syncTitle,
          content_text: payloadJson,
          status: 'approved',
        })
        .eq('id', existingMat[0].id);
      if (!savedToDedicatedTable) {
        savedRecord.id = existingMat[0].id;
      }
    } else {
      let catId = null;
      const { data: cats } = await supabase.from('categories').select('id').limit(1);
      if (Array.isArray(cats) && cats.length > 0) catId = cats[0].id;

      const { data: insertedMat } = await supabase
        .from('materials')
        .insert({
          category_id: catId,
          type: 'story',
          title: syncTitle,
          age_range: normRecord.level?.includes('2') ? '4-5' : '3-4',
          content_text: payloadJson,
          created_by: isValidUuid(normRecord.teacher_id) ? normRecord.teacher_id : null,
          status: 'approved',
        })
        .select('id')
        .single();

      if (insertedMat?.id && !savedToDedicatedTable) {
        savedRecord.id = insertedMat.id;
      }
    }
  } catch {
    // Ignore fallback error
  }

  return savedRecord;
}

/**
 * Fetches all accessible ECCD assessments from Supabase (`eccd_assessments` + `learners` + `materials` sync bridge),
 * automatically migrating any unsynced browser `localStorage` assessments to Supabase.
 */
export async function fetchEccdAssessmentsFromSupabase({ migrateLocal = true } = {}) {
  const fromDedicatedTable = [];
  const fromLearnersMeta = [];
  const fromMaterialsBridge = [];

  // 1. Query `public.eccd_assessments`
  try {
    const { data, error } = await supabase
      .from('eccd_assessments')
      .select('*')
      .order('updated_at', { ascending: false });

    if (!error && Array.isArray(data)) {
      data.forEach((row) => {
        const norm = normalizeEccdAssessmentRecord({
          ...row,
          date: row.assessment_date || row.date,
        });
        if (norm) fromDedicatedTable.push(norm);
      });
    }
  } catch {
    // Table may not exist yet
  }

  // 2. Query `public.learners` for embedded `eccd_assessment` metadata
  try {
    const { data: learnerRows, error: lErr } = await supabase
      .from('learners')
      .select('*')
      .order('created_at', { ascending: false });

    if (!lErr && Array.isArray(learnerRows)) {
      learnerRows.forEach((row) => {
        const unpacked = unpackLearnerRow(row);
        if (unpacked?.eccd_assessment) {
          const norm = normalizeEccdAssessmentRecord({
            ...unpacked.eccd_assessment,
            child_id: unpacked.eccd_assessment.child_id || unpacked.id,
            child_name: unpacked.eccd_assessment.child_name || unpacked.full_name,
            barangay: unpacked.eccd_assessment.barangay || unpacked.barangay,
            cdc_name: unpacked.eccd_assessment.cdc_name || unpacked.cdc_name,
          });
          if (norm) fromLearnersMeta.push(norm);
        }
      });
    }
  } catch {
    // Ignore
  }

  // 3. Query `public.materials` `[ECCD_ASSESSMENT]%` bridge
  try {
    const { data: matRows, error: matErr } = await supabase
      .from('materials')
      .select('id, title, content_text, created_by, created_at')
      .ilike('title', '[ECCD_ASSESSMENT]%')
      .order('created_at', { ascending: false });

    if (!matErr && Array.isArray(matRows)) {
      matRows.forEach((m) => {
        if (!m.content_text || !m.content_text.trim().startsWith('{')) return;
        try {
          const parsed = JSON.parse(m.content_text);
          if (parsed && (parsed.__eccd_assessment || parsed.child_name)) {
            const norm = normalizeEccdAssessmentRecord({
              ...parsed,
              id: parsed.id || m.id,
              teacher_id: parsed.teacher_id || m.created_by || null,
              updated_at: parsed.updated_at || m.created_at,
            });
            if (norm) fromMaterialsBridge.push(norm);
          }
        } catch {
          // ignore malformed JSON
        }
      });
    }
  } catch {
    // Ignore
  }

  // 4. Read local cached assessments & migrate any unsynced records to Supabase
  const localRecords = getLocalCachedEccdAssessments();
  const remoteMerged = deduplicateEccdAssessments([
    ...fromDedicatedTable,
    ...fromLearnersMeta,
    ...fromMaterialsBridge,
  ]);

  if (migrateLocal && localRecords.length > 0) {
    const remoteKeys = new Set(
      remoteMerged.flatMap((r) => [
        r.child_name.toLowerCase(),
        r.child_id ? `id:${r.child_id}` : '',
      ])
    );

    const unsyncedLocal = localRecords.filter(
      (loc) =>
        !remoteKeys.has(loc.child_name.toLowerCase()) &&
        (!loc.child_id || !remoteKeys.has(`id:${loc.child_id}`))
    );

    if (unsyncedLocal.length > 0) {
      for (const loc of unsyncedLocal) {
        try {
          await upsertSingleAssessmentInSupabase(loc);
        } catch {
          // ignore
        }
      }
    }
  }

  const combined = deduplicateEccdAssessments([
    ...fromDedicatedTable,
    ...fromLearnersMeta,
    ...fromMaterialsBridge,
    ...localRecords,
  ]);

  try {
    if (typeof localStorage !== 'undefined' && combined.length > 0) {
      localStorage.setItem(ECCD_ASSESSMENTS_STORAGE_KEY, JSON.stringify(combined));
    }
  } catch {
    // ignore
  }

  return combined;
}

/**
 * Saves a teacher's ECCD developmental assessment to Supabase (primary storage) and updates local cache.
 * Enforces that teachers can only manage assessments for their assigned learners.
 */
export async function saveEccdAssessmentToSupabase({
  assessmentRecord,
  teacherProfile,
  assignedLearners = [],
  teacherBarangay = '',
  cdcName = '',
}) {
  // Check teacher authorization BEFORE overwriting record fields with teacher defaults
  const isAuthorized = canTeacherManageLearnerAssessment(
    assessmentRecord,
    teacherProfile,
    assignedLearners,
    teacherBarangay,
    cdcName
  );

  if (!isAuthorized) {
    throw new Error('Unauthorized: You can only record or update assessments for your assigned learners.');
  }

  const normRecord = normalizeEccdAssessmentRecord({
    ...assessmentRecord,
    teacher_id: assessmentRecord?.teacher_id || teacherProfile?.id || null,
    teacher_name:
      assessmentRecord?.teacher_name ||
      teacherProfile?.full_name ||
      'Child Development Teacher',
    barangay: assessmentRecord?.barangay || teacherBarangay || teacherProfile?.barangay || '',
    cdc_name:
      assessmentRecord?.cdc_name ||
      cdcName ||
      teacherProfile?.cdc_name ||
      '',
    updated_at: new Date().toISOString(),
  });

  if (!normRecord) {
    throw new Error('Invalid learner name or assessment record.');
  }

  const savedRecord = await upsertSingleAssessmentInSupabase(normRecord);

  // Update local cache and notify listeners
  try {
    const currentLocal = getLocalCachedEccdAssessments();
    const updatedList = deduplicateEccdAssessments([savedRecord, ...currentLocal]);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(ECCD_ASSESSMENTS_STORAGE_KEY, JSON.stringify(updatedList));
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('earlylearn_assessments_updated', { detail: updatedList }));
    }
  } catch {
    // ignore
  }

  return savedRecord;
}

/**
 * Retrieves ECCD assessments strictly scoped to a teacher's assigned learners.
 */
export async function getAssessmentsForTeacher({
  teacherProfile,
  assignedLearners = [],
  teacherBarangay = '',
  cdcName = '',
}) {
  const allAssessments = await fetchEccdAssessmentsFromSupabase({ migrateLocal: true });
  return allAssessments.filter((a) =>
    canTeacherManageLearnerAssessment(a, teacherProfile, assignedLearners, teacherBarangay, cdcName)
  );
}

/**
 * Retrieves the latest ECCD assessment strictly belonging to a parent's own registered and approved child.
 * Never returns assessments belonging to any other child.
 */
export async function getParentChildAssessment({
  userId,
  childName,
  barangay = '',
  cdcName = '',
  approvalStatus = 'approved',
}) {
  // Parents can only access assessments belonging to their own registered and approved child
  if (approvalStatus && String(approvalStatus).toLowerCase() !== 'approved') {
    return null;
  }

  const cleanTargetName = cleanStudentName(childName || '').toLowerCase();
  const strUserId = userId ? String(userId).trim() : '';
  if (!strUserId && !cleanTargetName) return null;

  const allAssessments = await fetchEccdAssessmentsFromSupabase({ migrateLocal: false });
  const normBrgy = (barangay || '').trim().toLowerCase();
  const normCdc = (cdcName || '').trim().toLowerCase();

  for (const a of allAssessments) {
    if (!a) continue;
    const aChildId = a.child_id ? String(a.child_id).trim() : '';
    const aChildName = cleanStudentName(a.child_name || '').toLowerCase();

    // 1. Exact authenticated user/child ID match
    if (strUserId && aChildId && strUserId === aChildId) {
      return a;
    }

    // 2. Exact child name match (only if the record isn't bound to a different UUID user)
    if (cleanTargetName && aChildName && cleanTargetName === aChildName) {
      if (aChildId && isValidUuid(aChildId) && strUserId && aChildId !== strUserId) {
        continue;
      }
      const aBrgy = (a.barangay || '').trim().toLowerCase();
      const aCdc = (a.cdc_name || '').trim().toLowerCase();
      const brgyMatch = !normBrgy || !aBrgy || normBrgy === aBrgy;
      const cdcMatch = !normCdc || !aCdc || normCdc === aCdc || aCdc.includes(normBrgy);
      if (brgyMatch || cdcMatch) {
        return a;
      }
    }
  }

  return null;
}
