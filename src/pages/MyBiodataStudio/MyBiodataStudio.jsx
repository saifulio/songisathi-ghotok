import { useState, useRef, useEffect, useCallback } from 'react';
import { Button, Avatar, Switch, Input, Select, Badge } from '../../components/ui/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { api } from '../../lib/api.js';
import './MyBiodataStudio.css';

const FIELDS = [
  { k: 'heightLabel', label: 'Height', placeholder: 'e.g. 5′6″' },
  { k: 'maritalStatus', label: 'Marital status' },
  { k: 'area', label: 'Area' },
  { k: 'degree', label: 'Highest degree' },
  { k: 'institution', label: 'Institution' },
  { k: 'undergraduate', label: 'Undergraduate' },
  { k: 'profession', label: 'Profession' },
  { k: 'organisation', label: 'Organisation' },
  { k: 'fatherInfo', label: "Father's info" },
  { k: 'motherInfo', label: "Mother's info" },
  { k: 'siblings', label: 'Siblings' },
  { k: 'familyIncome', label: 'Family income' },
  { k: 'religion', label: 'Religion' },
  { k: 'religiousPractice', label: 'Religious practice' },
];
const initialsOf = (name) => String(name || '').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

export default function MyBiodataStudio() {
  const { token } = useAuth();
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({});
  const [prefs, setPrefs] = useState([]);
  const [newPref, setNewPref] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [blocked, setBlocked] = useState(null);
  const [toast, setToast] = useState(null);
  const timer = useRef(null);
  const say = useCallback((msg) => { clearTimeout(timer.current); setToast(msg); timer.current = setTimeout(() => setToast(null), 4400); }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  const load = useCallback(() => {
    if (!token) return undefined;
    let live = true;
    setLoading(true);
    api.myBiodata(token)
      .then((data) => {
        if (!live || !data.profile) return;
        setProfile(data.profile);
        setForm({
          ...Object.fromEntries(FIELDS.map((f) => [f.k, data.profile[f.k] || ''])),
          familyType: data.profile.familyType || '',
          photoLocked: data.profile.photoLocked,
          inNetworkPool: data.profile.inNetworkPool,
        });
        setPrefs(data.profile.preferences || []);
      })
      .catch((e) => { if (live) setBlocked(e.message || 'Biodata editing is not available for this account.'); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [token]);
  useEffect(() => load(), [load]);

  const setF = (k, v) => setForm((s) => ({ ...s, [k]: v }));
  const togglePref = (label) => setPrefs((list) => list.map((p) => (p.label === label ? { ...p, enabled: !p.enabled } : p)));
  const addPref = () => {
    const label = newPref.trim();
    if (!label) return;
    setPrefs((list) => [...list, { label, enabled: true }]);
    setNewPref('');
  };
  const removePref = (label) => setPrefs((list) => list.filter((p) => p.label !== label));

  const save = async (extra = {}) => {
    setSaving(true);
    try {
      const data = await api.updateMyBiodata(token, { ...form, preferences: prefs, ...extra });
      setProfile((p) => ({ ...p, ...data.profile }));
      // Publishing turns pool sharing on server-side; mirror the saved flags
      // back into the form so the next "Save changes" doesn't undo it.
      setForm((s) => ({
        ...s,
        photoLocked: Boolean(data.profile.photoLocked),
        inNetworkPool: Boolean(data.profile.inNetworkPool),
      }));
      say(extra.publish ? 'Published — your profile is now searchable in the network.' : 'Biodata saved.');
    } catch (e) {
      say(e.message || 'Could not save your biodata.');
    } finally {
      setSaving(false);
    }
  };

  if (blocked) {
    return (
      <div className="mb"><div className="mb-blocked">
        <div className="mb-blocked-t">Biodata editing isn't open on this account</div>
        <div className="mb-blocked-b">{blocked}</div>
        <a className="mb-blocked-link" href="/guardian">Go to your proposals</a>
      </div></div>
    );
  }
  if (loading) return <div className="mb"><div className="mb-frame" style={{ padding: 40 }}>Loading…</div></div>;
  if (!profile) return <div className="mb"><div className="mb-frame" style={{ padding: 40 }}>No profile is linked to this account yet.</div></div>;

  return (
    <div className="mb">
      <div className="mb-frame">
        <div className="mb-topbar">
          <div className="mb-topbar-brand"><div className="mb-logo">স</div><span>SongiSathi</span></div>
          <span className="mb-crumb">/ বায়োডাটা স্টুডিও · {profile.name}</span>
          <div className="mb-topbar-right"><Avatar initials={initialsOf(profile.name)} size={28} /></div>
        </div>

        <div className="mb-grid">
          <div className="mb-left">
            <div>
              <div className="mb-h-bn">বায়োডাটা স্টুডিও</div>
              <div className="mb-h-sub">Your own biodata · not editable by anyone else</div>
            </div>

            <div className="mb-status-row">
              <Badge tone={profile.status === 'ACTIVE' ? 'success' : 'neutral'}>{profile.statusLabel}</Badge>
              {profile.prn && <span className="mb-prn">{profile.prn}</span>}
              <span className="mb-complete">{profile.completeness}% complete</span>
            </div>
            <div className="mb-progress"><div style={{ width: `${profile.completeness}%` }} /></div>

            <div className="mb-fields">
              {FIELDS.map((f) => (
                <Input key={f.k} label={f.label} placeholder={f.placeholder} value={form[f.k] || ''} onChange={(e) => setF(f.k, e.target.value)} />
              ))}
              <Select label="Family type" value={form.familyType || ''} onChange={(e) => setF('familyType', e.target.value)} options={[{ value: 'NUCLEAR', label: 'Nuclear' }, { value: 'JOINT', label: 'Joint' }]} />
            </div>

            <div>
              <div className="mb-label">What you are looking for</div>
              <div className="mb-prefs">
                {prefs.map((p) => (
                  <div key={p.label} className="mb-pref">
                    <Switch label={p.label} checked={p.enabled} onChange={() => togglePref(p.label)} />
                    <span className="mb-pref-remove" onClick={() => removePref(p.label)}>✕</span>
                  </div>
                ))}
              </div>
              <div className="mb-pref-add">
                <Input placeholder="Add a preference, e.g. Settled abroad" value={newPref} onChange={(e) => setNewPref(e.target.value)} />
                <Button variant="outline" size="sm" onClick={addPref}>Add</Button>
              </div>
            </div>

            <div className="mb-switches">
              <Switch label="Keep photo locked (released only on request)" checked={form.photoLocked !== false} onChange={() => setF('photoLocked', !(form.photoLocked !== false))} />
              <Switch label="Share in the trusted network pool" checked={!!form.inNetworkPool} onChange={() => setF('inNetworkPool', !form.inNetworkPool)} />
            </div>
          </div>

          <div className="mb-right">
            <div className="mb-preview">
              <div className="mb-preview-label">Live preview</div>
              <div className="mb-sheet">
                <div className="mb-sheet-name">{profile.name}</div>
                <div className="mb-sheet-prn">{profile.prn || 'Not yet published'}</div>
                <div className="mb-sheet-facts">
                  <div><span>Age</span><span>{profile.age != null ? `${profile.age} years` : '—'}</span></div>
                  <div><span>Height</span><span>{form.heightLabel || '—'}</span></div>
                  <div><span>Location</span><span>{[form.area, profile.district].filter(Boolean).join(', ')}</span></div>
                  <div><span>Education</span><span>{[form.degree, form.institution].filter(Boolean).join(', ') || '—'}</span></div>
                  <div><span>Profession</span><span>{form.profession || '—'}</span></div>
                  <div><span>Family</span><span>{[form.familyType, form.fatherInfo].filter(Boolean).join(' · ') || '—'}</span></div>
                  <div><span>Religion</span><span>{[form.religion, form.religiousPractice].filter(Boolean).join(' · ') || '—'}</span></div>
                </div>
              </div>
            </div>

            <div className="mb-never">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--gold-400)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4.5" y="10.5" width="15" height="10" rx="2.4" /><path d="M8.4 10.5V7.8a3.6 3.6 0 0 1 7.2 0v2.7" /></svg>
              <span>Phone numbers and your private screening answers never appear on any sheet — there is no setting that adds them.</span>
            </div>

            <div className="mb-actions">
              <Button variant="primary" style={{ width: '100%' }} disabled={saving} onClick={() => save()}>{saving ? 'Saving…' : 'Save changes'}</Button>
              {profile.status === 'DRAFT' && (
                <Button variant="outline" style={{ width: '100%' }} disabled={saving} onClick={() => save({ publish: true })}>Publish · make searchable</Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {toast && (<div className="mb-toast"><span className="mb-toast-check">✓</span><span>{toast}</span></div>)}
    </div>
  );
}
