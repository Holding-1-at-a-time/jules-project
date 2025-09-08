'use client';

import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function DashboardPage() {
  const user = useQuery(api.users.me);
  const router = useRouter();

  useEffect(() => {
    if (user) {
      if (user.roles.includes('admin')) {
        router.push('/dashboard/admin');
      } else if (user.roles.includes('detailer')) {
        router.push('/dashboard/detailer');
      } else {
        router.push('/dashboard/client');
      }
    }
  }, [user, router]);

  if (!user) {
    return <div>Loading...</div>;
  }

  return null;
}
