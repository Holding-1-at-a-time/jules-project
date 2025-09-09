import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { getUserAndTenant } from './utils';

/**
 * Creates a new assessment.
 * @param tenantId The ID of the tenant.
 * @param clientId The ID of the client.
 * @param vehicleInfo Information about the vehicle.
 * @param selectedServices An array of selected service IDs.
 * @param notes Optional notes for the assessment.
 * @returns The ID of the newly created assessment.
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
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const assessmentId = await ctx.db.insert('assessments', {
      ...args,
      status: 'pending',
    });
    return assessmentId;
  },
});

/**
 * Gets all assessments for a specific tenant.
 * @param tenantId The ID of the tenant.
 * @returns A list of assessments for the tenant.
 */
export const getForTenant = query({
  args: { tenantId: v.id('tenants') },
  handler: async (ctx, args) => {
    const assessments = await ctx.db
      .query('assessments')
      .withIndex('by_tenant_id', (q) => q.eq('tenantId', args.tenantId))
      .collect();
    return assessments;
  },
});

/**
 * Gets all assessments for a specific client.
 * @param clientId The ID of the client.
 * @returns A list of assessments for the client.
 */
export const getForClient = query({
  args: { clientId: v.id('clients') },
  handler: async (ctx, args) => {
    const assessments = await ctx.db
      .query('assessments')
      .withIndex('by_client_id', (q) => q.eq('clientId', args.clientId))
      .collect();
    return assessments;
  },
});
