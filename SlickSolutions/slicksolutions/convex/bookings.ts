import { v } from 'convex/values';
import { internalMutation } from './_generated/server';

export const create = internalMutation({
  args: {
    appointmentId: v.id('appointments'),
    paymentId: v.id('payments'),
    status: v.union(v.literal('confirmed'), v.literal('cancelled')),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('bookings', args);
  },
});
