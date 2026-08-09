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
export const NAV_GROUPS = [
  {
    label: 'Public',
    items: [{ path: '/', label: 'Landing page', element: <LandingPage />, end: true }],
  },
  {
    label: 'Ghotok workspace',
    items: [
      { path: '/dashboard', label: 'Dashboard', element: <GhotokDashboard /> },
      { path: '/interest-inbox', label: 'Interest inbox', element: <InterestInbox /> },
      { path: '/search', label: 'Search & profiles', element: <SearchProfile /> },
      { path: '/add-profile', label: 'Add profile · vault', element: <AddProfile /> },
      { path: '/biodata-studio', label: 'Biodata studio', element: <BiodataStudio /> },
      { path: '/ai-matching', label: 'AI matching', element: <AiMatching /> },
      { path: '/commission', label: 'Commission & closing', element: <Commission /> },
    ],
  },
  {
    label: 'Onboarding & family',
    items: [
      { path: '/onboarding', label: 'Onboarding & pricing', element: <Onboarding /> },
      { path: '/guardian', label: 'Guardian & candidate', element: <GuardianCandidate /> },
    ],
  },
  {
    label: 'Admin',
    items: [{ path: '/admin', label: 'Moderation queue', element: <AdminModeration /> }],
  },
];

export const ROUTES = NAV_GROUPS.flatMap((g) => g.items);
