import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Button, Avatar, Badge } from '../../components/ui/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { api } from '../../lib/api.js';
import './AiMatching.css';

// The factor set is whatever the matching run scored this week (see
// match_factors in the DB) — not a fixed taxonomy, so it's derived from the
// API response rather than hardcoded.
const slug = (label) => String(label).toLowerCase().replace(/[^a-z0-9]+/g, '');

const MISSES = [
  { pair: 'Nusrat Jahan ↔ Imran Chowdhury', reason: 'Below your 60% threshold on location', tag: 'Scored 54%', tone: 'neutral' },
  { pair: 'Sadia Islam ↔ Tanvir Ahmed', reason: 'Not suggested by the private screening', tag: 'Gate closed', tone: 'warning' },
  { pair: 'Ayesha Siddika ↔ Rezaul Karim', reason: 'You dismissed this pair in July', tag: 'Dismissed', tone: 'neutral' },
];

const initialsOf = (name) => String(name || '').trim().split(/\s+/).map((w2) => w2[0]).slice(0, 2).join('').toUpperCase();
const personMeta = (p) => (p ? `${p.age ?? '—'} · ${p.edu || '—'} · ${p.city || '—'}` : '');
const weekLabel = (iso) => (iso ? new Date(iso).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) : '—');
const nextRunIn = (iso) => {
  if (!iso) return null;
  const days = 7 - Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return days > 0 ? days : 0;
};

export default function AiMatching() {
  const { user, token } = useAuth();
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [w, setW] = useState({});
  const [open, setOpen] = useState(null);
  const [decision, setDecision] = useState({});
  const [running, setRunning] = useState(false);
  const [toast, setToast] = useState(null);
  const timer = useRef(null);

  const say = useCallback((msg) => {
    clearTimeout(timer.current);
    setToast(msg);
    timer.current = setTimeout(() => setToast(null), 4400);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  // Suggestions from a load or from a fresh run. Weights are merged rather
  // than replaced: a factor the ghotok has already moved keeps its position,
  // and anything this run scored for the first time starts neutral.
  const applySuggestions = useCallback((list) => {
    setSuggestions(list);
    setOpen((cur) => cur ?? list[0]?.id ?? null);
    setW((cur) => {
      const keys = [...new Set(list.flatMap((s) => s.factors.map((f) => slug(f.label))))];
      return { ...Object.fromEntries(keys.map((k) => [k, 7])), ...cur };
    });
  }, []);

  // Load this week's suggestions, with their factor breakdown, from the API.
  useEffect(() => {
    if (!token) return undefined;
    let live = true;
    api.matchSuggestions(token)
      .then((data) => { if (live) applySuggestions(data.suggestions); })
      .catch((e) => say(e.message || 'Could not load this week’s matching run.'))
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [token, say, applySuggestions]);

  // "Run again now": score every pair not yet put to this ghotok and keep the
  // best. Pressing it again works further through the pool rather than
  // repeating itself, so the honest report is what this run added.
  const runNow = async () => {
    if (running) return;
    setRunning(true);
    try {
      const data = await api.runMatchSuggestions(token);
      applySuggestions(data.suggestions);
      const { created, considered } = data;
      say(
        created
          ? `Run finished. ${created} new pair${created === 1 ? '' : 's'} above your threshold, out of ${considered} scored.`
          : considered
            ? `Run finished. ${considered} new pair${considered === 1 ? '' : 's'} scored, none above your threshold.`
            : 'Run finished. Every pair in your book and the pool has already been put to you.'
      );
    } catch (e) {
      say(e.message || 'Could not run the matcher.');
    } finally {
      setRunning(false);
    }
  };

  // FACTORS: the union of factor labels this run scored, in the order the
  // first pair returned them.
  const FACTORS = useMemo(() => {
    const first = suggestions[0];
    if (!first) return [];
    return first.factors.map((f) => ({ k: slug(f.label), label: f.label }));
  }, [suggestions]);

  const PAIRS = useMemo(() => suggestions.map((s) => ({
    id: s.id,
    aName: s.a?.name, aMeta: personMeta(s.a),
    bName: s.b?.name, bMeta: personMeta(s.b),
    screeningPassed: s.screeningPassed,
    scores: Object.fromEntries(s.factors.map((f) => [slug(f.label), f.pct])),
    notes: Object.fromEntries(s.factors.map((f) => [slug(f.label), f.note])),
  })), [suggestions]);

  const weighted = useCallback((p, weights) => {
    if (!FACTORS.length) return 0;
    const total = FACTORS.reduce((n, f) => n + (weights[f.k] || 0), 0) || 1;
    return Math.round(FACTORS.reduce((n, f) => n + (p.scores[f.k] || 0) * (weights[f.k] || 0), 0) / total);
  }, [FACTORS]);

  const BASE = useMemo(() => Object.fromEntries(FACTORS.map((f) => [f.k, 7])), [FACTORS]);

  const wTotal = FACTORS.reduce((n, f) => n + (w[f.k] || 0), 0) || 1;
  const ranked = PAIRS.slice().sort((a, b) => weighted(b, w) - weighted(a, w));
  const top = ranked[0];

  // Optimistic status change, reverted on error.
  const actSuggestion = async (pairId, apiStatus, localState, successMsg) => {
    setDecision((x) => ({ ...x, [pairId]: localState }));
    try {
      await api.updateSuggestion(token, pairId, { status: apiStatus });
      say(successMsg);
    } catch (e) {
      setDecision((x) => { const n = { ...x }; delete n[pairId]; return n; });
      say(e.message || 'Could not update this pair.');
    }
  };

  const lastRun = suggestions[0]?.weekOf;
  const nextIn = nextRunIn(lastRun);

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

  const digest = top ? [
    { n: '৩', title: 'Three new suggestions', body: `Top pair at ${weighted(top, w)}% — ${top.aName} and ${top.bName}.`, bg: 'var(--green-100)', fg: 'var(--brand-primary)' },
    { n: '২', title: 'Two profiles need confirming', body: 'Sadia Islam and Mahmudul Hasan archive within a fortnight.', bg: 'var(--gold-100)', fg: 'var(--gold-700)' },
    { n: '১', title: 'One commission outstanding', body: '৳25,000 from the Rifat Jahan marriage, three weeks on.', bg: 'var(--terracotta-100)', fg: 'var(--terracotta-700)' },
  ] : [];

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
              <span className="am-lastrun">{lastRun ? `Last run ${weekLabel(lastRun)} · next in ${nextIn} day${nextIn === 1 ? '' : 's'}` : 'No run yet'}</span>
              <Avatar initials={initialsOf(user?.fullName)} size={28} />
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
                <div className="am-reset" onClick={() => { setW(BASE); say('Weights reset to the Sylhet district average. Your dismissals will start shifting them again from Monday.'); }}>
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
                <Button variant="outline" size="md" disabled={running} onClick={runNow}>{running ? 'Running…' : 'Run again now'}</Button>
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
                {loading && <div className="am-pair" style={{ padding: 20, color: 'var(--text-secondary)' }}>Loading this week’s matching run…</div>}
                {!loading && ranked.length === 0 && <div className="am-pair" style={{ padding: 20, color: 'var(--text-secondary)' }}>No open suggestions this week.</div>}
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
                              <span>Private screening: {p.screeningPassed ? 'passed' : 'not compared'}. That is the whole of what the gate returned — no factor, no percentage, no reason.</span>
                            </div>
                            {!st ? (
                              <div className="am-pair-actions">
                                <Button variant="primary" size="sm" onClick={() => actSuggestion(p.id, 'ACCEPTED', 'introduced', `Introduction sent to both managers. ${p.aName} ↔ ${p.bName} is now in progress.`)}>Introduce</Button>
                                <Button variant="ghost" size="sm" onClick={() => actSuggestion(p.id, 'DISMISSED', 'dismissed', 'Dismissed. Your weights shift slightly away from what this pair had in common.')}>Dismiss</Button>
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
              {top ? (
                <div className="am-digest-lead">{(user?.fullName || '').split(' ')[0] || 'আপা'}, এই সপ্তাহে {ranked.length}টি নতুন প্রস্তাব আছে। সর্বোচ্চ সঙ্গতি {weighted(top, w)}% — {top.aName} ↔ {top.bName}।</div>
              ) : (
                <div className="am-digest-lead">এই সপ্তাহে কোনো নতুন প্রস্তাব নেই।</div>
              )}
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
