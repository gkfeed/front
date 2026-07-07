import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '../state/AuthContext';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { credentials } = useAuth();
  const location = useLocation();

  if (!credentials) return <Navigate to="/login" replace state={{ from: location }} />;

  return children;
}
