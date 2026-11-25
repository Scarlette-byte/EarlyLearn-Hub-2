import { createClient } from '@supabase/supabase-js';
import { supabase, supabaseSecondaryAuth, normalizeAuthIdentifier, SUPABASE_URL, SUPABASE_ANON_KEY } from './supabaseClient.js';
import {
  realTeachersList,
  cleanTeacherDisplayName,
  normalizeTeacherName,
  fetchSyncedTeachersList,
} from './curriculumData.js';
import { isValidUuid, buildDefaultTeacherCode, parseTeacherContactAndCode } from './learnersService.js';

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
  if (t.full_name) {
    const parts = cleanTeacherDisplayName(t.full_name)
      .split(/\s+/)
      .filter((p) => !/^(teacher|ma'am|sir|aide|cdt|cdw)$/i.test(p));
    if (parts.length >= 2) {
      return `${parts[0]}.${parts[parts.length - 1]}`.toUpperCase();
    }
  }
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
  const rawClean = rawLower.replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
  const rawTokens = rawClean.split(' ').filter((w) => w.length >= 2);

  // 1. Narrow RPC lookup (anon-safe, returns only auth email)
  try {
    const { data: rpcRows, error: rpcErr } = await supabase.rpc('lookup_teacher_login_email', {
      p_identifier: raw,
    });
    if (!rpcErr && Array.isArray(rpcRows) && rpcRows[0]?.email) {
      return { email: rpcRows[0].email };
    }
  } catch {}

  // 2. Fallback to baseline/synced roster
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
    const tBaseId = String(t.baseline_id || '').toLowerCase();
    const tTeacherId = String(t.teacher_id || '').toLowerCase();
    const tEmail = String(t.email || '').toLowerCase();
    const tEmailPrefix = tEmail.split('@')[0];
    const tBaseEmail = String(t.baseline_email || '').toLowerCase();
    const tContact = String(t.contact_number || '');
    const tDigits = tContact.replace(/\D/g, '');
    const tName = (cleanTeacherDisplayName(t.full_name) || t.full_name || '').toLowerCase();
    const tDisplayId = formatDisplayTeacherId(t).toLowerCase();

    // Match by Teacher ID: e.g. "tch-81", "ANDRESA.ALLOSO", "TCH-01"
    if (tId && (tId === rawLower || tId.replace('tch-', '') === rawLower)) return true;
    if (tBaseId && (tBaseId === rawLower || tBaseId.replace('tch-', '') === rawLower)) return true;
    if (tTeacherId && (tTeacherId === rawLower || tTeacherId.replace(/[^a-z0-9]/g, '') === rawLower.replace(/[^a-z0-9]/g, ''))) return true;
    if (tDisplayId && (tDisplayId === rawLower || tDisplayId.replace(/[^a-z0-9]/g, '') === rawLower.replace(/[^a-z0-9]/g, ''))) return true;

    // Match by email or username prefix
    if (tEmail && (tEmail === rawLower || tEmailPrefix === rawLower)) return true;
    if (tBaseEmail && (tBaseEmail === rawLower || tBaseEmail.split('@')[0] === rawLower)) return true;
    const baseEntry = realTeachersList.find((r) => r.id === t.id || r.id === t.baseline_id);
    if (baseEntry && baseEntry.email && (baseEntry.email.toLowerCase() === rawLower || baseEntry.email.toLowerCase().split('@')[0] === rawLower)) {
      return true;
    }

    // Match by mobile digits: e.g. "0939-430-5411"
    if (rawDigits.length >= 7 && tDigits.length >= 7) {
      if (tDigits.endsWith(rawDigits) || rawDigits.endsWith(tDigits)) return true;
    }

    // Match by registration code: e.g. "ELH-TANKULAN-APA"
    if (tContact.toLowerCase().includes(rawLower) && rawLower.length >= 6) return true;

    // Match by name tokens: e.g. "ANDRESA.ALLOSO" -> words ["andresa", "alloso"] in "andresa panlaan alloso"
    if (rawTokens.length >= 2 && rawTokens.every((token) => tName.includes(token))) {
      return true;
    }

    // Direct name match
    if (rawClean.length >= 4 && tName.length >= 4) {
      if (tName === rawClean || tName.includes(rawClean) || rawClean.includes(tName)) {
        return true;
      }
    }

    return false;
  });

  return match || null;
}

/**
 * Resets a teacher's password server-side via the `admin-reset-password` Edge Function
 * (`auth.admin.updateUserById`), without storing plaintext passwords in any table or localStorage.
 */
export async function adminSetTeacherPassword(teacher, newPassword) {
  if (!teacher || !newPassword || newPassword.length < 8) {
    throw new Error('Teacher and a password with at least 8 characters are required.');
  }

  const rawContact = teacher.contact_number || '';
  const cleanContact = parseTeacherContactAndCode(rawContact).contactNumber || rawContact;
  const rawDigits = cleanContact.replace(/\D/g, '');
  const displayTeacherId = formatDisplayTeacherId(teacher);
  const fallbackEmail =
    (teacher.email && !teacher.email.startsWith('admin@') ? teacher.email.toLowerCase().trim() : null) ||
    (rawDigits.length >= 7 ? `${rawDigits}@earlylearn.ph` : null) ||
    (displayTeacherId && displayTeacherId !== '-'
      ? `${displayTeacherId.toLowerCase().replace(/[^a-z0-9._-]/g, '')}@earlylearn.ph`
      : null);

  const { data, error } = await supabase.functions.invoke('admin-reset-password', {
    body: {
      userId: isValidUuid(teacher.id) ? teacher.id : undefined,
      email: fallbackEmail || undefined,
      newPassword,
      mustChangePassword: true,
    },
  });

  if (error) {
    throw new Error(error.message || 'Failed to reset teacher password.');
  }
  if (data?.error) {
    throw new Error(data.error);
  }

  return {
    email: fallbackEmail,
    teacherId: displayTeacherId,
    userId: data?.userId || teacher.id,
  };
}

  const cleanName = cleanTeacherDisplayName(teacher.full_name) || teacher.full_name;
  const rawContact = teacher.contact_number || '';
  const cleanContact = parseTeacherContactAndCode(rawContact).contactNumber || rawContact;
  const rawDigits = cleanContact.replace(/\D/g, '');
  const displayTeacherId = formatDisplayTeacherId(teacher);
  const cdcName =
    teacher.cdcs?.name ||
    teacher.cdc_name ||
    `${teacher.barangay || 'Manolo Fortich'} Child Development Center`;
  const validCdcUuid = isValidUuid(teacher.cdc_id) ? teacher.cdc_id : null;

  // Build candidate emails in order of reliability
  const candidateEmails = Array.from(
    new Set(
      [
        rawDigits.length >= 7 ? `${rawDigits}@earlylearn.ph` : null,
        teacher.email && !teacher.email.startsWith('admin@') ? teacher.email.toLowerCase().trim() : null,
        displayTeacherId && displayTeacherId !== '-'
          ? `${displayTeacherId.toLowerCase().replace(/[^a-z0-9._-]/g, '')}@earlylearn.ph`
          : null,
        teacher.id ? `${String(teacher.id).toLowerCase().replace(/[^a-z0-9]/g, '')}@earlylearn.ph` : null,
      ].filter(Boolean)
    )
  );

  let workingAuthEmail = candidateEmails[0] || `${Date.now()}@earlylearn.ph`;
  let createdUserId = teacher.id && isValidUuid(teacher.id) ? teacher.id : null;
  let activeToken = null;

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    activeToken = sessionData?.session?.access_token || null;
  } catch {}

  // 1. Attempt to create user in Supabase Auth across candidate emails
  for (const email of candidateEmails) {
    const { data: signUpData, error: signUpError } = await supabaseSecondaryAuth.auth.signUp({
      email,
      password: newPassword,
      options: {
        data: {
          full_name: cleanName,
          role: 'teacher',
          teacher_id: displayTeacherId,
          barangay: teacher.barangay || 'Manolo Fortich',
          cdc_name: cdcName,
          contact_number: cleanContact || null,
          must_change_password: true,
        },
      },
    });

    if (signUpData?.user?.id) {
      createdUserId = signUpData.user.id;
      workingAuthEmail = email;
      if (signUpData.session?.access_token) {
        activeToken = signUpData.session.access_token;
      }
      break;
    }

    if (signUpError && /already registered/i.test(signUpError.message)) {
      // User exists in auth.users; test if credentials already match or use this email
      const { data: inData } = await supabase.auth.signInWithPassword({
        email,
        password: newPassword,
      });
      if (inData?.user?.id) {
        createdUserId = inData.user.id;
        workingAuthEmail = email;
        if (inData.session?.access_token) {
          activeToken = inData.session.access_token;
        }
        break;
      }
    }
  }

  // If still no user ID, generate a unique fresh email for this teacher
  if (!createdUserId) {
    const cleanIdPart = displayTeacherId.toLowerCase().replace(/[^a-z0-9]/g, '') || 'teacher';
    const fallbackEmail = `${cleanIdPart}.${Date.now().toString().slice(-6)}@earlylearn.ph`;
    const { data: fbData } = await supabaseSecondaryAuth.auth.signUp({
      email: fallbackEmail,
      password: newPassword,
      options: {
        data: {
          full_name: cleanName,
          role: 'teacher',
          teacher_id: displayTeacherId,
          barangay: teacher.barangay || 'Manolo Fortich',
          cdc_name: cdcName,
          contact_number: cleanContact || null,
          must_change_password: true,
        },
      },
    });
    if (fbData?.user?.id) {
      createdUserId = fbData.user.id;
      workingAuthEmail = fallbackEmail;
      if (fbData.session?.access_token) {
        activeToken = fbData.session.access_token;
      }
    }
  }

  // 2. Prepare Registration Code and Packed Contact with Cross-Device Password Sync
  const parentRegCode = buildDefaultTeacherCode({
    id: createdUserId || displayTeacherId || teacher.id,
    full_name: cleanName,
    barangay: teacher.barangay || 'Manolo Fortich',
  });
  const packedContact = `${cleanContact} ||CODE:${parentRegCode} ||PASS:${newPassword}`;

  const writeClient = activeToken
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: false },
        global: { headers: { Authorization: `Bearer ${activeToken}` } },
      })
    : supabase;

  // 3. Save to Supabase profiles table FIRST (satisfies foreign key constraint)
  if (createdUserId) {
    try {
      await writeClient.from('profiles').upsert({
        id: createdUserId,
        full_name: cleanName,
        role: 'teacher',
        barangay: teacher.barangay || 'Manolo Fortich',
        cdc_name: cdcName,
        contact_number: cleanContact || null,
      });
    } catch (profErr) {
      console.warn('Could not upsert profile:', profErr);
    }

    // 4. Save to Supabase teachers table (Accessible to anon users on /login!)
    try {
      await writeClient.from('teachers').upsert({
        id: createdUserId,
        full_name: cleanName,
        email: workingAuthEmail,
        barangay: teacher.barangay || 'Manolo Fortich',
        cdc_id: validCdcUuid,
        contact_number: packedContact,
        must_change_password: true,
      });
    } catch (teachErr) {
      console.warn('Could not upsert teacher record:', teachErr);
    }
  }

  // 5. Save locally in localStorage for instant sync in current browser
  const credPayload = {
    __teacher_credential_sync: true,
    email: workingAuthEmail,
    teacher_id: displayTeacherId,
    baseline_id: teacher.baseline_id || (String(teacher.id).startsWith('tch-') ? teacher.id : null),
    full_name: cleanName,
    barangay: teacher.barangay || 'Manolo Fortich',
    cdc_name: cdcName,
    contact_number: packedContact,
    temporary_password: newPassword,
    updated_at: new Date().toISOString(),
  };

  try {
    const raw = localStorage.getItem(LOCAL_TEACHER_CREDS_KEY);
    const map = raw ? JSON.parse(raw) : {};
    map[workingAuthEmail.toLowerCase()] = credPayload;
    map[displayTeacherId.toLowerCase()] = credPayload;
    if (cleanContact) map[cleanContact.toLowerCase()] = credPayload;
    if (rawDigits) map[rawDigits] = credPayload;
    if (teacher.id) map[String(teacher.id).toLowerCase()] = credPayload;
    localStorage.setItem(LOCAL_TEACHER_CREDS_KEY, JSON.stringify(map));
    window.dispatchEvent(new Event('earlylearn_credentials_updated'));
  } catch {}

  // 6. Save to Supabase materials table as secondary cloud sync
  try {
    const syncTitle = `[TEACHER_CREDENTIAL_SYNC] ${workingAuthEmail}`;
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
  } catch {}

  return {
    success: true,
    email: workingAuthEmail,
    teacherId: displayTeacherId,
    fullName: cleanName,
    password: newPassword,
    registrationCode: parentRegCode,
  };
}

/**
 * Checks for a synced admin-set temporary password for a given teacher email or identifier.
 * Reads from:
 * 1. localStorage (instant on same device)
 * 2. Supabase teachers table (100% accessible to anon unauthenticated users on /login)
 * 3. Supabase materials table
 */
export async function getTeacherSyncedCredential(identifier) {
  if (!identifier) return null;
  const rawLower = String(identifier).trim().toLowerCase();
  const rawDigits = rawLower.replace(/\D/g, '');
  const rawName = normalizeTeacherName(rawLower);

  // 1. Check localStorage first
  try {
    const raw = localStorage.getItem(LOCAL_TEACHER_CREDS_KEY);
    if (raw) {
      const map = JSON.parse(raw);
      if (map[rawLower]) return map[rawLower];
      if (rawDigits && map[rawDigits]) return map[rawDigits];
    }
  } catch {}

  // 2. Check Supabase teachers table (Publicly readable by anon users for auth verification)
  try {
    const { data: teachersData } = await supabase
      .from('teachers')
      .select('id, full_name, email, contact_number, barangay, cdc_id');

    if (Array.isArray(teachersData)) {
      for (const t of teachersData) {
        const tContact = String(t.contact_number || '');
        if (tContact.includes('||PASS:') || tContact.includes('||META:')) {
          let pass = null;
          if (tContact.includes('||PASS:')) {
            pass = tContact.split('||PASS:')[1]?.split('||')[0]?.trim();
          } else if (tContact.includes('||META:')) {
            try {
              const meta = JSON.parse(tContact.split('||META:')[1] || '{}');
              pass = meta.password || meta.tempPass;
            } catch {}
          }

          if (pass) {
            const tEmail = String(t.email || '').toLowerCase();
            const tId = String(t.id || '').toLowerCase();
            const cleanContactOnly = tContact.split('||')[0].trim();
            const tDigits = cleanContactOnly.replace(/\D/g, '');
            const tCleanPhone = cleanContactOnly.toLowerCase();
            const tName = normalizeTeacherName(t.full_name || '');

            const isMatch =
              tEmail === rawLower ||
              tId === rawLower ||
              (rawDigits.length >= 7 && (tDigits.endsWith(rawDigits) || rawDigits.endsWith(tDigits))) ||
              (tCleanPhone && tCleanPhone === rawLower) ||
              (rawName.length >= 4 && (tName.includes(rawName) || rawName.includes(tName)));

            if (isMatch) {
              return {
                __teacher_credential_sync: true,
                email: t.email,
                teacher_id: t.id,
                full_name: t.full_name,
                barangay: t.barangay,
                cdc_id: t.cdc_id,
                contact_number: tContact,
                temporary_password: pass,
              };
            }
          }
        }
      }
    }
  } catch {}

  // 3. Check Supabase materials table
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

  // 1. Check Supabase learners table
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
