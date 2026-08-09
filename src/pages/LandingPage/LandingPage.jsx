import { useState, useRef, useEffect, useCallback } from 'react';
import Button from '../../components/ui/Button.jsx';
import './LandingPage.css';

const LockIcon = ({ size = 16, stroke = 'var(--brand-primary)' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
    <rect x="4.5" y="10.5" width="15" height="10" rx="2.4" />
    <path d="M8.4 10.5V7.8a3.6 3.6 0 0 1 7.2 0v2.7" />
  </svg>
);

const COPY = {
  ghotok: {
    eyebrow: 'For ghotoks and marriage bureaus',
    heroBn: 'আপনার খাতা ডিজিটাল হোক, আপনার বিচার নয়',
    heroEn: 'Your register goes digital. Your judgement does not.',
    heroBody:
      'SongiSathi does the parts of matchmaking that a notebook cannot: it remembers every profile, screens the questions families cannot ask each other, and suggests pairs on Monday morning. Who is right for whom is still your call.',
    heroCta: 'ফ্রি শুরু করুন · Start free',
    heroCta2: 'See the dashboard',
    heroFoot: 'No card needed. Your commission is yours — we take none of it.',
    ctaLabel: 'Start free',
    stepsTitleBn: 'কীভাবে কাজ করে',
    stepsTitleEn: 'Three things happen that a paper register cannot do',
    steps: [
      { n: '১', title: 'Your book, carried across', bn: 'আপনার খাতা', body: 'Photograph the register or forward the biodata you already have on WhatsApp. We read them; you correct what the handwriting got wrong.' },
      { n: '২', title: 'The family answers privately', bn: 'পরিবার নিজে উত্তর দেয়', body: 'You hand the confidential section to the guardian. Their answers seal — you never see them, and that is exactly why families answer honestly.' },
      { n: '৩', title: 'Monday brings suggestions', bn: 'সোমবারে প্রস্তাব', body: 'Pairs that pass both the visible criteria and the sealed screening. Accept, dismiss, or ask why — the system learns from all three.' },
    ],
    promiseTitleBn: 'আমরা যা করি না',
    promiseTitleEn: 'What SongiSathi will never do',
    promises: [
      { title: 'Never take a cut of your commission', body: 'You pay for the size of your practice, monthly. What a family pays you for a marriage never passes through us.' },
      { title: 'Never let a family bypass you', body: 'Every interest, photo request, and contact detail routes through the profile’s manager. There is no direct-message feature to lose you the client.' },
      { title: 'Never show you the sealed answers', body: 'Not to you, not to our own staff. The screening returns one line: compatible, or not suggested.' },
      { title: 'Never hold your book hostage', body: 'Export every profile you manage, any time, and leave. It is your practice, not our database.' },
    ],
    quoteName: 'Rahima Akter',
    quoteMeta: 'Ghotok, Sylhet · 22 years, 27 marriages',
    quote:
      'I have kept the same register since 2003. What I wanted was not a new way of working — it was to stop forgetting that a family in Zindabazar told me something important eight months ago.',
  },
  family: {
    eyebrow: 'For guardians and families',
    heroBn: 'যে প্রশ্নগুলো মুখে জিজ্ঞাসা করা যায় না, সেগুলোর উত্তর আগেই মিলিয়ে নেওয়া হয়',
    heroEn: 'The questions no family can ask are answered before you meet.',
    heroBody:
      'Dowry. Where the couple will live. Whether she keeps working. A health matter that ought to be said early. You answer these once, privately — they are sealed, and only ever compared. If two families disagree on something fundamental, the proposal simply never reaches you.',
    heroCta: 'কীভাবে সুরক্ষিত জানুন',
    heroCta2: 'Find a verified ghotok',
    heroFoot: 'Your ghotok cannot read your answers. Neither can we.',
    ctaLabel: 'How it works',
    stepsTitleBn: 'আপনার পরিবারের জন্য',
    stepsTitleEn: 'Three things you keep control of, start to finish',
    steps: [
      { n: '১', title: 'Your ghotok stays your ghotok', bn: 'ঘটক আপনার পাশেই', body: 'Every proposal reaches you through the person you already trust, with their note attached. Nobody messages your daughter directly — there is no way to.' },
      { n: '২', title: 'Your answers are sealed, not stored openly', bn: 'উত্তর সিল করা থাকে', body: 'The confidential section is encrypted on your own phone. Your ghotok sees only that it is complete. No staff account can open it.' },
      { n: '৩', title: 'The photograph waits for your word', bn: 'ছবি আপনার অনুমতিতে', body: 'Photos stay blurred until you release them, for one specific proposal, to one specific family. You can refuse without giving a reason.' },
    ],
    promiseTitleBn: 'আমরা যা করি না',
    promiseTitleEn: 'What SongiSathi will never do',
    promises: [
      { title: 'Never show your phone number', body: 'Contact details move only when both families agree, through both managers. There is no paid unlock and no exception.' },
      { title: 'Never publish your address', body: 'A biodata carries your district. Not your road, not your house — even when it is forwarded on.' },
      { title: 'Never let anyone browse your daughter', body: 'There is no swiping and no public directory. Profiles are proposed, one at a time, by a manager who is answerable.' },
      { title: 'Never ask you to explain a no', body: 'A decline is passed on as “not the right fit at this time.” No reason is recorded and none is asked for.' },
    ],
    quoteName: 'Shirin Akter',
    quoteMeta: 'Guardian, Dhanmondi · mother of two daughters',
    quote:
      'The first family asked about dowry in the third meeting, after everyone had grown attached. Here it was settled before we ever heard their name. That is worth more than any photograph.',
  },
};

const HERO_ROWS = [
  { label: 'Education, profession, family', who: 'both families', ok: true },
  { label: 'District — never the address', who: 'both families', ok: true },
  { label: 'Photograph', who: 'on release only', ok: false },
  { label: 'The six private answers', who: 'nobody', ok: false },
];

export default function LandingPage() {
  const [audience, setAudience] = useState('ghotok');
  const [toast, setToast] = useState(null);
  const timer = useRef(null);
  const c = COPY[audience];
  const forGhotok = audience === 'ghotok';

  const say = useCallback((msg) => {
    clearTimeout(timer.current);
    setToast(msg);
    timer.current = setTimeout(() => setToast(null), 4400);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  const cta = () =>
    say(
      forGhotok
        ? 'Founding slot held for 24 hours. Onboarding takes about ten minutes — mostly photographing your register.'
        : 'A verified ghotok in your district will be suggested. You choose whether to contact them.'
    );
  const secondary = () =>
    say(
      forGhotok
        ? 'Opening the dashboard tour — the weekly suggestions, the biodata studio, and the sealed layer.'
        : 'Showing verified ghotoks near Dhanmondi, with the number of marriages each has closed.'
    );

  return (
    <div className="lp">
      {/* nav */}
      <header className="lp-nav">
        <div className="lp-nav-brand">
          <div className="lp-logo">স</div>
          <span className="lp-wordmark">SongiSathi</span>
        </div>
        <nav className="lp-nav-links">
          <span>How it works</span>
          <span>Privacy</span>
          <span>Pricing</span>
        </nav>
        <div className="lp-nav-actions">
          <div className="lp-toggle">
            {[
              { value: 'ghotok', label: 'For ghotoks' },
              { value: 'family', label: 'For families' },
            ].map((a) => (
              <button
                key={a.value}
                className={`lp-toggle-btn ${audience === a.value ? 'is-active' : ''}`}
                onClick={() => setAudience(a.value)}
              >
                {a.label}
              </button>
            ))}
          </div>
          <span className="lp-login">Log in</span>
          <Button variant="primary" size="sm" onClick={cta}>
            {c.ctaLabel}
          </Button>
        </div>
      </header>

      {/* hero */}
      <section className="lp-hero" key={audience}>
        <div className="lp-hero-copy">
          <div className="lp-eyebrow">
            <span className="lp-eyebrow-dot" />
            <span>{c.eyebrow}</span>
          </div>
          <h1 className="lp-hero-bn">{c.heroBn}</h1>
          <div className="lp-hero-en">{c.heroEn}</div>
          <p className="lp-hero-body">{c.heroBody}</p>
          <div className="lp-hero-actions">
            <Button variant="primary" size="lg" onClick={cta}>
              {c.heroCta}
            </Button>
            <Button variant="outline" size="lg" onClick={secondary}>
              {c.heroCta2}
            </Button>
          </div>
          <div className="lp-hero-foot">
            <LockIcon />
            <span>{c.heroFoot}</span>
          </div>
        </div>

        {/* sealed card */}
        <div className="lp-hero-art">
          <div className="lp-hero-art-frame" />
          <div className="lp-card">
            <div className="lp-card-head">
              <LockIcon size={15} stroke="var(--gold-400)" />
              <span>Private screening · sealed</span>
              <span className="lp-card-head-meta">6 answers</span>
            </div>
            <div className="lp-card-body">
              <div className="lp-card-label">What the two families see</div>
              <div className="lp-rows">
                {HERO_ROWS.map((r) => (
                  <div key={r.label} className={`lp-row ${r.ok ? 'ok' : ''}`}>
                    <span className="lp-row-dot">{r.ok ? '✓' : '–'}</span>
                    <span className="lp-row-label">{r.label}</span>
                    <span className="lp-row-who">{r.who}</span>
                  </div>
                ))}
              </div>
              <div className="lp-result">
                <div className="lp-result-title">Result: compatible</div>
                <div className="lp-result-body">
                  One line crosses the wall. No reason, no detail, no exception — not for the ghotok, not for us.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* steps */}
      <section className="lp-steps">
        <div className="lp-section-head">
          <div className="lp-section-title-bn">{c.stepsTitleBn}</div>
          <div className="lp-section-title-en">{c.stepsTitleEn}</div>
        </div>
        <div className="lp-steps-grid">
          {c.steps.map((st) => (
            <div key={st.n} className="lp-step">
              <div className="lp-step-head">
                <span className="lp-step-n">{st.n}</span>
                <span className="lp-step-title">{st.title}</span>
              </div>
              {st.bn && <div className="lp-step-bn">{st.bn}</div>}
              <div className="lp-step-body">{st.body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* promises + founding */}
      <section className="lp-promises">
        <div className="lp-promises-main">
          <div className="lp-section-title-bn">{c.promiseTitleBn}</div>
          <div className="lp-section-title-en">{c.promiseTitleEn}</div>
          <div className="lp-promises-grid">
            {c.promises.map((pr) => (
              <div key={pr.title} className="lp-promise">
                <div className="lp-promise-title">{pr.title}</div>
                <div className="lp-promise-body">{pr.body}</div>
              </div>
            ))}
          </div>
        </div>
        <aside className="lp-founding-col">
          <div className="lp-founding">
            <div className="lp-founding-eyebrow">Founding members</div>
            <div className="lp-founding-bn">প্রথম দশজন ঘটক দুই বছর বিনামূল্যে</div>
            <div className="lp-founding-body">
              The first ten activated ghotoks get two years free; the next ninety get one year. We are building this with them, not for them.
            </div>
            <div className="lp-founding-progress">
              <span className="lp-bar">
                <span className="lp-bar-fill" />
              </span>
              <span className="lp-bar-label">5 of 10 left</span>
            </div>
            <Button variant="primary" size="md" onClick={cta} style={{ width: '100%', background: 'var(--gold-400)', color: 'var(--brown-900)', border: '1px solid var(--gold-400)' }}>
              ফাউন্ডিং স্লট নিন
            </Button>
          </div>
          <div className="lp-quote">
            <div className="lp-quote-name">{c.quoteName}</div>
            <div className="lp-quote-meta">{c.quoteMeta}</div>
            <div className="lp-quote-body">{c.quote}</div>
          </div>
        </aside>
      </section>

      {/* footer */}
      <footer className="lp-footer">
        <div className="lp-footer-brand">
          <div className="lp-wordmark light">SongiSathi</div>
          <div className="lp-footer-tag">
            Dhaka and Sylhet · built for the way marriages are actually arranged in Bangladesh, not the way apps assume they are.
          </div>
        </div>
        <div className="lp-footer-cols">
          <div className="lp-footer-col">
            <span className="lp-footer-col-label">Product</span>
            <span>For ghotoks</span>
            <span>For families</span>
            <span>Pricing</span>
          </div>
          <div className="lp-footer-col">
            <span className="lp-footer-col-label">Trust</span>
            <span>Privacy policy</span>
            <span>How screening works</span>
            <span>Report a profile</span>
          </div>
        </div>
      </footer>

      {toast && (
        <div className="lp-toast">
          <span className="lp-toast-check">✓</span>
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}
