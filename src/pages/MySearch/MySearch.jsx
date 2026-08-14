import { useState, useRef, useEffect, useCallback } from 'react';
import { Button, Avatar, Badge, Input, Select, Switch, Tag, ProfileCard, Pagination, RangeSlider } from '../../components/ui/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useMyProfiles } from '../../context/MyProfilesContext.jsx';
import { api } from '../../lib/api.js';
import { PhotoSlideshow } from '../../components/PhotoGallery.jsx';
import './MySearch.css';

const opts = (a) => a.map((v) => ({ value: v, label: v }));
const PAGE_SIZE = 10;
const DEFAULT_FF = { gender: 'Any', ageMin: 20, ageMax: 40, district: 'Any district', edu: 'Any level', verified: false, screened: false };
const initialsOf = (name) => String(name || '').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

export default function MySearch() {
  const { user, token } = useAuth();
  // Whose search this is: the profile the switcher is on. Every profile the
  // account holds is left out of the results server-side.
  const { activeId } = useMyProfiles();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState(null);
  // Whether this account may act on what it finds. A candidate whose profile a
  // ghotok or guardian manages browses the same pool, but their manager is the
  // one who sends interest — the server is the source of truth (see my-search).
  const [canSendInterest, setCanSendInterest] = useState(true);
  // The household's monthly interest allowance, so the send button says what
  // it will spend before it is pressed.
  const [plan, setPlan] = useState(null);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState(null);
  const [ff, setFf] = useState(DEFAULT_FF);
  // The genders the server will serve this account — one for a household
  // matchmaking for brides only, both for a guardian holding a bride and a
  // groom. The filter is offered only where there is a choice to make.
  const [searchGenders, setSearchGenders] = useState([]);
  const [sent, setSent] = useState({});
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState(null);
  const timer = useRef(null);
  const cardsRef = useRef(null);
  // The gender filter is seeded from the profiles the account holds, but only
  // once: switching between two daughters derives the same default, and
  // re-applying it would throw away a filter the reader had set by hand.
  const genderSeeded = useRef(false);
  const say = useCallback((msg) => { clearTimeout(timer.current); setToast(msg); timer.current = setTimeout(() => setToast(null), 4400); }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  const setFF = (k, v) => setFf((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    if (!token) return undefined;
    let live = true;
    setLoading(true);
    api.mySearch(token, activeId)
      .then((data) => {
        if (!live) return;
        // Who this family is looking for: one gender when every profile they
        // hold is of the other, both when they hold a bride and a groom. The
        // server derives it and has already limited the results to it, so this
        // filter narrows what came back rather than reaching past it.
        const wanted = data.searchGenders || [];
        const defaultGender = wanted.length === 1 ? wanted[0] : 'Any';
        setResults(data.profiles);
        setSearchGenders(wanted);
        setCanSendInterest(data.canSendInterest !== false);
        setPlan(data.plan || null);
        if (!genderSeeded.current && wanted.length) {
          genderSeeded.current = true;
          setFf((s) => ({ ...s, gender: defaultGender }));
        }
        setSelected((cur) => cur ?? data.profiles.find((r) => defaultGender === 'Any' || r.gender === defaultGender)?.id ?? data.profiles[0]?.id ?? null);
      })
      .catch((e) => { if (live) setBlocked(e.message || 'Search is not available for this account.'); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [token, activeId]);

  const matches = (r) => {
    if (ff.gender !== 'Any' && r.gender !== ff.gender) return false;
    if (ff.verified && !r.verified) return false;
    if (ff.screened && !r.screened) return false;
    if (ff.district !== 'Any district' && r.dcode !== ff.district) return false;
    if (ff.edu !== 'Any level' && r.eduLevel !== ff.edu) return false;
    if (r.age < ff.ageMin || r.age > ff.ageMax) return false;
    const query = q.trim().toLowerCase();
    if (query && !(`${r.name} ${r.prn} ${r.edu} ${r.district}`.toLowerCase().includes(query))) return false;
    return true;
  };
  const list = results.filter(matches);
  const sel = list.find((r) => r.id === selected) || null;

  // The selected profile's photographs, loaded on selection rather than with
  // the results: a page of ten galleries is ten images the reader may never
  // open, and the images travel inside the JSON (see server/lib/photos.js).
  const [gallery, setGallery] = useState(null);
  useEffect(() => {
    if (!token || !sel) { setGallery(null); return undefined; }
    let live = true;
    api.profileGallery(token, sel.id)
      .then((d) => { if (live) setGallery(d); })
      .catch(() => { if (live) setGallery(null); });
    return () => { live = false; };
  }, [token, sel?.id]);

  // Ten to a page. Changing a filter shrinks the list under you, so the page
  // is clamped on render (page 9 of a 3-page result would otherwise go blank)
  // and reset whenever the filters or the query change.
  const pageCount = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pageItems = list.slice(pageStart, pageStart + PAGE_SIZE);
  useEffect(() => { setPage(1); }, [q, ff]);
  const goToPage = (p) => {
    setPage(p);
    cardsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const chips = [];
  if (ff.verified) chips.push({ label: 'Verified only', k: 'verified' });
  if (ff.screened) chips.push({ label: 'Screening done', k: 'screened' });
  if (ff.district !== 'Any district') chips.push({ label: ff.district, k: 'district' });
  if (ff.edu !== 'Any level') chips.push({ label: ff.edu, k: 'edu' });
  const removeChip = (k) => setFF(k, k === 'district' ? 'Any district' : k === 'edu' ? 'Any level' : false);

  const rows = sel ? [
    { k: 'Education', v: sel.edu }, { k: 'Profession', v: sel.job }, { k: 'Family', v: sel.family },
    { k: 'Siblings', v: sel.siblings }, { k: 'Religious practice', v: sel.religion }, { k: 'Family is looking for', v: sel.looking },
  ] : [];

  const sendInterest = async () => {
    const id = sel.id;
    try {
      await api.sendInterest(token, { targetProfileId: id, profileId: activeId });
      setSent((s) => ({ ...s, [id]: true }));
      say(`Interest sent to ${sel.managedBy}. They decide whether to accept it.`);
    } catch (e) {
      say(e.message || 'Could not send interest.');
    }
  };

  if (blocked) {
    return (
      <div className="ms"><div className="ms-blocked">
        <div className="ms-blocked-t">Search isn't open on this account</div>
        <div className="ms-blocked-b">{blocked}</div>
        <a className="ms-blocked-link" href="/guardian">Go to your proposals</a>
      </div></div>
    );
  }

  return (
    <div className="ms">
      <div className="ms-frame">
        <div className="ms-topbar">
          <div className="ms-topbar-brand"><div className="ms-logo">স</div><span>SongiSathi</span></div>
          <span className="ms-topbar-note">Search & profiles</span>
          <div className="ms-topbar-right"><Avatar initials={initialsOf(user?.fullName)} size={28} /></div>
        </div>

        <div className={`ms-grid ${sel ? 'has-panel' : ''}`}>
          <div className="ms-filters">
            <div>
              <div className="ms-h-bn">অনুসন্ধান</div>
              <div className="ms-h-sub">Search profiles in the trusted network</div>
            </div>
            {/* With one gender served there is no choice to offer — a select
                whose other options return nothing would only mislead. */}
            {searchGenders.length > 1 && (
              <Select label="Looking for" value={ff.gender} onChange={(e) => setFF('gender', e.target.value)} options={opts(['Any', 'FEMALE', 'MALE']).map((o) => ({ value: o.value, label: o.value === 'FEMALE' ? 'Bride' : o.value === 'MALE' ? 'Groom' : 'Any' }))} />
            )}
            {searchGenders.length === 1 && (
              <div className="ms-fixed-gender">
                <span className="ms-fixed-gender-k">Looking for</span>
                <span className="ms-fixed-gender-v">{searchGenders[0] === 'FEMALE' ? 'Brides' : 'Grooms'}</span>
                <span className="ms-fixed-gender-note">Matched to the profiles you manage. The pool you can read holds no others.</span>
              </div>
            )}
            <div>
              <div className="ms-age-label">Age range</div>
              <div className="ms-age-row">
                <span>{ff.ageMin}</span>
                <RangeSlider
                  min={18}
                  max={60}
                  valueMin={ff.ageMin}
                  valueMax={ff.ageMax}
                  labelMin="Minimum age"
                  labelMax="Maximum age"
                  onChange={(ageMin, ageMax) => setFf((s) => ({ ...s, ageMin, ageMax }))}
                />
                <span>{ff.ageMax}</span>
              </div>
            </div>
            <Select label="District" value={ff.district} onChange={(e) => setFF('district', e.target.value)} options={opts(['Any district', 'Dhaka', 'Sylhet', 'Chattogram', 'Mymensingh'])} />
            <Select label="Education" value={ff.edu} onChange={(e) => setFF('edu', e.target.value)} options={opts(['Any level', 'Graduate', 'Postgraduate'])} />
            <div className="ms-switches">
              <Switch label="Verified profiles only" checked={ff.verified} onChange={() => setFF('verified', !ff.verified)} />
              <Switch label="Screening completed" checked={ff.screened} onChange={() => setFF('screened', !ff.screened)} />
            </div>
            {/* Reset returns to the derived gender, not to "Any" — the latter
                is not a state this account's results can be in. */}
            <Button variant="ghost" size="sm" onClick={() => { setFf({ ...DEFAULT_FF, gender: searchGenders.length === 1 ? searchGenders[0] : 'Any' }); setQ(''); }}>Reset filters</Button>
          </div>

          <div className="ms-results">
            <div className="ms-results-top">
              <div style={{ flex: 1, minWidth: 0 }}>
                <Input placeholder="নাম, PRN, প্রতিষ্ঠান খুঁজুন · Search name, PRN, institution" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
            </div>
            <div className="ms-results-meta">
              <span>
                {list.length === 0
                  ? '0 profiles in the network pool'
                  : `Showing ${pageStart + 1}–${pageStart + pageItems.length} of ${list.length} profiles in the network pool`}
              </span>
              <div className="ms-chips">{chips.map((c) => (<Tag key={c.k} onRemove={() => removeChip(c.k)}>{c.label}</Tag>))}</div>
            </div>
            <div className="ms-cards" ref={cardsRef}>
              {pageItems.map((r) => (
                <div key={r.id} style={{ borderRadius: 14, outline: selected === r.id ? '2px solid var(--brand-primary)' : '2px solid transparent', outlineOffset: 2 }}>
                  <ProfileCard profileId={r.prn} name={r.name} age={r.age} height={r.height} education={r.edu} district={r.district} managedBy={r.managedBy.split(' ')[0]} verified={r.verified} photoLocked onClick={() => setSelected(r.id)} />
                </div>
              ))}
              {loading && <div className="ms-empty"><div className="ms-empty-t">Loading profiles…</div></div>}
              {!loading && list.length === 0 && (
                <div className="ms-empty">
                  <div className="ms-empty-t">No profiles match these filters</div>
                  <div className="ms-empty-b">Widen the age range or clear a filter.</div>
                  <Button variant="outline" size="sm" onClick={() => { setFf(DEFAULT_FF); setQ(''); }}>Clear filters</Button>
                </div>
              )}
            </div>
            <Pagination page={safePage} pageCount={pageCount} onChange={goToPage} />
          </div>

          {sel && (
            <div className="ms-panel">
              <div className="ms-panel-head">
                <span className="ms-panel-label">Profile detail</span>
                <span className="ms-panel-close" onClick={() => setSelected(null)}>Close</span>
              </div>
              <div className="ms-panel-body">
                <div className="ms-panel-hero">
                  <div className="ms-panel-photo">
                    <PhotoSlideshow gallery={gallery} />
                  </div>
                  <div className="ms-panel-hero-info">
                    <div className="ms-panel-name-row">
                      <span className="ms-panel-name">{sel.name}</span>
                      {sel.verified && <Badge tone="gold">Verified</Badge>}
                    </div>
                    <div className="ms-panel-prn">{sel.prn}</div>
                    <div className="ms-panel-basics">{sel.age} years · {sel.height}<br />{sel.district}</div>
                    <div className="ms-panel-badges">
                      <Badge tone={sel.screened ? 'success' : 'neutral'}>{sel.screened ? 'Screening complete' : 'Screening pending'}</Badge>
                    </div>
                  </div>
                </div>

                <div className="ms-block">
                  <div className="ms-block-label">Biodata</div>
                  <div className="ms-rows">{rows.map((rw) => (<div key={rw.k} className="ms-row"><span className="ms-row-k">{rw.k}</span><span className="ms-row-v">{rw.v}</span></div>))}</div>
                </div>

                <div className="ms-block">
                  <div className="ms-mgr">
                    <Avatar initials={sel.managedBy.slice(0, 2).toUpperCase()} size={30} />
                    <div><div className="ms-mgr-name">{sel.managedBy}</div><div className="ms-mgr-meta">{sel.mgrMeta}</div></div>
                  </div>
                  <div className="ms-mgr-note">Every message and every contact detail passes through this manager.</div>
                </div>
              </div>

              <div className="ms-panel-actions">
                {!canSendInterest
                  ? <div className="ms-interest-sent">Your manager sends interest on your behalf — show them this profile.</div>
                  : !sent[sel.id]
                    ? <Button variant="primary" style={{ width: '100%' }} onClick={sendInterest}>আগ্রহ পাঠান · Send interest</Button>
                    : <div className="ms-interest-sent">Interest sent — awaiting their reply</div>}
                {canSendInterest && plan && plan.interestLimit !== null && (
                  <div className="ms-allowance">
                    {plan.interestsLeft > 0
                      ? `${plan.interestsLeft} of ${plan.interestLimit} interests left this month on your free plan.`
                      : 'Your free interests for this month are spent — the allowance resets on the 1st.'}
                    {' '}<a href="/membership">Premium sends as many as you need.</a>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {toast && (<div className="ms-toast"><span className="ms-toast-check">✓</span><span>{toast}</span></div>)}
    </div>
  );
}
