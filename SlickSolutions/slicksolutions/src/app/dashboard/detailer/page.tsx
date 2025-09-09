'use client';

import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import QrCodeDisplay from '@/components/dashboard/QrCodeDisplay';
import Reports from './Reports';

/**
 * Detailer dashboard page component.
 *
 * Renders the Detailer Dashboard UI, loads the current user and their tenant via Convex queries,
 * and exposes a control to generate a tenant QR code via a Convex mutation.
 *
 * Behavior:
 * - Queries the current user (api.users.me) and, when available, loads the tenant (api.tenants.get).
 * - Displays a QR code using QrCodeDisplay when tenant data is present.
 * - When the tenant exists but has no `qrCode`, shows a "Generate QR Code" button that calls
 *   the generateQrCode mutation with the tenant's `_id`.
 * - Shows a loading message while tenant data is not yet available.
 *
 * @returns The dashboard page's JSX element.
 */
export default function DetailerDashboardPage() {
  const user = useQuery(api.users.me);
  const tenant = useQuery(api.tenants.get, user ? { id: user.tenantId! } : 'skip');
  const generateQrCode = useMutation(api.tenants.generateQrCode);

  const handleGenerateQrCode = () => {
    if (tenant) {
      generateQrCode({ tenantId: tenant._id });
    }
  };

  return (
    <div>
      <h1>Detailer Dashboard</h1>
      <p>Welcome to the detailer dashboard!</p>

      <div className="mt-8">
        <h2 className="text-2xl font-bold">QR Code</h2>
        {tenant ? (
          <div>
            <QrCodeDisplay qrCodeUrl={tenant.qrCode} />
            {!tenant.qrCode && (
              <button
                onClick={handleGenerateQrCode}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md"
              >
                Generate QR Code
              </button>
            )}
          </div>
        ) : (
          <p>Loading tenant data...</p>
        )}
      </div>

      <div className="mt-8">
        <Reports />
      </div>
    </div>
  );
}
