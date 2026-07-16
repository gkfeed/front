import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '../state/useAuth';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'checking') return <p role="status">Checking authentication…</p>;
  if (status !== 'authenticated') return <Navigate to="/login" replace state={{ from: location }} />;

  return children;
}
