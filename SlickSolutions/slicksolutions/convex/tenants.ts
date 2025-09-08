import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { getUser, assertRole } from './auth';
import { Clerk } from '@clerk/clerk-sdk-node';
import QRCode from 'qrcode';
import { getUserAndTenant } from './utils';

/**
 * Get a tenant by ID.
 * This query is protected and will only return the tenant if the user is a member of it.
 */
export const get = query({
  args: { id: v.id('tenants') },
  handler: async (ctx, args) => {
    const { user } = await getUserAndTenant(ctx, {});

    if (user.tenantId !== args.id) {
      throw new Error('Not authorized to view this tenant');
    }

    return await ctx.db.get(args.id);
  },
});

/**
 * Generate a QR code for a tenant.
 * This mutation is protected and will only generate a QR code if the user is a member of the tenant.
 */
export const generateQrCode = mutation({
  args: { tenantId: v.id('tenants') },
  handler: async (ctx, { tenantId }) => {
    const { user } = await getUserAndTenant(ctx, {});

    if (user.tenantId !== tenantId) {
      throw new Error('Not authorized to generate QR code for this tenant');

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
