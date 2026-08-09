// Route guards that tie the router to the signed-in user's role.
//
// ProtectedRoute  — gate an app route behind auth + (optionally) a role list.
//                   Logged-out users are bounced to /signin (remembering where
//                   they were headed); a signed-in user on a page their role
//                   can't see is sent to their own home (see homeForRole).
// PublicOnlyRoute — keep already-authenticated users off /signin and /signup.
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, homeForRole } from '../context/AuthContext.jsx';

export function ProtectedRoute({ roles, children }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    // Remember the target so sign-in can return the user to it.
    return <Navigate to="/signin" replace state={{ from: location.pathname }} />;
  }
  if (roles && !roles.includes(user.role)) {
    // Signed in, but this page isn't for their role — send them home.
    return <Navigate to={homeForRole(user)} replace />;
  }
  return children;
}

export function PublicOnlyRoute({ children }) {
  const { user } = useAuth();
  if (user) return <Navigate to={homeForRole(user)} replace />;
  return children;
}
