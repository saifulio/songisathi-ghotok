import { useState, useRef, useEffect, useCallback } from 'react';
import { Input, Select, Badge } from '../../components/ui/index.jsx';
import './Onboarding.css';

const TIERS = [
  { value: 'solo', name: 'Solo', bn: 'একক ঘটক', monthly: '৳1,200', annual: '৳960', limit: '20', features: ['Weekly AI match suggestions', 'Bilingual biodata studio', 'Private screening on every profile', 'WhatsApp sharing with revocable links'] },
  { value: 'bureau', name: 'Bureau', bn: 'ব্যুরো', monthly: '৳2,500', annual: '৳2,000', limit: '50', featured: true, features: ['Everything in Solo', 'Trusted network pool access', 'Commission tracking', 'Two staff logins', 'Priority verification'] },
  { value: 'agency', name: 'Agency', bn: 'এজেন্সি', monthly: '৳5,000', annual: '৳4,000', limit: '150', features: ['Everything in Bureau', 'Six staff logins', 'Branded biodata templates', 'District-level insight reports', 'A named support contact'] },
];

const DOCS = [
  { k: 'nid', label: 'National ID', note: 'Photograph the front and back. Checked by a person, never published.' },
  { k: 'photo', label: 'A photo of you', note: 'Shown to families alongside your name and district.' },
];

const IMPORTS = [
  { k: 'register', label: 'Photograph your register', bn: 'খাতার ছবি তুলুন', count: 8, iconPath: 'M14.5 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9.5L14.5 4zM14 4v6h6M8 14h8M8 17h5', rows: [{ init: 'NJ', name: 'Nusrat Jahan', state: 'read' }, { init: 'TA', name: 'Tanvir Ahmed', state: 'read' }, { init: 'SI', name: 'Sadia Islam', state: 'check name' }] },
  { k: 'whatsapp', label: 'Forward biodata from WhatsApp', bn: 'হোয়াটসঅ্যাপ থেকে', count: 5, iconPath: 'M20 12a8 8 0 0 1-11.7 7.1L4 20.5l1.4-4.3A8 8 0 1 1 20 12z', rows: [{ init: 'RK', name: 'Rezaul Karim', state: 'read' }, { init: 'FA', name: 'Farhana Akter', state: 'read' }] },
  { k: 'manual', label: 'Type one in yourself', bn: 'নিজে লিখুন', count: 1, iconPath: 'M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z', rows: [{ init: 'MH', name: 'Mahmudul Hasan', state: 'draft' }] },
];

const NEXT_STEPS = [
  { n: '1', title: 'Send the private questions to two families', body: 'A profile only enters matching once its family has sealed their answers.' },
  { n: '2', title: 'Turn on the trusted network pool', body: 'Your profiles become visible to other verified ghotoks. Contact still routes through you.' },
  { n: '3', title: 'Invite a ghotok you trust', body: 'You both get a free month, and the pool gets better for everyone in your district.' },
];

const UNIVERSAL = ['Private screening on every profile', 'Photos locked until you release them', 'Contact details behind a two-sided release', 'Bilingual biodata, Bangla and English', 'Your commission is yours — we take none of it', 'Export your book and leave whenever you like'];
const METHODS = [{ name: 'bKash', note: 'merchant', fg: 'var(--terracotta-600)' }, { name: 'Nagad', note: 'merchant', fg: 'var(--terracotta-700)' }, { name: 'Rocket', note: 'merchant', fg: 'var(--brand-primary)' }];

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState('01712 345 678');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [ghName, setGhName] = useState('');
  const [bureau, setBureau] = useState('');
  const [district, setDistrict] = useState('Sylhet');
  const [docs, setDocs] = useState({ nid: false, photo: false });
  const [imports, setImports] = useState({ register: false, whatsapp: false, manual: false });
  const [annual, setAnnual] = useState(true);
  const [toast, setToast] = useState(null);
  const timer = useRef(null);
  const say = useCallback((msg) => { clearTimeout(timer.current); setToast(msg); timer.current = setTimeout(() => setToast(null), 4400); }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  const importedCount = (imports.register ? 8 : 0) + (imports.whatsapp ? 5 : 0) + (imports.manual ? 1 : 0);
  const stepNo = ['১', '২', '৩', '৪'][step - 1];
  const primaryLabel = step === 1 ? (otpSent ? 'কোড যাচাই করুন · Verify code' : 'কোড পাঠান · Send code') : step === 2 ? 'Continue to import' : step === 3 ? (importedCount ? `Finish setup · ${importedCount} profiles` : 'Skip for now') : 'ড্যাশবোর্ডে যান · Go to dashboard';
  const footNote = step === 1 ? 'We never post to your number' : step === 2 ? 'Verification takes about a day' : step === 3 ? 'You can import more later' : 'Founding slot 5 of 10';

  const primary = () => {
    if (step === 1 && !otpSent) { setOtpSent(true); setOtp('4712'); say(`Code sent to ${phone}. It expires in two minutes.`); return; }
    if (step === 4) { say('Opening your dashboard. Your 42-profile book is waiting.'); return; }
    setStep((s) => Math.min(4, s + 1));
  };
  const otpBoxes = (otp || '    ').split('').slice(0, 4).map((v) => v.trim());

  return (
    <div className="ob">
      <div className="ob-grid">
        {/* --- wizard --- */}
        <div className="ob-phone">
          <div className="ob-phone-head">
            <div className="ob-status"><span>9:41</span><span>4G · 78%</span></div>
            <div className="ob-phone-brand">
              <div className="ob-logo">স</div>
              <span>SongiSathi</span>
              <span className="ob-step-no">ধাপ {stepNo} / ৪</span>
            </div>
            <div className="ob-bars">{[1, 2, 3, 4].map((n) => (<span key={n} className="ob-bar" style={{ background: n <= step ? 'var(--gold-400)' : 'rgba(253,251,246,.2)' }} />))}</div>
          </div>

          <div className="ob-phone-body">
            {step === 1 && (
              <div className="ob-step">
                <div>
                  <div className="ob-step-bn">আপনার নম্বর দিয়ে শুরু করুন</div>
                  <div className="ob-step-sub">Start with the number families already call you on. No email, no password.</div>
                </div>
                <Input label="Mobile number" caption="মোবাইল নম্বর" placeholder="01712 345 678" value={phone} onChange={(e) => setPhone(e.target.value)} />
                {otpSent && (
                  <div>
                    <div className="ob-otp-label">Enter the 4-digit code</div>
                    <div className="ob-otp">{otpBoxes.map((v, i) => (<div key={i} className="ob-otp-box" style={{ borderColor: v ? 'var(--brand-primary)' : 'var(--border-default)' }}>{v}</div>))}</div>
                    <div className="ob-otp-sent">Sent to {phone} · resend in 24s</div>
                  </div>
                )}
                <div className="ob-founding">
                  <div className="ob-founding-top"><span>Founding member · 5 slots left</span><span className="ob-founding-count">5 / 10</span></div>
                  <div className="ob-founding-bar"><div style={{ width: '50%' }} /></div>
                  <div className="ob-founding-note">The first ten activated ghotoks get two years free. The next ninety get one year. After that, the tiers below apply.</div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="ob-step">
                <div>
                  <div className="ob-step-bn">আপনি কে, তা প্রমাণ করুন</div>
                  <div className="ob-step-sub">Families are handing you their daughters' details. Verification is what makes that reasonable — and it is what the gold seal on your profile means.</div>
                </div>
                <Input label="Your name" caption="নাম" placeholder="e.g. Rahima Akter" value={ghName} onChange={(e) => setGhName(e.target.value)} />
                <Input label="Bureau or practice name" caption="ব্যুরোর নাম" placeholder="Optional" value={bureau} onChange={(e) => setBureau(e.target.value)} />
                <Select label="District you work in" value={district} onChange={(e) => setDistrict(e.target.value)} options={['Sylhet', 'Dhaka', 'Chattogram', 'Rajshahi', 'Khulna', 'Mymensingh'].map((v) => ({ value: v, label: v }))} />
                <div className="ob-docs">
                  {DOCS.map((d) => {
                    const on = docs[d.k];
                    return (
                      <div key={d.k} className="ob-doc" onClick={() => { setDocs((s) => ({ ...s, [d.k]: !s[d.k] })); say(on ? `${d.label} removed.` : `${d.label} uploaded. A person reviews it within a day.`); }} style={{ borderStyle: on ? 'solid' : 'dashed', borderColor: on ? 'var(--green-300)' : 'var(--border-default)', background: on ? 'var(--green-100)' : 'var(--surface-card)' }}>
                        <span className="ob-doc-mark" style={{ background: on ? 'var(--brand-primary)' : 'var(--surface-card-alt)', color: on ? 'var(--text-on-brand)' : 'var(--text-secondary)' }}>{on ? '✓' : '+'}</span>
                        <span><span className="ob-doc-label">{d.label}</span><span className="ob-doc-note">{on ? 'Uploaded · awaiting review' : d.note}</span></span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="ob-step">
                <div>
                  <div className="ob-step-bn">আপনার খাতা নিয়ে আসুন</div>
                  <div className="ob-step-sub">Bring your register across. Photograph the pages or forward the biodata you already have on WhatsApp — we read them and you correct what is wrong.</div>
                </div>
                <div className="ob-imports">
                  {IMPORTS.map((im) => {
                    const done = imports[im.k];
                    return (
                      <div key={im.k} className="ob-import" onClick={() => { setImports((s) => ({ ...s, [im.k]: !s[im.k] })); if (!done) say(`${im.count} profiles read. Check the names and ages — handwriting is not always kind.`); }} style={{ borderColor: done ? 'var(--green-300)' : 'var(--border-subtle)', background: done ? 'var(--green-100)' : 'var(--surface-card)' }}>
                        <div className="ob-import-top">
                          <span className="ob-import-icon" style={{ background: done ? 'var(--surface-card)' : 'var(--surface-card-alt)' }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--brand-primary)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={im.iconPath} /></svg>
                          </span>
                          <span className="ob-import-labels"><span className="ob-import-label">{im.label}</span><span className="ob-import-bn">{im.bn}</span></span>
                          <span className="ob-import-action" style={{ color: done ? 'var(--brand-primary)' : 'var(--text-secondary)' }}>{done ? `${im.count} read` : 'Start'}</span>
                        </div>
                        {done && (
                          <div className="ob-import-rows">
                            {im.rows.map((ir) => (
                              <div key={ir.name} className="ob-import-row"><span className="ob-import-row-init">{ir.init}</span><span className="ob-import-row-name">{ir.name}</span><span className="ob-import-row-state">{ir.state}</span></div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="ob-ready">
                  <div className="ob-ready-top"><span>{importedCount} profiles ready</span><span className="ob-ready-note">you review each one before it goes live</span></div>
                  <div className="ob-ready-body">Nothing is published and nothing enters matching until each family has given their private answers.</div>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="ob-step">
                <div className="ob-done">
                  <div className="ob-done-star">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M12 2.6l2.3 1.7 2.8-.3 1.1 2.6 2.4 1.5-.6 2.8.9 2.7-2.2 1.8-.8 2.7-2.9.2L12 21.4l-2.9-1.8-2.9-.2-.8-2.7L3.2 15l.9-2.7-.6-2.8L5.9 8 7 5.4l2.8.3z" fill="var(--gold-400)" /><path d="M9 12.2l2.1 2.1 4-4.2" stroke="var(--green-900)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </div>
                  <div className="ob-done-bn">আপনি ফাউন্ডিং সদস্য</div>
                  <div className="ob-done-body">Slot 5 of 10. Two years free, then whichever tier fits your practice. Your verification is pending — it usually takes a day.</div>
                  <div className="ob-done-stats">
                    <div><div className="ob-done-num">{importedCount}</div><div className="ob-done-cap">profiles imported</div></div>
                    <div><div className="ob-done-num">2 yrs</div><div className="ob-done-cap">free, from today</div></div>
                  </div>
                </div>
                <div className="ob-next">
                  <div className="ob-next-t">What to do first</div>
                  <div className="ob-next-list">
                    {NEXT_STEPS.map((ns) => (
                      <div key={ns.n} className="ob-next-item"><span className="ob-next-n">{ns.n}</span><span><span className="ob-next-title">{ns.title}</span><span className="ob-next-body">{ns.body}</span></span></div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="ob-cta" onClick={primary}>{primaryLabel}</div>
            <div className="ob-foot">
              <span className="ob-back" onClick={() => setStep((s) => Math.max(1, s - 1))}>← Back</span>
              <span className="ob-foot-note">{footNote}</span>
            </div>
          </div>
        </div>

        {/* --- pricing --- */}
        <div className="ob-pricing">
          <div className="ob-pricing-topbar">
            <div className="ob-pricing-brand"><div className="ob-logo">স</div><span>SongiSathi</span></div>
            <span className="ob-pricing-note">মূল্য · Pricing for ghotoks</span>
          </div>
          <div className="ob-pricing-body">
            <div className="ob-pricing-head">
              <div className="ob-pricing-head-copy">
                <div className="ob-pricing-h-bn">আপনার ব্যবসার আকার অনুযায়ী</div>
                <div className="ob-pricing-h-sub">Priced by how many profiles you keep active — never per introduction, never a cut of your commission. What you earn from a marriage stays yours.</div>
              </div>
              <div className="ob-billing">
                <span>Monthly</span>
                <div className="ob-billing-toggle" onClick={() => setAnnual((v) => !v)} style={{ background: annual ? 'var(--brand-primary)' : 'var(--border-default)' }}>
                  <span className="ob-billing-knob" style={{ left: annual ? 23 : 3 }} />
                </div>
                <span>Annual</span>
                <Badge tone="gold">Save 20%</Badge>
              </div>
            </div>

            <div className="ob-tiers">
              {TIERS.map((t) => {
                const f = !!t.featured;
                return (
                  <div key={t.value} className={`ob-tier ${f ? 'featured' : ''}`}>
                    {f && <span className="ob-tier-flag">MOST GHOTOKS</span>}
                    <div>
                      <div className="ob-tier-name">{t.name}</div>
                      <div className="ob-tier-bn">{t.bn}</div>
                    </div>
                    <div>
                      <div className="ob-tier-price-row"><span className="ob-tier-price">{annual ? t.annual : t.monthly}</span><span className="ob-tier-per">/month</span></div>
                      <div className="ob-tier-price-note">{annual ? 'billed yearly · 20% saved' : 'billed monthly · cancel any time'}</div>
                    </div>
                    <div className="ob-tier-limit"><div className="ob-tier-limit-num">{t.limit}</div><div className="ob-tier-limit-cap">active profiles</div></div>
                    <div className="ob-tier-features">
                      {t.features.map((ft) => (<div key={ft} className="ob-tier-feature"><span className="ob-tier-tick">✓</span><span>{ft}</span></div>))}
                    </div>
                    <div className="ob-tier-cta" onClick={() => say(`${t.name} selected — ${annual ? t.annual : t.monthly}/month. Pay by bKash and enter the transaction ID.`)}>Choose {t.name}</div>
                  </div>
                );
              })}
            </div>

            <div className="ob-extras">
              <div className="ob-universal">
                <div className="ob-universal-t">Included on every tier, including free</div>
                <div className="ob-universal-grid">
                  {UNIVERSAL.map((u) => (<div key={u} className="ob-universal-item"><span className="ob-universal-tick">✓</span><span>{u}</span></div>))}
                </div>
              </div>
              <div className="ob-pay">
                <div className="ob-pay-t">How you pay</div>
                <div className="ob-pay-methods">
                  {METHODS.map((m) => (<div key={m.name} className="ob-pay-method"><div className="ob-pay-name" style={{ color: m.fg }}>{m.name}</div><div className="ob-pay-note-2">{m.note}</div></div>))}
                </div>
                <div className="ob-pay-body">Send to the merchant number, then enter the transaction ID. A person checks it within a few hours — no card is ever required.</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {toast && (<div className="ob-toast"><span className="ob-toast-check">✓</span><span>{toast}</span></div>)}
    </div>
  );
}
