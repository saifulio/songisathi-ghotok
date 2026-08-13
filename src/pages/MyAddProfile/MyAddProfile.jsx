// A guardian adds the family member they are matchmaking for.
//
// Deliberately shorter than the ghotok's Add-profile wizard: no sealed
// screening layer and no publish step. The profile is created as a draft, and
// the guardian carries on in the biodata studio — where the rest of the fields
// and the Publish button already live.

import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, Select, Checkbox, Badge } from '../../components/ui/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useMyProfiles } from '../../context/MyProfilesContext.jsx';
import { api } from '../../lib/api.js';
import './MyAddProfile.css';

const opts = (a) => a.map((v) => ({ value: v, label: v }));
const DISTRICTS = ['Dhaka', 'Sylhet', 'Chattogram', 'Rajshahi', 'Khulna', 'Mymensingh', 'Barishal', 'Rangpur'];
const HEIGHTS = ['4′10″', '4′11″', '5′0″', '5′1″', '5′2″', '5′3″', '5′4″', '5′5″', '5′6″', '5′7″', '5′8″', '5′9″', '5′10″', '5′11″', '6′0″'];
const PREF_LABELS = ['Postgraduate degree', 'Settled abroad', 'Same district', 'Government service', 'Within 4 years of age', 'Family known to ours'];

const EMPTY = {
  fullName: '', gender: '', dob: '', heightLabel: '', maritalStatus: 'Never married',
  district: '', area: '', degree: '', institution: '', profession: '', familyType: '',
  religion: '', religiousPractice: '',
};

export default function MyAddProfile() {
  const { token } = useAuth();
  const { profiles, limit, canAdd, loading, reload, setActive } = useMyProfiles();
  const navigate = useNavigate();
  const [f, setF] = useState(EMPTY);
  const [prefs, setPrefs] = useState(() => Object.fromEntries(PREF_LABELS.map((l) => [l, false])));
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const timer = useRef(null);
  const say = useCallback((msg) => { clearTimeout(timer.current); setToast(msg); timer.current = setTimeout(() => setToast(null), 4400); }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  const setField = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const missing = !f.fullName.trim() || !f.gender || !f.district;

  const submit = async () => {
    if (busy || missing) return;
    setBusy(true);
    try {
      const { profile } = await api.createMyProfile(token, {
        ...f,
        preferences: PREF_LABELS.map((label) => ({ label, enabled: prefs[label] })),
      });
      // Switch to the profile that was just added, so the biodata studio (and
      // every other member page) opens on it.
      await reload();
      setActive(profile.id);
      say(`${profile.name} added as a draft. Finish the biodata, then publish to make it searchable.`);
      setTimeout(() => navigate('/my-biodata'), 1200);
    } catch (err) {
      say(err.message || 'Could not add the profile. Please try again.');
      setBusy(false);
    }
  };

  if (!loading && !canAdd) {
    return (
      <div className="map">
        <div className="map-frame map-full">
          <div className="map-h-bn">প্রোফাইল যোগ করা যাবে না</div>
          <div className="map-h-sub">
            A guardian account holds up to {limit} profiles, and yours is full ({profiles.length} of {limit}).
            Switch between the ones you have from the bar above.
          </div>
          <Button variant="outline" onClick={() => navigate('/guardian')}>Go to your proposals</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="map">
      <div className="map-frame">
        <div className="map-head">
          <div>
            <div className="map-h-bn">নতুন প্রোফাইল</div>
            <div className="map-h-sub">
              Add the family member you are matchmaking for. Saved as a draft — nobody sees it until you publish
              it from the biodata studio.
            </div>
          </div>
          <Badge tone="neutral">{profiles.length} of {limit} used</Badge>
        </div>

        <div className="map-card">
          <div className="map-card-t">Basic details</div>
          <div className="map-grid">
            <Input label="Full name" caption="পুরো নাম" placeholder="e.g. Nusrat Jahan" value={f.fullName} onChange={setField('fullName')} />
            <Select label="Profile for" value={f.gender} onChange={setField('gender')} placeholder="Bride or groom" options={[{ value: 'FEMALE', label: 'Bride (female)' }, { value: 'MALE', label: 'Groom (male)' }]} />
            <Input label="Date of birth" caption="জন্ম তারিখ" type="date" value={f.dob} onChange={setField('dob')} />
            <Select label="Height" value={f.heightLabel} onChange={setField('heightLabel')} options={opts(HEIGHTS)} />
            <Select label="Marital status" value={f.maritalStatus} onChange={setField('maritalStatus')} options={opts(['Never married', 'Divorced', 'Widowed'])} />
            <Select label="District" value={f.district} onChange={setField('district')} options={opts(DISTRICTS)} />
            <Input label="Area" caption="এলাকা" placeholder="e.g. Dhanmondi" value={f.area} onChange={setField('area')} />
          </div>
          <div className="map-note">Name, gender, and district are fixed once the profile is created. Everything else stays editable.</div>
        </div>

        <div className="map-card">
          <div className="map-card-t">Education, profession, and family</div>
          <div className="map-grid">
            <Input label="Highest degree" placeholder="e.g. MBA" value={f.degree} onChange={setField('degree')} />
            <Input label="Institution" placeholder="e.g. IBA, University of Dhaka" value={f.institution} onChange={setField('institution')} />
            <Input label="Profession" caption="পেশা" placeholder="e.g. Banker" value={f.profession} onChange={setField('profession')} />
            <Select label="Family type" value={f.familyType} onChange={setField('familyType')} options={[{ value: 'NUCLEAR', label: 'Nuclear' }, { value: 'JOINT', label: 'Joint' }]} />
            <Input label="Religion" placeholder="e.g. Islam" value={f.religion} onChange={setField('religion')} />
            <Input label="Religious practice" placeholder="e.g. Practising" value={f.religiousPractice} onChange={setField('religiousPractice')} />
          </div>
        </div>

        <div className="map-card">
          <div className="map-card-t">What the family is looking for</div>
          <div className="map-note">Shown on the biodata. You can change these any time from the biodata studio.</div>
          <div className="map-prefs">
            {PREF_LABELS.map((l) => (
              <Checkbox key={l} label={l} checked={prefs[l]} onChange={() => setPrefs((s) => ({ ...s, [l]: !s[l] }))} />
            ))}
          </div>
        </div>

        <div className="map-actions">
          <span className="map-actions-note">
            {missing ? 'Full name, bride or groom, and district are needed to save.' : 'The photo stays locked, and the profile stays out of the pool until you publish it.'}
          </span>
          <Button variant="primary" disabled={busy || missing} onClick={submit}>
            {busy ? 'Adding…' : 'Add profile'}
          </Button>
        </div>
      </div>

      {toast && (<div className="map-toast"><span className="map-toast-check">✓</span><span>{toast}</span></div>)}
    </div>
  );
}
