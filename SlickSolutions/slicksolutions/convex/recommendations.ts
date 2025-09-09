import { mutation } from './_generated/server';
import { v } from 'convex/values';

/**
 * Creates a new recommendation for a tenant.
 * @param tenantId The ID of the tenant.
 * @param content The content of the recommendation.
 */
export const create = mutation({
  args: {
    tenantId: v.id('tenants'),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('recommendations', {
      ...args,
      createdAt: Date.now(),
    });
  },
});
