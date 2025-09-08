import { query } from './_generated/server';
import { v } from 'convex/values';
import { getUserAndTenant } from './utils';

/**
 * Get services for a tenant.
 * This query is protected and will only return services for the tenant that the user is a member of.
 */
export const getForTenant = query({
  args: { tenantId: v.id('tenants') },
  handler: async (ctx, args) => {
    const { user } = await getUserAndTenant(ctx, {});

    if (user.tenantId !== args.tenantId) {
      throw new Error('Not authorized to view services for this tenant');
    }

    return await ctx.db
      .query('services')
      .withIndex('by_tenant_id', (q) => q.eq('tenantId', args.tenantId))
      .collect();
  },
});
