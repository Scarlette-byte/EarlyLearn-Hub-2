import { useState, useMemo, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient.js';
import {
  cleanStudentName,
  isPlaceholderStudentName,
  getAssessmentsForTeacher,
  saveEccdAssessmentToSupabase,
  canTeacherManageLearnerAssessment,
} from '../../lib/learnersService.js';
import TeacherReportSheet, {
  formatAgeInYears,
  getRatingBadgeClass,
} from './TeacherReportSheet.jsx';

export default function TeacherChildDevelopment({
  teacherProfile,
  teacherBarangay = '',
  cdcName = '',
  learners = [],
  onRefreshLearners,
}) {
  const teacherId = teacherProfile?.id;
  const teacherName = teacherProfile?.full_name || 'Child Development Teacher';

  // Multi-device state: loaded strictly from Supabase (never localStorage or IndexedDB)
  const [assessments, setAssessments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  // Modal states
  const [activeDossier, setActiveDossier] = useState(null);
  const [evaluatingLearner, setEvaluatingLearner] = useState(null);
  const [reportModal, setReportModal] = useState(null); // { mode: 'learner' | 'class', learner?: object }

  // Evaluation Form state
  const [evalForm, setEvalForm] = useState({
    id: null,
    child_id: '',
    child_name: '',
    age: 3,
    level: 'Pre-K1',
    date: new Date().toISOString().split('T')[0],
    cognitive_status: 'Developing as Expected',
    physical_status: 'Developing as Expected',
    social_status: 'Developing as Expected',
    language_status: 'Developing as Expected',
    overall_status: 'Developing as Expected',
    observations: '',
    recommendation: '',
  });

  const [msg, setMsg] = useState({ text: '', type: '' });

  const loadAssessmentsFromSupabase = useCallback(async () => {
    setIsLoading(true);
    try {
      const synced = await getAssessmentsForTeacher({
        teacherProfile,
        assignedLearners: learners,
        teacherBarangay,
        cdcName,
      });
      setAssessments(synced);
    } catch (err) {
      console.warn('Error loading assessments from Supabase:', err);
    } finally {
      setIsLoading(false);
    }
  }, [teacherProfile, learners, teacherBarangay, cdcName]);

  useEffect(() => {
    loadAssessmentsFromSupabase();

    const handleSync = () => {
      loadAssessmentsFromSupabase();
    };
    window.addEventListener('earlylearn_assessments_updated', handleSync);

    const channel = supabase
      .channel('teacher-eccd-assessments-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'eccd_assessments' },
        () => loadAssessmentsFromSupabase()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'learners' },
        () => loadAssessmentsFromSupabase()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'materials' },
        () => loadAssessmentsFromSupabase()
      )
      .subscribe();

    return () => {
      window.removeEventListener('earlylearn_assessments_updated', handleSync);
      supabase.removeChannel(channel);
    };
  }, [loadAssessmentsFromSupabase]);

  // Map assessments by child_id or child_name
  const assessmentMap = useMemo(() => {
    const map = new Map();
    assessments.forEach((a) => {
      if (!a || isPlaceholderStudentName(a.child_name || '')) return;
      if (a.child_id) map.set(String(a.child_id), a);
      if (a.child_name) map.set(a.child_name.trim().toLowerCase(), a);
    });
    return map;
  }, [assessments]);

  // Combine teacher's scoped learners with their evaluation record, sorting unevaluated learners first
  const enrichedLearners = useMemo(() => {
    const seen = new Set();
    const list = [];

    learners.forEach((l) => {
      const cleaned = cleanStudentName(l.full_name || '');
      if (!cleaned || isPlaceholderStudentName(cleaned)) return;
      if (
        !canTeacherManageLearnerAssessment(
          l,
          teacherProfile,
          learners,
          teacherBarangay,
          cdcName
        )
      ) {
        return;
      }

      const normName = cleaned.toLowerCase();
      if (seen.has(normName)) return;
      seen.add(normName);

      const existing =
        (l.id && assessmentMap.get(String(l.id))) || assessmentMap.get(normName) || null;

      list.push({
        ...l,
        full_name: cleaned,
        assessment: existing,
      });
    });

    // Unevaluated learners first, then alphabetical by learner name
    list.sort((a, b) => {
      const aEvaluated = Boolean(a.assessment);
      const bEvaluated = Boolean(b.assessment);
      if (aEvaluated !== bEvaluated) {
        return aEvaluated ? 1 : -1;
      }
      return (a.full_name || '').localeCompare(b.full_name || '');
    });

    return list;
  }, [learners, assessmentMap, teacherProfile, teacherBarangay, cdcName]);

  // Filter learners by learner name and status
  const filteredLearners = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return enrichedLearners.filter((l) => {
      const matchSearch = !query || (l.full_name || '').toLowerCase().includes(query);
      if (!matchSearch) return false;

      if (filterStatus === 'all') return true;
      if (filterStatus === 'evaluated') return Boolean(l.assessment);
      if (filterStatus === 'pending') return !l.assessment;
      return l.assessment?.overall_status === filterStatus;
    });
  }, [enrichedLearners, searchTerm, filterStatus]);

  // Summary counts
  const totalLearners = enrichedLearners.length;
  const evaluatedCount = enrichedLearners.filter((l) => Boolean(l.assessment)).length;
  const pendingCount = totalLearners - evaluatedCount;

  // Auto-calculate overall status based on 4 domain ratings
  function calculateOverallStatus(cog, phys, soc, lang) {
    const ratings = [cog, phys, soc, lang];
    if (ratings.includes('Delay')) return 'Requires Follow-up';
    if (ratings.includes('Needs Support')) return 'Needs Reinforcement';
    return 'Developing as Expected';
  }

  function handleOpenEvaluate(learner) {
    if (!canTeacherManageLearnerAssessment(learner, teacherProfile, learners, teacherBarangay, cdcName)) {
      setMsg({
        text: 'You can only manage assessments for learners assigned to your class.',
        type: 'error',
      });
      return;
    }

    const normName = (learner.full_name || '').trim().toLowerCase();
    const existing = (learner.id && assessmentMap.get(String(learner.id))) || assessmentMap.get(normName);

    setEvaluatingLearner(learner);
    if (existing) {
      setEvalForm({
        id: existing.id,
        child_id: learner.id,
        child_name: learner.full_name,
        age: learner.age || learner.child_age || 3,
        level: existing.level || (String(learner.child_age || '').includes('4') ? 'Pre-K2' : 'Pre-K1'),
        date: existing.date || new Date().toISOString().split('T')[0],
        cognitive_status: existing.cognitive_status || 'Developing as Expected',
        physical_status: existing.physical_status || 'Developing as Expected',
        social_status: existing.social_status || 'Developing as Expected',
        language_status: existing.language_status || 'Developing as Expected',
        overall_status: existing.overall_status || 'Developing as Expected',
        observations: existing.observations || '',
        recommendation: existing.recommendation || '',
      });
    } else {
      setEvalForm({
        id: null,
        child_id: learner.id,
        child_name: learner.full_name,
        age: learner.age || learner.child_age || 3,
        level: String(learner.child_age || '').includes('4') ? 'Pre-K2' : 'Pre-K1',
        date: new Date().toISOString().split('T')[0],
        cognitive_status: 'Developing as Expected',
        physical_status: 'Developing as Expected',
        social_status: 'Developing as Expected',
        language_status: 'Developing as Expected',
        overall_status: 'Developing as Expected',
        observations: '',
        recommendation: '',
      });
    }
  }

  function handleDomainChange(domain, value) {
    setEvalForm((prev) => {
      const updated = { ...prev, [domain]: value };
      const newOverall = calculateOverallStatus(
        domain === 'cognitive_status' ? value : updated.cognitive_status,
        domain === 'physical_status' ? value : updated.physical_status,
        domain === 'social_status' ? value : updated.social_status,
        domain === 'language_status' ? value : updated.language_status
      );
      return { ...updated, overall_status: newOverall };
    });
  }

  async function handleSaveAssessment(e) {
    e.preventDefault();
    if (!evaluatingLearner || isSaving) return;

    const record = {
      id: evalForm.id || `ass-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      child_id: evaluatingLearner.id,
      child_name: evaluatingLearner.full_name,
      age: evalForm.age,
      level: evalForm.level,
      barangay: evaluatingLearner.barangay || teacherBarangay,
      cdc_name: evaluatingLearner.cdc_name || cdcName,
      teacher_id: teacherId,
      teacher_name: teacherName,
      date: evalForm.date,
      cognitive_status: evalForm.cognitive_status,
      physical_status: evalForm.physical_status,
      social_status: evalForm.social_status,
      language_status: evalForm.language_status,
      overall_status: evalForm.overall_status,
      observations: evalForm.observations.trim(),
      recommendation: evalForm.recommendation.trim(),
      updated_at: new Date().toISOString(),
    };

    setIsSaving(true);
    try {
      const saved = await saveEccdAssessmentToSupabase({
        assessmentRecord: record,
        teacherProfile,
        assignedLearners: learners,
        teacherBarangay,
        cdcName,
      });

      setAssessments((prev) => {
        const filtered = prev.filter(
          (a) =>
            a.id !== saved.id &&
            (!saved.child_id || a.child_id !== saved.child_id) &&
            (a.child_name || '').trim().toLowerCase() !== saved.child_name.trim().toLowerCase()
        );
        return [saved, ...filtered];
      });

      setEvaluatingLearner(null);
      setMsg({
        text: `Saved evaluation for ${evaluatingLearner.full_name}.`,
        type: 'ok',
      });
      setTimeout(() => setMsg({ text: '', type: '' }), 4000);
    } catch (err) {
      setMsg({
        text: err.message || 'Could not save assessment.',
        type: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  }

  function getDomainPill(score, label) {
    return (
      <span className={`px-2 py-0.5 rounded-md text-[10.5px] font-bold ${getRatingBadgeClass(score)}`}>
        {label}: {score}
      </span>
    );
  }

  const effectiveCenterName =
    cdcName ||
    (teacherBarangay
      ? `${teacherBarangay} Child Development Center`
      : 'Child Development Center');

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#FAF5EC] via-[#FFFDF8] to-[#FFF8EE] p-5 sm:p-6 rounded-3xl border border-card-border shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
            <span>🌱</span>
            <span>Child Development Evaluation</span>
          </div>
          <h2 className="font-fraunces text-2xl sm:text-3xl font-bold text-dash-ink m-0">
            Child Development
          </h2>
          <p className="text-xs sm:text-sm text-dash-ink-soft leading-relaxed m-0">
            Record and print child development evaluations for your class at{' '}
            <strong className="text-dash-ink">{effectiveCenterName}</strong>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setReportModal({ mode: 'class' })}
            className="px-4 py-2.5 rounded-xl bg-accent hover:bg-[#B5673C] text-white font-bold text-xs shadow-xs cursor-pointer"
          >
            Class Report
          </button>

          {onRefreshLearners && (
            <button
              type="button"
              onClick={() => {
                onRefreshLearners();
                loadAssessmentsFromSupabase();
              }}
              className="px-3.5 py-2.5 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-dash-ink font-bold text-xs cursor-pointer"
            >
              Refresh
            </button>
          )}
        </div>
      </div>

      {msg.text && (
        <div
          className={`p-3.5 rounded-2xl text-xs font-bold ${
            msg.type === 'error'
              ? 'bg-rose-50 text-rose-800 border border-rose-200'
              : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* Single Summary Line + Search and Filter Bar */}
      <div className="bg-white rounded-2xl p-4 border border-card-border shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="text-sm font-bold text-dash-ink">
          {totalLearners} learners • {evaluatedCount} evaluated • {pendingCount} pending
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full md:w-auto">
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              placeholder="Search learner name"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-2 rounded-xl border border-gray-300 bg-white text-xs font-semibold text-dash-ink outline-none focus:border-accent"
            />
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
              🔍
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <label className="text-xs font-bold text-dash-ink-soft shrink-0">Filter:</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full sm:w-auto px-3 py-2 rounded-xl border border-gray-300 bg-white text-xs font-bold text-dash-ink outline-none focus:border-accent"
            >
              <option value="all">All learners ({totalLearners})</option>
              <option value="pending">Pending ({pendingCount})</option>
              <option value="evaluated">Evaluated ({evaluatedCount})</option>
              <option value="Developing as Expected">Developing as Expected</option>
              <option value="Needs Reinforcement">Needs Reinforcement</option>
              <option value="Requires Follow-up">Requires Follow-up</option>
            </select>
          </div>
        </div>
      </div>

      {/* Learners & Assessments Table */}
      <div className="bg-white rounded-2xl border border-card-border shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-[#FAF5EC] border-b border-card-border text-xs font-bold text-[#8C7F63]">
                <th className="px-4 py-3">Learner and age</th>
                <th className="px-4 py-3">Contact and barangay</th>
                <th className="px-4 py-3">Domain ratings</th>
                <th className="px-4 py-3 text-center">Overall result</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F6F1E7] text-dash-ink">
              {isLoading && filteredLearners.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-dash-ink-soft">
                    Loading learners and evaluations...
                  </td>
                </tr>
              ) : filteredLearners.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-dash-ink-soft">
                    {totalLearners === 0 ? (
                      <div className="space-y-1.5 max-w-md mx-auto py-3">
                        <div className="text-2xl">🧒</div>
                        <div className="font-bold text-sm text-dash-ink">
                          No learners in your class yet
                        </div>
                        <p className="text-xs text-dash-ink-soft m-0">
                          Learners enrolled under <strong>{effectiveCenterName}</strong> will appear
                          here.
                        </p>
                      </div>
                    ) : (
                      'No learners found matching your search.'
                    )}
                  </td>
                </tr>
              ) : (
                filteredLearners.map((l) => {
                  const ass = l.assessment;
                  return (
                    <tr key={l.id || l.full_name} className="hover:bg-amber-50/30 transition-colors">
                      {/* Learner and age */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="text-base">🧒</span>
                          <div>
                            <div className="font-bold text-sm text-dash-ink">{l.full_name}</div>
                            <div className="text-[11px] text-dash-ink-soft">
                              {formatAgeInYears(l)} • Brgy. {l.barangay || teacherBarangay || '—'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Contact and barangay */}
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-dash-ink">{l.parent_contact || '—'}</div>
                        <div className="text-[11px] text-dash-ink-soft">
                          Brgy. {l.barangay || teacherBarangay || '—'}
                        </div>
                      </td>

                      {/* 4 Domain ratings */}
                      <td className="px-4 py-3.5">
                        {ass ? (
                          <div className="space-y-1.5">
                            <div className="flex flex-wrap gap-1.5">
                              {getDomainPill(ass.cognitive_status, 'Cognitive')}
                              {getDomainPill(ass.physical_status, 'Physical')}
                              {getDomainPill(ass.social_status, 'Social')}
                              {getDomainPill(ass.language_status, 'Language')}
                            </div>
                            <div className="text-[10px] text-dash-ink-soft">
                              Evaluated on {ass.date}
                            </div>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600 font-semibold text-[11px]">
                            Not evaluated yet
                          </span>
                        )}
                      </td>

                      {/* Overall result */}
                      <td className="px-4 py-3.5 text-center">
                        {ass ? (
                          <span
                            className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold ${getRatingBadgeClass(
                              ass.overall_status
                            )}`}
                          >
                            {ass.overall_status}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">Pending</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                          {ass ? (
                            <>
                              <button
                                type="button"
                                onClick={() => setActiveDossier({ ...ass, learner: l })}
                                className="px-2.5 py-1.5 rounded-lg bg-[#FAF5EC] hover:bg-[#EFE8DC] text-dash-ink font-bold text-xs cursor-pointer"
                              >
                                View
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenEvaluate(l)}
                                className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer"
                              >
                                Edit
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleOpenEvaluate(l)}
                              className="px-3 py-1.5 rounded-lg bg-accent hover:bg-[#B5673C] text-white font-bold text-xs shadow-xs cursor-pointer"
                            >
                              Evaluate Child
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setReportModal({ mode: 'learner', learner: l })}
                            className="px-2.5 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-dash-ink font-bold text-xs cursor-pointer"
                          >
                            Print Report
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Evaluation Form Modal */}
      {evaluatingLearner && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-xl border border-card-border space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-card-border pb-3.5">
              <div>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                  Child Evaluation Form
                </span>
                <h3 className="font-fraunces text-xl font-bold text-dash-ink mt-1">
                  {evalForm.child_name}
                </h3>
                <p className="text-xs text-dash-ink-soft m-0">
                  Teacher: {teacherName} • {effectiveCenterName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEvaluatingLearner(null)}
                className="w-8 h-8 rounded-full bg-[#FAF5EC] text-dash-ink font-bold text-sm hover:bg-[#EFE8DC] cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAssessment} className="space-y-4 text-xs text-dash-ink">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-dash-ink mb-1">Assessment date</label>
                  <input
                    type="date"
                    required
                    value={evalForm.date}
                    onChange={(e) => setEvalForm({ ...evalForm, date: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 font-semibold text-xs outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block font-bold text-dash-ink mb-1">Class level</label>
                  <select
                    value={evalForm.level}
                    onChange={(e) => setEvalForm({ ...evalForm, level: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 font-bold text-xs outline-none focus:border-accent"
                  >
                    <option value="Pre-K1">3 to 3.11 years (Pre-K1)</option>
                    <option value="Pre-K2">4 to 4.11 years (Pre-K2)</option>
                  </select>
                </div>
              </div>

              {/* 4 Developmental Domains Selection */}
              <div className="space-y-3 pt-1">
                <div className="font-bold text-sm text-dash-ink">Select rating for each domain:</div>

                {[
                  {
                    key: 'cognitive_status',
                    title: '1. Cognitive',
                    desc: 'Color sorting, counting 1 to 5, basic shapes, and simple puzzles',
                    boxClass: 'bg-amber-50/40 border-amber-200/60',
                  },
                  {
                    key: 'physical_status',
                    title: '2. Physical and Motor',
                    desc: 'Balance, jumping, holding a crayon, line tracing, and playdough',
                    boxClass: 'bg-blue-50/40 border-blue-200/60',
                  },
                  {
                    key: 'social_status',
                    title: '3. Social-Emotional',
                    desc: 'Sharing toys, joining group activities, following rules, and kindness',
                    boxClass: 'bg-orange-50/40 border-orange-200/60',
                  },
                  {
                    key: 'language_status',
                    title: '4. Language',
                    desc: 'Speaking clearly, learning new words, rhymes, and listening to stories',
                    boxClass: 'bg-purple-50/40 border-purple-200/60',
                  },
                ].map((dom) => (
                  <div
                    key={dom.key}
                    className={`p-3.5 rounded-2xl border space-y-2 ${dom.boxClass}`}
                  >
                    <div>
                      <div className="font-bold text-dash-ink">{dom.title}</div>
                      <div className="text-[11px] text-dash-ink-soft">{dom.desc}</div>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {['Developing as Expected', 'Needs Support', 'Delay'].map((status) => {
                        const isSelected = evalForm[dom.key] === status;
                        let selectedStyle = 'bg-[#DCEBDD] text-[#2E6B38] border-[#2E6B38]';
                        if (status === 'Needs Support') {
                          selectedStyle = 'bg-[#FFF3D6] text-[#8C6200] border-[#8C6200]';
                        } else if (status === 'Delay') {
                          selectedStyle = 'bg-[#FDE2E2] text-[#9E2A2B] border-[#9E2A2B]';
                        }
                        return (
                          <button
                            type="button"
                            key={status}
                            onClick={() => handleDomainChange(dom.key, status)}
                            className={`px-3 py-1.5 rounded-xl font-bold text-xs border transition-all cursor-pointer ${
                              isSelected
                                ? `${selectedStyle} ring-2 ring-offset-1 ring-gray-400`
                                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            {status}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Overall Result */}
              <div>
                <label className="block font-bold text-dash-ink mb-1">Overall result</label>
                <select
                  value={evalForm.overall_status}
                  onChange={(e) => setEvalForm({ ...evalForm, overall_status: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 font-bold text-xs outline-none focus:border-accent"
                >
                  <option value="Developing as Expected">Developing as Expected</option>
                  <option value="Needs Reinforcement">Needs Reinforcement</option>
                  <option value="Requires Follow-up">Requires Follow-up</option>
                </select>
              </div>

              {/* Observations */}
              <div>
                <label className="block font-bold text-dash-ink mb-1">Teacher observations</label>
                <textarea
                  rows="2"
                  value={evalForm.observations}
                  onChange={(e) => setEvalForm({ ...evalForm, observations: e.target.value })}
                  placeholder="Write short notes on how the child is doing in class..."
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs font-medium outline-none focus:border-accent resize-none"
                />
              </div>

              {/* Recommendation */}
              <div>
                <label className="block font-bold text-dash-ink mb-1">Recommendation</label>
                <textarea
                  rows="2"
                  value={evalForm.recommendation}
                  onChange={(e) => setEvalForm({ ...evalForm, recommendation: e.target.value })}
                  placeholder="Write simple tips for parents to practice at home..."
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs font-medium outline-none focus:border-accent resize-none"
                />
              </div>

              {/* Modal Actions */}
              <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-card-border">
                <button
                  type="button"
                  onClick={() => setEvaluatingLearner(null)}
                  className="px-4 py-2 rounded-xl border border-gray-300 text-dash-ink font-bold text-xs hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-accent hover:bg-[#B5673C] text-white font-bold text-xs shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save Evaluation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Dossier Modal (Uses isolated @media print so only the dossier prints) */}
      {activeDossier && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <style>{`
            @media print {
              body * {
                visibility: hidden !important;
              }
              #teacher-printable-dossier,
              #teacher-printable-dossier * {
                visibility: visible !important;
              }
              #teacher-printable-dossier {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                max-width: 100% !important;
                margin: 0 !important;
                padding: 16px !important;
                box-shadow: none !important;
                border: none !important;
                background: #ffffff !important;
              }
              .no-print {
                display: none !important;
              }
            }
          `}</style>

          <div
            id="teacher-printable-dossier"
            className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-xl border border-card-border space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-start justify-between border-b border-card-border pb-3.5">
              <div>
                <div className="text-xs font-bold text-dash-ink-soft">
                  Municipality of Manolo Fortich, Bukidnon - MSWDO
                </div>
                <h3 className="font-fraunces text-xl font-bold text-dash-ink mt-0.5">
                  {activeDossier.child_name}
                </h3>
                <p className="text-xs text-dash-ink-soft m-0">
                  {activeDossier.cdc_name || effectiveCenterName} • Evaluated on {activeDossier.date}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveDossier(null)}
                className="no-print w-8 h-8 rounded-full bg-[#FAF5EC] text-dash-ink font-bold text-sm hover:bg-[#EFE8DC] cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="font-bold text-dash-ink">Domain ratings:</div>

              {[
                { label: '1. Cognitive', value: activeDossier.cognitive_status },
                { label: '2. Physical and Motor', value: activeDossier.physical_status },
                { label: '3. Social-Emotional', value: activeDossier.social_status },
                { label: '4. Language', value: activeDossier.language_status },
              ].map((dom) => (
                <div
                  key={dom.label}
                  className="p-3 rounded-xl bg-[#FAF5EC] border border-card-border flex items-center justify-between"
                >
                  <div className="font-bold text-dash-ink">{dom.label}</div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${getRatingBadgeClass(
                      dom.value
                    )}`}
                  >
                    {dom.value}
                  </span>
                </div>
              ))}

              <div className="p-3.5 rounded-xl bg-stone-50 border border-card-border flex items-center justify-between">
                <div className="font-bold text-dash-ink">Overall result:</div>
                <span
                  className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${getRatingBadgeClass(
                    activeDossier.overall_status
                  )}`}
                >
                  {activeDossier.overall_status}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-[#FFFDF8] border border-card-border space-y-1">
                <div className="font-bold text-dash-ink">Teacher observations:</div>
                <p className="text-xs text-dash-ink-soft leading-relaxed m-0">
                  {activeDossier.observations || 'No observations recorded.'}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#FFFDF8] border border-card-border space-y-1">
                <div className="font-bold text-dash-ink">Recommendation:</div>
                <p className="text-xs text-dash-ink-soft leading-relaxed m-0">
                  {activeDossier.recommendation || 'No recommendation recorded.'}
                </p>
              </div>

              <div className="pt-4 grid grid-cols-2 gap-6 border-t border-gray-200 text-xs">
                <div>
                  <div className="text-dash-ink-soft mb-4">Prepared by:</div>
                  <div className="font-bold text-dash-ink border-b border-gray-400 pb-0.5">
                    {activeDossier.teacher_name || teacherName}
                  </div>
                </div>
                <div>
                  <div className="text-dash-ink-soft mb-4">Noted by:</div>
                  <div className="font-bold text-dash-ink border-b border-gray-400 pb-0.5">
                    MSWDO
                  </div>
                </div>
              </div>
            </div>

            <div className="no-print pt-2 flex items-center justify-end gap-2.5 border-t border-card-border">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-5 py-2.5 rounded-xl bg-accent hover:bg-[#B5673C] text-white font-bold text-xs shadow-xs cursor-pointer"
              >
                Print or Save as PDF
              </button>
              <button
                type="button"
                onClick={() => setActiveDossier(null)}
                className="px-4 py-2.5 rounded-xl border border-gray-300 text-dash-ink font-bold text-xs hover:bg-gray-50 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Report Sheet Modal (Individual Learner Report or Class Report) */}
      {reportModal && (
        <TeacherReportSheet
          mode={reportModal.mode}
          learner={reportModal.learner || null}
          learners={enrichedLearners}
          cdcName={effectiveCenterName}
          teacherBarangay={teacherBarangay}
          teacherName={teacherName}
          onClose={() => setReportModal(null)}
        />
      )}
    </div>
  );
}
