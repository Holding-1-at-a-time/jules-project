import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import QRCode from 'qrcode';

/**
 * Creates a new tenant.
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
    const tenant = await ctx.db.get(args.id);
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
    const assessmentUrl = `/assessment/${tenantId}`;
    const qrCodeDataUrl = await QRCode.toDataURL(assessmentUrl);

    // Store the QR code in the database
    await ctx.db.patch(tenantId, { qrCode: qrCodeDataUrl });

    return qrCodeDataUrl;
  },
});
