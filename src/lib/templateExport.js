/**
 * Official DOCX Template Export Helper
 * Downloads the exact unmodified MSWDO .docx template from /templates/reports/
 * so formatting, logos, borders, and signature blocks are never altered.
 */
export const OFFICIAL_TEMPLATES = [
  {
    key: 'cdc_monitoring',
    label: 'CDC Monitoring Report (.docx)',
    file: 'CHILD-DEVELOPMENT-CENTER-MONITORING-REPORT.docx',
  },
  {
    key: 'nutritional_status',
    label: 'Upon-Entry Nutritional Status (.docx)',
    file: 'UPON-ENTRY-Nutritional-Status.docx',
  },
  {
    key: 'community_mapping',
    label: 'Community Mapping 2.0 (.docx)',
    file: 'COMMUNITY-MAPPING-2.0.docx',
  },
];

export async function downloadOfficialTemplate(templateKey, contextLabel = '') {
  const tpl = OFFICIAL_TEMPLATES.find((t) => t.key === templateKey);
  if (!tpl) throw new Error('Unknown template');

  const res = await fetch(`/templates/reports/${encodeURIComponent(tpl.file)}`);
  if (!res.ok) throw new Error(`Failed to load template (${res.status})`);

  const blob = await res.blob();
  const safeCtx = String(contextLabel || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `${tpl.key}${safeCtx ? `_${safeCtx}` : ''}_${dateStr}.docx`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return filename;
}
