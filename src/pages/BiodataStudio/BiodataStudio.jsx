import { useState, useRef, useEffect, useCallback } from 'react';
import { Button, Avatar, Checkbox, Switch, Radio, Select, Dialog } from '../../components/ui/index.jsx';
import './BiodataStudio.css';

const TEMPLATES = [
  { value: 'classic', name: 'Classic', bn: 'ক্লাসিক', note: 'Ruled sections, serif headings. What most families expect.', accent: 'var(--brand-primary)', rule: 'var(--border-subtle)', headBorder: '1px solid var(--border-subtle)', photoRadius: '6px', thumbHead: 10, thumbHeadBg: 'var(--green-300)' },
  { value: 'formal', name: 'Formal green', bn: 'ফরমাল', note: 'Deep green header band. Reads as a document, not a card.', accent: 'var(--green-900)', rule: 'var(--green-200)', headBorder: '2px solid var(--green-900)', photoRadius: '4px', thumbHead: 16, thumbHeadBg: 'var(--green-900)' },
  { value: 'quiet', name: 'Quiet', bn: 'সরল', note: 'No rules, generous space. For families who dislike ornament.', accent: 'var(--text-primary)', rule: 'transparent', headBorder: '1px solid var(--surface-card-alt)', photoRadius: '50% 50% 6px 6px', thumbHead: 6, thumbHeadBg: 'var(--surface-card-alt)' },
];
const ADDRESS = { 'District only': 'Dhaka', 'Area and district': 'Dhanmondi, Dhaka', 'Full address': 'House 42, Road 9/A, Dhanmondi, Dhaka' };
const SECTION_DEFS = [
  { k: 'education', label: 'Education' }, { k: 'career', label: 'Profession' }, { k: 'family', label: 'Family' },
  { k: 'religion', label: 'Religion and practice' }, { k: 'preferences', label: 'What the family is looking for' }, { k: 'health', label: 'General health line' },
];

export default function BiodataStudio() {
  const [template, setTemplate] = useState('classic');
  const [lang, setLang] = useState('both');
  const [sections, setSections] = useState({ education: true, family: true, preferences: true, religion: true, career: true, health: false });
  const [opt, setOpt] = useState({ photo: true, photoMode: 'locked', address: 'District only', income: false, siblings: true });
  const [dialog, setDialog] = useState(null);
  const [toast, setToast] = useState(null);
  const timer = useRef(null);
  const say = useCallback((msg) => { clearTimeout(timer.current); setToast(msg); timer.current = setTimeout(() => setToast(null), 4400); }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  const setO = (k, v) => setOpt((s) => ({ ...s, [k]: v }));

  const tpl = TEMPLATES.find((t) => t.value === template) || TEMPLATES[0];
  const bn = lang === 'bn' || lang === 'both';
  const en = lang === 'en' || lang === 'both';
  const locked = opt.photoMode === 'locked';
  const risk = [opt.photo && !locked, opt.address === 'Full address', opt.income, opt.siblings].filter(Boolean).length;
  const riskMeta = risk === 0
    ? { label: 'Minimal', fg: 'var(--brand-primary)', bg: 'var(--green-100)', bd: 'var(--green-300)', note: 'Nothing here identifies the household. Safe to forward widely.' }
    : risk <= 2
      ? { label: 'Moderate', fg: 'var(--gold-700)', bg: 'var(--gold-100)', bd: 'var(--gold-300)', note: 'Fine for a specific proposal. Think twice before posting to a group.' }
      : { label: 'High', fg: 'var(--terracotta-700)', bg: 'var(--terracotta-100)', bd: 'var(--terracotta-300)', note: 'This sheet locates the family. Send it to one manager you know, not to a group.' };

  const allRows = {
    education: { en: 'Education', bn: 'শিক্ষা', rows: [{ k: 'Highest degree', v: 'MBA (Finance), 2024' }, { k: 'Institution', v: 'IBA, University of Dhaka' }, { k: 'Undergraduate', v: 'BBA, University of Dhaka, 2021' }] },
    career: { en: 'Profession', bn: 'পেশা', rows: [{ k: 'Occupation', v: 'Banker — corporate credit' }, { k: 'Organisation', v: 'A private commercial bank, Dhaka' }, { k: 'Since', v: '2024' }] },
    family: { en: 'Family', bn: 'পরিবার', rows: [{ k: 'Father', v: 'Retired, government service' }, { k: 'Mother', v: 'Homemaker' }, { k: 'Family type', v: 'Nuclear' }].concat(opt.siblings ? [{ k: 'Siblings', v: 'One younger brother, undergraduate student' }] : []).concat(opt.income ? [{ k: 'Family income', v: '৳1,80,000 per month (approx.)' }] : []) },
    religion: { en: 'Religion', bn: 'ধর্ম', rows: [{ k: 'Religion', v: 'Islam — Sunni' }, { k: 'Practice', v: 'Moderately practising' }] },
    preferences: { en: 'Family is looking for', bn: 'প্রত্যাশা', rows: [{ k: 'Education', v: 'Postgraduate' }, { k: 'Age', v: 'Within four years' }, { k: 'Location', v: 'Dhaka, or settled abroad' }] },
    health: { en: 'Health', bn: 'স্বাস্থ্য', rows: [{ k: 'General health', v: 'Good — no disclosures on this sheet' }] },
  };
  const sheetSections = Object.keys(allRows).filter((k) => sections[k]).map((k) => ({ en: allRows[k].en, bn: allRows[k].bn, rows: allRows[k].rows }));
  const headFacts = [{ k: 'Age', v: '26 years' }, { k: 'Height', v: '5′4″' }, { k: 'Location', v: ADDRESS[opt.address] }];
  const langNote = { bn: 'বাংলা only', en: 'English only', both: 'Bangla with English beneath' }[lang];
  const addressNote = opt.address === 'Full address' ? 'A full address on a forwarded sheet is how families get turned up at unannounced. Rarely necessary.' : opt.address === 'Area and district' ? 'Enough for a family to judge distance, not enough to find the house.' : 'The safest default. Most families accept it without asking.';

  const dlg = dialog === 'share'
    ? { title: 'Share this biodata?', body: 'A 7-day link is created — not a file. You can revoke it at any time from Manage active links, and whoever opens it sees exactly the sheet on screen now.',
        actions: (<><Button variant="ghost" onClick={() => setDialog(null)}>Cancel</Button><Button variant="primary" onClick={() => { setDialog(null); say('Link created — sngi.st/b/10245, expires 15 August. Opened in WhatsApp.'); }}>Create link</Button></>) }
    : dialog === 'download'
      ? { title: 'Download a PDF?', body: 'A downloaded file cannot be revoked or expired. Once it is forwarded, it is out of your hands and out of the family’s. Prefer a link unless someone specifically needs to print it.',
          actions: (<><Button variant="ghost" onClick={() => setDialog('share')}>Send a link instead</Button><Button variant="primary" onClick={() => { setDialog(null); say('PDF downloaded. It is watermarked with your GHT number and the date.'); }}>Download anyway</Button></>) }
      : null;

  return (
    <div className="bs">
      <div className="bs-frame">
        <div className="bs-topbar">
          <div className="bs-topbar-brand"><div className="bs-logo">স</div><span>SongiSathi</span></div>
          <span className="bs-crumb">/ প্রোফাইল / Nusrat Jahan · PRN-10245 / বায়োডাটা</span>
          <div className="bs-topbar-right">
            <div className="bs-lang">
              {['bn', 'en', 'both'].map((l) => (<span key={l} className={lang === l ? 'on' : ''} style={{ fontFamily: l === 'bn' ? "'Hind Siliguri', sans-serif" : undefined }} onClick={() => setLang(l)}>{l === 'bn' ? 'বাংলা' : l === 'en' ? 'EN' : 'Both'}</span>))}
            </div>
            <Avatar initials="RA" size={28} />
          </div>
        </div>

        <div className="bs-grid">
          {/* left: templates + sections */}
          <div className="bs-left">
            <div>
              <div className="bs-h-bn">বায়োডাটা স্টুডিও</div>
              <div className="bs-h-sub">Biodata studio · Nusrat Jahan</div>
            </div>
            <div>
              <div className="bs-label">Template</div>
              <div className="bs-templates">
                {TEMPLATES.map((t) => (
                  <div key={t.value} className="bs-template" onClick={() => setTemplate(t.value)} style={{ borderColor: template === t.value ? 'var(--brand-primary)' : 'var(--border-subtle)', background: template === t.value ? 'var(--green-100)' : 'var(--surface-page)' }}>
                    <div className="bs-template-thumb">
                      <div style={{ height: t.thumbHead, borderRadius: 2, background: t.thumbHeadBg }} />
                      <div className="bs-thumb-line" /><div className="bs-thumb-line" style={{ width: '70%' }} /><div className="bs-thumb-line" /><div className="bs-thumb-line" style={{ width: '55%' }} />
                    </div>
                    <div className="bs-template-info"><div className="bs-template-name">{t.name}</div><div className="bs-template-bn">{t.bn}</div><div className="bs-template-note">{t.note}</div></div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="bs-label">Sections to include</div>
              <div className="bs-sections">
                {SECTION_DEFS.map((x) => (
                  <Checkbox key={x.k} label={x.label} checked={!!sections[x.k]} onChange={() => setSections((s) => ({ ...s, [x.k]: !s[x.k] }))} />
                ))}
              </div>
            </div>
          </div>

          {/* center: sheet */}
          <div className="bs-center">
            <div className="bs-sheet-bar">
              <span>Live preview · A4 · {sheetSections.length > 4 ? '2 pages' : '1 page'}</span>
              <span>{langNote}</span>
            </div>
            <div className="bs-sheet">
              <div className="bs-sheet-head" style={{ borderBottom: tpl.headBorder }}>
                {opt.photo && (
                  <div className="bs-sheet-photo" style={{ borderRadius: tpl.photoRadius }}>
                    <div className="bs-sheet-photo-bg" style={{ filter: locked ? 'blur(5px)' : 'none' }} />
                    {locked && (<div className="bs-sheet-photo-lock"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EBDCC3" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4.5" y="10.5" width="15" height="10" rx="2.4" /><path d="M8.4 10.5V7.8a3.6 3.6 0 0 1 7.2 0v2.7" /></svg><span>Photo on request</span></div>)}
                  </div>
                )}
                <div className="bs-sheet-head-info">
                  {bn && <div className="bs-sheet-name-bn" style={{ color: tpl.accent }}>নুসরাত জাহান</div>}
                  {en && <div className="bs-sheet-name-en" style={{ fontSize: bn ? 15 : 26, marginTop: bn ? 3 : 0 }}>Nusrat Jahan</div>}
                  <div className="bs-sheet-prn">PRN-10245</div>
                  <div className="bs-sheet-headfacts">
                    {headFacts.map((hf) => (<div key={hf.k}><div className="bs-headfact-k">{hf.k}</div><div className="bs-headfact-v">{hf.v}</div></div>))}
                  </div>
                </div>
              </div>

              {sheetSections.map((ss) => (
                <div key={ss.en}>
                  <div className="bs-sheet-section-head">
                    <span className="bs-section-en" style={{ color: tpl.accent }}>{ss.en}</span>
                    {bn && <span className="bs-section-bn">{ss.bn}</span>}
                    <span className="bs-section-rule" style={{ background: tpl.rule }} />
                  </div>
                  <div className="bs-sheet-rows">
                    {ss.rows.map((rw) => (<div key={rw.k} className="bs-sheet-row"><span className="bs-sheet-k">{rw.k}</span><span className="bs-sheet-v">{rw.v}</span></div>))}
                  </div>
                </div>
              ))}

              <div className="bs-sheet-foot">
                <div>
                  <div className="bs-foot-label">Managed by</div>
                  <div className="bs-foot-name">Rahima Akter · ঘটক</div>
                  <div className="bs-foot-meta">GHT-0042, Sylhet · all contact through the manager</div>
                </div>
                <div className="bs-foot-qr"><div className="bs-qr" /><div className="bs-qr-cap">Verify · 7 days</div></div>
              </div>
            </div>
          </div>

          {/* right: disclosure */}
          <div className="bs-right">
            <div>
              <div className="bs-label">What this sheet reveals</div>
              <div className="bs-right-sub">Once forwarded, a biodata travels on its own. These defaults assume it will.</div>
            </div>
            <div className="bs-controls">
              <Switch label="Include photograph" checked={opt.photo} onChange={() => setO('photo', !opt.photo)} />
              {opt.photo && (
                <div className="bs-photo-modes">
                  {[{ value: 'locked', label: 'Locked — released per request', note: 'The sheet shows a blurred frame. Families ask you, and you decide each time.' }, { value: 'open', label: 'Printed on the sheet', note: 'Anyone the sheet reaches can see and save the photograph. This cannot be undone.' }].map((m) => (
                    <div key={m.value} className="bs-photo-mode" onClick={() => setO('photoMode', m.value)} style={{ borderColor: opt.photoMode === m.value ? 'var(--brand-primary)' : 'var(--border-subtle)', background: opt.photoMode === m.value ? 'var(--green-100)' : 'var(--surface-page)' }}>
                      <Radio label={m.label} checked={opt.photoMode === m.value} name="photo-mode" onChange={() => setO('photoMode', m.value)} />
                      <div className="bs-photo-mode-note">{m.note}</div>
                    </div>
                  ))}
                </div>
              )}
              <Select label="Address precision" value={opt.address} onChange={(e) => setO('address', e.target.value)} options={Object.keys(ADDRESS).map((v) => ({ value: v, label: v }))} />
              <div className="bs-address-note">{addressNote}</div>
              <Switch label="Print family income figures" checked={opt.income} onChange={() => setO('income', !opt.income)} />
              <Switch label="Print sibling details" checked={opt.siblings} onChange={() => setO('siblings', !opt.siblings)} />
            </div>

            <div className="bs-never">
              <div className="bs-never-head">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--gold-400)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4.5" y="10.5" width="15" height="10" rx="2.4" /><path d="M8.4 10.5V7.8a3.6 3.6 0 0 1 7.2 0v2.7" /></svg>
                <span>Never printed</span>
              </div>
              <div className="bs-never-body">Phone numbers, the family's address, and every answer from the private screening section. There is no setting that adds them — the sheet cannot carry them.</div>
            </div>

            <div className="bs-risk" style={{ borderColor: riskMeta.bd, background: riskMeta.bg }}>
              <div className="bs-risk-top"><span style={{ color: riskMeta.fg, fontWeight: 600, fontSize: 12 }}>Exposure: {riskMeta.label}</span><span className="bs-risk-count">{risk} of 4 disclosures on</span></div>
              <div className="bs-risk-bar"><div style={{ width: `${(risk / 4) * 100}%`, background: riskMeta.fg }} /></div>
              <div className="bs-risk-note">{riskMeta.note}</div>
            </div>

            <div className="bs-actions">
              <Button variant="primary" style={{ width: '100%' }} onClick={() => setDialog('share')}>হোয়াটসঅ্যাপে পাঠান · Share link</Button>
              <Button variant="outline" style={{ width: '100%' }} onClick={() => setDialog('download')}>Download PDF</Button>
              <Button variant="ghost" style={{ width: '100%' }} onClick={() => say('3 active links — two shared with Kamrul Islam, one with a guardian. Any of them can be revoked now.')}>Manage active links (3)</Button>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={!!dlg} title={dlg ? dlg.title : ''} actions={dlg ? dlg.actions : null}>{dlg ? dlg.body : ''}</Dialog>

      {toast && (<div className="bs-toast"><span className="bs-toast-check">✓</span><span>{toast}</span></div>)}
    </div>
  );
}
