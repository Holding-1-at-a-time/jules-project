import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { getUser, assertRole } from './auth';
import { Clerk } from '@clerk/clerk-sdk-node';
import QRCode from 'qrcode';

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
      roles: [...user.roles, 'admin'],
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

export const generateQrCode = mutation({
  args: { tenantId: v.id('tenants') },
  handler: async (ctx, { tenantId }) => {
    const user = await getUser(ctx);
    assertRole(ctx, user, 'admin');

    const tenant = await ctx.db.get(tenantId);
    if (!tenant || tenant.orgId !== user.orgId) {
      throw new Error('Tenant not found or access denied');
    }

    const assessmentUrl = `/assessment/${tenantId}`;
    const qrCodeDataUrl = await QRCode.toDataURL(assessmentUrl);

    await ctx.db.patch(tenantId, { qrCode: qrCodeDataUrl });

    return qrCodeDataUrl;
  },
});
