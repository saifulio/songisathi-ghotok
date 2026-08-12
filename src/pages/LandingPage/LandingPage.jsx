import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button.jsx';
import { useAuth, homeForRole } from '../../context/AuthContext.jsx';
import './LandingPage.css';

const LockIcon = ({ size = 16, stroke = 'var(--brand-primary)' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
    <rect x="4.5" y="10.5" width="15" height="10" rx="2.4" />
    <path d="M8.4 10.5V7.8a3.6 3.6 0 0 1 7.2 0v2.7" />
  </svg>
);

// The page reads in one language at a time, Bangla first — most ghotoks and
// guardians read Bangla far more comfortably than English. The Bangla is
// written as its own copy, not translated line-for-line from the English.
const LANGUAGES = [
  { value: 'bn', label: 'বাংলা' },
  { value: 'en', label: 'English' },
];

// Chrome shared by both audiences: nav, the sealed card, the founding panel,
// the footer. COPY below carries the per-audience pitch.
const UI = {
  bn: {
    navHow: 'কীভাবে কাজ করে',
    navPrivacy: 'গোপনীয়তা',
    navPricing: 'খরচ',
    audience: { ghotok: 'ঘটকদের জন্য', family: 'পরিবারের জন্য' },
    login: 'লগ ইন',
    logout: 'লগ আউট',
    dashboard: 'ড্যাশবোর্ডে যান',
    cardHead: 'গোপন যাচাই · সিল করা',
    cardMeta: '৬টি উত্তর',
    cardLabel: 'দুই পরিবার যতটুকু দেখতে পায়',
    rows: [
      { label: 'শিক্ষা, পেশা, পরিবার', who: 'দুই পরিবারই', ok: true },
      { label: 'জেলা — ঠিকানা কখনো নয়', who: 'দুই পরিবারই', ok: true },
      { label: 'ছবি', who: 'অনুমতি দিলে', ok: false },
      { label: 'ছয়টি গোপন উত্তর', who: 'কেউ না', ok: false },
    ],
    resultTitle: 'ফলাফল: মিলেছে',
    resultBody:
      'দেয়াল পেরিয়ে আসে কেবল একটি লাইন। কারণ নয়, বিস্তারিত নয়, ব্যতিক্রমও নয় — ঘটকের জন্যও না, আমাদের নিজেদের জন্যও না।',
    foundingEyebrow: 'ফাউন্ডিং সদস্য',
    foundingTitle: 'প্রথম দশজন ঘটক দুই বছর বিনামূল্যে',
    foundingBody:
      'প্রথম দশজন সক্রিয় ঘটক পাচ্ছেন দুই বছর বিনামূল্যে, পরের নব্বইজন এক বছর। জিনিসটা আমরা তাঁদের জন্য বানাচ্ছি না, তাঁদের সঙ্গে নিয়ে বানাচ্ছি।',
    foundingProgress: '১০টির মধ্যে ৫টি বাকি',
    foundingCta: 'ফাউন্ডিং স্লট নিন',
    footerTag:
      'ঢাকা ও সিলেট · বাংলাদেশে বিয়ে আসলে যেভাবে ঠিক হয়, সেভাবেই বানানো — অ্যাপ যেভাবে ধরে নেয়, সেভাবে নয়।',
    footerCols: [
      { label: 'প্রোডাক্ট', items: ['ঘটকদের জন্য', 'পরিবারের জন্য', 'খরচ'] },
      { label: 'ভরসা', items: ['গোপনীয়তা নীতি', 'যাচাই কীভাবে হয়', 'প্রোফাইলের নামে অভিযোগ'] },
    ],
  },
  en: {
    navHow: 'How it works',
    navPrivacy: 'Privacy',
    navPricing: 'Pricing',
    audience: { ghotok: 'For ghotoks', family: 'For families' },
    login: 'Log in',
    logout: 'Log out',
    dashboard: 'Go to dashboard',
    cardHead: 'Private screening · sealed',
    cardMeta: '6 answers',
    cardLabel: 'What the two families see',
    rows: [
      { label: 'Education, profession, family', who: 'both families', ok: true },
      { label: 'District — never the address', who: 'both families', ok: true },
      { label: 'Photograph', who: 'on release only', ok: false },
      { label: 'The six private answers', who: 'nobody', ok: false },
    ],
    resultTitle: 'Result: compatible',
    resultBody:
      'One line crosses the wall. No reason, no detail, no exception — not for the ghotok, not for us.',
    foundingEyebrow: 'Founding members',
    foundingTitle: 'The first ten ghotoks go free for two years',
    foundingBody:
      'The first ten activated ghotoks get two years free; the next ninety get one year. We are building this with them, not for them.',
    foundingProgress: '5 of 10 left',
    foundingCta: 'Claim a founding slot',
    footerTag:
      'Dhaka and Sylhet · built for the way marriages are actually arranged in Bangladesh, not the way apps assume they are.',
    footerCols: [
      { label: 'Product', items: ['For ghotoks', 'For families', 'Pricing'] },
      { label: 'Trust', items: ['Privacy policy', 'How screening works', 'Report a profile'] },
    ],
  },
};

const COPY = {
  bn: {
    ghotok: {
      eyebrow: 'ঘটক ও ম্যারেজ ব্যুরোর জন্য',
      heroTitle: 'আপনার খাতা ডিজিটাল হোক, আপনার বিচার নয়',
      heroLead: 'কার সঙ্গে কার মিলবে — সে সিদ্ধান্ত আজও পুরোপুরি আপনারই।',
      heroBody:
        'কাগজের খাতা যা পারে না, সঙ্গীসাথী ঠিক সেটুকুই করে — প্রতিটি প্রোফাইল মনে রাখে, যে প্রশ্নগুলো দুই পরিবার মুখোমুখি করতে পারে না সেগুলো আগেই মিলিয়ে নেয়, আর সোমবার সকালে সম্ভাব্য জোড়ার তালিকা হাতে তুলে দেয়। বাকি বিচারটা আপনার হাতেই থাকে।',
      heroCta: 'ফ্রি শুরু করুন',
      heroCta2: 'ড্যাশবোর্ড দেখুন',
      heroFoot: 'কার্ড লাগবে না। আপনার কমিশন পুরোটাই আপনার — আমরা এক পয়সাও নিই না।',
      ctaLabel: 'ফ্রি শুরু করুন',
      stepsTitle: 'কীভাবে কাজ করে',
      stepsSub: 'তিনটি কাজ, যা কাগজের খাতায় কখনো সম্ভব ছিল না',
      steps: [
        {
          n: '১',
          title: 'আপনার খাতা, হুবহু সঙ্গে',
          body: 'খাতার পাতার ছবি তুলুন, কিংবা হোয়াটসঅ্যাপে আগে থেকেই যে বায়োডাটাগুলো আছে সেগুলো পাঠিয়ে দিন। আমরা পড়ে নিই; হাতের লেখা যেটুকু ভুল বুঝেছি, আপনি ঠিক করে দেন।',
        },
        {
          n: '২',
          title: 'পরিবার নিজে উত্তর দেয়',
          body: 'গোপন অংশটা আপনি অভিভাবকের হাতে তুলে দেন। তাঁদের উত্তর সিল হয়ে যায় — আপনি কোনোদিন দেখেন না, আর ঠিক এ কারণেই পরিবারগুলো সত্যি কথাটা লেখে।',
        },
        {
          n: '৩',
          title: 'সোমবারে প্রস্তাব আসে',
          body: 'যে জোড়াগুলো প্রকাশ্য শর্ত আর সিল করা যাচাই — দুটোতেই উতরে যায়, কেবল সেগুলোই। রাখুন, বাদ দিন, বা কারণ জানতে চান; তিনটি থেকেই সিস্টেম শেখে।',
        },
      ],
      promiseTitle: 'আমরা যা কখনো করব না',
      promiseSub: 'চারটি কথা, লিখিতভাবে',
      promises: [
        {
          title: 'আপনার কমিশনে ভাগ বসাব না',
          body: 'আপনার কাজের পরিসর অনুযায়ী মাসিক ফি, ব্যস। বিয়ে ঠিক হলে পরিবার আপনাকে যা দেয়, তার এক পয়সাও আমাদের হাত ঘুরে যায় না।',
        },
        {
          title: 'পরিবারকে আপনাকে ডিঙিয়ে যেতে দেব না',
          body: 'আগ্রহ, ছবির অনুরোধ, যোগাযোগের তথ্য — সবই যায় প্রোফাইলের দায়িত্বে থাকা মানুষটির মাধ্যমে। সরাসরি বার্তা পাঠানোর ব্যবস্থাই এখানে নেই, তাই ক্লায়েন্ট হাতছাড়া হওয়ার ভয়ও নেই।',
        },
        {
          title: 'সিল করা উত্তর আপনাকেও দেখাব না',
          body: 'আপনাকে তো নয়ই, আমাদের নিজেদের কর্মীদেরও নয়। যাচাই শেষে একটি লাইনই ফেরে: মিলেছে, কিংবা প্রস্তাব করা হয়নি।',
        },
        {
          title: 'আপনার খাতা আটকে রাখব না',
          body: 'আপনার দায়িত্বে থাকা প্রতিটি প্রোফাইল যেকোনো দিন রপ্তানি করে নিয়ে চলে যেতে পারবেন। এটা আপনার পেশা, আমাদের ডেটাবেজ নয়।',
        },
      ],
      quoteName: 'রহিমা আক্তার',
      quoteMeta: 'ঘটক, সিলেট · ২২ বছর, ২৭টি বিয়ে',
      quote:
        '২০০৩ সাল থেকে একই খাতা চালিয়ে আসছি। কাজের নতুন ধরন আমি খুঁজছিলাম না — খুঁজছিলাম এমন কিছু, যাতে জিন্দাবাজারের একটা পরিবার আট মাস আগে যে কথাটা বলেছিল, সেটা আর ভুলে না যাই।',
      toastCta:
        'ফাউন্ডিং স্লট ২৪ ঘণ্টার জন্য রাখা থাকল। শুরু করতে মিনিট দশেক লাগে — তার বেশিরভাগ সময় যায় খাতার ছবি তুলতে।',
      toastSecondary:
        'ড্যাশবোর্ড ঘুরে দেখাচ্ছি — সাপ্তাহিক প্রস্তাব, বায়োডাটা স্টুডিও আর সিল করা স্তর।',
    },
    family: {
      eyebrow: 'অভিভাবক ও পরিবারের জন্য',
      heroTitle: 'যে প্রশ্নগুলো মুখে করা যায় না, সেগুলোর হিসাব আগেই মিলে যায়',
      heroLead: 'দেখা-সাক্ষাতের আগেই, কাউকে অস্বস্তিতে না ফেলে।',
      heroBody:
        'যৌতুক। বিয়ের পর কোথায় থাকবে। মেয়ে চাকরি চালিয়ে যাবে কি না। স্বাস্থ্যের যে কথাটা শুরুতেই বলা উচিত। এসবের উত্তর আপনি একবারই দেন, গোপনে — উত্তরগুলো সিল হয়ে থাকে, কেবল মিলিয়ে দেখা হয়। মৌলিক কোনো বিষয়ে দুই পরিবারের অমিল থাকলে প্রস্তাবটা আপনার কাছ পর্যন্ত আসেই না।',
      heroCta: 'ফ্রি শুরু করুন',
      heroCta2: 'কীভাবে কাজ করে',
      heroFoot: 'আপনার ঘটক আপনার উত্তর পড়তে পারেন না। আমরাও পারি না।',
      ctaLabel: 'ফ্রি শুরু করুন',
      stepsTitle: 'আপনার পরিবারের জন্য',
      stepsSub: 'শুরু থেকে শেষ পর্যন্ত তিনটি জিনিস আপনার হাতেই থাকে',
      steps: [
        {
          n: '১',
          title: 'ঘটক আপনার ঘটকই থাকেন',
          body: 'প্রতিটি প্রস্তাব আপনার কাছে আসে সেই মানুষটির মাধ্যমে, যাঁকে আপনি আগে থেকেই চেনেন — সঙ্গে তাঁর নিজের মতামত। আপনার মেয়েকে কেউ সরাসরি বার্তা পাঠাতে পারে না; পাঠানোর কোনো উপায়ই রাখা হয়নি।',
        },
        {
          n: '২',
          title: 'উত্তর সিল থাকে, খোলা পড়ে থাকে না',
          body: 'গোপন অংশটা আপনার নিজের ফোনেই এনক্রিপ্ট হয়ে যায়। আপনার ঘটক শুধু দেখেন যে পূরণ করা হয়েছে। কোনো স্টাফ অ্যাকাউন্ট সেটা খুলতে পারে না।',
        },
        {
          n: '৩',
          title: 'ছবি আপনার অনুমতির অপেক্ষায় থাকে',
          body: 'আপনি না বলা পর্যন্ত ছবি ঝাপসাই থাকে — একটি নির্দিষ্ট প্রস্তাবের জন্য, একটি নির্দিষ্ট পরিবারকে। কারণ না জানিয়েই আপনি মানা করতে পারেন।',
        },
      ],
      promiseTitle: 'আমরা যা কখনো করব না',
      promiseSub: 'চারটি কথা, লিখিতভাবে',
      promises: [
        {
          title: 'আপনার ফোন নম্বর দেখাব না',
          body: 'যোগাযোগের তথ্য হাতবদল হয় কেবল তখনই, যখন দুই পরিবার রাজি এবং দুই পক্ষের ঘটক জানেন। টাকা দিয়ে খোলার ব্যবস্থা নেই, ব্যতিক্রমও নেই।',
        },
        {
          title: 'আপনার ঠিকানা প্রকাশ করব না',
          body: 'বায়োডাটায় থাকে আপনার জেলা। রাস্তা নয়, বাড়ি নয় — বায়োডাটা হাত ঘুরলেও নয়।',
        },
        {
          title: 'আপনার মেয়ের প্রোফাইল কাউকে ঘেঁটে দেখতে দেব না',
          body: 'এখানে সোয়াইপ নেই, খোলা তালিকাও নেই। প্রোফাইল একটি একটি করে প্রস্তাব করেন এমন একজন, যাঁকে জবাব দিতে হয়।',
        },
        {
          title: '“না” বলার কারণ জানতে চাইব না',
          body: 'আপনার মানা অন্য পক্ষের কাছে যায় এভাবে — “এই মুহূর্তে ঠিক মিলছে না।” কোনো কারণ লেখা হয় না, জানতেও চাওয়া হয় না।',
        },
      ],
      quoteName: 'শিরীন আক্তার',
      quoteMeta: 'অভিভাবক, ধানমন্ডি · দুই মেয়ের মা',
      quote:
        'প্রথম পরিবারটি যৌতুকের কথা তুলেছিল তৃতীয় বৈঠকে, তখন সবার মায়া পড়ে গেছে। এখানে ওদের নাম শোনার আগেই বিষয়টা মিটে গিয়েছিল। যেকোনো ছবির চেয়ে ওটার দাম বেশি।',
      toastCta:
        'আপনার জেলার একজন যাচাই করা ঘটকের নাম প্রস্তাব করা হবে। যোগাযোগ করবেন কি না, সেটা আপনার সিদ্ধান্ত।',
      toastSecondary:
        'ধানমন্ডির কাছের যাচাই করা ঘটকদের দেখাচ্ছি, সঙ্গে কে কতগুলো বিয়ে সম্পন্ন করেছেন।',
    },
  },
  en: {
    ghotok: {
      eyebrow: 'For ghotoks and marriage bureaus',
      heroTitle: 'Your register goes digital. Your judgement does not.',
      heroLead: 'Who is right for whom is still entirely your call.',
      heroBody:
        'SongiSathi does the parts of matchmaking that a notebook cannot: it remembers every profile, screens the questions families cannot ask each other, and suggests pairs on Monday morning. The judgement stays with you.',
      heroCta: 'Start free',
      heroCta2: 'See the dashboard',
      heroFoot: 'No card needed. Your commission is yours — we take none of it.',
      ctaLabel: 'Start free',
      stepsTitle: 'How it works',
      stepsSub: 'Three things happen that a paper register cannot do',
      steps: [
        {
          n: '1',
          title: 'Your book, carried across',
          body: 'Photograph the register or forward the biodata you already have on WhatsApp. We read them; you correct what the handwriting got wrong.',
        },
        {
          n: '2',
          title: 'The family answers privately',
          body: 'You hand the confidential section to the guardian. Their answers seal — you never see them, and that is exactly why families answer honestly.',
        },
        {
          n: '3',
          title: 'Monday brings suggestions',
          body: 'Pairs that pass both the visible criteria and the sealed screening. Accept, dismiss, or ask why — the system learns from all three.',
        },
      ],
      promiseTitle: 'What SongiSathi will never do',
      promiseSub: 'Four promises, in writing',
      promises: [
        {
          title: 'Never take a cut of your commission',
          body: 'You pay for the size of your practice, monthly. What a family pays you for a marriage never passes through us.',
        },
        {
          title: 'Never let a family bypass you',
          body: 'Every interest, photo request, and contact detail routes through the profile’s manager. There is no direct-message feature to lose you the client.',
        },
        {
          title: 'Never show you the sealed answers',
          body: 'Not to you, not to our own staff. The screening returns one line: compatible, or not suggested.',
        },
        {
          title: 'Never hold your book hostage',
          body: 'Export every profile you manage, any time, and leave. It is your practice, not our database.',
        },
      ],
      quoteName: 'Rahima Akter',
      quoteMeta: 'Ghotok, Sylhet · 22 years, 27 marriages',
      quote:
        'I have kept the same register since 2003. What I wanted was not a new way of working — it was to stop forgetting that a family in Zindabazar told me something important eight months ago.',
      toastCta:
        'Founding slot held for 24 hours. Onboarding takes about ten minutes — mostly photographing your register.',
      toastSecondary:
        'Opening the dashboard tour — the weekly suggestions, the biodata studio, and the sealed layer.',
    },
    family: {
      eyebrow: 'For guardians and families',
      heroTitle: 'The questions no family can ask are answered before you meet.',
      heroLead: 'Settled early, without putting anyone on the spot.',
      heroBody:
        'Dowry. Where the couple will live. Whether she keeps working. A health matter that ought to be said early. You answer these once, privately — they are sealed, and only ever compared. If two families disagree on something fundamental, the proposal simply never reaches you.',
      heroCta: 'Start free',
      heroCta2: 'How it works',
      heroFoot: 'Your ghotok cannot read your answers. Neither can we.',
      ctaLabel: 'Start free',
      stepsTitle: 'For your family',
      stepsSub: 'Three things you keep control of, start to finish',
      steps: [
        {
          n: '1',
          title: 'Your ghotok stays your ghotok',
          body: 'Every proposal reaches you through the person you already trust, with their note attached. Nobody messages your daughter directly — there is no way to.',
        },
        {
          n: '2',
          title: 'Your answers are sealed, not stored openly',
          body: 'The confidential section is encrypted on your own phone. Your ghotok sees only that it is complete. No staff account can open it.',
        },
        {
          n: '3',
          title: 'The photograph waits for your word',
          body: 'Photos stay blurred until you release them, for one specific proposal, to one specific family. You can refuse without giving a reason.',
        },
      ],
      promiseTitle: 'What SongiSathi will never do',
      promiseSub: 'Four promises, in writing',
      promises: [
        {
          title: 'Never show your phone number',
          body: 'Contact details move only when both families agree, through both managers. There is no paid unlock and no exception.',
        },
        {
          title: 'Never publish your address',
          body: 'A biodata carries your district. Not your road, not your house — even when it is forwarded on.',
        },
        {
          title: 'Never let anyone browse your daughter',
          body: 'There is no swiping and no public directory. Profiles are proposed, one at a time, by a manager who is answerable.',
        },
        {
          title: 'Never ask you to explain a no',
          body: 'A decline is passed on as “not the right fit at this time.” No reason is recorded and none is asked for.',
        },
      ],
      quoteName: 'Shirin Akter',
      quoteMeta: 'Guardian, Dhanmondi · mother of two daughters',
      quote:
        'The first family asked about dowry in the third meeting, after everyone had grown attached. Here it was settled before we ever heard their name. That is worth more than any photograph.',
      toastCta:
        'A verified ghotok in your district will be suggested. You choose whether to contact them.',
      toastSecondary:
        'Showing verified ghotoks near Dhanmondi, with the number of marriages each has closed.',
    },
  },
};

// Button sets its own font inline, so neither the shared sm/lg sizes nor the
// page's Tiro Bangla can be reached from LandingPage.css — both are restated
// here so the buttons sit with the rest of the page.
const NAV_BTN = { fontSize: 15, fontFamily: 'var(--lp-font)' };
const HERO_BTN = { fontSize: 17, fontFamily: 'var(--lp-font)' };

export default function LandingPage() {
  const [lang, setLang] = useState('bn');
  const [audience, setAudience] = useState('ghotok');
  const [toast, setToast] = useState(null);
  const timer = useRef(null);
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const t = UI[lang];
  const c = COPY[lang][audience];
  const forGhotok = audience === 'ghotok';
  // A ghotok signs up as a matchmaker; a family signs up as a guardian.
  const signupRole = forGhotok ? 'matchmaker' : 'guardian';

  const say = useCallback((msg) => {
    clearTimeout(timer.current);
    setToast(msg);
    timer.current = setTimeout(() => setToast(null), 4400);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  // Keep the document language honest for screen readers and hyphenation.
  useEffect(() => {
    document.documentElement.lang = lang;
    return () => {
      document.documentElement.lang = 'en';
    };
  }, [lang]);

  // "Start free" — go to sign up with the right account type preselected.
  const goSignup = () => navigate(`/signup?as=${signupRole}`);

  const scrollToId = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  const cta = () => say(c.toastCta);
  const secondary = () => say(c.toastSecondary);

  return (
    <div className={`lp lang-${lang}`}>
      {/* nav */}
      <header className="lp-nav">
        <div className="lp-nav-brand">
          <div className="lp-logo">স</div>
          <span className="lp-wordmark">SongiSathi</span>
        </div>
        <nav className="lp-nav-links">
          <span role="button" tabIndex={0} onClick={() => scrollToId('how-it-works')} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && scrollToId('how-it-works')}>
            {t.navHow}
          </span>
          <span role="button" tabIndex={0} onClick={() => scrollToId('privacy')} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && scrollToId('privacy')}>
            {t.navPrivacy}
          </span>
          <span role="button" tabIndex={0} onClick={() => navigate('/onboarding')} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && navigate('/onboarding')}>
            {t.navPricing}
          </span>
        </nav>
        {/* Sits outside lp-nav-actions so that when the nav wraps on a phone it
            keeps the brand company instead of forcing a third row. */}
        <div className="lp-toggle lp-lang" role="group" aria-label="Language / ভাষা">
          {LANGUAGES.map((l) => (
            <button
              key={l.value}
              className={`lp-toggle-btn ${lang === l.value ? 'is-active' : ''}`}
              onClick={() => setLang(l.value)}
              aria-pressed={lang === l.value}
              lang={l.value}
            >
              {l.label}
            </button>
          ))}
        </div>
        <div className="lp-nav-actions">
          <div className="lp-toggle">
            {[
              { value: 'ghotok', label: t.audience.ghotok },
              { value: 'family', label: t.audience.family },
            ].map((a) => (
              <button
                key={a.value}
                className={`lp-toggle-btn ${audience === a.value ? 'is-active' : ''}`}
                onClick={() => setAudience(a.value)}
                aria-pressed={audience === a.value}
              >
                {a.label}
              </button>
            ))}
          </div>
          {user ? (
            <>
              <span className="lp-login">{user.fullName}</span>
              <Button variant="outline" size="sm" style={NAV_BTN} onClick={logout}>{t.logout}</Button>
              <Button variant="primary" size="sm" style={NAV_BTN} onClick={() => navigate(homeForRole(user))}>
                {t.dashboard}
              </Button>
            </>
          ) : (
            <>
              <span
                className="lp-login"
                role="button"
                tabIndex={0}
                onClick={() => navigate('/signin')}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && navigate('/signin')}
              >
                {t.login}
              </span>
              <Button variant="primary" size="sm" style={NAV_BTN} onClick={goSignup}>
                {c.ctaLabel}
              </Button>
            </>
          )}
        </div>
      </header>

      {/* hero */}
      <section className="lp-hero" key={`${lang}-${audience}`}>
        <div className="lp-hero-copy">
          <div className="lp-eyebrow">
            <span className="lp-eyebrow-dot" />
            <span>{c.eyebrow}</span>
          </div>
          <h1 className="lp-hero-title">{c.heroTitle}</h1>
          <div className="lp-hero-lead">{c.heroLead}</div>
          <p className="lp-hero-body">{c.heroBody}</p>
          <div className="lp-hero-actions">
            <Button variant="primary" size="lg" style={HERO_BTN} onClick={goSignup}>
              {c.heroCta}
            </Button>
            <Button variant="outline" size="lg" style={HERO_BTN} onClick={secondary}>
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
              <span>{t.cardHead}</span>
              <span className="lp-card-head-meta">{t.cardMeta}</span>
            </div>
            <div className="lp-card-body">
              <div className="lp-card-label">{t.cardLabel}</div>
              <div className="lp-rows">
                {t.rows.map((r) => (
                  <div key={r.label} className={`lp-row ${r.ok ? 'ok' : ''}`}>
                    <span className="lp-row-dot">{r.ok ? '✓' : '–'}</span>
                    <span className="lp-row-label">{r.label}</span>
                    <span className="lp-row-who">{r.who}</span>
                  </div>
                ))}
              </div>
              <div className="lp-result">
                <div className="lp-result-title">{t.resultTitle}</div>
                <div className="lp-result-body">{t.resultBody}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* steps */}
      <section className="lp-steps" id="how-it-works">
        <div className="lp-section-head">
          <div className="lp-section-title">{c.stepsTitle}</div>
          <div className="lp-section-sub">{c.stepsSub}</div>
        </div>
        <div className="lp-steps-grid">
          {c.steps.map((st) => (
            <div key={st.n} className="lp-step">
              <div className="lp-step-head">
                <span className="lp-step-n">{st.n}</span>
                <span className="lp-step-title">{st.title}</span>
              </div>
              <div className="lp-step-body">{st.body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* promises + founding */}
      <section className="lp-promises" id="privacy">
        <div className="lp-promises-main">
          <div className="lp-section-title">{c.promiseTitle}</div>
          <div className="lp-section-sub">{c.promiseSub}</div>
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
            <div className="lp-founding-eyebrow">{t.foundingEyebrow}</div>
            <div className="lp-founding-title">{t.foundingTitle}</div>
            <div className="lp-founding-body">{t.foundingBody}</div>
            <div className="lp-founding-progress">
              <span className="lp-bar">
                <span className="lp-bar-fill" />
              </span>
              <span className="lp-bar-label">{t.foundingProgress}</span>
            </div>
            <Button variant="primary" size="md" onClick={cta} style={{ width: '100%', fontSize: 16, fontFamily: 'var(--lp-font)', background: 'var(--gold-400)', color: 'var(--brown-900)', border: '1px solid var(--gold-400)' }}>
              {t.foundingCta}
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
          <div className="lp-footer-tag">{t.footerTag}</div>
        </div>
        <div className="lp-footer-cols">
          {t.footerCols.map((col) => (
            <div key={col.label} className="lp-footer-col">
              <span className="lp-footer-col-label">{col.label}</span>
              {col.items.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          ))}
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
