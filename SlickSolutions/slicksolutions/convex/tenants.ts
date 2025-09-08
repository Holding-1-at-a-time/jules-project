import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
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
    }

    const assessmentUrl = `/assessment/${tenantId}`;
    const qrCodeDataUrl = await QRCode.toDataURL(assessmentUrl);

    // Store the QR code in the database
    await ctx.db.patch(tenantId, { qrCode: qrCodeDataUrl });

    return qrCodeDataUrl;
  },
});
