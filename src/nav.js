// Pure nav/route metadata — path, label, and access rules only, no component
// references. Kept separate from pages/index.jsx (which wires in the actual
// page components) so pages can read the nav registry without creating a
// circular import back through pages/index.jsx.
//
// Access per item:
//   public: true  → anyone, signed in or not (marketing pages).
//   roles: [...]  → must be signed in AND hold one of these roles.
//   (neither)     → must be signed in, any role.
// The router enforces this via ProtectedRoute; the nav hides what a user
// can't reach (see Layout).
export const NAV_GROUPS = [
  {
    label: 'Ghotok workspace',
    items: [
      { path: '/dashboard', label: 'Dashboard', roles: ['GHOTOK'] },
      { path: '/interest-inbox', label: 'Interest inbox', roles: ['GHOTOK'] },
      { path: '/messages', label: 'Messages', roles: ['GHOTOK'] },
      { path: '/search', label: 'Search & profiles', roles: ['GHOTOK'] },
      { path: '/add-profile', label: 'Add profile · vault', roles: ['GHOTOK'] },
      { path: '/biodata-studio', label: 'Biodata studio', roles: ['GHOTOK'] },
      { path: '/ai-matching', label: 'AI matching', roles: ['GHOTOK'] },
      { path: '/commission', label: 'Commission & closing', roles: ['GHOTOK'] },
    ],
  },
  {
    label: 'Onboarding & family',
    items: [
      { path: '/onboarding', label: 'Onboarding & pricing', public: true },
      { path: '/guardian', label: 'Guardian & candidate', roles: ['GUARDIAN', 'CANDIDATE'] },
      // A guardian matchmakes for their own family — up to five profiles, one
      // per person. A candidate's single profile is created at signup, so the
      // page has nothing to offer them.
      { path: '/my-add-profile', label: 'Add a profile', roles: ['GUARDIAN'] },
      // Every candidate can look: browse the pool, read their own profile, and
      // see their scored matches, whether their biodata is self-managed or run
      // by a ghotok or guardian. Acting on what they see is the part that stays
      // with the manager — a managed candidate gets all three read-only (the
      // server decides, via canSendInterest / canEdit; the pages render to
      // match, so nothing is offered that the server would refuse).
      { path: '/my-search', label: 'Search & profiles', roles: ['GUARDIAN', 'CANDIDATE'] },
      { path: '/my-biodata', label: 'Biodata studio', roles: ['GUARDIAN', 'CANDIDATE'] },
      { path: '/my-matches', label: 'AI matching', roles: ['GUARDIAN', 'CANDIDATE'] },
      // The same page as the ghotok's Messages above: both sides of a match
      // are managers, and they are talking to each other. Listed in both
      // groups so each audience finds it where they already look; the router
      // merges the two entries into one route (see pages/index.jsx).
      { path: '/messages', label: 'Messages', roles: ['GUARDIAN', 'CANDIDATE'] },
    ],
  },
  {
    label: 'Admin',
    items: [{ path: '/admin', label: 'Moderation queue', roles: ['ADMIN'] }],
  },
];
