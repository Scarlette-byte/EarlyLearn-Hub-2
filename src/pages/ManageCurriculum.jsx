import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { cardBox, cardBoxTitle, table, th, td, btnSmall } from '../lib/ui.js';

const LEVELS = ['K1', 'K2'];

const STATUS_PILL = {
  not_started: { text: 'Not started', cls: 'bg-[#F6E4C2] text-[#8A6420]' },
  pending: { text: 'Uploaded — waiting approval', cls: 'bg-[#F6E4C2] text-[#8A6420]' },
  approved: { text: '✅ Approved', cls: 'bg-[#DCEBDD] text-[#3D7048]' },
  rejected: { text: '❌ Rejected — needs reupload', cls: 'bg-[#F6D6D0] text-[#9A3B2B]' },
};

export default function ManageCurriculum() {
  const [level, setLevel] = useState('K1');
  const [entries, setEntries] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [activeQuarter, setActiveQuarter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [assigningId, setAssigningId] = useState(null); // entry currently being assigned (for button spinner state)
  const [rowMsg, setRowMsg] = useState({ id: null, text: '', type: '' });

  const load = useCallback(async () => {
    setLoading(true);
    const { data: guide } = await supabase
      .from('curriculum_guide')
      .select('*')
      .eq('level', level)
      .order('quarter')
      .order('week');

    const { data: teacherList } = await supabase
      .from('teachers')
      .select('id, full_name')
      .order('full_name');

    const { data: assigns } = await supabase
      .from('curriculum_assignments')
      .select('id, curriculum_guide_id, teacher_id, teachers(full_name), materials(status)');

    setEntries(guide || []);
    setTeachers(teacherList || []);
    setAssignments(assigns || []);
    const quarters = [...new Set((guide || []).map((g) => g.quarter))];
    setActiveQuarter((prev) => (quarters.includes(prev) ? prev : quarters[0] || null));
    setLoading(false);
  }, [level]);

  useEffect(() => {
    load();
  }, [load]);

  function assignmentsFor(entryId) {
    return assignments.filter((a) => a.curriculum_guide_id === entryId);
  }

  function statusOf(a) {
    if (!a.materials) return STATUS_PILL.not_started;
    return STATUS_PILL[a.materials.status] || STATUS_PILL.pending;
  }

  // Assigns this Week/Sub-theme to EVERY teacher in one go.
  // Skips teachers who already have an assignment for this entry, so it's safe to click again later
  // (e.g. after a new teacher account is created) without creating duplicate rows.
  async function assignToAllTeachers(entry) {
    if (teachers.length === 0) {
      setRowMsg({ id: entry.id, text: '⚠️ No teachers exist yet', type: 'error' });
      return;
    }

    const alreadyAssignedIds = new Set(assignmentsFor(entry.id).map((a) => a.teacher_id));
    const toInsert = teachers
      .filter((t) => !alreadyAssignedIds.has(t.id))
      .map((t) => ({ curriculum_guide_id: entry.id, teacher_id: t.id }));

    if (toInsert.length === 0) {
      setRowMsg({ id: entry.id, text: 'Already assigned to all teachers', type: 'ok' });
      return;
    }

    if (!confirm(`Assign "${entry.week} · ${entry.sub_theme}" to all ${toInsert.length} teacher(s)?`)) {
      return;
    }

    setAssigningId(entry.id);
    const { error } = await supabase.from('curriculum_assignments').insert(toInsert);
    setAssigningId(null);

    if (error) {
      setRowMsg({ id: entry.id, text: '❌ ' + error.message, type: 'error' });
    } else {
      setRowMsg({ id: entry.id, text: '', type: '' });
      load();
    }
  }

  async function removeAssignment(id) {
    if (!confirm('Remove this assignment?')) return;
    await supabase.from('curriculum_assignments').delete().eq('id', id);
    load();
  }

  const quarters = [...new Set(entries.map((e) => e.quarter))];
  const quarterEntries = entries.filter((e) => e.quarter === activeQuarter);
  const theme = quarterEntries[0]?.theme || '';
  const suggestedContent = quarterEntries[0]?.suggested_content || '';

  return (
    <div className={cardBox}>
      <h3 className={cardBoxTitle}>Curriculum Guide</h3>
      <p className="text-[13px] text-[#8a7f66] -mt-2.5 mb-4">
        MSWD-based reference. Assign a Week/Sub-theme to all teachers at once so the system tracks
        who is responsible for uploading that activity, and its approval status.
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
                    <th className={th}>Assigned Teachers</th>
                    <th className={th}></th>
                  </tr>
                </thead>
                <tbody>
                  {quarterEntries.map((e) => {
                    const list = assignmentsFor(e.id);
                    const allAssigned = teachers.length > 0 && list.length >= teachers.length;
                    return (
                      <tr key={e.id}>
                        <td className={td}>{e.week}</td>
                        <td className={td}>{e.sub_theme}</td>
                        <td className={td}>
                          {list.length === 0 && (
                            <span className="text-[12px] text-dash-ink-soft">Unassigned</span>
                          )}
                          <div className="flex flex-col gap-1">
                            {list.map((a) => {
                              const s = statusOf(a);
                              return (
                                <div key={a.id} className="flex items-center gap-2">
                                  <span className="text-[12px] font-semibold">
                                    {a.teachers?.full_name}
                                  </span>
                                  <span
                                    className={`inline-block px-2 py-[2px] rounded-full text-[10px] font-bold ${s.cls}`}
                                  >
                                    {s.text}
                                  </span>
                                  <button
                                    onClick={() => removeAssignment(a.id)}
                                    className="text-[#ccc] hover:text-danger text-[11px] border-none bg-transparent cursor-pointer"
                                  >
                                    ✕
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                          {rowMsg.id === e.id && rowMsg.text && (
                            <p
                              className={`text-[11px] mt-1 ${
                                rowMsg.type === 'error' ? 'text-danger' : 'text-[#3D7048]'
                              }`}
                            >
                              {rowMsg.text}
                            </p>
                          )}
                        </td>
                        <td className={td}>
                          <button
                            onClick={() => assignToAllTeachers(e)}
                            disabled={assigningId === e.id || allAssigned}
                            className={`${btnSmall} disabled:opacity-50 disabled:cursor-not-allowed`}
                          >
                            {assigningId === e.id
                              ? 'Assigning…'
                              : allAssigned
                              ? '✓ All assigned'
                              : '+ Assign to All Teachers'}
                          </button>
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