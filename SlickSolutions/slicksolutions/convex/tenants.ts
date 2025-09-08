import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import QRCode from 'qrcode';

// Get a tenant by ID
export const get = query({
  args: { id: v.id('tenants') },
  handler: async (ctx, args) => {
    // This is a placeholder.
    // In a real application, you would fetch the tenant from the database.
    return {
      _id: args.id,
      name: 'Test Tenant',
    };
  },
});

// Generate a QR code for a tenant
export const generateQrCode = mutation({
  args: { tenantId: v.id('tenants') },
  handler: async (ctx, { tenantId }) => {
    const assessmentUrl = `/assessment/${tenantId}`;
    const qrCodeDataUrl = await QRCode.toDataURL(assessmentUrl);

    // Store the QR code in the database
    await ctx.db.patch(tenantId, { qrCode: qrCodeDataUrl });

    return qrCodeDataUrl;
  },
});
