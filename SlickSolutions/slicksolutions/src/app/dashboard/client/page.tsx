'use client';

import { useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import Chat from './Chat';

/**
 * Client-side React page that displays the dashboard for the currently authenticated client.
 *
 * Fetches the current user and then loads the corresponding client record. While either query
 * is pending it renders a loading message; if the resolved client lacks an id or tenantId it
 * renders an error message. When data is available it renders a header and the Chat component
 * with the resolved `clientId` and `tenantId`.
 *
 * @returns The dashboard UI as JSX containing the client Chat when data is available, or a
 * loading/error message otherwise.
 */
export default function ClientDashboardPage() {
  const user = useQuery(api.users.me);
  const client = useQuery(api.clients.getByUserId, user ? { userId: user._id } : 'skip');

  if (!user || !client) {
    return <div>Loading...</div>;
  }

  const { _id: clientId, tenantId } = client;

  if (!clientId || !tenantId) {
    return <div>Error: Client or Tenant not found.</div>;
  }

  return (
    <div>
      <h1>Client Dashboard</h1>
      <Chat clientId={clientId} tenantId={tenantId} />
    </div>
  );
}
