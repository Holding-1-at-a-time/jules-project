import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

// Create a new service
export const create = mutation({
  args: {
    tenantId: v.id('tenants'),
    name: v.string(),
    description: v.string(),
    basePrice: v.number(),
  },
  handler: async (ctx, args) => {
    const serviceId = await ctx.db.insert('services', args);
    return serviceId;
  },
});

// Get services for a tenant
export const getForTenant = query({
  args: { tenantId: v.id('tenants') },
  handler: async (ctx, args) => {
    const services = await ctx.db
      .query('services')
      .withIndex('by_tenant_id', (q) => q.eq('tenantId', args.tenantId))
      .collect();
    return services;
  },
});

// Update a service
export const update = mutation({
  args: {
    id: v.id('services'),
    tenantId: v.id('tenants'),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    basePrice: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const service = await ctx.db.get(args.id);
    if (service && service.tenantId === args.tenantId) {
      const { id, tenantId, ...rest } = args;
      await ctx.db.patch(id, rest);
    } else {
      throw new Error('Permission denied.');
    }
  },
});

// Delete a service
export const del = mutation({
  args: {
    id: v.id('services'),
    tenantId: v.id('tenants'),
  },
  handler: async (ctx, args) => {
    const service = await ctx.db.get(args.id);
    if (service && service.tenantId === args.tenantId) {
      await ctx.db.delete(args.id);
    } else {
      throw new Error('Permission denied.');
    }
  },
});
