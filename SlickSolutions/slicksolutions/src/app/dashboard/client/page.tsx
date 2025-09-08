'use client';

import SubmitReviewForm from '@/components/dashboard/SubmitReviewForm';
import { Id } from '@/convex/_generated/dataModel';

export default function ClientDashboardPage() {
  // Placeholder IDs - in a real app, these would come from the user's session and the specific assessment.
  const tenantId = "123" as Id<"tenants">;
  const clientId = "456" as Id<"clients">;
  const detailerId = "789" as Id<"detailers">;
  const assessmentId = "101" as Id<"assessments">;

  return (
    <div>
      <h1>Client Dashboard</h1>
      <p>Welcome to the client dashboard!</p>

      <div className="mt-8">
        <h2 className="text-2xl font-bold">Submit a Review</h2>
        <SubmitReviewForm
          tenantId={tenantId}
          clientId={clientId}
          detailerId={detailerId}
          assessmentId={assessmentId}
        />
      </div>
    </div>
  );
}
