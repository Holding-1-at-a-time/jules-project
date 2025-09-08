import { mutation } from './_generated/server';
import { v } from 'convex/values';
import { getUserAndTenant } from './utils';

/**
 * Create a new assessment.
 * This mutation is protected and will only create an assessment for the tenant that the user is a member of.
 */
export const create = mutation({
  args: {
    tenantId: v.id('tenants'),
    clientId: v.id('clients'),
    vehicleInfo: v.object({
      vin: v.string(),
      make: v.string(),
      model: v.string(),
      year: v.number(),
    }),
    selectedServices: v.array(v.id('services')),
  },
  handler: async (ctx, args) => {
    const { user } = await getUserAndTenant(ctx, {});

    if (user.tenantId !== args.tenantId) {
      throw new Error('Not authorized to create an assessment for this tenant');
    }

    return await ctx.db.insert('assessments', args);
  },
});
