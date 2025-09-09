import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

/**
 * Creates a new booking.
 * @param tenantId The ID of the tenant.
 * @param clientId The ID of the client.
 * @param assessmentId The ID of the associated assessment.
 * @param scheduledTime The scheduled time for the booking (Unix timestamp).
 * @returns The ID of the newly created booking.
 */
export const create = mutation({
  args: {
    tenantId: v.id('tenants'),
    clientId: v.id('clients'),
    assessmentId: v.id('assessments'),
    scheduledTime: v.number(),
  },
  handler: async (ctx, args) => {
    const bookingId = await ctx.db.insert('bookings', {
      ...args,
      status: 'scheduled',
    });
    return bookingId;
  },
});

/**
 * Updates an existing booking.
 * @param id The ID of the booking to update.
 * @param scheduledTime The new scheduled time for the booking.
 * @param status The new status of the booking.
 */
export const update = mutation({
  args: {
    id: v.id('bookings'),
    scheduledTime: v.optional(v.number()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...rest } = args;
    await ctx.db.patch(id, rest);
  },
});

/**
 * Gets all bookings for a specific tenant.
 * @param tenantId The ID of the tenant.
 * @returns A list of bookings for the tenant.
 */
export const getForTenant = query({
  args: { tenantId: v.id('tenants') },
  handler: async (ctx, args) => {
    const bookings = await ctx.db
      .query('bookings')
      .withIndex('by_tenant_id', (q) => q.eq('tenantId', args.tenantId))
      .collect();
    return bookings;
  },
});

/**
 * Gets all bookings for a specific client.
 * @param clientId The ID of the client.
 * @returns A list of bookings for the client.
 */
export const getForClient = query({
  args: { clientId: v.id('clients') },
  handler: async (ctx, args) => {
    const bookings = await ctx.db
      .query('bookings')
      .withIndex('by_client_id', (q) => q.eq('clientId', args.clientId))
      .collect();
    return bookings;
  },
});
