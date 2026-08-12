// Wires the pure nav registry (src/nav.js) to actual page components,
// producing the router's route list. The landing page is routed separately
// (see App.jsx) since it has its own marketing header instead of the app
// shell's nav — it isn't listed here.
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
import { NAV_GROUPS } from '../nav.js';

const ELEMENTS = {
  '/dashboard': <GhotokDashboard />,
  '/interest-inbox': <InterestInbox />,
  '/search': <SearchProfile />,
  '/add-profile': <AddProfile />,
  '/biodata-studio': <BiodataStudio />,
  '/ai-matching': <AiMatching />,
  '/commission': <Commission />,
  '/onboarding': <Onboarding />,
  '/guardian': <GuardianCandidate />,
  '/admin': <AdminModeration />,
};

export const ROUTES = NAV_GROUPS.flatMap((g) => g.items).map((item) => ({ ...item, element: ELEMENTS[item.path] }));
