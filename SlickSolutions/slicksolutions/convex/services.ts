import { query, internalQuery } from './_generated/server';
import { v } from 'convex/values';

// Get services for a tenant
export const getForTenant = query({
  args: { tenantId: v.id('tenants') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('services')
      .withIndex('by_tenant_id', (q) => q.eq('tenantId', args.tenantId))
      .collect();
  },
});

// Get a specific service by ID
export const getService = internalQuery({
    args: { id: v.id('services') },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.id);
    },
});

export const get = query({
    args: { id: v.id('services') },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.id);
    },
});
