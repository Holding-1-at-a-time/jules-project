import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

// Create a new assessment
export const create = mutation({
  args: {
    tenantId: v.id('tenants'),
    clientId: v.id('clients'),
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

// Get assessments for a tenant
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

// Get assessments for a client
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
