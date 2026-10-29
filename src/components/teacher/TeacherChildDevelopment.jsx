import { useState, useMemo, useEffect } from 'react';
import { cleanStudentName } from '../../lib/learnersService.js';

const STORAGE_KEY = 'earlylearn_teacher_eccd_assessments';

export default function TeacherChildDevelopment({
  teacherProfile,
  teacherBarangay = '',
  cdcName = '',
  learners = [],
  onRefreshLearners,
}) {
  const teacherId = teacherProfile?.id;
  const teacherName = teacherProfile?.full_name || 'Child Development Teacher';

  // Load stored teacher assessments
  const [assessments, setAssessments] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed)
        ? parsed.filter((a) => (a.child_name || '').trim().toLowerCase() !== 'hannah mae tion')
        : [];
    } catch {
      return [];
    }
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // 'all' | 'evaluated' | 'pending' | 'Developing as Expected' | 'Needs Reinforcement' | 'Requires Follow-up'

  // Modal states
  const [activeDossier, setActiveDossier] = useState(null);
  const [evaluatingLearner, setEvaluatingLearner] = useState(null);

  // Evaluation Form state
  const [evalForm, setEvalForm] = useState({
    id: null,
    child_id: '',
    child_name: '',
    age: 3,
    level: 'PRE-K 1',
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

  // Map assessments by child_id or child_name
  const assessmentMap = useMemo(() => {
    const map = new Map();
    assessments.forEach((a) => {
      if (a.child_id) map.set(String(a.child_id), a);
      if (a.child_name) map.set(a.child_name.trim().toLowerCase(), a);
    });
    return map;
  }, [assessments]);

  // Combine learners with their evaluation record (1 record per student, student name only)
  const enrichedLearners = useMemo(() => {
    const seen = new Set();
    const list = [];
    learners.forEach((l) => {
      const cleaned = cleanStudentName(l.full_name || '');
      if (!cleaned) return;
      const normName = cleaned.toLowerCase();
      if (seen.has(normName)) return;
      seen.add(normName);

      const existing = (l.id && assessmentMap.get(String(l.id))) || assessmentMap.get(normName) || null;
      list.push({
        ...l,
        full_name: cleaned,
        assessment: existing,
      });
    });
    return list;
  }, [learners, assessmentMap]);

  // Filter learners
  const filteredLearners = useMemo(() => {
    return enrichedLearners.filter((l) => {
      const matchSearch =
        !searchTerm ||
        (l.full_name || '').toLowerCase().includes(searchTerm.toLowerCase());

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
  const normalCount = enrichedLearners.filter(
    (l) => l.assessment?.overall_status === 'Developing as Expected'
  ).length;
  const needsAttentionCount = evaluatedCount - normalCount;

  // Auto-calculate suggested overall status based on domain ratings
  function calculateOverallStatus(cog, phys, soc, lang) {
    const ratings = [cog, phys, soc, lang];
    if (ratings.includes('Delay')) return 'Requires Follow-up';
    if (ratings.includes('Needs Support')) return 'Needs Reinforcement';
    return 'Developing as Expected';
  }

  function handleOpenEvaluate(learner) {
    const normName = (learner.full_name || '').trim().toLowerCase();
    const existing = (learner.id && assessmentMap.get(String(learner.id))) || assessmentMap.get(normName);

    setEvaluatingLearner(learner);
    if (existing) {
      setEvalForm({
        id: existing.id,
        child_id: learner.id,
        child_name: learner.full_name,
        age: learner.age || learner.child_age || 3,
        level: learner.level || (learner.child_age === '5-6' ? 'PRE-K 2' : 'PRE-K 1'),
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
        level: learner.level || (learner.child_age === '5-6' ? 'PRE-K 2' : 'PRE-K 1'),
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

  function handleSaveAssessment(e) {
    e.preventDefault();
    if (!evaluatingLearner) return;

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

    const updatedList = assessments.filter(
      (a) =>
        a.id !== record.id &&
        a.child_id !== record.child_id &&
        (a.child_name || '').trim().toLowerCase() !== record.child_name.trim().toLowerCase()
    );
    updatedList.unshift(record);

    setAssessments(updatedList);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));
      window.dispatchEvent(new Event('earlylearn_assessments_updated'));
    } catch (err) {
      console.warn('Failed saving assessment:', err);
    }

    setEvaluatingLearner(null);
    setMsg({
      text: `✅ Developmental evaluation saved for ${evaluatingLearner.full_name}!`,
      type: 'ok',
    });
    setTimeout(() => setMsg({ text: '', type: '' }), 4000);
  }

  function getStatusBadge(status) {
    switch (status) {
      case 'Developing as Expected':
        return 'bg-[#DCEBDD] text-[#2E6B38] border border-[#BDE0C0]';
      case 'Needs Reinforcement':
        return 'bg-[#FFF3D6] text-[#8C6200] border border-[#F5DC9A]';
      case 'Requires Follow-up':
        return 'bg-[#FDE2E2] text-[#9E2A2B] border border-[#F8B4B4]';
      default:
        return 'bg-gray-100 text-gray-600 border border-gray-200';
    }
  }

  function getDomainPill(score, label) {
    let color = 'bg-[#DCEBDD] text-[#2E6B38]';
    if (score === 'Needs Support') color = 'bg-[#FFF3D6] text-[#8C6200]';
    if (score === 'Delay') color = 'bg-[#FDE2E2] text-[#9E2A2B]';

    return (
      <span className={`px-2 py-0.5 rounded-md text-[10.5px] font-bold ${color}`}>
        {label}: {score}
      </span>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#FAF5EC] via-[#FFFDF8] to-[#FFF8EE] p-6 sm:p-7 rounded-3xl border border-card-border shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
            <span>🌱</span>
            <span>ECCD 4-Domain Evaluations • Classroom Teacher Jurisdiction</span>
          </div>
          <h2 className="font-fraunces text-2xl sm:text-3xl font-bold text-dash-ink m-0">
            Child Development Monitoring
          </h2>
          <p className="text-xs sm:text-sm text-dash-ink-soft leading-relaxed m-0">
            Conduct, record, and monitor early childhood developmental milestone assessments (DepEd ECCD 4-Domain standards) for your assigned students at{' '}
            <strong className="text-dash-ink">{cdcName || (teacherBarangay ? `${teacherBarangay} Child Development Center` : 'Child Development Center')}</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {onRefreshLearners && (
            <button
              onClick={onRefreshLearners}
              className="px-3.5 py-2 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-dash-ink font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Refresh student roster"
            >
              <span>🔄</span> Refresh Roster
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

      {/* KPI Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-card-border shadow-xs">
          <div className="text-[11px] font-bold text-dash-ink-soft uppercase tracking-wider">
            My Enrolled Learners
          </div>
          <div className="font-fraunces text-2xl font-bold text-dash-ink mt-1">
            {totalLearners}
          </div>
          <div className="text-[11px] text-dash-ink-soft mt-0.5">
            Assigned to {teacherName.split(' ')[0]}
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-card-border shadow-xs">
          <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
            Evaluated Learners
          </div>
          <div className="font-fraunces text-2xl font-bold text-emerald-700 mt-1">
            {evaluatedCount}
          </div>
          <div className="text-[11px] text-dash-ink-soft mt-0.5">
            {totalLearners > 0 ? Math.round((evaluatedCount / totalLearners) * 100) : 0}% of your class
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-card-border shadow-xs">
          <div className="text-[11px] font-bold text-[#2E6B38] uppercase tracking-wider">
            Developing as Expected
          </div>
          <div className="font-fraunces text-2xl font-bold text-[#2E6B38] mt-1">
            {normalCount}
          </div>
          <div className="text-[11px] text-dash-ink-soft mt-0.5">On developmental track</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-card-border shadow-xs">
          <div className="text-[11px] font-bold text-[#8C6200] uppercase tracking-wider">
            Pending / Reinforcement
          </div>
          <div className="font-fraunces text-2xl font-bold text-[#8C6200] mt-1">
            {pendingCount + needsAttentionCount}
          </div>
          <div className="text-[11px] text-dash-ink-soft mt-0.5">
            {pendingCount} unassessed • {needsAttentionCount} focus
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-card-border shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <input
            type="text"
            placeholder="Search learner or parent name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-2 rounded-xl border border-gray-300 bg-white text-xs font-semibold text-dash-ink outline-none focus:border-accent"
          />
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
            🔍
          </span>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <label className="text-xs font-bold text-dash-ink-soft shrink-0">Filter Status:</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 rounded-xl border border-gray-300 bg-white text-xs font-bold text-dash-ink outline-none focus:border-accent"
          >
            <option value="all">All Learners ({totalLearners})</option>
            <option value="evaluated">Evaluated ({evaluatedCount})</option>
            <option value="pending">Pending Evaluation ({pendingCount})</option>
            <option value="Developing as Expected">Developing as Expected</option>
            <option value="Needs Reinforcement">Needs Reinforcement</option>
            <option value="Requires Follow-up">Requires Follow-up</option>
          </select>
        </div>
      </div>

      {/* Learners & Assessments Table */}
      <div className="bg-white rounded-2xl border border-card-border shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-[#FAF5EC] border-b border-card-border text-[11px] font-bold text-[#8C7F63] uppercase tracking-wider">
                <th className="px-4 py-3">Learner &amp; Age</th>
                <th className="px-4 py-3">Contact &amp; Barangay</th>
                <th className="px-4 py-3">ECCD 4-Domain Ratings</th>
                <th className="px-4 py-3 text-center">Overall Evaluation</th>
                <th className="px-4 py-3 text-right">Classroom Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F6F1E7] text-dash-ink">
              {filteredLearners.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-dash-ink-soft">
                    {totalLearners === 0 ? (
                      <div className="space-y-2 max-w-md mx-auto py-4">
                        <div className="text-3xl">🧒</div>
                        <div className="font-bold text-sm text-dash-ink">No Real Students Registered Yet</div>
                        <p className="text-xs text-dash-ink-soft">
                          When students sign up or are enrolled under <strong>{cdcName || teacherBarangay}</strong>, they will automatically appear here ready for your 4-Domain developmental assessments.
                        </p>
                      </div>
                    ) : (
                      'No learners found matching your search and filter criteria.'
                    )}
                  </td>
                </tr>
              ) : (
                filteredLearners.map((l) => {
                  const ass = l.assessment;
                  return (
                    <tr key={l.id || l.full_name} className="hover:bg-amber-50/30 transition-colors">
                      {/* Child & Age */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="text-base">🧒</span>
                          <div>
                            <div className="font-bold text-sm text-dash-ink">{l.full_name}</div>
                            <div className="text-[11px] text-dash-ink-soft">
                              {l.birthdate || (l.child_age ? `Age ${l.child_age}` : 'Age 3')} • Brgy. {l.barangay || teacherBarangay}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Contact & Barangay */}
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-dash-ink">{l.parent_contact || '—'}</div>
                        <div className="text-[11px] text-dash-ink-soft">Brgy. {l.barangay || teacherBarangay || '—'}</div>
                      </td>

                      {/* 4-Domains ratings */}
                      <td className="px-4 py-3.5">
                        {ass ? (
                          <div className="space-y-1.5">
                            <div className="flex flex-wrap gap-1.5">
                              {getDomainPill(ass.cognitive_status, 'Cog')}
                              {getDomainPill(ass.physical_status, 'Phys')}
                              {getDomainPill(ass.social_status, 'Soc')}
                              {getDomainPill(ass.language_status, 'Lang')}
                            </div>
                            <div className="text-[10px] text-dash-ink-soft">
                              Evaluated on {ass.date}
                            </div>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600 font-semibold text-[11px]">
                            <span>⏳</span> Pending Evaluation
                          </span>
                        )}
                      </td>

                      {/* Overall Status */}
                      <td className="px-4 py-3.5 text-center">
                        {ass ? (
                          <span
                            className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold ${getStatusBadge(
                              ass.overall_status
                            )}`}
                          >
                            {ass.overall_status}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs italic">Not Assessed</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          {ass ? (
                            <>
                              <button
                                onClick={() => setActiveDossier(ass)}
                                className="px-2.5 py-1 rounded-lg bg-[#FAF5EC] hover:bg-[#EFE8DC] text-dash-ink font-bold text-[11px] transition-colors cursor-pointer"
                              >
                                View Dossier
                              </button>
                              <button
                                onClick={() => handleOpenEvaluate(l)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition-colors cursor-pointer"
                              >
                                Update
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleOpenEvaluate(l)}
                              className="px-3 py-1.5 rounded-lg bg-accent hover:bg-[#B5673C] text-white font-bold text-xs shadow-xs transition-colors cursor-pointer flex items-center gap-1"
                            >
                              <span>+</span> Evaluate Child
                            </button>
                          )}
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

      {/* EVALUATION FORM MODAL */}
      {evaluatingLearner && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-xl border border-card-border space-y-4 animate-pop max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-card-border pb-3.5">
              <div>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 tracking-wider">
                  DepEd ECCD 4-Domain Evaluation (Teacher Form)
                </span>
                <h3 className="font-fraunces text-xl font-bold text-dash-ink mt-1">
                  {evalForm.child_name}
                </h3>
                <p className="text-xs text-dash-ink-soft">
                  Teacher: {teacherName} • {cdcName || teacherBarangay}
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
                  <label className="block font-bold text-dash-ink mb-1">Assessment Date *</label>
                  <input
                    type="date"
                    required
                    value={evalForm.date}
                    onChange={(e) => setEvalForm({ ...evalForm, date: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 font-semibold text-xs outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block font-bold text-dash-ink mb-1">Curriculum Level</label>
                  <select
                    value={evalForm.level}
                    onChange={(e) => setEvalForm({ ...evalForm, level: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 font-bold text-xs outline-none focus:border-accent"
                  >
                    <option value="PRE-K 1">PRE-K 1 (3.11 y/o)</option>
                    <option value="PRE-K 2">PRE-K 2 (4.11 y/o)</option>
                  </select>
                </div>
              </div>

              {/* 4 Developmental Domains Selection */}
              <div className="space-y-3 pt-1">
                <div className="font-bold text-sm text-dash-ink">
                  Assess 4 Core ECCD Developmental Domains:
                </div>

                {/* Domain 1: Cognitive */}
                <div className="p-3.5 rounded-2xl bg-amber-50/40 border border-amber-200/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-dash-ink">1. Cognitive Development</div>
                      <div className="text-[11px] text-dash-ink-soft">
                        Color sorting, counting 1 to 5, basic shape identification, puzzle problem solving
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {['Developing as Expected', 'Needs Support', 'Delay'].map((status) => (
                      <button
                        type="button"
                        key={status}
                        onClick={() => handleDomainChange('cognitive_status', status)}
                        className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                          evalForm.cognitive_status === status
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Domain 2: Physical & Motor */}
                <div className="p-3.5 rounded-2xl bg-blue-50/40 border border-blue-200/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-dash-ink">2. Physical &amp; Motor Development</div>
                      <div className="text-[11px] text-dash-ink-soft">
                        Gross motor balance, jumping, fine motor pincer grasp, crayon tracing, playdough
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {['Developing as Expected', 'Needs Support', 'Delay'].map((status) => (
                      <button
                        type="button"
                        key={status}
                        onClick={() => handleDomainChange('physical_status', status)}
                        className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                          evalForm.physical_status === status
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Domain 3: Social-Emotional */}
                <div className="p-3.5 rounded-2xl bg-orange-50/40 border border-orange-200/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-dash-ink">3. Social-Emotional Development</div>
                      <div className="text-[11px] text-dash-ink-soft">
                        Sharing toys, participation in greeting circles, following routines, empathy
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {['Developing as Expected', 'Needs Support', 'Delay'].map((status) => (
                      <button
                        type="button"
                        key={status}
                        onClick={() => handleDomainChange('social_status', status)}
                        className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                          evalForm.social_status === status
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Domain 4: Language & Communication */}
                <div className="p-3.5 rounded-2xl bg-purple-50/40 border border-purple-200/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-dash-ink">4. Language &amp; Literacy</div>
                      <div className="text-[11px] text-dash-ink-soft">
                        Mother Tongue / English vocabulary, rhymes, expressive speech, listening to stories
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {['Developing as Expected', 'Needs Support', 'Delay'].map((status) => (
                      <button
                        type="button"
                        key={status}
                        onClick={() => handleDomainChange('language_status', status)}
                        className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                          evalForm.language_status === status
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Overall Evaluation Result */}
              <div>
                <label className="block font-bold text-dash-ink mb-1">
                  Overall Developmental Assessment Result
                </label>
                <select
                  value={evalForm.overall_status}
                  onChange={(e) => setEvalForm({ ...evalForm, overall_status: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 font-bold text-xs outline-none focus:border-accent"
                >
                  <option value="Developing as Expected">Developing as Expected</option>
                  <option value="Needs Reinforcement">Needs Reinforcement</option>
                  <option value="Requires Follow-up">Requires Follow-up</option>
                </select>
                <div className="text-[11px] text-dash-ink-soft mt-1">
                  Suggested automatically based on your 4-domain ratings above.
                </div>
              </div>

              {/* Qualitative Observations */}
              <div>
                <label className="block font-bold text-dash-ink mb-1">
                  Teacher Qualitative Observations
                </label>
                <textarea
                  rows="2"
                  value={evalForm.observations}
                  onChange={(e) => setEvalForm({ ...evalForm, observations: e.target.value })}
                  placeholder="e.g. Active in morning circle greeting. Identifies colors easily and counts 1-5 with blocks."
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs font-medium outline-none focus:border-accent resize-none"
                />
              </div>

              {/* Recommendations */}
              <div>
                <label className="block font-bold text-dash-ink mb-1">
                  Developmental Recommendations &amp; Home Interventions
                </label>
                <textarea
                  rows="2"
                  value={evalForm.recommendation}
                  onChange={(e) => setEvalForm({ ...evalForm, recommendation: e.target.value })}
                  placeholder="e.g. Practice line tracing and guided sensory play with parent at home."
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
                  className="px-5 py-2 rounded-xl bg-accent hover:bg-[#B5673C] text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                >
                  Save Assessment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DOSSIER MODAL */}
      {activeDossier && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-xl border border-card-border space-y-4 animate-pop max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-card-border pb-3.5">
              <div>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700 tracking-wider">
                  Official DepEd ECCD Child Dossier
                </span>
                <h3 className="font-fraunces text-xl font-bold text-dash-ink mt-1">
                  {activeDossier.child_name}
                </h3>
                <p className="text-xs text-dash-ink-soft">
                  Assessed by {activeDossier.teacher_name} ({activeDossier.cdc_name || cdcName}) on {activeDossier.date}
                </p>
              </div>
              <button
                onClick={() => setActiveDossier(null)}
                className="w-8 h-8 rounded-full bg-[#FAF5EC] text-dash-ink font-bold text-sm hover:bg-[#EFE8DC] cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="font-bold text-dash-ink">4 Core ECCD Developmental Domains:</div>

              <div className="p-3 rounded-xl bg-[#FAF5EC] border border-card-border flex items-center justify-between">
                <div>
                  <div className="font-bold text-dash-ink">1. Cognitive Development</div>
                  <div className="text-[11px] text-dash-ink-soft">
                    Color sorting, counting 1 to 5, pairing basic geometric shapes
                  </div>
                </div>
                {getDomainPill(activeDossier.cognitive_status, 'Rating')}
              </div>

              <div className="p-3 rounded-xl bg-[#FAF5EC] border border-card-border flex items-center justify-between">
                <div>
                  <div className="font-bold text-dash-ink">2. Physical &amp; Motor Development</div>
                  <div className="text-[11px] text-dash-ink-soft">
                    Fine motor pincer grip, gross motor balance, outdoor play
                  </div>
                </div>
                {getDomainPill(activeDossier.physical_status, 'Rating')}
              </div>

              <div className="p-3 rounded-xl bg-[#FAF5EC] border border-card-border flex items-center justify-between">
                <div>
                  <div className="font-bold text-dash-ink">3. Social-Emotional Development</div>
                  <div className="text-[11px] text-dash-ink-soft">
                    Group circle participation, sharing with peers, following routines
                  </div>
                </div>
                {getDomainPill(activeDossier.social_status, 'Rating')}
              </div>

              <div className="p-3 rounded-xl bg-[#FAF5EC] border border-card-border flex items-center justify-between">
                <div>
                  <div className="font-bold text-dash-ink">4. Language &amp; Literacy</div>
                  <div className="text-[11px] text-dash-ink-soft">
                    Articulation in Mother Tongue and English, listening comprehension
                  </div>
                </div>
                {getDomainPill(activeDossier.language_status, 'Rating')}
              </div>

              <div className="p-3.5 rounded-xl bg-stone-50 border border-card-border space-y-1">
                <div className="font-bold text-dash-ink">Overall Result:</div>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${getStatusBadge(
                      activeDossier.overall_status
                    )}`}
                  >
                    {activeDossier.overall_status}
                  </span>
                </div>
              </div>

              {activeDossier.observations && (
                <div className="p-3.5 rounded-xl bg-[#FFFDF8] border border-card-border space-y-1">
                  <div className="font-bold text-dash-ink">Teacher Observations:</div>
                  <p className="text-xs text-dash-ink-soft italic leading-relaxed m-0">
                    "{activeDossier.observations}"
                  </p>
                </div>
              )}

              {activeDossier.recommendation && (
                <div className="p-3.5 rounded-xl bg-[#FFFDF8] border border-card-border space-y-1">
                  <div className="font-bold text-dash-ink">Action Plan &amp; Home Interventions:</div>
                  <p className="text-xs text-dash-ink-soft leading-relaxed m-0">
                    {activeDossier.recommendation}
                  </p>
                </div>
              )}
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-card-border">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3.5 py-2 rounded-xl border border-gray-300 text-dash-ink font-bold text-xs hover:bg-gray-50 cursor-pointer"
              >
                🖨️ Print
              </button>
              <button
                type="button"
                onClick={() => setActiveDossier(null)}
                className="px-4 py-2 rounded-xl bg-accent text-white font-bold text-xs hover:bg-[#B5673C] cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
