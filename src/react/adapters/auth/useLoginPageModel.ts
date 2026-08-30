import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { useLoginForm } from '../../hooks/useLoginForm';
import { getRedirectTarget } from '../../state/routes';
import { useAuth } from '../../state/useAuth';

export function useLoginPageModel() {
  const { credentials, status, authenticate, clearCredentials } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const redirectTo = getRedirectTarget(location.state);
  const onAuthenticated = useCallback(() => {
    navigate(redirectTo, { replace: true });
  }, [navigate, redirectTo]);
  const loginForm = useLoginForm({ authenticate, onAuthenticated });

  return {
    status,
    savedUsername: credentials?.username ?? '',
    clearCredentials,
    loginForm,
  };
}
