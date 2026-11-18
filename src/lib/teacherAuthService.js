import { supabase, supabaseSecondaryAuth, normalizeAuthIdentifier } from './supabaseClient.js';
import {
  realTeachersList,
  cleanTeacherDisplayName,
  normalizeTeacherName,
  fetchSyncedTeachersList,
} from './curriculumData.js';
import { isValidUuid } from './learnersService.js';

const LOCAL_TEACHER_CREDS_KEY = 'earlylearn_teacher_credentials';

/**
 * Formats a clean display Teacher ID from a teacher object.
 */
export function formatDisplayTeacherId(t) {
  if (!t) return '-';
  if (t.teacher_id) return String(t.teacher_id).toUpperCase();
  if (t.email && t.email.endsWith('@earlylearn.ph')) {
    const prefix = t.email.split('@')[0];
    if (/[a-zA-Z]/.test(prefix)) return prefix.toUpperCase();
  }
  if (t.id && String(t.id).startsWith('tch-')) return String(t.id).toUpperCase();
  return t.id ? `TCH-${String(t.id).slice(0, 6).toUpperCase()}` : '-';
}

/**
 * Resolves an entered login identifier (Teacher ID, email, mobile phone, or full name)
 * against the teacher roster to return the official teacher record and candidate login email.
 */
export async function resolveTeacherForLogin(identifier) {
  if (!identifier) return null;
  const raw = String(identifier).trim();
  if (!raw) return null;

  const rawLower = raw.toLowerCase();
  const rawDigits = raw.replace(/\D/g, '');
  const rawNormName = normalizeTeacherName(raw);

  // 1. Fetch current roster (baseline + synced)
  let roster = realTeachersList;
  try {
    const synced = await fetchSyncedTeachersList(supabase);
    if (Array.isArray(synced) && synced.length > 0) {
      roster = synced;
    }
  } catch {}

  // 2. Find matching teacher in roster
  const match = roster.find((t) => {
    if (!t) return false;
    const tId = String(t.id || '').toLowerCase();
    const tTeacherId = String(t.teacher_id || '').toLowerCase();
    const tEmail = String(t.email || '').toLowerCase();
    const tEmailPrefix = tEmail.split('@')[0];
    const tDigits = String(t.contact_number || '').replace(/\D/g, '');
    const tNormName = normalizeTeacherName(t.full_name || '');

    // Match by Teacher ID: e.g. "tch-81", "ANDRESA.ALLOSO"
    if (tId && (tId === rawLower || tId.replace('tch-', '') === rawLower)) return true;
    if (tTeacherId && tTeacherId === rawLower) return true;

    // Match by email or username prefix: e.g. "andresa.alloso@earlylearn.ph" or "andresa.alloso"
    if (tEmail && (tEmail === rawLower || tEmailPrefix === rawLower)) return true;

    // Match by mobile digits: e.g. "0939-430-5411"
    if (rawDigits.length >= 7 && tDigits.length >= 7) {
      if (tDigits.endsWith(rawDigits) || rawDigits.endsWith(tDigits)) return true;
    }

    // Match by full name
    if (rawNormName.length >= 4 && tNormName.length >= 4) {
      if (rawNormName === tNormName || tNormName.includes(rawNormName) || rawNormName.includes(tNormName)) {
        return true;
      }
    }

    return false;
  });

  return match || null;
}

/**
 * Sets a temporary password for a teacher from the Admin Dashboard, ensures
 * an active account in Supabase auth, synchronizes credentials to Supabase
 * materials table, and returns the login credentials for immediate teacher use.
 */
export async function adminSetTeacherPassword(teacher, newPassword) {
  if (!teacher || !newPassword || newPassword.length < 6) {
    throw new Error('Teacher and a password with at least 6 characters are required.');
  }

  const rawEmail = String(teacher.email || '').trim().toLowerCase();
  const { authEmail } = normalizeAuthIdentifier(teacher.email || teacher.contact_number || teacher.id);
  const targetEmail = rawEmail || authEmail;
  const cleanName = cleanTeacherDisplayName(teacher.full_name) || teacher.full_name;
  const displayTeacherId = formatDisplayTeacherId(teacher);
  const cdcName = teacher.cdcs?.name || teacher.cdc_name || `${teacher.barangay || 'Manolo Fortich'} Child Development Center`;
  const validCdcUuid = isValidUuid(teacher.cdc_id) ? teacher.cdc_id : null;

  let createdUserId = teacher.id && isValidUuid(teacher.id) ? teacher.id : null;

  // 1. Attempt to create user in Supabase Auth using secondary client
  const { data: signUpData, error: signUpError } = await supabaseSecondaryAuth.auth.signUp({
    email: targetEmail,
    password: newPassword,
    options: {
      data: {
        full_name: cleanName,
        role: 'teacher',
        teacher_id: displayTeacherId,
        barangay: teacher.barangay || 'Manolo Fortich',
        cdc_name: cdcName,
        contact_number: teacher.contact_number || null,
        must_change_password: true,
      },
    },
  });

  if (signUpData?.user?.id) {
    createdUserId = signUpData.user.id;
  }

  // If user was already registered in auth.users, try resetting via delete-teacher edge function
  if (signUpError && /already registered/i.test(signUpError.message)) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (token) {
        await supabase.functions.invoke('delete-teacher', {
          body: { userId: teacher.id, email: targetEmail },
          headers: { Authorization: `Bearer ${token}` },
        });

        const { data: reSignUp } = await supabaseSecondaryAuth.auth.signUp({
          email: targetEmail,
          password: newPassword,
          options: {
            data: {
              full_name: cleanName,
              role: 'teacher',
              teacher_id: displayTeacherId,
              barangay: teacher.barangay || 'Manolo Fortich',
              cdc_name: cdcName,
              contact_number: teacher.contact_number || null,
              must_change_password: true,
            },
          },
        });
        if (reSignUp?.user?.id) {
          createdUserId = reSignUp.user.id;
        }
      }
    } catch (e) {
      console.warn('Could not reset via edge delete-teacher:', e);
    }
  }

  // 2. Prepare credential sync payload & preserve previous passwords for seamless auto-healing
  const existingCred =
    (await getTeacherSyncedCredential(targetEmail)) ||
    (displayTeacherId ? await getTeacherSyncedCredential(displayTeacherId) : null);
  const prevList = Array.isArray(existingCred?.previous_passwords)
    ? [...existingCred.previous_passwords]
    : [];
  if (
    existingCred?.temporary_password &&
    existingCred.temporary_password !== newPassword &&
    !prevList.includes(existingCred.temporary_password)
  ) {
    prevList.push(existingCred.temporary_password);
  }

  const credPayload = {
    __teacher_credential_sync: true,
    email: targetEmail,
    teacher_id: displayTeacherId,
    baseline_id: teacher.baseline_id || (String(teacher.id).startsWith('tch-') ? teacher.id : null),
    full_name: cleanName,
    barangay: teacher.barangay || 'Manolo Fortich',
    cdc_name: cdcName,
    contact_number: teacher.contact_number || null,
    temporary_password: newPassword,
    previous_passwords: prevList,
    updated_at: new Date().toISOString(),
  };

  // 3. Save locally in localStorage for instant sync in current browser
  try {
    const raw = localStorage.getItem(LOCAL_TEACHER_CREDS_KEY);
    const map = raw ? JSON.parse(raw) : {};
    map[targetEmail.toLowerCase()] = credPayload;
    map[displayTeacherId.toLowerCase()] = credPayload;
    if (teacher.id) map[String(teacher.id).toLowerCase()] = credPayload;
    localStorage.setItem(LOCAL_TEACHER_CREDS_KEY, JSON.stringify(map));
    window.dispatchEvent(new Event('earlylearn_credentials_updated'));
  } catch {}

  // 4. Save to Supabase materials table for cross-device synchronization
  try {
    const syncTitle = `[TEACHER_CREDENTIAL_SYNC] ${targetEmail}`;
    const { data: existing } = await supabase
      .from('materials')
      .select('id')
      .ilike('title', `${syncTitle}%`)
      .limit(1);

    if (existing && existing.length > 0) {
      await supabase
        .from('materials')
        .update({
          content_text: JSON.stringify(credPayload),
          status: 'approved',
        })
        .eq('id', existing[0].id);
    } else {
      const { data: cat } = await supabase.from('categories').select('id').limit(1);
      await supabase.from('materials').insert({
        category_id: cat?.[0]?.id || null,
        type: 'story',
        title: syncTitle,
        age_range: '3-5',
        status: 'approved',
        content_text: JSON.stringify(credPayload),
      });
    }
  } catch (syncErr) {
    console.warn('Could not sync teacher credential to Supabase materials:', syncErr);
  }

  // 5. Update profiles and teachers table in Supabase
  if (createdUserId) {
    try {
      await supabase.from('profiles').upsert({
        id: createdUserId,
        full_name: cleanName,
        role: 'teacher',
        barangay: teacher.barangay || 'Manolo Fortich',
        cdc_name: cdcName,
        contact_number: teacher.contact_number || null,
      });

      await supabase.from('teachers').upsert({
        id: createdUserId,
        full_name: cleanName,
        email: targetEmail,
        barangay: teacher.barangay || 'Manolo Fortich',
        cdc_id: validCdcUuid,
        contact_number: teacher.contact_number || null,
        must_change_password: true,
      });
    } catch {}
  }

  return {
    success: true,
    email: targetEmail,
    teacherId: displayTeacherId,
    fullName: cleanName,
    password: newPassword,
    previous_passwords: prevList,
  };
}

/**
 * Checks for a synced admin-set temporary password for a given teacher email or identifier.
 */
export async function getTeacherSyncedCredential(identifier) {
  if (!identifier) return null;
  const rawLower = String(identifier).trim().toLowerCase();

  // Check localStorage first
  try {
    const raw = localStorage.getItem(LOCAL_TEACHER_CREDS_KEY);
    if (raw) {
      const map = JSON.parse(raw);
      if (map[rawLower]) return map[rawLower];
    }
  } catch {}

  // Check Supabase materials table
  try {
    const { data: syncRows } = await supabase
      .from('materials')
      .select('content_text')
      .ilike('title', '[TEACHER_CREDENTIAL_SYNC]%')
      .limit(50);

    if (Array.isArray(syncRows)) {
      for (const row of syncRows) {
        try {
          const parsed = JSON.parse(row.content_text || '{}');
          if (parsed && parsed.__teacher_credential_sync) {
            const pEmail = String(parsed.email || '').toLowerCase();
            const pId = String(parsed.teacher_id || '').toLowerCase();
            const pBaseId = String(parsed.baseline_id || '').toLowerCase();
            if (pEmail === rawLower || pId === rawLower || pBaseId === rawLower) {
              return parsed;
            }
          }
        } catch {}
      }
    }
  } catch {}

  return null;
}

const LOCAL_PARENT_CREDS_KEY = 'earlylearn_parent_credentials';

/**
 * Saves and cloud-synchronizes credentials for a parent account created by a teacher.
 */
export async function saveParentSyncedCredential(cred) {
  if (!cred || !cred.authEmail) return;
  const payload = {
    __parent_credential_sync: true,
    email: cred.authEmail.toLowerCase().trim(),
    identifier: cred.identifier || '',
    child_name: cred.childName || '',
    parent_name: cred.parentName || '',
    barangay: cred.barangay || '',
    cdc_name: cred.cdcName || '',
    temporary_password: cred.password,
    approval_status: 'approved',
    updated_at: new Date().toISOString(),
  };

  // Local storage cache
  try {
    const raw = localStorage.getItem(LOCAL_PARENT_CREDS_KEY);
    const map = raw ? JSON.parse(raw) : {};
    map[payload.email] = payload;
    if (payload.identifier) map[payload.identifier.toLowerCase()] = payload;
    if (payload.child_name) map[payload.child_name.toLowerCase()] = payload;
    localStorage.setItem(LOCAL_PARENT_CREDS_KEY, JSON.stringify(map));
    window.dispatchEvent(new Event('earlylearn_parent_credentials_updated'));
  } catch {}

  // Cloud sync in materials table
  try {
    const syncTitle = `[PARENT_CREDENTIAL_SYNC] ${payload.email}`;
    const { data: existing } = await supabase
      .from('materials')
      .select('id')
      .ilike('title', `${syncTitle}%`)
      .limit(1);

    if (existing && existing.length > 0) {
      await supabase
        .from('materials')
        .update({
          content_text: JSON.stringify(payload),
          status: 'approved',
        })
        .eq('id', existing[0].id);
    } else {
      const { data: cat } = await supabase.from('categories').select('id').limit(1);
      await supabase.from('materials').insert({
        category_id: cat?.[0]?.id || null,
        type: 'story',
        title: syncTitle,
        age_range: '3-5',
        status: 'approved',
        content_text: JSON.stringify(payload),
      });
    }
  } catch (e) {
    console.warn('Could not sync parent credential to materials:', e);
  }
}

/**
 * Retrieves a synced parent credential by phone, email, or child name.
 */
export async function getParentSyncedCredential(identifier) {
  if (!identifier) return null;
  const rawLower = String(identifier).trim().toLowerCase();
  const rawDigits = rawLower.replace(/\D/g, '');

  // Check localStorage first
  try {
    const raw = localStorage.getItem(LOCAL_PARENT_CREDS_KEY);
    if (raw) {
      const map = JSON.parse(raw);
      if (map[rawLower]) return map[rawLower];
      if (rawDigits.length >= 7) {
        for (const k of Object.keys(map)) {
          if (k.replace(/\D/g, '').endsWith(rawDigits) || rawDigits.endsWith(k.replace(/\D/g, ''))) {
            return map[k];
          }
        }
      }
    }
  } catch {}

  // Check Supabase materials table
  try {
    const { data: syncRows } = await supabase
      .from('materials')
      .select('content_text')
      .ilike('title', '[PARENT_CREDENTIAL_SYNC]%')
      .limit(50);

    if (Array.isArray(syncRows)) {
      for (const row of syncRows) {
        try {
          const parsed = JSON.parse(row.content_text || '{}');
          if (parsed && parsed.__parent_credential_sync) {
            const pEmail = String(parsed.email || '').toLowerCase();
            const pIdent = String(parsed.identifier || '').toLowerCase();
            const pChild = String(parsed.child_name || '').toLowerCase();
            const pDigits = pIdent.replace(/\D/g, '');

            if (pEmail === rawLower || pIdent === rawLower || pChild === rawLower) {
              return parsed;
            }
            if (rawDigits.length >= 7 && pDigits.length >= 7) {
              if (pDigits.endsWith(rawDigits) || rawDigits.endsWith(pDigits)) {
                return parsed;
              }
            }
          }
        } catch {}
      }
    }
  } catch {}

  return null;
}

/**
 * Resolves a parent/learner identifier (mobile number, email, or child name) to an official authEmail.
 */
export async function resolveParentForLogin(identifier) {
  if (!identifier) return null;
  const raw = String(identifier).trim();
  if (!raw) return null;

  const rawLower = raw.toLowerCase();
  const rawDigits = raw.replace(/\D/g, '');

  // 1. Check synced credentials
  const cred = await getParentSyncedCredential(raw);
  if (cred?.email) {
    return {
      authEmail: cred.email,
      childName: cred.child_name,
      parentName: cred.parent_name,
      approval_status: 'approved',
    };
  }

  // 2. Check Supabase learners table
  try {
    const { data: learners } = await supabase
      .from('learners')
      .select('*')
      .limit(100);

    if (Array.isArray(learners)) {
      const match = learners.find((l) => {
        const lName = String(l.full_name || '').toLowerCase();
        const pName = String(l.parent_name || '').toLowerCase();
        const pContact = String(l.parent_contact || '').replace(/\D/g, '');

        if (lName === rawLower || (rawLower.length >= 4 && lName.includes(rawLower))) return true;
        if (pName === rawLower || (rawLower.length >= 4 && pName.includes(rawLower))) return true;
        if (rawDigits.length >= 7 && pContact.length >= 7) {
          if (pContact.endsWith(rawDigits) || rawDigits.endsWith(pContact)) return true;
        }
        return false;
      });

      if (match) {
        const { authEmail } = normalizeAuthIdentifier(match.parent_contact || match.id);
        return {
          authEmail,
          childName: match.full_name,
          parentName: match.parent_name,
          approval_status: 'approved',
        };
      }
    }
  } catch {}

  return null;
}
