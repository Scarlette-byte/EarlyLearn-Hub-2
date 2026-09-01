import { useEffect, useState, useCallback } from 'react';
import { supabase, barangays } from '../lib/supabaseClient';
import { cardBox, cardBoxTitle, table, th, td, msgOk, msgError, input, label, btnPrimary, delBtn } from '../lib/ui.js';

export default function ManageTeachers() {
  const [teachers, setTeachers] = useState([]);
  const [cdcs, setCdcs] = useState([]);

  // Add teacher form
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [teacherBarangay, setTeacherBarangay] = useState('');
  const [cdcId, setCdcId] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [saving, setSaving] = useState(false);
  const [formMsg, setFormMsg] = useState({ text: '', type: '' });

  // Add CDC form
  const [newCdcName, setNewCdcName] = useState('');
  const [newCdcBarangay, setNewCdcBarangay] = useState('');
  const [cdcMsg, setCdcMsg] = useState({ text: '', type: '' });

  // Credentials modal (shown once right after creating an account)
  const [credentials, setCredentials] = useState(null); // { email, tempPassword }

  const loadTeachers = useCallback(async () => {
    const { data } = await supabase
      .from('teachers')
      .select('id, full_name, barangay, contact_number, email, cdcs(name)')
      .order('full_name');
    setTeachers(data || []);
  }, []);

  const loadCdcs = useCallback(async () => {
    const { data } = await supabase.from('cdcs').select('*').order('barangay, name');
    setCdcs(data || []);
  }, []);

  useEffect(() => {
    loadTeachers();
    loadCdcs();
  }, [loadTeachers, loadCdcs]);

  async function addCdc() {
    if (!newCdcName.trim() || !newCdcBarangay) {
      setCdcMsg({ text: '⚠️ Please enter a CDC name and select a barangay', type: 'error' });
      return;
    }
    const { error } = await supabase
      .from('cdcs')
      .insert({ name: newCdcName.trim(), barangay: newCdcBarangay });
    if (error) {
      setCdcMsg({ text: '❌ ' + error.message, type: 'error' });
    } else {
      setCdcMsg({ text: '✅ CDC added', type: 'ok' });
      setNewCdcName('');
      setNewCdcBarangay('');
      loadCdcs();
    }
  }

  async function addTeacher() {
    if (!fullName.trim() || !email.trim() || !teacherBarangay) {
      setFormMsg({ text: '⚠️ Full name, email, and barangay are required', type: 'error' });
      return;
    }
    setSaving(true);
    setFormMsg({ text: '', type: '' });

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    const { data, error } = await supabase.functions.invoke('create-teacher', {
      body: {
        fullName: fullName.trim(),
        email: email.trim(),
        barangay: teacherBarangay,
        cdcId: cdcId || null,
        contactNumber: contactNumber.trim() || null,
      },
      headers: { Authorization: `Bearer ${token}` },
    });

    setSaving(false);

    if (error || data?.error) {
      setFormMsg({ text: '❌ ' + (data?.error || error.message), type: 'error' });
      return;
    }

    setCredentials({ email: data.email, tempPassword: data.tempPassword });
    setFullName('');
    setEmail('');
    setTeacherBarangay('');
    setCdcId('');
    setContactNumber('');
    setFormMsg({ text: '✅ Teacher account created!', type: 'ok' });
    loadTeachers();
  }

  async function deleteTeacher(id, name) {
    if (!confirm(`Delete ${name}'s account? This cannot be undone.`)) return;
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    const { data, error } = await supabase.functions.invoke('delete-teacher', {
      body: { teacherId: id },
      headers: { Authorization: `Bearer ${token}` },
    });

    if (error || data?.error) {
      alert('❌ ' + (data?.error || error.message));
      return;
    }
    loadTeachers();
  }

  const cdcsForBarangay = (brgy) => cdcs.filter((c) => c.barangay === brgy);

  return (
    <>
      {/* CDC management */}
      <div className={cardBox}>
        <h3 className={cardBoxTitle}>Child Development Centers (CDCs)</h3>
        <p className="text-[13px] text-[#8a7f66] -mt-2.5 mb-4">
          Add each CDC once here — teachers and learners will both be tagged with a CDC so the
          system can match them automatically.
        </p>
        <div className="flex gap-2.5 flex-wrap mb-2">
          <input
            type="text"
            placeholder="CDC name (e.g. CDC 1)"
            value={newCdcName}
            onChange={(e) => setNewCdcName(e.target.value)}
            className={`${input} flex-1 min-w-[160px]`}
          />
          <select
            value={newCdcBarangay}
            onChange={(e) => setNewCdcBarangay(e.target.value)}
            className={`${input} w-[200px]`}
          >
            <option value="">— select barangay —</option>
            {barangays.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
          <button onClick={addCdc} className={btnPrimary}>
            + Add CDC
          </button>
        </div>
        {cdcMsg.text && <p className={cdcMsg.type === 'error' ? msgError : msgOk}>{cdcMsg.text}</p>}

        {cdcs.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {cdcs.map((c) => (
              <span
                key={c.id}
                className="text-[12px] bg-[#F6F1E7] text-[#5c5342] px-3 py-1 rounded-full font-semibold"
              >
                {c.name} · {c.barangay}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Add Teacher */}
      <div className={cardBox}>
        <h3 className={cardBoxTitle}>Add Teacher</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
          <div>
            <label className={label}>Full Name</label>
            <input
              type="text"
              placeholder="Juana Dela Cruz"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={input}
            />
          </div>
          <div>
            <label className={label}>Email (used as login)</label>
            <input
              type="email"
              placeholder="teacher@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={input}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
          <div>
            <label className={label}>Barangay</label>
            <select
              value={teacherBarangay}
              onChange={(e) => {
                setTeacherBarangay(e.target.value);
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
            <label className={label}>CDC Assigned</label>
            <select
              value={cdcId}
              onChange={(e) => setCdcId(e.target.value)}
              disabled={!teacherBarangay}
              className={input}
            >
              <option value="">— select CDC —</option>
              {cdcsForBarangay(teacherBarangay).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <label className={label}>Contact Number (optional)</label>
        <input
          type="text"
          placeholder="09XX-XXX-XXXX"
          value={contactNumber}
          onChange={(e) => setContactNumber(e.target.value)}
          className={input}
        />

        <button onClick={addTeacher} disabled={saving} className={btnPrimary}>
          {saving ? 'Creating account...' : 'Create Teacher Account'}
        </button>
        {formMsg.text && (
          <p className={formMsg.type === 'error' ? msgError : msgOk}>{formMsg.text}</p>
        )}
      </div>

      {/* Teacher list */}
      <div className={cardBox}>
        <h3 className={cardBoxTitle}>All Teachers</h3>
        <div className="overflow-x-auto">
          <table className={table}>
            <thead>
              <tr>
                <th className={th}>Name</th>
                <th className={th}>Barangay</th>
                <th className={th}>CDC</th>
                <th className={th}>Contact</th>
                <th className={th}>Email</th>
                <th className={th}></th>
              </tr>
            </thead>
            <tbody>
              {teachers.map((t) => (
                <tr key={t.id}>
                  <td className={td}>{t.full_name}</td>
                  <td className={td}>{t.barangay}</td>
                  <td className={td}>{t.cdcs?.name || '-'}</td>
                  <td className={td}>{t.contact_number || '-'}</td>
                  <td className={td}>{t.email}</td>
                  <td className={td}>
                    <button onClick={() => deleteTeacher(t.id, t.full_name)} className={delBtn}>
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {teachers.length === 0 && (
          <p className="text-[13px] mt-3 text-dash-ink-soft">No teachers added yet.</p>
        )}
      </div>

      {/* Credentials modal */}
      {credentials && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="font-fraunces text-lg font-bold mb-2 text-dash-ink">
              ✅ Account Created
            </h3>
            <p className="text-sm text-dash-ink-soft mb-4">
              Ihatag ni nga login details sa teacher. Ang temporary password kay makita ra ni
              karon, dili na ni ma-display pag-usab.
            </p>
            <div className="bg-[#FAF5EC] rounded-xl p-4 text-sm space-y-1.5">
              <p>
                <strong>Email:</strong> {credentials.email}
              </p>
              <p>
                <strong>Temporary Password:</strong>{' '}
                <span className="font-mono font-bold">{credentials.tempPassword}</span>
              </p>
            </div>
            <button
              onClick={() => setCredentials(null)}
              className={`${btnPrimary} w-full mt-4 text-center`}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
}