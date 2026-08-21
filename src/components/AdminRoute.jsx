import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import Skeleton from './Skeleton.jsx';

const ADMIN_EMAIL = 'drewnegron95@gmail.com';

export default function AdminRoute({ children }) {
  const { isLoggedIn, user, loading } = useAuth();

  if (loading) {
    return (
      <section className="page-section">
        <Skeleton variant="page" />
      </section>
    );
  }

  if (!isLoggedIn) {
    return <Navigate to="/login" replace state={{ from: '/admin' }} />;
  }

  const email = user?.email?.toLowerCase() || '';
  if (email !== ADMIN_EMAIL) {
    return (
      <section className="page-section">
        <p className="empty-state error-state">Access denied. Admin only.</p>
      </section>
    );
  }

  return children;
}
