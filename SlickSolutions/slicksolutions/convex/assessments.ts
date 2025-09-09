import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { api } from './_generated/api';

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
  },
  handler: async (ctx, args) => {
    // This is a placeholder.
    // In a real application, you would create a new assessment in the database.
    console.log('Creating assessment with args:', args);
    return {
      _id: 'assessment1',
      ...args,
    };
  },
});

export const getForClient = query({
  args: {
    clientId: v.id('clients'),
    tenantId: v.id('tenants'),
  },
  handler: async (ctx, { clientId, tenantId }) => {
    return await ctx.db
      .query('assessments')
      .withIndex('by_tenant_id', (q) => q.eq('tenantId', tenantId))
      .filter((q) => q.eq(q.field('clientId'), clientId))
      .collect();
  },
});
