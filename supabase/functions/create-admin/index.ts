// Supabase Edge Function: create-admin
// Verifies the caller carries a server-trusted `superadmin` claim in JWT `app_metadata` (1C),
// then uses the service-role key to provision an MSWD Administrator account with
// `app_metadata.role = 'admin'` and a matching `public.profiles` row.

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

  // 1. Verify caller identity and require server-trusted `superadmin` claim in `app_metadata` (1C)
  const {
    data: { user: caller },
    error: callerError,
  } = await supabaseAdmin.auth.getUser(token);

  if (callerError || !caller) {
    return jsonResponse({ error: 'Unauthorized: invalid or expired session token.' }, 401);
  }

  const callerRole = String(caller.app_metadata?.role || '').toLowerCase().trim();
  const isCallerSuperAdmin =
    callerRole === 'superadmin' || caller.app_metadata?.is_superadmin === true;

  if (!isCallerSuperAdmin) {
    return jsonResponse(
      { error: 'Forbidden: Only a Municipal Superadmin can create Administrator accounts.' },
      403
    );
  }

  // 2. Parse and validate request payload
  let payload: {
    email?: string;
    password?: string;
    full_name?: string;
    barangay?: string | null;
    contact_number?: string | null;
  };

  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON request body.' }, 400);
  }

  const normalizedEmail = String(payload.email || '').toLowerCase().trim();
  const password = String(payload.password || '');
  const fullName = String(payload.full_name || '').trim();
  const barangay = payload.barangay ? String(payload.barangay).trim() : null;
  const contactNumber = payload.contact_number ? String(payload.contact_number).trim() : null;

  if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return jsonResponse({ error: 'A valid email address is required.' }, 400);
  }

  if (!fullName) {
    return jsonResponse({ error: 'Full name is required.' }, 400);
  }

  if (password.length < 6) {
    return jsonResponse({ error: 'Initial password must be at least 6 characters long.' }, 400);
  }

  // 3. Provision Auth user with service role and set server-trusted role via `app_metadata` (1C)
  const { data: createdData, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email: normalizedEmail,
    password,
    email_confirm: true,
    app_metadata: {
      role: 'admin',
      is_superadmin: false,
    },
    user_metadata: {
      full_name: fullName,
      barangay,
      contact_number: contactNumber,
    },
  });

  if (createError || !createdData?.user) {
    return jsonResponse(
      { error: createError?.message || 'Failed to create Administrator auth user.' },
      400
    );
  }

  const createdUser = createdData.user;

  // 4. Upsert matching `public.profiles` record (`role = 'admin'`)
  const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
    id: createdUser.id,
    full_name: fullName,
    role: 'admin',
    barangay,
    contact_number: contactNumber,
  });

  if (profileError) {
    // Roll back Auth user so partial accounts do not linger
    await supabaseAdmin.auth.admin.deleteUser(createdUser.id);
    return jsonResponse(
      { error: `Failed to initialize Administrator profile: ${profileError.message}` },
      500
    );
  }

  return jsonResponse(
    {
      success: true,
      user: {
        id: createdUser.id,
        email: createdUser.email,
        full_name: fullName,
        role: 'admin',
        barangay,
        contact_number: contactNumber,
      },
    },
    201
  );
});
