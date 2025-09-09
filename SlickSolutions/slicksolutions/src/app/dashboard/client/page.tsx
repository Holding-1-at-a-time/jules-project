'use client';

import { useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import Chat from './Chat';

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
