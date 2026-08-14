// Tiny fetch wrapper for the SongiSathi auth API (proxied at /api by Vite).

async function request(path, { method = 'GET', body, token } = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    // fetch() itself threw — the API server can't be reached at all.
    throw new Error("We can't reach the server right now. Check your connection and try again.");
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    /* no body, or not JSON */
  }
  if (!res.ok) {
    const friendly = res.status >= 500
      ? 'Something went wrong on our end. Please try again in a moment.'
      : 'Something went wrong with that request. Please try again.';
    throw new Error((data && data.error) || friendly);
  }
  return data;
}

// A guardian holds several profiles, so every guardian/candidate read names
// the one it is about. Left off, the API falls back to the first profile.
const forProfile = (path, profileId) => (profileId ? `${path}?profileId=${profileId}` : path);

export const api = {
  signup: (payload) => request('/auth/signup', { method: 'POST', body: payload }),
  signin: (payload) => request('/auth/signin', { method: 'POST', body: payload }),
  me: (token) => request('/auth/me', { token }),

  // Profiles
  screeningQuestions: (token) => request('/screening-questions', { token }),
  createProfile: (token, payload) => request('/profiles', { method: 'POST', body: payload, token }),
  profiles: (token) => request('/profiles', { token }),
  searchProfiles: (token) => request('/profiles/search', { token }),
  profileDetail: (token, id) => request(`/profiles/${id}`, { token }),
  // Everything one profile holds, for the detail page — readable from either
  // chair, unlike profileDetail above, which is a ghotok reading their book.
  profileFull: (token, id) => request(`/profiles/${id}/detail`, { token }),
  updateProfile: (token, id, patch) => request(`/profiles/${id}`, { method: 'PATCH', body: patch, token }),

  // Dashboard
  dashboardStats: (token) => request('/dashboard/stats', { token }),
  matchSuggestions: (token) => request('/match-suggestions', { token }),
  runMatchSuggestions: (token) => request('/match-suggestions/run', { method: 'POST', token }),
  updateSuggestion: (token, id, patch) => request(`/match-suggestions/${id}`, { method: 'PATCH', body: patch, token }),

  // Interest inbox
  interests: (token) => request('/interests', { token }),
  updateInterest: (token, id, patch) => request(`/interests/${id}`, { method: 'PATCH', body: patch, token }),

  // Commission
  marriages: (token) => request('/marriages', { token }),
  closablePairs: (token) => request('/marriages/closable-pairs', { token }),
  recordMarriage: (token, payload) => request('/marriages', { method: 'POST', body: payload, token }),
  testimonials: (token) => request('/testimonials', { token }),

  // Admin moderation
  adminVerifications: (token) => request('/admin/verifications', { token }),
  updateVerification: (token, id, patch) => request(`/admin/verifications/${id}`, { method: 'PATCH', body: patch, token }),
  adminReports: (token) => request('/admin/reports', { token }),
  updateReport: (token, id, patch) => request(`/admin/reports/${id}`, { method: 'PATCH', body: patch, token }),
  adminPayments: (token) => request('/admin/payments', { token }),
  updatePayment: (token, id, patch) => request(`/admin/payments/${id}`, { method: 'PATCH', body: patch, token }),

  // Guardian / candidate self-view — profileId picks which profile a guardian
  // is acting for (see forProfile above).
  myProfiles: (token) => request('/my-profiles', { token }),
  createMyProfile: (token, payload) => request('/my-profiles', { method: 'POST', body: payload, token }),
  myProfile: (token, profileId) => request(forProfile('/my-profile', profileId), { token }),
  myProposals: (token, profileId) => request(forProfile('/my-profile/proposals', profileId), { token }),
  myActivity: (token, profileId) => request(forProfile('/my-profile/activity', profileId), { token }),
  decideProposal: (token, id, patch, profileId) => request(`/my-profile/proposals/${id}`, { method: 'PATCH', body: { ...patch, profileId }, token }),
  myBiodata: (token, profileId) => request(forProfile('/my-profile/biodata', profileId), { token }),
  updateMyBiodata: (token, patch, profileId) => request('/my-profile/biodata', { method: 'PATCH', body: { ...patch, profileId }, token }),
  mySearch: (token, profileId) => request(forProfile('/my-search', profileId), { token }),
  myMatches: (token, profileId) => request(forProfile('/my-matches', profileId), { token }),
  // Sent by whoever manages the profile being put forward: a member names it
  // with profileId (or lets the server take their first), a ghotok names one
  // of their book with fromProfileId.
  sendInterest: (token, payload) => request('/interests', { method: 'POST', body: payload, token }),

  // Hiring a matchmaker — the family searches the directory and asks one to
  // take their profile on; the ghotok answers from their own inbox.
  ghotokDirectory: (token, { profileId, district, q } = {}) => {
    const p = new URLSearchParams();
    if (profileId) p.set('profileId', profileId);
    if (district) p.set('district', district);
    if (q) p.set('q', q);
    const qs = p.toString();
    return request(qs ? `/ghotoks?${qs}` : '/ghotoks', { token });
  },
  myGhotokRequests: (token, profileId) => request(forProfile('/ghotok-requests', profileId), { token }),
  requestGhotok: (token, payload) => request('/ghotok-requests', { method: 'POST', body: payload, token }),
  withdrawGhotokRequest: (token, id, profileId) => request(`/ghotok-requests/${id}`, { method: 'DELETE', body: { profileId }, token }),
  ghotokRequestInbox: (token) => request('/ghotok-requests/inbox', { token }),
  decideGhotokRequest: (token, id, patch) => request(`/ghotok-requests/${id}`, { method: 'PATCH', body: patch, token }),

  // Membership — the family side of billing. The plan lives on the account,
  // not on a profile, so none of these name one.
  plans: (token, audience) => request(audience ? `/plans?audience=${audience}` : '/plans', { token }),
  myPlan: (token) => request('/my-plan', { token }),
  submitMyPlanPayment: (token, payload) => request('/my-plan/payments', { method: 'POST', body: payload, token }),

  // Manager-to-manager messages
  conversations: (token) => request('/conversations', { token }),
  conversation: (token, id) => request(`/conversations/${id}`, { token }),
  sendMessage: (token, id, body) => request(`/conversations/${id}/messages`, { method: 'POST', body: { body }, token }),

  // The photo gallery. A manager's own gallery is /my-gallery — a ghotok
  // names the profile in the query string, a family's comes from the
  // switcher, the same way every other member read works. Another family's
  // gallery is read by profile id and may come back locked.
  myGallery: (token, profileId) => request(forProfile('/my-gallery', profileId), { token }),
  uploadPhoto: (token, image, profileId) => request('/my-gallery', { method: 'POST', body: { image, profileId }, token }),
  setGalleryLock: (token, photoLocked, profileId) => request('/my-gallery', { method: 'PATCH', body: { photoLocked, profileId }, token }),
  deletePhoto: (token, photoId, profileId) => request(`/my-gallery/${photoId}`, { method: 'DELETE', body: { profileId }, token }),
  profileGallery: (token, profileId) => request(`/profiles/${profileId}/gallery`, { token }),
  adminPhotos: (token) => request('/admin/photos', { token }),
  decidePhoto: (token, id, patch) => request(`/admin/photos/${id}`, { method: 'PATCH', body: patch, token }),

  // Email verification
  verifyEmail: (token) => request('/auth/verify-email', { method: 'POST', body: { token } }),
  resendVerification: (email) => request('/auth/resend-verification', { method: 'POST', body: { email } }),

  // Password reset
  forgotPassword: (email) => request('/auth/forgot-password', { method: 'POST', body: { email } }),
  resetPassword: (token, password) => request('/auth/reset-password', { method: 'POST', body: { token, password } }),
};
