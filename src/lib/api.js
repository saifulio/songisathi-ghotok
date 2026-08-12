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
  updateProfile: (token, id, patch) => request(`/profiles/${id}`, { method: 'PATCH', body: patch, token }),

  // Dashboard
  dashboardStats: (token) => request('/dashboard/stats', { token }),
  matchSuggestions: (token) => request('/match-suggestions', { token }),
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

  // Guardian / candidate self-view
  myProfile: (token) => request('/my-profile', { token }),
  myProposals: (token) => request('/my-profile/proposals', { token }),
  myActivity: (token) => request('/my-profile/activity', { token }),
  decideProposal: (token, id, patch) => request(`/my-profile/proposals/${id}`, { method: 'PATCH', body: patch, token }),
  myBiodata: (token) => request('/my-profile/biodata', { token }),
  updateMyBiodata: (token, patch) => request('/my-profile/biodata', { method: 'PATCH', body: patch, token }),
  mySearch: (token) => request('/my-search', { token }),
  myMatches: (token) => request('/my-matches', { token }),
  sendInterest: (token, targetProfileId, message) => request('/interests', { method: 'POST', body: { targetProfileId, message }, token }),

  // Email verification
  verifyEmail: (token) => request('/auth/verify-email', { method: 'POST', body: { token } }),
  resendVerification: (email) => request('/auth/resend-verification', { method: 'POST', body: { email } }),

  // Password reset
  forgotPassword: (email) => request('/auth/forgot-password', { method: 'POST', body: { email } }),
  resetPassword: (token, password) => request('/auth/reset-password', { method: 'POST', body: { token, password } }),
};
