'use client';

import QrCodeDisplay from '@/components/dashboard/QrCodeDisplay';
import ReviewList from '@/components/dashboard/ReviewList';
import AnalyticsDashboard from '@/components/dashboard/AnalyticsDashboard';
import { Id } from '@/convex/_generated/dataModel';

export default function DetailerDashboardPage() {
  // This is a placeholder for getting the tenant ID.
  // In a real app, you'd get this from the user's session or another source.
  const tenantId = 'tenant123'; // Placeholder
  const detailerId = 'detailer456' as Id<'detailers'>; // Placeholder

  // These hooks will not work without a running Convex instance and a valid tenantId.
  // const tenant = useQuery(api.tenants.get, { id: tenantId });
  // const generateQrCode = useMutation(api.tenants.generateQrCode);

  // For now, we'll use placeholder data.
  const tenant = {
    _id: 'tenant123',
    name: 'Test Tenant',
    qrCode: null,
  };
  const generateQrCode = async () => {
    alert('Generating QR code...');
  };


  const handleGenerateQrCode = () => {
    if (tenant) {
      // generateQrCode({ tenantId: tenant._id });
    }
  };

  return (
    <div>
      <h1>Detailer Dashboard</h1>
      <p>Welcome to the detailer dashboard!</p>

      <div className="mt-8">
        <AnalyticsDashboard detailerId={detailerId} />
      </div>

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
        <ReviewList detailerId={detailerId} />
      </div>
    </div>
  );
}
