import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

// Create a new payment
export const create = mutation({
  args: {
    tenantId: v.id('tenants'),
    bookingId: v.id('bookings'),
    amount: v.number(),
    paymentMethod: v.string(),
    stripePaymentId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const paymentId = await ctx.db.insert('payments', {
      ...args,
      status: 'succeeded',
    });
    return paymentId;
  },
});

// Get payments for a booking
export const getForBooking = query({
  args: { bookingId: v.id('bookings') },
  handler: async (ctx, args) => {
    const payments = await ctx.db
      .query('payments')
      .filter((q) => q.eq(q.field('bookingId'), args.bookingId))
      .collect();
    return payments;
  },
});
