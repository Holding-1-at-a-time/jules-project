import { query } from './_generated/server';
import { v } from 'convex/values';

export const me = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();
    return user;
  },
});

export const getDetailer = query({
    args: { userId: v.id('users') },
    handler: async (ctx, { userId }) => {
        return await ctx.db
            .query('detailers')
            .withIndex('by_user_id', q => q.eq('userId', userId))
            .first();
    },
});

export const getDetailersByTenant = query({
    args: { tenantId: v.id('tenants') },
    handler: async (ctx, { tenantId }) => {
        return await ctx.db
            .query('detailers')
            .withIndex('by_tenant_id', q => q.eq('tenantId', tenantId))
            .collect();
    },
});

export const getClient = query({
    args: { userId: v.id('users') },
    handler: async (ctx, { userId }) => {
        return await ctx.db
            .query('clients')
            .withIndex('by_user_id', q => q.eq('userId', userId))
            .first();
    },
});
