import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation } from 'react-router';

import { useAuth } from '../state/useAuth';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'checking') return <p role="status">{t('auth.checking')}</p>;
  if (status !== 'authenticated') return <Navigate to="/login" replace state={{ from: location }} />;

  return children;
}
