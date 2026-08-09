// Central registry of pages -> routes. Drives both the router and the nav.
import LandingPage from './LandingPage/LandingPage.jsx';
import AiMatching from './AiMatching/AiMatching.jsx';
import GhotokDashboard from './GhotokDashboard/GhotokDashboard.jsx';
import InterestInbox from './InterestInbox/InterestInbox.jsx';
import SearchProfile from './SearchProfile/SearchProfile.jsx';
import AddProfile from './AddProfile/AddProfile.jsx';
import BiodataStudio from './BiodataStudio/BiodataStudio.jsx';
import Onboarding from './Onboarding/Onboarding.jsx';
import GuardianCandidate from './GuardianCandidate/GuardianCandidate.jsx';
import Commission from './Commission/Commission.jsx';
import AdminModeration from './AdminModeration/AdminModeration.jsx';

// Grouped for the sidebar. `end` marks exact-match routes (the index route).
//
// Access per item:
//   public: true  → anyone, signed in or not (marketing pages).
//   roles: [...]  → must be signed in AND hold one of these roles.
//   (neither)     → must be signed in, any role.
// The router enforces this via ProtectedRoute; the nav hides what a user
// can't reach (see Layout).
export const NAV_GROUPS = [
  {
    label: 'Public',
    items: [{ path: '/', label: 'Landing page', element: <LandingPage />, end: true, public: true }],
  },
  {
    label: 'Ghotok workspace',
    items: [
      { path: '/dashboard', label: 'Dashboard', element: <GhotokDashboard />, roles: ['GHOTOK'] },
      { path: '/interest-inbox', label: 'Interest inbox', element: <InterestInbox />, roles: ['GHOTOK'] },
      { path: '/search', label: 'Search & profiles', element: <SearchProfile />, roles: ['GHOTOK'] },
      { path: '/add-profile', label: 'Add profile · vault', element: <AddProfile />, roles: ['GHOTOK'] },
      { path: '/biodata-studio', label: 'Biodata studio', element: <BiodataStudio />, roles: ['GHOTOK'] },
      { path: '/ai-matching', label: 'AI matching', element: <AiMatching />, roles: ['GHOTOK'] },
      { path: '/commission', label: 'Commission & closing', element: <Commission />, roles: ['GHOTOK'] },
    ],
  },
  {
    label: 'Onboarding & family',
    items: [
      { path: '/onboarding', label: 'Onboarding & pricing', element: <Onboarding />, public: true },
      { path: '/guardian', label: 'Guardian & candidate', element: <GuardianCandidate />, roles: ['GUARDIAN', 'CANDIDATE'] },
    ],
  },
  {
    label: 'Admin',
    items: [{ path: '/admin', label: 'Moderation queue', element: <AdminModeration />, roles: ['ADMIN'] }],
  },
];

export const ROUTES = NAV_GROUPS.flatMap((g) => g.items);
