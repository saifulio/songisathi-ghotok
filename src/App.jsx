import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import { ROUTES } from './pages/index.jsx';
import SignIn from './pages/Auth/SignIn.jsx';
import SignUp from './pages/Auth/SignUp.jsx';

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
      {/* Auth pages render full-screen, without the app chrome */}
      <Route path="/signin" element={<SignIn />} />
      <Route path="/signup" element={<SignUp />} />

      {/* Everything else inside the app shell */}
      <Route element={<LayoutRoute />}>
        {ROUTES.map((r) => (
          <Route key={r.path} path={r.path} element={r.element} />
        ))}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
