import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { getUser, assertRole } from './auth';

/**
 * Creates a new service for a tenant.
 * @param tenantId The ID of the tenant.
 * @param name The name of the service.
 * @param description The description of the service.
 * @param basePrice The base price of the service.
 * @returns The ID of the newly created service.
 */
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

/**
 * Gets all services for a specific tenant.
 * @param tenantId The ID of the tenant.
 * @returns A list of services for the tenant.
 */
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

/**
 * Updates an existing service.
 * @param id The ID of the service to update.
 * @param tenantId The ID of the tenant.
 * @param name The new name of the service.
 * @param description The new description of the service.
 * @param basePrice The new base price of the service.
 */
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

/**
 * Deletes a service.
 * @param id The ID of the service to delete.
 * @param tenantId The ID of the tenant.
 */
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
