import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Input, Select } from '../../components/ui/index.jsx';
import { useAuth, homeForRole } from '../../context/AuthContext.jsx';
import './Auth.css';

const ACCOUNT_TYPES = [
  { value: 'matchmaker', label: 'Matchmaker', bn: 'ঘটক', note: 'You manage biodata for families.' },
  { value: 'guardian', label: 'Guardian', bn: 'অভিভাবক', note: 'You manage a family member’s search.' },
  { value: 'bride', label: 'Bride (self)', bn: 'কনে', note: 'You manage your own biodata.' },
  { value: 'groom', label: 'Groom (self)', bn: 'বর', note: 'You manage your own biodata.' },
];
const TYPE_VALUES = ACCOUNT_TYPES.map((t) => t.value);

const opts = (a) => a.map((v) => ({ value: v, label: v }));
const DISTRICTS = ['Dhaka', 'Sylhet', 'Chattogram', 'Rajshahi', 'Khulna', 'Mymensingh', 'Barishal', 'Rangpur'];
const HEIGHTS = ["4′10″", "4′11″", "5′0″", "5′1″", "5′2″", "5′3″", "5′4″", "5′5″", "5′6″", "5′7″", "5′8″", "5′9″", "5′10″", "5′11″", "6′0″", "6′1″"];
const TIER_VALUES = ['SOLO', 'BUREAU', 'AGENCY'];

export default function SignUp() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // Preselect the account type from ?as= (e.g. the "For families" flow lands
  // here with guardian chosen). Falls back to matchmaker for anything unknown.
  const requestedType = params.get('as');
  const [accountType, setAccountType] = useState(
    TYPE_VALUES.includes(requestedType) ? requestedType : 'matchmaker'
  );
  // ?tier= / ?district= carry a plan and district picked on the pricing or
  // onboarding page through to the matchmaker fields below.
  const requestedTier = (params.get('tier') || '').toUpperCase();
  const requestedDistrict = params.get('district');
  const [f, setF] = useState({
    fullName: '', phone: '', password: '', confirm: '',
    // matchmaker
    bureauName: '', tier: TIER_VALUES.includes(requestedTier) ? requestedTier : 'SOLO',
    // guardian
    relation: '',
    // self (bride/groom)
    dob: '', heightLabel: '5′4″', maritalStatus: 'Never married',
    area: '', degree: '', institution: '', profession: '', familyType: 'NUCLEAR',
    religion: '', religiousPractice: 'Moderately practising',
    // shared
    district: DISTRICTS.includes(requestedDistrict) ? requestedDistrict : 'Dhaka',
  });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const isSelf = accountType === 'bride' || accountType === 'groom';

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (f.password.length < 6) return setError('Password must be at least 6 characters.');
    if (f.password !== f.confirm) return setError('Passwords do not match.');

    const payload = { accountType, fullName: f.fullName, phone: f.phone, password: f.password };
    if (accountType === 'matchmaker') Object.assign(payload, { district: f.district, bureauName: f.bureauName, tier: f.tier });
    if (accountType === 'guardian') Object.assign(payload, { district: f.district, relation: f.relation });
    if (isSelf) Object.assign(payload, {
      district: f.district, dob: f.dob, heightLabel: f.heightLabel, maritalStatus: f.maritalStatus,
      area: f.area, degree: f.degree, institution: f.institution, profession: f.profession,
      familyType: f.familyType, religion: f.religion, religiousPractice: f.religiousPractice,
    });

    setBusy(true);
    try {
      const user = await signup(payload);
      navigate(homeForRole(user), { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <div className="auth-card wide">
        <aside className="auth-aside">
          <Link to="/" className="auth-brand"><span className="auth-logo">স</span><span>SongiSathi</span></Link>
          <div className="auth-aside-title">Create your account</div>
          <p className="auth-aside-copy">Whether you are a matchmaker, a guardian, or searching for yourself — your details stay behind you. Contact and photos are never the opening move.</p>
          <ul className="auth-aside-list">
            <li>Private screening on every profile</li>
            <li>Photos locked until you release them</li>
            <li>Your commission is yours — we take none</li>
          </ul>
        </aside>

        <div className="auth-main">
          <h1 className="auth-title">Sign up</h1>
          <p className="auth-sub">Choose the kind of account you need.</p>

          <div className="auth-types">
            {ACCOUNT_TYPES.map((t) => (
              <button type="button" key={t.value} className={`auth-type ${accountType === t.value ? 'is-active' : ''}`} onClick={() => setAccountType(t.value)}>
                <span className="auth-type-label">{t.label}</span>
                <span className="auth-type-bn">{t.bn}</span>
                <span className="auth-type-note">{t.note}</span>
              </button>
            ))}
          </div>

          {error && <div className="auth-error">{error}</div>}

          <form className="auth-form" onSubmit={submit}>
            <div className="auth-grid">
              <Input label="Full name" caption="পুরো নাম" placeholder="e.g. Rahima Akter" value={f.fullName} onChange={set('fullName')} />
              <Input label="Mobile number" caption="মোবাইল" placeholder="01712 345 678" value={f.phone} onChange={set('phone')} />
              <Input label="Password" type="password" placeholder="At least 6 characters" value={f.password} onChange={set('password')} />
              <Input label="Confirm password" type="password" placeholder="Re-enter password" value={f.confirm} onChange={set('confirm')} />
            </div>

            {/* MATCHMAKER */}
            {accountType === 'matchmaker' && (
              <div className="auth-grid">
                <Select label="District you work in" value={f.district} onChange={set('district')} options={opts(DISTRICTS)} />
                <Select label="Plan" value={f.tier} onChange={set('tier')} options={[{ value: 'SOLO', label: 'Solo · 20 profiles' }, { value: 'BUREAU', label: 'Bureau · 50 profiles' }, { value: 'AGENCY', label: 'Agency · 150 profiles' }]} />
                <Input label="Bureau / practice name" caption="ঐচ্ছিক" placeholder="Optional" value={f.bureauName} onChange={set('bureauName')} />
              </div>
            )}

            {/* GUARDIAN */}
            {accountType === 'guardian' && (
              <div className="auth-grid">
                <Select label="District" value={f.district} onChange={set('district')} options={opts(DISTRICTS)} />
                <Input label="Your relation" caption="সম্পর্ক" placeholder="e.g. Mother of Nusrat Jahan" value={f.relation} onChange={set('relation')} />
              </div>
            )}

            {/* BRIDE / GROOM (self) — biodata */}
            {isSelf && (
              <>
                <div className="auth-section-label">Biodata · {accountType === 'bride' ? 'কনের তথ্য' : 'বরের তথ্য'}</div>
                <div className="auth-grid">
                  <Input label="Date of birth" caption="জন্ম তারিখ" type="date" value={f.dob} onChange={set('dob')} />
                  <Select label="Height" value={f.heightLabel} onChange={set('heightLabel')} options={opts(HEIGHTS)} />
                  <Select label="Marital status" value={f.maritalStatus} onChange={set('maritalStatus')} options={opts(['Never married', 'Divorced', 'Widowed'])} />
                  <Select label="District" value={f.district} onChange={set('district')} options={opts(DISTRICTS)} />
                  <Input label="Area" caption="এলাকা" placeholder="e.g. Dhanmondi" value={f.area} onChange={set('area')} />
                  <Input label="Highest degree" caption="সর্বোচ্চ ডিগ্রি" placeholder="e.g. MBA" value={f.degree} onChange={set('degree')} />
                  <Input label="Institution" placeholder="e.g. IBA, University of Dhaka" value={f.institution} onChange={set('institution')} />
                  <Input label="Profession" caption="পেশা" placeholder="e.g. Banker" value={f.profession} onChange={set('profession')} />
                  <Select label="Family type" value={f.familyType} onChange={set('familyType')} options={[{ value: 'NUCLEAR', label: 'Nuclear' }, { value: 'JOINT', label: 'Joint' }]} />
                  <Input label="Religion" placeholder="e.g. Islam — Sunni" value={f.religion} onChange={set('religion')} />
                  <Select label="Religious practice" value={f.religiousPractice} onChange={set('religiousPractice')} options={opts(['Strictly practising', 'Moderately practising', 'Culturally observant'])} />
                </div>
              </>
            )}

            <Button type="submit" variant="primary" size="lg" disabled={busy} style={{ width: '100%', marginTop: 6 }}>
              {busy ? 'Creating account…' : 'Create account'}
            </Button>
          </form>

          <div className="auth-alt">Already have an account? <Link to="/signin">Sign in</Link></div>
        </div>
      </div>
    </div>
  );
}
