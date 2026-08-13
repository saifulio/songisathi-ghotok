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
import Messages from './Messages/Messages.jsx';
import MyAddProfile from './MyAddProfile/MyAddProfile.jsx';
import MySearch from './MySearch/MySearch.jsx';
import MyBiodataStudio from './MyBiodataStudio/MyBiodataStudio.jsx';
import MyMatches from './MyMatches/MyMatches.jsx';
import Membership from './Membership/Membership.jsx';
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
  '/messages': <Messages />,
  '/my-add-profile': <MyAddProfile />,
  '/my-search': <MySearch />,
  '/my-biodata': <MyBiodataStudio />,
  '/my-matches': <MyMatches />,
  '/membership': <Membership />,
  '/admin': <AdminModeration />,
};

// A page may be listed in more than one nav group when it serves more than one
// audience — messages are the same page for a ghotok and for a family. The nav
// wants both entries; the router wants one route per path, allowed to whoever
// either entry allows, so the duplicates are merged here by union of roles.
const routeByPath = new Map();
for (const item of NAV_GROUPS.flatMap((g) => g.items)) {
  const seen = routeByPath.get(item.path);
  routeByPath.set(item.path, seen
    ? { ...seen, roles: seen.roles && item.roles ? [...new Set([...seen.roles, ...item.roles])] : undefined }
    : item);
}

export const ROUTES = [...routeByPath.values()].map((item) => ({ ...item, element: ELEMENTS[item.path] }));
