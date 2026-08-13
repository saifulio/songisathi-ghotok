// The profiles a guardian / candidate account holds, and which one the member
// pages are currently acting for.
//
// A candidate has exactly one and never sees a choice. A guardian holds up to
// five — a daughter, a nephew — and every member page reads the active one
// from here, so switching in one place moves proposals, search, matches, and
// the biodata studio together. The choice is remembered per user, so a reload
// lands back on the same family member.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext.jsx';
import { api } from '../lib/api.js';

const MyProfilesContext = createContext(null);
const storageKey = (userId) => `songisathi.activeProfile.${userId}`;

const isMember = (user) => user?.role === 'GUARDIAN' || user?.role === 'CANDIDATE';

function readStored(userId) {
  try {
    return Number(localStorage.getItem(storageKey(userId))) || null;
  } catch {
    return null;
  }
}

export function MyProfilesProvider({ children }) {
  const { user, token } = useAuth();
  const member = isMember(user);
  const [profiles, setProfiles] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [limit, setLimit] = useState(1);
  const [canAdd, setCanAdd] = useState(false);
  const [loading, setLoading] = useState(member);

  const load = useCallback(async () => {
    if (!member || !token) {
      setProfiles([]);
      setActiveId(null);
      setCanAdd(false);
      setLoading(false);
      return [];
    }
    setLoading(true);
    try {
      const data = await api.myProfiles(token);
      const list = data.profiles || [];
      setProfiles(list);
      setLimit(data.limit || 1);
      setCanAdd(Boolean(data.canAdd));
      // Keep the remembered profile if it is still one of theirs; otherwise
      // fall back to the first, which is what the API itself would pick.
      const stored = readStored(user.id);
      setActiveId(list.some((p) => p.id === stored) ? stored : list[0]?.id ?? null);
      return list;
    } finally {
      setLoading(false);
    }
  }, [member, token, user?.id]);

  useEffect(() => { load().catch(() => { /* the pages report their own errors */ }); }, [load]);

  const setActive = useCallback((id) => {
    setActiveId(id);
    try {
      if (id) localStorage.setItem(storageKey(user?.id), String(id));
    } catch {
      /* a full or blocked localStorage only costs us the memory of the choice */
    }
  }, [user?.id]);

  const value = useMemo(() => ({
    profiles,
    activeId,
    activeProfile: profiles.find((p) => p.id === activeId) || null,
    setActive,
    limit,
    canAdd,
    loading,
    reload: load,
  }), [profiles, activeId, setActive, limit, canAdd, loading, load]);

  return <MyProfilesContext.Provider value={value}>{children}</MyProfilesContext.Provider>;
}

export function useMyProfiles() {
  const ctx = useContext(MyProfilesContext);
  if (!ctx) throw new Error('useMyProfiles must be used within MyProfilesProvider');
  return ctx;
}
