import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

/**
 * Creates a new payment record.
 * @param tenantId The ID of the tenant.
 * @param bookingId The ID of the associated booking.
 * @param amount The amount of the payment.
 * @param paymentMethod The method of payment (e.g., 'stripe', 'cash').
 * @param stripePaymentId The optional ID of the payment in Stripe.
 * @returns The ID of the newly created payment.
 */
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

/**
 * Gets all payments for a specific booking.
 * @param bookingId The ID of the booking.
 * @returns A list of payments for the booking.
 */
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
