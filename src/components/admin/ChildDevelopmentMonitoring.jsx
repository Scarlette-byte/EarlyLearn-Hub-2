import { useState } from 'react';
import { barangays } from '../../lib/supabaseClient';

export default function ChildDevelopmentMonitoring({
  assessments = [],
  onVerifyAssessment,
  onAddRecommendation,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBarangay, setSelectedBarangay] = useState('');
  const [selectedDomain, setSelectedDomain] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [activeAssessment, setActiveAssessment] = useState(null);
  const [recommendationText, setRecommendationText] = useState('');

  // Filter assessments
  const filteredAssessments = assessments.filter((a) => {
    const matchesSearch =
      a.child_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.cdc_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.teacher_name.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesBarangay = !selectedBarangay || a.barangay === selectedBarangay;
    const matchesStatus = !selectedStatus || a.overall_status === selectedStatus;

    const matchesDomain =
      !selectedDomain ||
      (selectedDomain === 'Cognitive' && a.cognitive_status !== 'Developing as Expected') ||
      (selectedDomain === 'Physical' && a.physical_status !== 'Developing as Expected') ||
      (selectedDomain === 'Social-Emotional' && a.social_status !== 'Developing as Expected') ||
      (selectedDomain === 'Language' && a.language_status !== 'Developing as Expected');

    return matchesSearch && matchesBarangay && matchesStatus && matchesDomain;
  });

  // Metrics
  const total = assessments.length;
  const normalCount = assessments.filter(
    (a) => a.overall_status === 'Developing as Expected'
  ).length;
  const monitoredCount = assessments.filter(
    (a) => a.overall_status === 'Needs Reinforcement'
  ).length;
  const referralCount = assessments.filter(
    (a) => a.overall_status === 'Requires Follow-up'
  ).length;

  function getStatusBadge(status) {
    switch (status) {
      case 'Developing as Expected':
        return 'bg-[#DCEBDD] text-[#2E6B38] border border-[#BDE0C0]';
      case 'Needs Reinforcement':
        return 'bg-[#FFF3D6] text-[#8C6200] border border-[#F5DC9A]';
      case 'Requires Follow-up':
        return 'bg-[#FDE2E2] text-[#9E2A2B] border border-[#F8B4B4]';
      default:
        return 'bg-[#FAF5EC] text-dash-ink border border-card-border';
    }
  }

  function getDomainPill(score, label) {
    let color = 'bg-[#DCEBDD] text-[#2E6B38]';
    if (score === 'Needs Support') color = 'bg-[#FFF3D6] text-[#8C6200]';
    if (score === 'Delay') color = 'bg-[#FDE2E2] text-[#9E2A2B]';

    return (
      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${color}`}>
        {label}: {score}
      </span>
    );
  }

  return (
    <div className="space-y-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-card-border shadow-xs">
          <div className="text-xs font-bold text-dash-ink-soft uppercase tracking-wider">
            Total ECCD Assessments
          </div>
          <div className="font-fraunces text-2xl font-bold text-dash-ink mt-1">
            {total}
          </div>
          <div className="text-[11px] text-dash-ink-soft mt-0.5">Ages 3–4 Toddlers</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-card-border shadow-xs">
          <div className="text-xs font-bold text-[#2E6B38] uppercase tracking-wider">
            Developing as Expected
          </div>
          <div className="font-fraunces text-2xl font-bold text-[#2E6B38] mt-1">
            {normalCount}
          </div>
          <div className="text-[11px] text-dash-ink-soft mt-0.5">
            {total > 0 ? Math.round((normalCount / total) * 100) : 0}% of cohort
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-card-border shadow-xs">
          <div className="text-xs font-bold text-[#8C6200] uppercase tracking-wider">
            Needs Reinforcement
          </div>
          <div className="font-fraunces text-2xl font-bold text-[#8C6200] mt-1">
            {monitoredCount}
          </div>
          <div className="text-[11px] text-dash-ink-soft mt-0.5">Mild domain delay</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-card-border shadow-xs">
          <div className="text-xs font-bold text-[#9E2A2B] uppercase tracking-wider">
            Follow-up / Referral
          </div>
          <div className="font-fraunces text-2xl font-bold text-[#9E2A2B] mt-1">
            {referralCount}
          </div>
          <div className="text-[11px] text-dash-ink-soft mt-0.5">Flagged for MSWD action</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-5 border border-card-border shadow-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-fraunces text-lg font-bold text-dash-ink m-0">
              Child Development Monitoring (ECCD Domains)
            </h3>
            <p className="text-xs text-dash-ink-soft mt-0.5">
              Review developmental assessment results in cognitive, physical, social-emotional, and language areas submitted by Daycare Workers.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 pt-1">
          <div>
            <input
              type="text"
              placeholder="Search child, teacher, or center..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#E5DCC9] bg-[#FFFDF8] text-xs font-bold text-dash-ink outline-none focus:border-accent"
            />
          </div>

          <div>
            <select
              value={selectedBarangay}
              onChange={(e) => setSelectedBarangay(e.target.value)}
              className="w-full px-2.5 py-2 rounded-xl border border-[#E5DCC9] bg-[#FFFDF8] text-xs font-bold text-dash-ink outline-none focus:border-accent"
            >
              <option value="">All Barangays</option>
              {barangays.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-2.5 py-2 rounded-xl border border-[#E5DCC9] bg-[#FFFDF8] text-xs font-bold text-dash-ink outline-none focus:border-accent"
            >
              <option value="">All Overall Results</option>
              <option value="Developing as Expected">Developing as Expected</option>
              <option value="Needs Reinforcement">Needs Reinforcement</option>
              <option value="Requires Follow-up">Requires Follow-up</option>
            </select>
          </div>

          <div>
            <select
              value={selectedDomain}
              onChange={(e) => setSelectedDomain(e.target.value)}
              className="w-full px-2.5 py-2 rounded-xl border border-[#E5DCC9] bg-[#FFFDF8] text-xs font-bold text-dash-ink outline-none focus:border-accent"
            >
              <option value="">Filter by Domain Focus</option>
              <option value="Cognitive">Cognitive (Flags)</option>
              <option value="Physical">Physical / Motor (Flags)</option>
              <option value="Social-Emotional">Social-Emotional (Flags)</option>
              <option value="Language">Language (Flags)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Assessments Review Table */}
      <div className="bg-white rounded-2xl border border-card-border shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-[#FAF5EC] border-b border-card-border text-[11px] font-bold text-[#8C7F63] uppercase tracking-wider">
                <th className="px-4 py-3">Child & Age</th>
                <th className="px-4 py-3">Center & Daycare Worker</th>
                <th className="px-4 py-3">ECCD 4-Domain Ratings</th>
                <th className="px-4 py-3 text-center">Overall Result</th>
                <th className="px-4 py-3 text-right">MSWD Review</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F6F1E7] text-xs text-dash-ink">
              {filteredAssessments.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-dash-ink-soft">
                    No developmental assessments found matching your filter criteria.
                  </td>
                </tr>
              ) : (
                filteredAssessments.map((a) => (
                  <tr key={a.id} className="hover:bg-[#FFFDF9] transition-colors">
                    {/* Child & Age */}
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-sm text-dash-ink">{a.child_name}</div>
                      <div className="text-[11px] text-dash-ink-soft mt-0.5">
                        Age {a.age} y/o • Brgy. {a.barangay}
                      </div>
                    </td>

                    {/* Center & Worker */}
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-dash-ink">{a.cdc_name}</div>
                      <div className="text-[11px] text-dash-ink-soft">
                        Teacher: {a.teacher_name} • {a.date}
                      </div>
                    </td>

                    {/* 4 Domains breakdown */}
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap gap-1.5 max-w-sm">
                        {getDomainPill(a.cognitive_status, 'Cog')}
                        {getDomainPill(a.physical_status, 'Phys')}
                        {getDomainPill(a.social_status, 'Soc')}
                        {getDomainPill(a.language_status, 'Lang')}
                      </div>
                    </td>

                    {/* Overall Status */}
                    <td className="px-4 py-3.5 text-center">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-[10.5px] font-bold ${getStatusBadge(
                          a.overall_status
                        )}`}
                      >
                        {a.overall_status}
                      </span>
                    </td>

                    {/* Review Actions */}
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        {a.mswd_verified ? (
                          <span className="px-2 py-0.8 rounded-md bg-[#DCEBDD] text-[#2E6B38] font-bold text-[10.5px]">
                            Verified ✓
                          </span>
                        ) : (
                          <button
                            onClick={() => onVerifyAssessment(a.id)}
                            className="px-2.5 py-1 rounded-lg bg-accent text-white font-bold text-[11px] hover:bg-[#B5673C]"
                          >
                            Verify ✓
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setActiveAssessment(a);
                            setRecommendationText(a.recommendation || '');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-[#FAF5EC] text-dash-ink font-bold text-[11px] hover:bg-[#EFE8DC]"
                        >
                          Details
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ASSESSMENT DOSSIER & RECOMMENDATION MODAL */}
      {activeAssessment && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-xl border border-card-border space-y-4 animate-pop max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-card-border pb-3.5">
              <div>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-[#FAF5EC] text-accent tracking-wider">
                  DepEd ECCD Assessment Result (Ages 3–4)
                </span>
                <h3 className="font-fraunces text-xl font-bold text-dash-ink mt-1">
                  {activeAssessment.child_name}
                </h3>
                <p className="text-xs text-dash-ink-soft">
                  Assessed by {activeAssessment.teacher_name} ({activeAssessment.cdc_name})
                  on {activeAssessment.date}
                </p>
              </div>
              <button
                onClick={() => setActiveAssessment(null)}
                className="w-8 h-8 rounded-full bg-[#FAF5EC] text-dash-ink font-bold text-sm hover:bg-[#EFE8DC]"
              >
                ✕
              </button>
            </div>

            {/* 4 Developmental Domains Detail */}
            <div className="space-y-2.5 text-xs">
              <div className="font-bold text-dash-ink">4 Core ECCD Developmental Domains:</div>

              <div className="p-3 rounded-xl bg-[#FAF5EC] border border-card-border flex items-center justify-between">
                <div>
                  <div className="font-bold text-dash-ink">1. Cognitive Development</div>
                  <div className="text-[11px] text-dash-ink-soft">
                    Color sorting, counting 1 to 5, pairing basic geometric shapes
                  </div>
                </div>
                {getDomainPill(activeAssessment.cognitive_status, 'Rating')}
              </div>

              <div className="p-3 rounded-xl bg-[#FAF5EC] border border-card-border flex items-center justify-between">
                <div>
                  <div className="font-bold text-dash-ink">2. Physical & Motor Skills</div>
                  <div className="text-[11px] text-dash-ink-soft">
                    Grasping crayons, scribbling within boundaries, gentle balance
                  </div>
                </div>
                {getDomainPill(activeAssessment.physical_status, 'Rating')}
              </div>

              <div className="p-3 rounded-xl bg-[#FAF5EC] border border-card-border flex items-center justify-between">
                <div>
                  <div className="font-bold text-dash-ink">3. Social-Emotional Development</div>
                  <div className="text-[11px] text-dash-ink-soft">
                    Sharing toys, cooperative play, self-help routines (handwashing)
                  </div>
                </div>
                {getDomainPill(activeAssessment.social_status, 'Rating')}
              </div>

              <div className="p-3 rounded-xl bg-[#FAF5EC] border border-card-border flex items-center justify-between">
                <div>
                  <div className="font-bold text-dash-ink">4. Language & Communication</div>
                  <div className="text-[11px] text-dash-ink-soft">
                    Articulating phonics, responding to questions, Mother Tongue & English
                  </div>
                </div>
                {getDomainPill(activeAssessment.language_status, 'Rating')}
              </div>
            </div>

            {/* Teacher Notes */}
            <div className="p-3.5 rounded-xl bg-[#FFFDF9] border border-card-border text-xs space-y-1">
              <div className="font-bold text-dash-ink">Teacher's Observations:</div>
              <p className="text-dash-ink-soft leading-relaxed italic m-0">
                "{activeAssessment.observations || 'Child demonstrates enthusiasm in group singing and numbers, continuing practice with finger grasping.'}"
              </p>
            </div>

            {/* MSWD Focal Recommendation Box */}
            <div className="space-y-1.5 text-xs">
              <label className="block font-bold text-dash-ink">
                MSWD Officer Notes & Recommendations:
              </label>
              <textarea
                rows="3"
                placeholder="Enter municipal recommendations, e.g., 'Recommended for supplementary fine motor worksheets'..."
                value={recommendationText}
                onChange={(e) => setRecommendationText(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-[#E5DCC9] bg-[#FFFDF8] font-nunito text-xs text-dash-ink outline-none focus:border-accent"
              />
            </div>

            <div className="pt-2 flex justify-between items-center border-t border-card-border">
              {!activeAssessment.mswd_verified && (
                <button
                  onClick={() => {
                    onVerifyAssessment(activeAssessment.id);
                    onAddRecommendation(activeAssessment.id, recommendationText);
                    setActiveAssessment(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-[#2E6B38] text-white font-bold text-xs"
                >
                  Verify Assessment ✓
                </button>
              )}
              <div className="ml-auto flex gap-2">
                <button
                  onClick={() => {
                    onAddRecommendation(activeAssessment.id, recommendationText);
                    setActiveAssessment(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-accent text-white font-bold text-xs"
                >
                  Save Recommendation
                </button>
                <button
                  onClick={() => setActiveAssessment(null)}
                  className="px-4 py-2 rounded-xl border border-[#D5C7B0] text-dash-ink font-bold text-xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
