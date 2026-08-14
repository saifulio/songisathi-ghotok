import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import { ROUTES } from './pages/index.jsx';
import { ProtectedRoute, PublicOnlyRoute } from './components/RouteGuards.jsx';
import SignIn from './pages/Auth/SignIn.jsx';
import SignUp from './pages/Auth/SignUp.jsx';
import LandingPage from './pages/LandingPage/LandingPage.jsx';
import ProfileDetails from './pages/ProfileDetails/ProfileDetails.jsx';

function LayoutRoute() {
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}

export default function App() {
  return (
    <Routes>
      {/* Auth pages render full-screen, without the app chrome.
          Already-signed-in users are bounced to their home. */}
      <Route path="/signin" element={<PublicOnlyRoute><SignIn /></PublicOnlyRoute>} />
      <Route path="/signup" element={<PublicOnlyRoute><SignUp /></PublicOnlyRoute>} />

      {/* Landing page has its own marketing header, so it also skips the app shell. */}
      <Route path="/" element={<LandingPage />} />

      {/* Everything else inside the app shell. Public pages render as-is;
          the rest are gated on auth and (where set) the user's role. */}
      <Route element={<LayoutRoute />}>
        {ROUTES.map((r) => (
          <Route
            key={r.path}
            path={r.path}
            element={r.public ? r.element : <ProtectedRoute roles={r.roles}>{r.element}</ProtectedRoute>}
          />
        ))}
        {/* One profile in full. Reached from a search result rather than from
            the nav — it is about a particular profile, so it takes an id and
            has no menu entry of its own (hence not in nav.js). Open to every
            manager; which profiles each may actually read is the server's
            call (GET /profiles/:id/detail). */}
        <Route
          path="/profile/:id"
          element={<ProtectedRoute roles={['GHOTOK', 'GUARDIAN', 'CANDIDATE']}><ProfileDetails /></ProtectedRoute>}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
