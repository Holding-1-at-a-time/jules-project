import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import QRCode from 'qrcode';

// Create a new tenant
export const create = mutation({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const tenantId = await ctx.db.insert('tenants', { name: args.name });
    return tenantId;
  },
});

// Get a tenant by ID
export const get = query({
  args: { id: v.id('tenants') },
  handler: async (ctx, args) => {
    const tenant = await ctx.db.get(args.id);
    return tenant;
  },
});

// Get all tenants
export const getAll = query({
  args: {},
  handler: async (ctx) => {
    const tenants = await ctx.db.query('tenants').collect();
    return tenants;
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
