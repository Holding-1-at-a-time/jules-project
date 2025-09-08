import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { getUser, assertRole } from './auth';

export const createService = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    basePrice: v.number(),
  },
  handler: async (ctx, args) => {
    const name = args.name.trim();
    if (!name) throw new Error('Service name is required');
    if (args.description.length > 2_000) throw new Error('Description too long');
    if (args.basePrice < 0) throw new Error('Base price must be >= 0');
    // ...rest of handler logic
  handler: async (ctx, args) => {
    const user = await getUser(ctx);
    assertRole(ctx, user, 'admin');

    if (!user.orgId) {
      throw new Error('User does not belong to an organization');
    }

    const tenant = await ctx.db
      .query('tenants')
      .withIndex('by_org_id', (q) => q.eq('orgId', user.orgId as string))
      .unique();

    if (!tenant) {
      throw new Error('Tenant not found');
    }

    await ctx.db.insert('services', {
      tenantId: tenant._id,
      ...args,
    });
  },
});

export const getServices = query({
  args: {},
  handler: async (ctx) => {
    const user = await getUser(ctx);

    if (!user.orgId) {
      return [];
    }

    const tenant = await ctx.db
      .query('tenants')
      .withIndex('by_org_id', (q) => q.eq('orgId', user.orgId as string))
      .unique();

    if (!tenant) {
      return [];
    }

    return await ctx.db
      .query('services')
      .withIndex('by_tenant_id', (q) => q.eq('tenantId', tenant._id))
      .collect();
  },
});
