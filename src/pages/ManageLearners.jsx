import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { cardBox, cardBoxTitle, table, th, td } from '../lib/ui.js';

export default function ManageLearners() {
  const [rows, setRows] = useState([]);
  const [totalLearners, setTotalLearners] = useState(0);
  const [totalOfficial, setTotalOfficial] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: cdcs } = await supabase
      .from('cdcs')
      .select('id, name, barangay, official_enrollment_count, official_teacher_name')
      .order('barangay, name');

    const { data: learners } = await supabase.from('learners').select('cdc_id');

    const counts = {};
    (learners || []).forEach((l) => {
      counts[l.cdc_id] = (counts[l.cdc_id] || 0) + 1;
    });

    const result = (cdcs || []).map((c) => ({
      ...c,
      count: counts[c.id] || 0,
    }));

    setRows(result);
    setTotalLearners((learners || []).length);
    setTotalOfficial(
      (cdcs || []).reduce((sum, c) => sum + (c.official_enrollment_count || 0), 0)
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className={cardBox}>
      <h3 className={cardBoxTitle}>Learners Overview</h3>
      <p className="text-[13px] text-[#8a7f66] -mt-2.5 mb-4">
        Learner records are added and managed by each teacher from their own dashboard, scoped to
        their assigned CDC. "Official Enrollment" is the MSWD-reported total; "Encoded" is how
        many have been entered into this system so far.
      </p>

      <div className="flex flex-wrap gap-3 mb-5">
        <div className="bg-[#FFFDF8] border border-card-border rounded-2xl px-[18px] py-4">
          <b className="font-fraunces text-3xl font-bold text-accent block">{totalOfficial}</b>
          <span className="text-[13px] text-dash-ink-soft font-semibold">Official Enrollment (MSWD)</span>
        </div>
        <div className="bg-[#FFFDF8] border border-card-border rounded-2xl px-[18px] py-4">
          <b className="font-fraunces text-3xl font-bold text-accent block">{totalLearners}</b>
          <span className="text-[13px] text-dash-ink-soft font-semibold">Encoded in System</span>
        </div>
      </div>

      {loading && <p className="text-[13px] text-dash-ink-soft">Loading...</p>}

      {!loading && (
        <div className="overflow-x-auto">
          <table className={table}>
            <thead>
              <tr>
                <th className={th}>CDC</th>
                <th className={th}>Barangay</th>
                <th className={th}>Child Development Worker</th>
                <th className={th}>Official Enrollment</th>
                <th className={th}>Encoded</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className={td}>{r.name}</td>
                  <td className={td}>{r.barangay}</td>
                  <td className={td}>{r.official_teacher_name || '-'}</td>
                  <td className={td}>{r.official_enrollment_count ?? '-'}</td>
                  <td className={td}>
                    <span className="inline-block px-3 py-[3px] rounded-full text-[10.5px] font-extrabold bg-[#DCEBDD] text-[#3D7048]">
                      {r.count}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && (
            <p className="text-[13px] mt-3 text-dash-ink-soft">
              No CDCs recorded yet.
            </p>
          )}
        </div>
      )}
    </div>
  );
}