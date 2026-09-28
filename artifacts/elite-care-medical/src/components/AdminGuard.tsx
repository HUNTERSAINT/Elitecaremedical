import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAdminAuth } from '@/context/AdminAuthContext';

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAdminAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isAuthenticated) {
      setLocation('/admin');
    }
  }, [isAuthenticated, setLocation]);

  if (!isAuthenticated) return null;
  return <>{children}</>;
}
