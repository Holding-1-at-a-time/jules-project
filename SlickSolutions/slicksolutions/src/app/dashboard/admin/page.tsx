'use client';

import ThemeCustomizer from '@/components/dashboard/ThemeCustomizer';
import { Id } from '@/convex/_generated/dataModel';

export default function AdminDashboardPage() {
    // Placeholder ID - in a real app, this would come from the user's session
    const tenantId = "123" as Id<"tenants">;

    return (
        <div>
        <h1>Admin Dashboard</h1>
        <p>Welcome to the admin dashboard!</p>

        <div className="mt-8">
            <ThemeCustomizer tenantId={tenantId} />
        </div>
        </div>
    );
}
