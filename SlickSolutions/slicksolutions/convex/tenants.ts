import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { getUser, assertRole } from './auth';
import { Clerk } from '@clerk/clerk-sdk-node';
import QRCode from 'qrcode';
import { getUserAndTenant } from './utils';

/**
] * Creates a new tenant.
 * @param name The name of the tenant.
 * @returns The ID of the newly created tenant.
 */
export const create = mutation({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const tenantId = await ctx.db.insert('tenants', { name: args.name });
    return tenantId;
  },
});

/**
 * Gets a tenant by their ID.
 * @param id The ID of the tenant.
 * @returns The tenant object, or null if not found.
 */
export const get = query({
  args: { id: v.id('tenants') },
  handler: async (ctx, args) => {
\    const tenant = await ctx.db.get(args.id);
    return tenant;
  },
});

/**
 * Gets all tenants.
 * @returns A list of all tenants.
 */
export const getAll = query({
  args: {},
  handler: async (ctx) => {
    const tenants = await ctx.db.query('tenants').collect();
    return tenants;
  },
});

/**
 * Generates a QR code for a tenant's assessment page and saves it to the database.
 * @param tenantId The ID of the tenant.
 * @returns The data URL of the generated QR code.
 */
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
