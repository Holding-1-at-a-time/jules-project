import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { getUser, assertRole } from './auth';
import { Clerk } from '@clerk/clerk-sdk-node';

const clerk = new Clerk({
  secretKey: process.env.CLERK_SECRET_KEY,
});

export const createTenant = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const user = await getUser(ctx);

    const { id: orgId } = await clerk.organizations.createOrganization({
      name,
      createdBy: user.clerkId,
    });

    if (!orgId) {
      throw new Error('Failed to create organization in Clerk');
    }

    await clerk.organizations.createOrganizationMembership({
      organizationId: orgId,
      userId: user.clerkId,
      role: 'org:admin',
    });

    const tenantId = await ctx.db.insert('tenants', { name, orgId });

    await ctx.db.patch(user._id, {
      orgId,
      roles: ['admin'],
    });

    return tenantId;
  },
});

export const get = query({
  args: {},
  handler: async (ctx) => {
    const user = await getUser(ctx);
    if (!user.orgId) {
      return null;
    }
    return await ctx.db
      .query('tenants')
      .withIndex('by_org_id', (q) => q.eq('orgId', user.orgId as string))
      .unique();
  },
});
