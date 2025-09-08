import { query } from './_generated/server';
import { v } from 'convex/values';

// Get services for a tenant
export const getForTenant = query({
  args: { tenantId: v.id('tenants') },
  handler: async (ctx, args) => {
    // This is a placeholder.
    // In a real application, you would fetch the services from the database.
    return [
      {
        _id: 'service1',
        tenantId: args.tenantId,
        name: 'Basic Wash',
        description: 'A basic exterior wash.',
        basePrice: 25,
      },
      {
        _id: 'service2',
        tenantId: args.tenantId,
        name: 'Full Detail',
        description: 'A complete interior and exterior detail.',
        basePrice: 150,
      },
    ];
  },
});
