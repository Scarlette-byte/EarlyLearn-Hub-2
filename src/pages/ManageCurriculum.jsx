import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { cardBox, cardBoxTitle, table, th, td } from '../lib/ui.js';

const LEVELS = ['K1', 'K2'];

export default function ManageCurriculum() {
  const [level, setLevel] = useState('K1');
  const [entries, setEntries] = useState([]);
  const [coverage, setCoverage] = useState({}); // curriculum_guide_id -> count of linked materials
  const [activeQuarter, setActiveQuarter] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: guide } = await supabase
      .from('curriculum_guide')
      .select('*')
      .eq('level', level)
      .order('quarter')
      .order('week');

    const { data: materials } = await supabase
      .from('materials')
      .select('curriculum_guide_id')
      .not('curriculum_guide_id', 'is', null);

    const counts = {};
    (materials || []).forEach((m) => {
      counts[m.curriculum_guide_id] = (counts[m.curriculum_guide_id] || 0) + 1;
    });

    setEntries(guide || []);
    setCoverage(counts);
    const quarters = [...new Set((guide || []).map((g) => g.quarter))];
    setActiveQuarter((prev) => (quarters.includes(prev) ? prev : quarters[0] || null));
    setLoading(false);
  }, [level]);

  useEffect(() => {
    load();
  }, [load]);

  const quarters = [...new Set(entries.map((e) => e.quarter))];
  const quarterEntries = entries.filter((e) => e.quarter === activeQuarter);
  const theme = quarterEntries[0]?.theme || '';
  const suggestedContent = quarterEntries[0]?.suggested_content || '';

  return (
    <div className={cardBox}>
      <h3 className={cardBoxTitle}>Curriculum Guide</h3>
      <p className="text-[13px] text-[#8a7f66] -mt-2.5 mb-4">
        MSWD-based reference used to plan weekly activities. Teachers can link their uploads to a
        week here so Admin can see which weeks are already covered.
      </p>

      <div className="flex gap-2 mb-4">
        {LEVELS.map((l) => (
          <button
            key={l}
            onClick={() => setLevel(l)}
            className={`px-4 py-1.5 rounded-lg text-[13px] font-bold border border-card-border ${
              level === l ? 'bg-accent text-white' : 'bg-white text-dash-ink'
            }`}
          >
            {l === 'K1' ? 'K1 (3.0-3.11)' : 'K2 (4.0-4.11)'}
          </button>
        ))}
      </div>

      {loading && <p className="text-[13px] text-dash-ink-soft">Loading...</p>}

      {!loading && (
        <>
          <div className="flex gap-1.5 mb-4 flex-wrap">
            {quarters.map((q) => (
              <button
                key={q}
                onClick={() => setActiveQuarter(q)}
                className={`px-3 py-1 rounded-full text-[12px] font-semibold border border-card-border ${
                  activeQuarter === q ? 'bg-gold text-dash-ink' : 'bg-white text-dash-ink-soft'
                }`}
              >
                {q}
              </button>
            ))}
          </div>

          <div className="bg-[#FFFDF8] border border-card-border rounded-xl p-4">
            <p className="text-[13px] text-dash-ink-soft mb-3">
              {activeQuarter} · Suggested Content: <strong>{suggestedContent}</strong> · Theme:{' '}
              <strong>{theme}</strong>
            </p>
            <div className="overflow-x-auto">
              <table className={table}>
                <thead>
                  <tr>
                    <th className={th}>Week</th>
                    <th className={th}>Sub-theme</th>
                    <th className={th}>Coverage</th>
                  </tr>
                </thead>
                <tbody>
                  {quarterEntries.map((e) => {
                    const count = coverage[e.id] || 0;
                    return (
                      <tr key={e.id}>
                        <td className={td}>{e.week}</td>
                        <td className={td}>{e.sub_theme}</td>
                        <td className={td}>
                          {count > 0 ? (
                            <span className="inline-block px-3 py-[3px] rounded-full text-[10.5px] font-extrabold bg-[#DCEBDD] text-[#3D7048]">
                              ✅ {count} material{count > 1 ? 's' : ''} uploaded
                            </span>
                          ) : (
                            <span className="inline-block px-3 py-[3px] rounded-full text-[10.5px] font-extrabold bg-[#F6E4C2] text-[#8A6420]">
                              Not yet assigned
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {quarterEntries.length === 0 && (
              <p className="text-[13px] text-dash-ink-soft">No entries for this quarter.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}