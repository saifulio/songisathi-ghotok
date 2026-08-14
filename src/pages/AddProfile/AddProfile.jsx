import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Avatar, Badge, Input, Select, Checkbox, Switch, Radio, Tabs, StatusPill, Dialog } from '../../components/ui/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { api } from '../../lib/api.js';
import PageFrame from '../../components/PageFrame.jsx';
import './AddProfile.css';

const QS = [
  { id: 'q1', bn: 'বিয়ের পর কোথায় থাকার পরিকল্পনা?', en: 'Where does the family expect the couple to live after marriage?', help: 'The single most common cause of a broken engagement, and the hardest thing for two families to raise with each other.', options: ['With the groom’s family', 'Separate household', 'Either, to be decided together'] },
  { id: 'q2', bn: 'যৌতুক সম্পর্কে পরিবারের অবস্থান কী?', en: 'What is the family’s position on dowry?', help: 'Dowry is illegal in Bangladesh. SongiSathi does not match a family that expects it with one that refuses it.', options: ['We neither give nor accept dowry', 'Gifts only, freely given', 'Prefer not to answer'] },
  { id: 'q3', bn: 'বিয়ের পর চাকরি চালিয়ে যাওয়া নিয়ে প্রত্যাশা?', en: 'Expectation about continuing employment after marriage', help: 'Asked of both sides. Mismatched expectations here surface late and painfully.', options: ['Should continue working', 'Should stop working', 'The couple decides'] },
  { id: 'q4', bn: 'ধর্মীয় অনুশীলনের মাত্রা?', en: 'Level of religious practice in the household', help: '', options: ['Strictly practising', 'Moderately practising', 'Culturally observant'] },
  { id: 'q5', bn: 'আগের বিবাহ বা সন্তান আছে এমন পাত্র/পাত্রী বিবেচনা করবেন?', en: 'Would the family consider a candidate with a prior marriage or children?', help: '', options: ['Yes, without reservation', 'Yes, if there are no children', 'No'] },
  { id: 'q6', bn: 'অন্য পরিবারের আগে থেকে জানা উচিত এমন কোনো স্বাস্থ্য বিষয়?', en: 'Any health matter the other family should know before proceeding?', help: 'Written answers are compared by the system only, never displayed. Leave blank if there is nothing to disclose.', type: 'text', placeholder: 'e.g. a managed chronic condition, a hereditary consideration — in the family’s own words' },
];
const opts = (a) => a.map((v) => ({ value: v, label: v }));
const OWNERS = [{ value: 'guardian', label: 'The guardian' }, { value: 'candidate', label: 'The candidate' }, { value: 'ghotok', label: 'I will fill it in' }];
// The DB stores question text but not the textarea placeholder — supply it here.
const PLACEHOLDERS = { q6: 'e.g. a managed chronic condition, a hereditary consideration — in the family’s own words' };

export default function AddProfile() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [owner, setOwner] = useState('guardian');
  const [questions, setQuestions] = useState(QS);
  const [answers, setAnswers] = useState({});
  const [text, setText] = useState('');
  const [consent, setConsent] = useState(false);
  const [sealed, setSealed] = useState(false);
  const [poolOn, setPoolOn] = useState(true);
  const [busy, setBusy] = useState(false);
  // The plan meter from the dashboard, so a full plan is visible before the
  // wizard is filled in rather than only when POST /profiles refuses it.
  const [plan, setPlan] = useState(null);
  const [publishedPrn, setPublishedPrn] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [toast, setToast] = useState(null);
  const [f, setF] = useState({ name: 'Nusrat Jahan', gender: 'FEMALE', dob: '2000-03-14', height: '5′4″', marital: 'Never married', district: 'Dhaka', area: 'Dhanmondi', degree: 'MBA', inst: 'IBA, University of Dhaka', job: 'Banker', family: 'Nuclear' });
  const [prefs, setPrefs] = useState({ 'Postgraduate degree': true, 'Settled abroad': false, 'Same district': true, 'Government service': false, 'Within 4 years of age': true, 'Family known to ours': false });
  const timer = useRef(null);
  const say = useCallback((msg) => { clearTimeout(timer.current); setToast(msg); timer.current = setTimeout(() => setToast(null), 4200); }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  // Load the sealed-layer questions from the API (falls back to the built-in
  // list if the request fails, so the wizard still works offline).
  useEffect(() => {
    let live = true;
    api.screeningQuestions(token)
      .then((data) => {
        if (!live || !data?.questions?.length) return;
        setQuestions(data.questions.map((q) => (
          q.type === 'text' ? { ...q, placeholder: PLACEHOLDERS[q.id] || 'In the family’s own words' } : q
        )));
      })
      .catch(() => { /* keep the built-in QS fallback */ });
    return () => { live = false; };
  }, [token]);

  // How much room the plan has left. A failure here leaves plan null, which
  // reads as "not known yet" and blocks nothing — the server still decides.
  useEffect(() => {
    let live = true;
    api.dashboardStats(token)
      .then((data) => { if (live) setPlan(data.stats); })
      .catch(() => { /* the publish attempt will report it */ });
    return () => { live = false; };
  }, [token]);

  const planFull = plan ? plan.activeProfiles >= plan.profileLimit : false;
  const slotsLeft = plan ? Math.max(0, plan.profileLimit - plan.activeProfiles) : null;
  const tierLabel = plan?.tier ? plan.tier[0] + plan.tier.slice(1).toLowerCase() : '';

  const setField = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  const textQ = questions.find((q) => q.type === 'text');
  const total = questions.length;
  const answered = questions.filter((q) => q.type !== 'text' && answers[q.id]).length + (text.trim() ? 1 : 0);

  // Assemble the wizard state into the API payload.
  const buildPayload = (publish) => ({
    fullName: f.name,
    gender: f.gender,
    dob: f.dob,
    heightLabel: f.height,
    maritalStatus: f.marital,
    district: f.district,
    area: f.area,
    degree: f.degree,
    institution: f.inst,
    profession: f.job,
    familyType: f.family,
    preferences: Object.entries(prefs).map(([label, enabled]) => ({ label, enabled })),
    screening: { ...answers, ...(textQ ? { [textQ.id]: text.trim() } : {}) },
    owner,
    sealed,
    inNetworkPool: poolOn,
    publish,
  });

  const submit = async (publish) => {
    if (busy || publishedPrn) return;
    setBusy(true);
    try {
      const { profile } = await api.createProfile(token, buildPayload(publish));
      if (publish) {
        setPublishedPrn(profile.prn);
        say(`Profile published. ${profile.prn} issued — it enters matching from Monday’s run.`);
        setTimeout(() => navigate('/dashboard'), 1600);
      } else {
        say('Draft saved. You can return to this profile from the dashboard.');
      }
    } catch (err) {
      say(err.message || 'Could not save the profile. Please try again.');
    } finally {
      setBusy(false);
    }
  };
  const vaultPct = Math.round((answered / total) * 100);
  const completePct = 46 + Math.round((answered / total) * 34) + (sealed ? 8 : 0);
  const stepDone = { 1: true, 2: true, 3: sealed, 4: false };

  const steps = [
    { n: 1, bn: 'মৌলিক তথ্য', en: 'Basic details', meta: '6 of 6 fields' },
    { n: 2, bn: 'শিক্ষা ও পরিবার', en: 'Education and family', meta: '4 of 4 fields' },
    { n: 3, bn: 'গোপন প্রশ্নাবলী', en: 'Private screening', meta: sealed ? 'Sealed' : `${answered} of ${total} answered` },
    { n: 4, bn: 'পর্যালোচনা', en: 'Review and publish', meta: sealed ? 'Ready' : 'Locked until step 3 is sealed' },
  ];

  const handoffCopy = { guardian: { title: 'Hand this step to the guardian', body: 'They open the link on their own phone. You never see the answers, and they know it.', link: 'sngi.st/v/9K2M' }, candidate: { title: 'Hand this step to the candidate', body: 'The candidate answers privately. The guardian is notified that the section is complete, not what it says.', link: 'sngi.st/v/4T7P' }, ghotok: null }[owner];

  const dlg = dialog === 'seal'
    ? { title: 'Seal these answers?', body: `Once sealed, these ${total} answers are encrypted and cannot be viewed or edited — by you, by the family, or by anyone at SongiSathi. Reopening the section means asking the family to answer again from the start.`,
        actions: (<><Button variant="ghost" onClick={() => setDialog(null)}>Not yet</Button><Button variant="primary" onClick={() => { setSealed(true); setDialog(null); say(`Sealed. ${total} answers encrypted — matching can read them, nobody else can.`); }}>Seal answers</Button></>) }
    : dialog === 'reanswer'
      ? { title: 'Ask the family to re-answer?', body: 'The sealed answers are destroyed and a fresh link is sent to the guardian. Until they finish, this profile drops out of AI matching.',
          actions: (<><Button variant="ghost" onClick={() => setDialog(null)}>Cancel</Button><Button variant="primary" onClick={() => { setSealed(false); setAnswers({}); setText(''); setConsent(false); setDialog(null); say('Previous answers destroyed. A fresh link was sent to the guardian on WhatsApp.'); }}>Send new link</Button></>) }
      : dialog === 'policy'
        ? { title: 'How the sealed layer works', body: 'Answers are encrypted on the family’s device before they reach us. Matching runs on the encrypted comparison, returning one bit per pair: compatible, or not suggested. No staff account, no export, and no support ticket can reveal an answer.',
            actions: (<Button variant="primary" onClick={() => setDialog(null)}>Understood</Button>) }
        : null;

  const reviewRows = [
    { k: 'Date of birth · age', v: '14 March 2000 · 26 years' },
    { k: 'Height · marital status', v: `${f.height} · ${f.marital}` },
    { k: 'Education', v: `${f.degree}, ${f.inst}` },
    { k: 'Profession', v: f.job },
    { k: 'Family type', v: `${f.family} family, ${f.area}` },
    { k: 'Managed by', v: 'Rahima Akter (ghotok) · GHT-0042, Sylhet' },
  ];
  const checks = [
    {
      label: plan
        ? planFull
          ? `Your ${tierLabel} plan is full — ${plan.activeProfiles} of ${plan.profileLimit} active profiles. Save this as a draft, or free a place first.`
          : `${slotsLeft} of ${plan.profileLimit} places left on your ${tierLabel} plan`
        : 'Checking how much room your plan has left',
      mark: planFull ? '!' : '✓',
      bg: planFull ? 'var(--gold-200)' : 'var(--green-100)',
      fg: planFull ? 'var(--gold-700)' : 'var(--brand-primary)',
    },
    { label: 'Basic details and education complete', mark: '✓', bg: 'var(--green-100)', fg: 'var(--brand-primary)' },
    { label: sealed ? 'Private screening sealed' : 'Private screening not sealed — profile will publish without matching', mark: sealed ? '✓' : '!', bg: sealed ? 'var(--green-100)' : 'var(--gold-200)', fg: sealed ? 'var(--brand-primary)' : 'var(--gold-700)' },
    { label: 'Photo locked until released per request', mark: '✓', bg: 'var(--green-100)', fg: 'var(--brand-primary)' },
    { label: 'Guardian consent recorded for contact routing', mark: '✓', bg: 'var(--green-100)', fg: 'var(--brand-primary)' },
  ];
  const sealDisabled = !(consent && answered >= total - 1);
  const nextLabel = step === 4 ? (planFull ? 'Plan full' : 'Publish profile') : 'Save and continue';
  const footerNote = step === 3
    ? (sealed ? 'Sealed — step 4 is unlocked.' : 'Step 4 unlocks once this section is sealed.')
    : step === 4 && planFull
      ? 'Your plan has no free place. Save this as a draft and publish it once one opens.'
      : 'Everything here is editable until you publish.';

  return (
    <PageFrame
      note="/ প্রোফাইল / নতুন প্রোফাইল"
      right={<><span>Draft saved 2 minutes ago</span><Badge tone="neutral">Draft</Badge><Avatar initials="RA" size={28} /></>}
    >

        <div className="ap-grid">
          {/* rail */}
          <div className="ap-rail">
            <div>
              <div className="ap-h-bn">নতুন প্রোফাইল</div>
              <div className="ap-h-sub">New profile · PRN will be issued on publish</div>
            </div>
            <div className="ap-steps">
              {steps.map((st) => {
                const active = step === st.n; const done = stepDone[st.n];
                return (
                  <div key={st.n} className="ap-step-item" onClick={() => setStep(st.n)} style={{ background: active ? 'var(--green-100)' : 'transparent', borderColor: active ? 'var(--green-300)' : 'transparent' }}>
                    <span className="ap-step-num" style={{ background: active ? 'var(--brand-primary)' : done ? 'var(--green-100)' : 'var(--surface-card-alt)', color: active ? 'var(--surface-card)' : done ? 'var(--brand-primary)' : 'var(--text-secondary)' }}>{done && !active ? '✓' : st.n}</span>
                    <span className="ap-step-labels">
                      <span className="ap-step-bn" style={{ color: active ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{st.bn}</span>
                      <span className="ap-step-en">{st.en}</span>
                      <span className="ap-step-meta" style={{ color: st.n === 3 && !sealed ? 'var(--gold-700)' : 'var(--text-secondary)' }}>{st.meta}</span>
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="ap-complete">
              <div className="ap-complete-t">Profile completeness</div>
              <div className="ap-complete-num"><span>{completePct}%</span><span className="ap-complete-sub">of required fields</span></div>
              <div className="ap-complete-bar"><div style={{ width: `${Math.min(completePct, 100)}%` }} /></div>
              <div className="ap-complete-note">Profiles under 70% are not shown in AI matching.</div>
            </div>
          </div>

          {/* body */}
          <div className="ap-body">
            {step === 1 && (
              <div className="ap-stepbody">
                <div><div className="ap-step-title">মৌলিক তথ্য</div><div className="ap-step-desc">Basic details · visible on the biodata once you publish</div></div>
                <div className="ap-card ap-form-grid">
                  <Input label="Full name" caption="পুরো নাম" placeholder="e.g. Nusrat Jahan" value={f.name} onChange={setField('name')} />
                  <Select label="Profile for" caption="পাত্র/পাত্রী" value={f.gender} onChange={setField('gender')} options={[{ value: 'FEMALE', label: 'Bride (female)' }, { value: 'MALE', label: 'Groom (male)' }]} />
                  <Input label="Date of birth" caption="জন্ম তারিখ" type="date" value={f.dob} onChange={setField('dob')} />
                  <Select label="Height" value={f.height} onChange={setField('height')} options={opts(['5′0″', '5′1″', '5′2″', '5′3″', '5′4″', '5′5″', '5′6″'])} />
                  <Select label="Marital status" value={f.marital} onChange={setField('marital')} options={opts(['Never married', 'Divorced', 'Widowed'])} />
                  <Select label="District" value={f.district} onChange={setField('district')} options={opts(['Dhaka', 'Sylhet', 'Chattogram', 'Rajshahi', 'Khulna', 'Mymensingh'])} />
                  <Input label="Area" caption="এলাকা" placeholder="e.g. Dhanmondi" value={f.area} onChange={setField('area')} />
                </div>
                <div className="ap-card ap-photo-row">
                  <div className="ap-photo-frame">
                    <div className="ap-photo-lock">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EBDCC3" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4.5" y="10.5" width="15" height="10" rx="2.4" /><path d="M8.4 10.5V7.8a3.6 3.6 0 0 1 7.2 0v2.7" /></svg>
                      <span>Photo locked by default<br />Release per request</span>
                    </div>
                  </div>
                  <div className="ap-photo-copy">
                    <div><div className="ap-photo-t">Photograph</div><div className="ap-photo-b">Photos stay blurred to everyone until this profile's manager releases them for a specific request. Families see the biodata first — the photo is never the opening move.</div></div>
                    <div className="ap-photo-actions">
                      <Button variant="outline" size="sm" onClick={() => say('Photo added and locked. Release it per request from the profile page.')}>Upload photo</Button>
                      <Button variant="ghost" size="sm" onClick={() => say('Photo skipped. Profiles without a photo still match — the biodata carries the weight.')}>Add later</Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="ap-stepbody">
                <div><div className="ap-step-title">শিক্ষা ও পরিবার</div><div className="ap-step-desc">Education, profession, and family details</div></div>
                <div className="ap-card ap-form-grid">
                  <Input label="Highest degree" caption="সর্বোচ্চ ডিগ্রি" placeholder="e.g. MBA" value={f.degree} onChange={setField('degree')} />
                  <Input label="Institution" placeholder="e.g. IBA, University of Dhaka" value={f.inst} onChange={setField('inst')} />
                  <Input label="Profession" caption="পেশা" placeholder="e.g. Banker" value={f.job} onChange={setField('job')} />
                  <Select label="Family type" value={f.family} onChange={setField('family')} options={opts(['Nuclear', 'Joint'])} />
                </div>
                <div className="ap-card">
                  <div className="ap-photo-t">What the family is looking for</div>
                  <div className="ap-step-desc">Shown on the biodata. Anything sensitive belongs in step 3 instead.</div>
                  <div className="ap-prefs">
                    {Object.keys(prefs).map((k) => (<Checkbox key={k} label={k} checked={prefs[k]} onChange={() => setPrefs((s) => ({ ...s, [k]: !s[k] }))} />))}
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="ap-stepbody">
                <div className="ap-vault-head">
                  <div>
                    <div className="ap-vault-title-row"><div className="ap-step-title">গোপন প্রশ্নাবলী</div><Badge tone="gold">Sealed layer</Badge></div>
                    <div className="ap-step-desc">Private screening · the questions families need answered but can never ask</div>
                  </div>
                  <div className="ap-vault-progress">
                    <div className="ap-vault-progress-label">{answered} of {total} answered</div>
                    <div className="ap-vault-bar"><div style={{ width: `${vaultPct}%` }} /></div>
                  </div>
                </div>

                <div className="ap-wall">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#DBB863" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none', marginTop: 1 }}><rect x="4.5" y="10.5" width="15" height="10" rx="2.4" /><path d="M8.4 10.5V7.8a3.6 3.6 0 0 1 7.2 0v2.7" /></svg>
                  <div className="ap-wall-copy">
                    <div className="ap-wall-t">These answers are sealed the moment they are submitted</div>
                    <div className="ap-wall-b">They are encrypted and read only by the matching system. You will never see them. The other family will never see them. The matched candidate will never see them. What crosses the wall is a single line on the suggestion card: compatible, or not suggested.</div>
                  </div>
                  <Button variant="ghost" size="sm" style={{ color: '#DBB863', borderColor: 'rgba(219,184,99,.4)' }} onClick={() => setDialog('policy')}>How it works</Button>
                </div>

                <div className="ap-card">
                  <div className="ap-owner-row">
                    <div className="ap-owner-copy">
                      <div className="ap-photo-t">Who answers this section?</div>
                      <div className="ap-step-desc">Most ghotoks hand this step to the family — the answers are theirs to give, and handing it over is what keeps you out of the confidential layer entirely.</div>
                    </div>
                    <Tabs items={OWNERS.map((o) => ({ ...o }))} active={owner} onChange={setOwner} style={{ border: 'none' }} />
                  </div>
                  {owner !== 'ghotok' && handoffCopy && (
                    <div className="ap-handoff">
                      <div className="ap-handoff-copy"><div className="ap-handoff-t">{handoffCopy.title}</div><div className="ap-handoff-b">{handoffCopy.body}</div></div>
                      <div className="ap-handoff-send">
                        <div className="ap-handoff-link">{handoffCopy.link}</div>
                        <Button variant="primary" size="sm" onClick={() => say('Link sent. The family answers on their own phone; you will only see that the section is complete.')}>Send on WhatsApp</Button>
                      </div>
                    </div>
                  )}
                </div>

                {!sealed ? (
                  <>
                    <div className="ap-questions">
                      {questions.map((q, i) => {
                        const a = answers[q.id];
                        const done = q.type === 'text' ? !!text.trim() : !!a;
                        return (
                          <div key={q.id} className="ap-question" style={{ borderColor: done ? 'var(--green-300)' : 'var(--border-subtle)' }}>
                            <div className="ap-question-head">
                              <span className="ap-question-num" style={{ background: done ? 'var(--brand-primary)' : 'var(--surface-card-alt)', color: done ? 'var(--surface-card)' : 'var(--text-secondary)' }}>{done ? '✓' : i + 1}</span>
                              <div className="ap-question-text">
                                <div className="ap-question-bn">{q.bn}</div>
                                <div className="ap-question-en">{q.en}</div>
                                {q.help && <div className="ap-question-help">{q.help}</div>}
                              </div>
                              <span className="ap-question-never">
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4.5" y="10.5" width="15" height="10" rx="2.4" /><path d="M8.4 10.5V7.8a3.6 3.6 0 0 1 7.2 0v2.7" /></svg>
                                never shown
                              </span>
                            </div>
                            {q.type === 'text' ? (
                              <div className="ap-question-body">
                                <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={q.placeholder} className="ap-textarea" />
                                <div className="ap-textarea-note">Written answers are encrypted with the same key as the rest of this section. They are never rendered anywhere in the product.</div>
                              </div>
                            ) : (
                              <div className="ap-options">
                                {q.options.map((o) => (
                                  <div key={o} className="ap-option" onClick={() => setAnswers((s) => ({ ...s, [q.id]: o }))} style={{ borderColor: a === o ? 'var(--brand-primary)' : 'var(--border-subtle)', background: a === o ? 'var(--green-100)' : 'var(--surface-page)' }}>
                                    <Radio label={o} checked={a === o} name={q.id} onChange={() => setAnswers((s) => ({ ...s, [q.id]: o }))} />
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="ap-seal">
                      <div className="ap-seal-consent">
                        <Checkbox label="The family has given these answers themselves and understands they cannot be edited after sealing." checked={consent} onChange={() => setConsent((v) => !v)} />
                        <div className="ap-seal-note">A sealed section can only be reopened by asking the family to answer again — you request it, they re-answer, the old answers are destroyed.</div>
                      </div>
                      <div className="ap-seal-actions">
                        <Button variant="ghost" disabled={busy} onClick={() => submit(false)}>Save draft</Button>
                        <Button variant="primary" disabled={sealDisabled} onClick={() => setDialog('seal')}>Seal and encrypt answers</Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="ap-sealed">
                    <div className="ap-sealed-icon"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#DBB863" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="4.5" y="10.5" width="15" height="10" rx="2.4" /><path d="M8.4 10.5V7.8a3.6 3.6 0 0 1 7.2 0v2.7" /></svg></div>
                    <div className="ap-sealed-bn">উত্তরগুলো সিল করা হয়েছে</div>
                    <div className="ap-sealed-body">Sealed on 8 August 2026 by the Guardian of this profile. {total} answers encrypted. From here, matching reads them; nobody does.</div>
                    <div className="ap-sealed-stats">
                      <div><div className="ap-sealed-num">{total}</div><div className="ap-sealed-cap">answers sealed</div></div>
                      <div><div className="ap-sealed-num">0</div><div className="ap-sealed-cap">people who can read them</div></div>
                      <div><div className="ap-sealed-num">AES-256</div><div className="ap-sealed-cap">at rest and in transit</div></div>
                    </div>
                    <div className="ap-sealed-actions">
                      <Button variant="ghost" size="sm" style={{ color: '#DBB863', borderColor: 'rgba(219,184,99,.4)' }} onClick={() => setDialog('reanswer')}>Ask the family to re-answer</Button>
                      <Button variant="primary" size="sm" onClick={() => setStep(4)}>Continue to review</Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {step === 4 && (
              <div className="ap-stepbody">
                <div><div className="ap-step-title">পর্যালোচনা ও প্রকাশ</div><div className="ap-step-desc">Review and publish · this is exactly what other families will see</div></div>
                <div className="ap-review-grid">
                  <div className="ap-card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div className="ap-review-head">
                      <div className="ap-review-photo"><div className="ap-review-photo-lock"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#EBDCC3" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="4.5" y="10.5" width="15" height="10" rx="2.4" /><path d="M8.4 10.5V7.8a3.6 3.6 0 0 1 7.2 0v2.7" /></svg></div></div>
                      <div className="ap-review-head-info"><div className="ap-review-name">{f.name}</div><div className="ap-review-sub">PRN issued on publish · {f.area}, {f.district}</div></div>
                      <StatusPill status="draft" />
                    </div>
                    {reviewRows.map((r) => (<div key={r.k} className="ap-review-row"><span className="ap-review-k">{r.k}</span><span className="ap-review-v">{r.v}</span></div>))}
                    <div className="ap-review-vault">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gold-600)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}><rect x="4.5" y="10.5" width="15" height="10" rx="2.4" /><path d="M8.4 10.5V7.8a3.6 3.6 0 0 1 7.2 0v2.7" /></svg>
                      <span>Private screening section: <strong>{sealed ? `sealed, ${total} answers` : 'not yet sealed'}</strong>. Its contents appear nowhere on this page, by design.</span>
                    </div>
                  </div>
                  <div className="ap-review-rail">
                    <div className="ap-card">
                      <div className="ap-photo-t">Before you publish</div>
                      <div className="ap-checks">
                        {checks.map((c) => (<div key={c.label} className="ap-check"><span className="ap-check-mark" style={{ background: c.bg, color: c.fg }}>{c.mark}</span><span>{c.label}</span></div>))}
                      </div>
                    </div>
                    <div className="ap-card ap-publish">
                      <Switch label="Include in trusted network pool" checked={poolOn} onChange={() => setPoolOn((v) => !v)} />
                      <div className="ap-publish-note">Other verified ghotoks can be suggested this profile. Contact always routes back through you.</div>
                      <Button variant="primary" style={{ width: '100%' }} disabled={busy || !!publishedPrn || planFull} onClick={() => submit(true)}>{publishedPrn ? `Published · ${publishedPrn}` : planFull ? 'Plan full — save as a draft' : busy ? 'Publishing…' : 'Publish profile'}</Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="ap-footer">
              <Button variant="ghost" onClick={() => setStep((s) => Math.max(1, s - 1))}>Back</Button>
              <span className="ap-footer-note">{footerNote}</span>
              <div className="ap-footer-actions">
                <Button variant="outline" disabled={busy} onClick={() => submit(false)}>Save and exit</Button>
                <Button variant="primary" disabled={busy || (step === 4 && (!!publishedPrn || planFull))} onClick={() => (step === 4 ? submit(true) : setStep((s) => Math.min(4, s + 1)))}>{step === 4 && busy ? 'Publishing…' : nextLabel}</Button>
              </div>
            </div>
          </div>
        </div>

      <Dialog open={!!dlg} title={dlg ? dlg.title : ''} actions={dlg ? dlg.actions : null}>{dlg ? dlg.body : ''}</Dialog>

      {toast && (<div className="ap-toast"><span className="ap-toast-check">✓</span><span>{toast}</span></div>)}
    </PageFrame>
  );
}
