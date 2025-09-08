import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { getUserAndTenant } from './utils';

/**
 * Create a new assessment.
 * This mutation is protected and will only create an assessment for the tenant that the user is a member of.
 */
export const create = mutation({
  args: {
    clientId: v.id('users'),
    vehicleInfo: v.object({
      vin: v.string(),
      make: v.string(),
      model: v.string(),
      year: v.number(),
    }),
    selectedServices: v.array(v.id('services')),
  },
  handler: async (ctx, args) => {
    const user = await getUser(ctx);
    assertRole(ctx, user, 'client');

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

    await ctx.db.insert('assessments', {
      tenantId: tenant._id,
      ...args,
    });
  },
});

export const getAssessments = query({
  args: {},
  handler: async (ctx) => {
    const user = await getUser(ctx);
    assertRole(ctx, user, 'detailer');

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
      .query('assessments')
      .withIndex('by_tenant_id', (q) => q.eq('tenantId', tenant._id))
      .collect();
  },
});
