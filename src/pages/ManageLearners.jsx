import { useEffect, useState, useCallback } from 'react';
import { supabase, barangays } from '../lib/supabaseClient';
import { cardBox, cardBoxTitle, table, th, td, msgOk, msgError, input, label, btnPrimary, delBtn } from '../lib/ui.js';

export default function ManageLearners() {
  const [learners, setLearners] = useState([]);
  const [cdcs, setCdcs] = useState([]);

  const [fullName, setFullName] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [learnerBarangay, setLearnerBarangay] = useState('');
  const [cdcId, setCdcId] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentContact, setParentContact] = useState('');
  const [formMsg, setFormMsg] = useState({ text: '', type: '' });
  const [saving, setSaving] = useState(false);

  const loadLearners = useCallback(async () => {
    const { data } = await supabase
      .from('learners')
      .select('id, full_name, birthdate, barangay, parent_name, parent_contact, cdcs(name)')
      .order('full_name');
    setLearners(data || []);
  }, []);

  const loadCdcs = useCallback(async () => {
    const { data } = await supabase.from('cdcs').select('*').order('barangay, name');
    setCdcs(data || []);
  }, []);

  useEffect(() => {
    loadLearners();
    loadCdcs();
  }, [loadLearners, loadCdcs]);

  async function addLearner() {
    if (!fullName.trim() || !learnerBarangay) {
      setFormMsg({ text: '⚠️ Full name and barangay are required', type: 'error' });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('learners').insert({
      full_name: fullName.trim(),
      birthdate: birthdate || null,
      barangay: learnerBarangay,
      cdc_id: cdcId || null,
      parent_name: parentName.trim() || null,
      parent_contact: parentContact.trim() || null,
    });
    setSaving(false);

    if (error) {
      setFormMsg({ text: '❌ ' + error.message, type: 'error' });
    } else {
      setFormMsg({ text: '✅ Learner added', type: 'ok' });
      setFullName('');
      setBirthdate('');
      setLearnerBarangay('');
      setCdcId('');
      setParentName('');
      setParentContact('');
      loadLearners();
    }
  }

  async function deleteLearner(id) {
    if (!confirm('Delete this learner record?')) return;
    await supabase.from('learners').delete().eq('id', id);
    loadLearners();
  }

  const cdcsForBarangay = (brgy) => cdcs.filter((c) => c.barangay === brgy);

  return (
    <>
      <div className={cardBox}>
        <h3 className={cardBoxTitle}>Add Learner</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
          <div>
            <label className={label}>Full Name</label>
            <input
              type="text"
              placeholder="Juan Dela Cruz Jr."
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={input}
            />
          </div>
          <div>
            <label className={label}>Birthdate</label>
            <input
              type="date"
              value={birthdate}
              onChange={(e) => setBirthdate(e.target.value)}
              className={input}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
          <div>
            <label className={label}>Barangay</label>
            <select
              value={learnerBarangay}
              onChange={(e) => {
                setLearnerBarangay(e.target.value);
                setCdcId('');
              }}
              className={input}
            >
              <option value="">— select barangay —</option>
              {barangays.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>CDC</label>
            <select
              value={cdcId}
              onChange={(e) => setCdcId(e.target.value)}
              disabled={!learnerBarangay}
              className={input}
            >
              <option value="">— select CDC —</option>
              {cdcsForBarangay(learnerBarangay).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
          <div>
            <label className={label}>Parent/Guardian Name</label>
            <input
              type="text"
              placeholder="Maria Dela Cruz"
              value={parentName}
              onChange={(e) => setParentName(e.target.value)}
              className={input}
            />
          </div>
          <div>
            <label className={label}>Parent Contact Number</label>
            <input
              type="text"
              placeholder="09XX-XXX-XXXX"
              value={parentContact}
              onChange={(e) => setParentContact(e.target.value)}
              className={input}
            />
          </div>
        </div>

        <button onClick={addLearner} disabled={saving} className={btnPrimary}>
          {saving ? 'Saving...' : '+ Add Learner'}
        </button>
        {formMsg.text && (
          <p className={formMsg.type === 'error' ? msgError : msgOk}>{formMsg.text}</p>
        )}
      </div>

      <div className={cardBox}>
        <h3 className={cardBoxTitle}>All Learners</h3>
        <div className="overflow-x-auto">
          <table className={table}>
            <thead>
              <tr>
                <th className={th}>Name</th>
                <th className={th}>Birthdate</th>
                <th className={th}>Barangay</th>
                <th className={th}>CDC</th>
                <th className={th}>Parent</th>
                <th className={th}>Contact</th>
                <th className={th}></th>
              </tr>
            </thead>
            <tbody>
              {learners.map((l) => (
                <tr key={l.id}>
                  <td className={td}>{l.full_name}</td>
                  <td className={td}>{l.birthdate || '-'}</td>
                  <td className={td}>{l.barangay}</td>
                  <td className={td}>{l.cdcs?.name || '-'}</td>
                  <td className={td}>{l.parent_name || '-'}</td>
                  <td className={td}>{l.parent_contact || '-'}</td>
                  <td className={td}>
                    <button onClick={() => deleteLearner(l.id)} className={delBtn}>
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {learners.length === 0 && (
          <p className="text-[13px] mt-3 text-dash-ink-soft">No learners added yet.</p>
        )}
      </div>
    </>
  );
}