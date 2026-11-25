// Supabase Edge Function: admin-reset-password
// Verifies the caller is an authenticated `admin` or `superadmin` (via JWT `app_metadata`),
// then uses `auth.admin.updateUserById` to reset a user's password server-side without
// ever storing plaintext passwords in `teachers`, `materials`, or `localStorage`.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'Server configuration error: missing Supabase service credentials.' }, 500);
  }

  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return jsonResponse({ error: 'Unauthorized: missing Bearer token.' }, 401);
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // 1. Verify caller identity and require `admin` or `superadmin` in `app_metadata`
  const {
    data: { user: caller },
    error: callerError,
  } = await supabaseAdmin.auth.getUser(token);

  if (callerError || !caller) {
    return jsonResponse({ error: 'Unauthorized: invalid or expired session token.' }, 401);
  }

  const callerRole = String(caller.app_metadata?.role || '').toLowerCase().trim();
  const isAuthorized =
    callerRole === 'admin' ||
    callerRole === 'superadmin' ||
    caller.app_metadata?.is_superadmin === true;

  if (!isAuthorized) {
    return jsonResponse(
      { error: 'Forbidden: Only Administrators or Superadmins can reset user passwords.' },
      403
    );
  }

  // 2. Parse and validate request payload
  let payload: {
    userId?: string;
    email?: string;
    newPassword?: string;
    mustChangePassword?: boolean;
  };

  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON request body.' }, 400);
  }

  const newPassword = String(payload.newPassword || '');
  const mustChangePassword = payload.mustChangePassword !== false;
  let targetUserId = String(payload.userId || '').trim();
  const targetEmail = String(payload.email || '').trim().toLowerCase();

  if (newPassword.length < 8 || newPassword.length > 72) {
    return jsonResponse({ error: 'Password must be between 8 and 72 characters.' }, 400);
  }

  if (!targetUserId && !targetEmail) {
    return jsonResponse({ error: 'Either userId or email is required.' }, 400);
  }

  if (!targetUserId && targetEmail) {
    const { data: profileRow } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .ilike('email', targetEmail)
      .maybeSingle();

    if (profileRow?.id) {
      targetUserId = String(profileRow.id);
    }
  }

  if (!targetUserId) {
    return jsonResponse({ error: 'Target user not found.' }, 404);
  }

  // 3. Preserve existing app_metadata while updating password & must_change_password
  const { data: existingUserData, error: fetchErr } = await supabaseAdmin.auth.admin.getUserById(targetUserId);
  if (fetchErr || !existingUserData?.user) {
    return jsonResponse({ error: fetchErr?.message || 'Target auth user not found.' }, 404);
  }

  const existingAppMeta = existingUserData.user.app_metadata || {};

  const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
    password: newPassword,
    app_metadata: {
      ...existingAppMeta,
      must_change_password: mustChangePassword,
    },
  });

  if (updateErr) {
    return jsonResponse({ error: updateErr.message || 'Failed to update user password.' }, 400);
  }

  // 4. Mirror must_change_password flag on public.teachers if applicable
  await supabaseAdmin
    .from('teachers')
    .update({ must_change_password: mustChangePassword })
    .eq('id', targetUserId);

  return jsonResponse({
    ok: true,
    userId: targetUserId,
    mustChangePassword,
  });
});
