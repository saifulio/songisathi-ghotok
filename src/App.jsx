import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import { ROUTES } from './pages/index.jsx';
import { ProtectedRoute, PublicOnlyRoute } from './components/RouteGuards.jsx';
import SignIn from './pages/Auth/SignIn.jsx';
import SignUp from './pages/Auth/SignUp.jsx';
import LandingPage from './pages/LandingPage/LandingPage.jsx';

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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
