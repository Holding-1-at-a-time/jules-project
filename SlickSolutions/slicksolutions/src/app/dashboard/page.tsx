'use client';

import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Client-side dashboard entry that redirects users to a role-specific dashboard.
 *
 * When the current user becomes available, this component navigates to:
 * - /dashboard/admin if the user has the "admin" role
 * - /dashboard/detailer if the user has the "detailer" role
 * - /dashboard/client otherwise
 *
 * While the user data is loading this renders a simple "Loading..." indicator; after triggering navigation it renders null.
 *
 * Note: this component expects the fetched `user` to have a `roles` property that supports `includes` (e.g., an array of role strings).
 *
 * @returns A React element showing a loading state or `null` after initiating a redirect.
 */
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
