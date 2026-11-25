import { supabase } from './supabaseClient.js';

/**
 * Single database source of truth for Barangays and CDCs/LCs.
 * Replaces static baseline arrays and localStorage overrides.
 */
export async function fetchBarangaysFromDb() {
  const { data, error } = await supabase
    .from('barangays')
    .select('id, name, municipality, province')
    .order('name', { ascending: true });

  if (error) throw new Error(`Failed to load barangays: ${error.message}`);
  return data || [];
}

export async function fetchCdcsFromDb({ barangayId = null, status = 'active' } = {}) {
  let query = supabase
    .from('cdcs')
    .select('id, name, center_type, status, permit_number, permit_issued_at, permit_expires_at, barangay_id, barangays(id, name)')
    .order('name', { ascending: true });

  if (barangayId) query = query.eq('barangay_id', barangayId);
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to load CDCs: ${error.message}`);
  return data || [];
}
