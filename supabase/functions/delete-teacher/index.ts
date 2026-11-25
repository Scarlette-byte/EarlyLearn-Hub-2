// Supabase Edge Function: delete-teacher
// Verifies the caller carries a server-trusted `admin` or `superadmin` claim in JWT `app_metadata` (1C),
// ensures the target is not an administrator/superadmin, and deletes the teacher's records and Auth user.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

  // 1. Server-side admin check via caller's verified Auth `app_metadata` (1C)
  const {
    data: { user: caller },
    error: callerError,
  } = await supabaseAdmin.auth.getUser(token);

  if (callerError || !caller) {
    return jsonResponse({ error: 'Unauthorized: invalid or expired session token.' }, 401);
  }

  const callerRole = String(caller.app_metadata?.role || '').toLowerCase().trim();
  const isAdminOrSuperAdmin =
    callerRole === 'admin' ||
    callerRole === 'superadmin' ||
    caller.app_metadata?.is_superadmin === true;

  if (!isAdminOrSuperAdmin) {
    return jsonResponse(
      { error: 'Forbidden: Administrator privileges are required to delete teacher accounts.' },
      403
    );
  }

  // 2. Parse and validate `teacherId`
  let payload: { teacherId?: string };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON request body.' }, 400);
  }

  const teacherId = String(payload.teacherId || '').trim();
  if (!UUID_REGEX.test(teacherId)) {
    return jsonResponse({ error: 'A valid teacher UUID (`teacherId`) is required.' }, 400);
  }

  if (teacherId === caller.id) {
    return jsonResponse({ error: 'Cannot delete your own active account.' }, 400);
  }

  // 3. Guard against deleting Administrator / Superadmin accounts through `delete-teacher`
  const { data: targetUserRes } = await supabaseAdmin.auth.admin.getUserById(teacherId);
  const targetUser = targetUserRes?.user || null;
  if (targetUser) {
    const targetAppRole = String(targetUser.app_metadata?.role || '').toLowerCase().trim();
    if (
      targetAppRole === 'admin' ||
      targetAppRole === 'superadmin' ||
      targetUser.app_metadata?.is_superadmin === true
    ) {
      return jsonResponse(
        { error: 'Forbidden: Administrator accounts cannot be deleted via delete-teacher.' },
        403
      );
    }
  }

  const { data: targetProfile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', teacherId)
    .maybeSingle();

  if (targetProfile?.role === 'admin') {
    return jsonResponse(
      { error: 'Forbidden: Target profile belongs to an Administrator, not a Teacher.' },
      403
    );
  }

  // 4. Delete teacher domain rows and Auth user with service role
  const { error: teachersDelErr } = await supabaseAdmin
    .from('teachers')
    .delete()
    .eq('id', teacherId);

  if (teachersDelErr) {
    return jsonResponse({ error: `Failed deleting teacher record: ${teachersDelErr.message}` }, 500);
  }

  await supabaseAdmin.from('profiles').delete().eq('id', teacherId);

  if (targetUser) {
    const { error: authDelErr } = await supabaseAdmin.auth.admin.deleteUser(teacherId);
    if (authDelErr) {
      return jsonResponse({ error: `Failed deleting teacher auth user: ${authDelErr.message}` }, 500);
    }
  }

  return jsonResponse({ success: true, teacherId }, 200);
});
