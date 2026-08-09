import { useState, useRef, useEffect, useCallback } from 'react';
import { Button, Avatar, Badge } from '../../components/ui/index.jsx';
import './AiMatching.css';

const FACTORS = [
  { k: 'education', label: 'Education', bn: 'শিক্ষা' },
  { k: 'family', label: 'Family type', bn: 'পারিবারিক ধরন' },
  { k: 'location', label: 'Location', bn: 'অবস্থান' },
  { k: 'religion', label: 'Religious practice', bn: 'ধর্মীয় অনুশীলন' },
  { k: 'age', label: 'Age difference', bn: 'বয়সের ব্যবধান' },
];

const PAIRS = [
  { id: 'm1', aName: 'Nusrat Jahan', aMeta: '26 · MBA, IBA Dhaka · Dhanmondi', bName: 'Tanvir Ahmed', bMeta: '31 · MSc CSE, BUET · Auckland',
    scores: { education: 94, family: 88, location: 72, religion: 85, age: 80 },
    notes: { education: 'Both postgraduate, business and technical', family: 'Nuclear, both fathers retired service', location: 'Dhaka family, groom settled abroad', religion: 'Both moderately practising', age: 'Five years apart, both families content' } },
  { id: 'm2', aName: 'Sadia Islam', aMeta: '24 · BSc Pharmacy, SUST · Sylhet', bName: 'Rezaul Karim', bMeta: '29 · LLB, Chittagong Univ. · Khulshi',
    scores: { education: 83, family: 90, location: 64, religion: 92, age: 78 },
    notes: { education: 'Professional degrees on both sides', family: 'Joint family, both Sylhet-rooted', location: 'Sylhet and Chattogram — travel expected', religion: 'Both strictly practising', age: 'Five years apart' } },
  { id: 'm3', aName: 'Ayesha Siddika', aMeta: '23 · Honours in Bangla · Mymensingh', bName: 'Imran Chowdhury', bMeta: '30 · MEng, Toronto · civil engineer',
    scores: { education: 66, family: 82, location: 58, religion: 74, age: 62 },
    notes: { education: 'Honours against a postgraduate degree', family: 'Both nuclear, elder-led decisions', location: 'Mymensingh family, groom in Toronto', religion: 'Observant against moderately practising', age: 'Seven years apart' } },
];

const MISSES = [
  { pair: 'Nusrat Jahan ↔ Imran Chowdhury', reason: 'Below your 60% threshold on location', tag: 'Scored 54%', tone: 'neutral' },
  { pair: 'Sadia Islam ↔ Tanvir Ahmed', reason: 'Not suggested by the private screening', tag: 'Gate closed', tone: 'warning' },
  { pair: 'Ayesha Siddika ↔ Rezaul Karim', reason: 'You dismissed this pair in July', tag: 'Dismissed', tone: 'neutral' },
];

const BASE = { education: 8, family: 7, location: 6, religion: 7, age: 5 };
const weighted = (p, w) => {
  const total = FACTORS.reduce((n, f) => n + w[f.k], 0) || 1;
  return Math.round(FACTORS.reduce((n, f) => n + p.scores[f.k] * w[f.k], 0) / total);
};

export default function AiMatching() {
  const [w, setW] = useState({ education: 8, family: 7, location: 6, religion: 7, age: 5 });
  const [open, setOpen] = useState('m1');
  const [decision, setDecision] = useState({});
  const [toast, setToast] = useState(null);
  const timer = useRef(null);

  const say = useCallback((msg) => {
    clearTimeout(timer.current);
    setToast(msg);
    timer.current = setTimeout(() => setToast(null), 4400);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  const wTotal = FACTORS.reduce((n, f) => n + w[f.k], 0) || 1;
  const ranked = PAIRS.slice().sort((a, b) => weighted(b, w) - weighted(a, w));
  const top = ranked[0];
  const heaviest = FACTORS.slice().sort((a, b) => w[b.k] - w[a.k])[0];

  const funnel = [
    { n: '1,482', label: 'Possible pairs in your book and the pool', flex: 6, bar: 'var(--surface-card-alt)' },
    { n: '624', label: 'Met the family’s stated criteria', flex: 4, bar: 'var(--green-200)' },
    { n: '91', label: 'Both profiles confirmed active', flex: 3, bar: 'var(--green-300)' },
    { n: '12', label: 'Passed the private screening gate', flex: 2, bar: 'var(--gold-400)' },
    { n: String(ranked.length), label: 'Scored above your threshold', flex: 1.4, bar: 'var(--brand-primary)' },
  ];

  const res = {
    introduced: { label: 'Introduction sent', bg: 'var(--green-100)', fg: 'var(--brand-primary)' },
    dismissed: { label: 'Dismissed — not suggested again this quarter', bg: 'var(--surface-card-alt)', fg: 'var(--text-secondary)' },
  };

  const digest = [
    { n: '৩', title: 'Three new suggestions', body: `Top pair at ${weighted(top, w)}% — ${top.aName} and ${top.bName}.`, bg: 'var(--green-100)', fg: 'var(--brand-primary)' },
    { n: '২', title: 'Two profiles need confirming', body: 'Sadia Islam and Mahmudul Hasan archive within a fortnight.', bg: 'var(--gold-100)', fg: 'var(--gold-700)' },
    { n: '১', title: 'One commission outstanding', body: '৳25,000 from the Rifat Jahan marriage, three weeks on.', bg: 'var(--terracotta-100)', fg: 'var(--terracotta-700)' },
  ];

  return (
    <div className="am">
      <div className="am-grid">
        {/* --- console --- */}
        <div className="am-console">
          <div className="am-topbar">
            <div className="am-topbar-brand">
              <div className="am-logo">স</div>
              <span>SongiSathi</span>
            </div>
            <div className="am-topbar-tabs">
              <span>ড্যাশবোর্ড</span>
              <span>প্রোফাইল</span>
              <span className="on">এআই ম্যাচিং</span>
            </div>
            <div className="am-topbar-right">
              <span className="am-lastrun">Last run Monday 4 August, 6:00 · next in 3 days</span>
              <Avatar initials="RA" size={28} />
            </div>
          </div>

          <div className="am-body">
            {/* weights */}
            <div className="am-weights">
              <div>
                <div className="am-h-bn">আপনার অগ্রাধিকার</div>
                <div className="am-h-sub">What you weigh heavily, the system weighs heavily. These are yours alone — no other ghotok sees or inherits them.</div>
              </div>
              <div className="am-sliders">
                {FACTORS.map((f) => (
                  <div key={f.k}>
                    <div className="am-slider-head">
                      <span>{f.label}</span>
                      <span className="am-slider-pct">{Math.round((w[f.k] / wTotal) * 100)}%</span>
                    </div>
                    <div className="am-slider-bn">{f.bn}</div>
                    <input type="range" min="0" max="10" value={w[f.k]} onChange={(e) => setW((s) => ({ ...s, [f.k]: Number(e.target.value) }))} className="am-range" />
                  </div>
                ))}
              </div>
              <div className="am-learned">
                <div className="am-learned-t">Learned from you</div>
                <div className="am-learned-b">You have dismissed 7 pairs where the families were more than 200km apart. Distance counts for more in your suggestions than it did in June — you can undo that by moving the slider yourself.</div>
                <div className="am-reset" onClick={() => { setW({ education: 7, family: 7, location: 7, religion: 6, age: 5 }); say('Weights reset to the Sylhet district average. Your dismissals will start shifting them again from Monday.'); }}>
                  Reset to the district average
                </div>
              </div>
              <div className="am-sealed">
                <div className="am-sealed-head">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--gold-400)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4.5" y="10.5" width="15" height="10" rx="2.4" /><path d="M8.4 10.5V7.8a3.6 3.6 0 0 1 7.2 0v2.7" /></svg>
                  <span>Not yours to weigh</span>
                </div>
                <div className="am-sealed-b">The sealed answers are a gate, not a slider. A pair that fails the private screening is never suggested at any weighting — including yours.</div>
              </div>
            </div>

            {/* runs */}
            <div className="am-runs">
              <div className="am-runs-head">
                <div>
                  <div className="am-h-bn" style={{ fontSize: 20 }}>সোমবারের ফলাফল</div>
                  <div className="am-runs-sub">{ranked.length} pairs surfaced from 1,482 possible combinations</div>
                </div>
                <Button variant="outline" size="md" onClick={() => say(`Re-run finished in 4 seconds. ${ranked.length} pairs, same gate — ${heaviest.label.toLowerCase()} is currently your heaviest factor.`)}>Run again now</Button>
              </div>

              <div className="am-funnel">
                <div className="am-funnel-t">How 1,482 became {ranked.length}</div>
                <div className="am-funnel-bars">
                  {funnel.map((fn, i) => (
                    <div key={i} className="am-funnel-col" style={{ flex: fn.flex }}>
                      <div className="am-funnel-bar" style={{ background: fn.bar }} />
                      <div className="am-funnel-n">{fn.n}</div>
                      <div className="am-funnel-label">{fn.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="am-pairs">
                {ranked.map((p) => {
                  const sc = weighted(p, w);
                  const diff = sc - weighted(p, BASE);
                  const st = decision[p.id];
                  const r = res[st];
                  const isOpen = open === p.id;
                  return (
                    <div key={p.id} className="am-pair" style={{ borderColor: st === 'introduced' ? 'var(--green-300)' : 'var(--border-subtle)' }}>
                      <div className="am-pair-row">
                        <div className="am-pair-people">
                          <div>
                            <div className="am-pair-name">{p.aName}</div>
                            <div className="am-pair-meta">{p.aMeta}</div>
                          </div>
                          <span className="am-pair-arrow">↔</span>
                          <div>
                            <div className="am-pair-name">{p.bName}</div>
                            <div className="am-pair-meta">{p.bMeta}</div>
                          </div>
                        </div>
                        <div className="am-pair-score">
                          <div className="am-pair-score-top">
                            <span className="am-pair-score-num">{sc}%</span>
                            <span className="am-pair-delta" style={{ color: diff > 0 ? 'var(--brand-primary)' : diff < 0 ? 'var(--terracotta-600)' : 'var(--text-secondary)' }}>
                              {diff === 0 ? 'at default weights' : `${diff > 0 ? '+' : ''}${diff} from your weights`}
                            </span>
                          </div>
                          <div className="am-pair-bar"><div style={{ width: `${sc}%` }} /></div>
                        </div>
                        <span className="am-pair-toggle" onClick={() => setOpen(isOpen ? null : p.id)}>{isOpen ? 'Hide working' : 'Show working'}</span>
                      </div>

                      {isOpen && (
                        <div className="am-pair-detail">
                          <div className="am-factors">
                            {FACTORS.map((f) => (
                              <div key={f.k} className="am-factor">
                                <div className="am-factor-top"><span>{f.label}</span><span className="am-factor-pct">{p.scores[f.k]}%</span></div>
                                <div className="am-factor-bar"><div style={{ width: `${p.scores[f.k]}%` }} /></div>
                                <div className="am-factor-note">{p.notes[f.k]}</div>
                                <div className="am-factor-weight">weight {w[f.k]}/10</div>
                              </div>
                            ))}
                          </div>
                          <div className="am-pair-foot">
                            <div className="am-pair-gate">
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--gold-400)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4.5" y="10.5" width="15" height="10" rx="2.4" /><path d="M8.4 10.5V7.8a3.6 3.6 0 0 1 7.2 0v2.7" /></svg>
                              <span>Private screening: passed. That is the whole of what the gate returned — no factor, no percentage, no reason.</span>
                            </div>
                            {!st ? (
                              <div className="am-pair-actions">
                                <Button variant="primary" size="sm" onClick={() => { setDecision((x) => ({ ...x, [p.id]: 'introduced' })); say(`Introduction sent to both managers. ${p.aName} ↔ ${p.bName} is now in progress.`); }}>Introduce</Button>
                                <Button variant="ghost" size="sm" onClick={() => { setDecision((x) => ({ ...x, [p.id]: 'dismissed' })); say('Dismissed. Your weights shift slightly away from what this pair had in common.'); }}>Dismiss</Button>
                              </div>
                            ) : (
                              <span className="am-pair-res" style={{ background: r.bg, color: r.fg }}>{r.label}</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="am-misses">
                <div className="am-misses-t">Pairs you might have expected</div>
                <div className="am-misses-sub">The ones a ghotok notices are missing. Where the reason is visible, it is given.</div>
                <div className="am-misses-list">
                  {MISSES.map((m) => (
                    <div key={m.pair} className="am-miss">
                      <span className="am-miss-pair">{m.pair}</span>
                      <span className="am-miss-reason">{m.reason}</span>
                      <Badge tone={m.tone}>{m.tag}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* --- digest phone --- */}
        <div className="am-digest">
          <div className="am-digest-head">
            <div className="am-digest-status"><span>6:04</span><span>4G · 94%</span></div>
            <div className="am-digest-bn">সোমবারের প্রস্তাব</div>
            <div className="am-digest-date">Monday digest · 4 August 2026</div>
          </div>
          <div className="am-digest-body">
            <div className="am-digest-card">
              <div className="am-digest-lead">রাহিমা আপা, এই সপ্তাহে {ranked.length}টি নতুন প্রস্তাব আছে। সর্বোচ্চ সঙ্গতি {weighted(top, w)}% — {top.aName} ↔ {top.bName}।</div>
              <div className="am-digest-lead-en">Three suggestions, two profiles that need confirming, and one commission still outstanding. Nothing else — you will not hear from us again until next Monday.</div>
            </div>
            {digest.map((d, i) => (
              <div key={i} className="am-digest-item">
                <span className="am-digest-n" style={{ background: d.bg, color: d.fg }}>{d.n}</span>
                <span>
                  <span className="am-digest-item-t">{d.title}</span>
                  <span className="am-digest-item-b">{d.body}</span>
                </span>
              </div>
            ))}
            <div className="am-digest-cta" onClick={() => say('Opening the matching console with this week’s three pairs.')}>প্রস্তাবগুলো দেখুন</div>
            <div className="am-digest-foot">One message a week. Reply STOP to receive none — your suggestions will still be waiting in the app.</div>
          </div>
        </div>
      </div>

      {toast && (
        <div className="am-toast">
          <span className="am-toast-check">✓</span>
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}
