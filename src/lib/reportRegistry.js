/**
 * Report Registry & Export Utilities
 * Supports role-scoped filtering (school year, barangay, CDC, class, date range),
 * CSV export, and audit logging via `log_event`.
 */

export const REPORT_REGISTRY = [
  {
    id: 'class_enrollment',
    title: 'Class Enrollment Report',
    description: 'Enrolled learners grouped by Barangay, CDC, and Class/Age Level.',
    allowedRoles: ['superadmin', 'admin', 'teacher'],
    columns: [
      { key: 'full_name', label: 'Learner Name' },
      { key: 'barangay', label: 'Barangay' },
      { key: 'cdc_name', label: 'Child Development Center' },
      { key: 'age_level', label: 'Class / Age Level' },
      { key: 'enrollment_status', label: 'Status' },
      { key: 'parent_name', label: 'Parent / Guardian' },
    ],
    buildRows: ({ learners = [] }, filters) => {
      return applyCommonFilters(learners, filters, (l) => ({
        barangay: l.barangay,
        cdcId: l.cdc_id,
        cdcName: l.cdc_name,
        classId: l.class_id,
        date: l.created_at,
      })).map((l) => ({
        full_name: l.full_name || '—',
        barangay: l.barangay || '—',
        cdc_name: l.cdc_name || '—',
        age_level: l.age_level || (l.age ? `Age ${l.age}` : 'Pre-K1'),
        enrollment_status: l.enrollment_status || 'Enrolled',
        parent_name: l.parent_name || '—',
      }));
    },
  },
  {
    id: 'activity',
    title: 'Activity & Curriculum Compliance Report',
    description: 'Submitted learning activities, materials, and MSWD verification status.',
    allowedRoles: ['superadmin', 'admin', 'teacher'],
    columns: [
      { key: 'title', label: 'Activity / Material' },
      { key: 'barangay', label: 'Barangay' },
      { key: 'cdc_name', label: 'CDC' },
      { key: 'teacher_name', label: 'Teacher' },
      { key: 'status', label: 'Status' },
      { key: 'created_at', label: 'Date' },
    ],
    buildRows: ({ activityReports = [] }, filters) => {
      return applyCommonFilters(activityReports, filters, (a) => ({
        barangay: a.barangay,
        cdcId: a.cdc_id,
        cdcName: a.cdc_name,
        classId: a.class_id,
        date: a.created_at || a.submitted_at,
      })).map((a) => ({
        title: a.title || a.activity_title || 'Untitled Activity',
        barangay: a.barangay || '—',
        cdc_name: a.cdc_name || '—',
        teacher_name: a.teacher_name || a.submitted_by || '—',
        status: a.status || 'Pending',
        created_at: formatShortDate(a.created_at || a.submitted_at),
      }));
    },
  },
  {
    id: 'teachers_list',
    title: 'List of Teachers / CDWs',
    description: 'Accredited Child Development Workers assigned across Barangays and CDCs.',
    allowedRoles: ['superadmin', 'admin'],
    columns: [
      { key: 'full_name', label: 'Teacher / CDW Name' },
      { key: 'barangay', label: 'Barangay' },
      { key: 'cdc_name', label: 'Assigned CDC' },
      { key: 'contact_number', label: 'Contact' },
      { key: 'email', label: 'Email' },
    ],
    buildRows: ({ teachers = [] }, filters) => {
      return applyCommonFilters(teachers, filters, (t) => ({
        barangay: t.barangay,
        cdcId: t.cdc_id,
        cdcName: t.cdc_name,
      })).map((t) => ({
        full_name: t.full_name || '—',
        barangay: t.barangay || '—',
        cdc_name: t.cdc_name || t.cdcs?.name || '—',
        contact_number: t.contact_number || '—',
        email: t.email || '—',
      }));
    },
  },
  {
    id: 'student_progress',
    title: 'Student Individual Progress Report',
    description: 'Per-learner activity completion and latest assessment summary.',
    allowedRoles: ['superadmin', 'admin', 'teacher'],
    columns: [
      { key: 'full_name', label: 'Learner Name' },
      { key: 'barangay', label: 'Barangay' },
      { key: 'cdc_name', label: 'CDC' },
      { key: 'completed_count', label: 'Completed Activities' },
      { key: 'latest_score', label: 'Latest Standard Score' },
      { key: 'status', label: 'Progress Status' },
    ],
    buildRows: ({ learners = [], assessments = [] }, filters) => {
      const assessMap = new Map();
      assessments.forEach((a) => {
        if (a.student_id || a.learner_id) {
          assessMap.set(a.student_id || a.learner_id, a);
        }
      });
      return applyCommonFilters(learners, filters, (l) => ({
        barangay: l.barangay,
        cdcId: l.cdc_id,
        cdcName: l.cdc_name,
        classId: l.class_id,
      })).map((l) => {
        const latest = assessMap.get(l.id);
        return {
          full_name: l.full_name || '—',
          barangay: l.barangay || '—',
          cdc_name: l.cdc_name || '—',
          completed_count: l.completed_activities ?? 0,
          latest_score: latest?.standard_score ?? latest?.overall_score ?? '—',
          status: latest?.interpretation || 'Active',
        };
      });
    },
  },
  {
    id: 'student_development',
    title: 'Student Development Report',
    description: 'ECCD developmental domain scores and interpretation per learner.',
    allowedRoles: ['superadmin', 'admin', 'teacher'],
    columns: [
      { key: 'learner_name', label: 'Learner Name' },
      { key: 'barangay', label: 'Barangay' },
      { key: 'gross_motor', label: 'Gross Motor' },
      { key: 'fine_motor', label: 'Fine Motor' },
      { key: 'self_help', label: 'Self-Help' },
      { key: 'receptive_lang', label: 'Receptive Lang' },
      { key: 'expressive_lang', label: 'Expressive Lang' },
      { key: 'cognitive', label: 'Cognitive' },
      { key: 'social_emotional', label: 'Social-Emotional' },
      { key: 'standard_score', label: 'Standard Score' },
    ],
    buildRows: ({ assessments = [] }, filters) => {
      return applyCommonFilters(assessments, filters, (a) => ({
        barangay: a.barangay,
        cdcId: a.cdc_id,
        cdcName: a.cdc_name,
        date: a.assessed_at || a.created_at,
      })).map((a) => ({
        learner_name: a.learner_name || a.student_name || '—',
        barangay: a.barangay || '—',
        gross_motor: a.gross_motor ?? '—',
        fine_motor: a.fine_motor ?? '—',
        self_help: a.self_help ?? '—',
        receptive_lang: a.receptive_language ?? a.receptive_lang ?? '—',
        expressive_lang: a.expressive_language ?? a.expressive_lang ?? '—',
        cognitive: a.cognitive ?? '—',
        social_emotional: a.social_emotional ?? '—',
        standard_score: a.standard_score ?? a.overall_score ?? '—',
      }));
    },
  },
  {
    id: 'eccd_form_1_1',
    title: 'Monthly Center Outcomes (ECCD Council Form 1.1)',
    description:
      'ECCD Council Form 1.1 style summary: domain scaled scores, overall standard score, and 3–6 month improvement.',
    allowedRoles: ['superadmin', 'admin', 'teacher'],
    columns: [
      { key: 'cdc_name', label: 'Child Development Center' },
      { key: 'barangay', label: 'Barangay' },
      { key: 'learners_assessed', label: 'Assessed' },
      { key: 'avg_scaled_score', label: 'Avg Domain Scaled Score' },
      { key: 'avg_standard_score', label: 'Overall Standard Score' },
      { key: 'improvement_3_6_mo', label: '3–6 Mo Improvement' },
    ],
    buildRows: ({ assessments = [], cdcs = [] }, filters) => {
      const grouped = new Map();
      const filteredAssessments = applyCommonFilters(assessments, filters, (a) => ({
        barangay: a.barangay,
        cdcId: a.cdc_id,
        cdcName: a.cdc_name,
        date: a.assessed_at || a.created_at,
      }));

      filteredAssessments.forEach((a) => {
        const key = a.cdc_name || a.barangay || 'Municipal CDC';
        if (!grouped.has(key)) {
          grouped.set(key, {
            cdc_name: a.cdc_name || `${a.barangay || 'Municipal'} CDC`,
            barangay: a.barangay || '—',
            scores: [],
            standardScores: [],
            improvements: [],
          });
        }
        const entry = grouped.get(key);
        const std = Number(a.standard_score ?? a.overall_score);
        if (!Number.isNaN(std) && std > 0) entry.standardScores.push(std);
        const scaled = avgOf([
          a.gross_motor,
          a.fine_motor,
          a.self_help,
          a.receptive_language ?? a.receptive_lang,
          a.expressive_language ?? a.expressive_lang,
          a.cognitive,
          a.social_emotional,
        ]);
        if (scaled !== null) entry.scores.push(scaled);
        if (a.improvement_delta != null && !Number.isNaN(Number(a.improvement_delta))) {
          entry.improvements.push(Number(a.improvement_delta));
        }
      });

      if (grouped.size === 0 && cdcs.length > 0) {
        return applyCommonFilters(cdcs, filters, (c) => ({
          barangay: c.barangay,
          cdcId: c.id,
          cdcName: c.name,
        })).map((c) => ({
          cdc_name: c.name,
          barangay: c.barangay || '—',
          learners_assessed: 0,
          avg_scaled_score: '—',
          avg_standard_score: '—',
          improvement_3_6_mo: 'Pending 2nd assessment',
        }));
      }

      return Array.from(grouped.values()).map((g) => ({
        cdc_name: g.cdc_name,
        barangay: g.barangay,
        learners_assessed: g.standardScores.length || g.scores.length,
        avg_scaled_score: g.scores.length ? (g.scores.reduce((s, v) => s + v, 0) / g.scores.length).toFixed(1) : '—',
        avg_standard_score: g.standardScores.length
          ? (g.standardScores.reduce((s, v) => s + v, 0) / g.standardScores.length).toFixed(1)
          : '—',
        improvement_3_6_mo: g.improvements.length
          ? `+${(g.improvements.reduce((s, v) => s + v, 0) / g.improvements.length).toFixed(1)} pts`
          : 'Baseline',
      }));
    },
  },
];

function avgOf(values) {
  const nums = values.map(Number).filter((n) => !Number.isNaN(n) && n > 0);
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function formatShortDate(val) {
  if (!val) return '—';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return String(val);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function applyCommonFilters(items, filters = {}, extract) {
  const { barangay, cdcId, classId, dateFrom, dateTo } = filters;
  return items.filter((item) => {
    const meta = extract(item);
    if (barangay && meta.barangay && meta.barangay.toLowerCase() !== barangay.toLowerCase()) {
      return false;
    }
    if (cdcId && meta.cdcId && String(meta.cdcId) !== String(cdcId)) {
      return false;
    }
    if (classId && meta.classId && String(meta.classId) !== String(classId)) {
      return false;
    }
    if ((dateFrom || dateTo) && meta.date) {
      const t = new Date(meta.date).getTime();
      if (!Number.isNaN(t)) {
        if (dateFrom && t < new Date(dateFrom).getTime()) return false;
        if (dateTo && t > new Date(`${dateTo}T23:59:59`).getTime()) return false;
      }
    }
    return true;
  });
}

export function exportReportToCsv(filename, columns, rows) {
  const escape = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = columns.map((c) => escape(c.label)).join(',');
  const body = rows.map((r) => columns.map((c) => escape(r[c.key])).join(',')).join('\n');
  const csv = `${header}\n${body}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function logReportExport(supabase, { reportId, format, filters }) {
  try {
    await supabase.rpc('log_event', {
      p_action: 'report_export',
      p_entity_type: 'report',
      p_entity_id: reportId,
      p_metadata: { format, filters },
    });
  } catch {
    // Non-blocking audit log
  }
}
