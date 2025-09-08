import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

// Create a new booking
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

// Update a booking
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

// Get bookings for a tenant
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

// Get bookings for a client
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
