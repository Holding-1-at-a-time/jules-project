import { v } from 'convex/values';
import { internalMutation } from './_generated/server';

export const create = internalMutation({
  args: {
    stripePaymentId: v.string(),
    amount: v.number(),
    currency: v.string(),
    status: v.union(
      v.literal('succeeded'),
      v.literal('pending'),
      v.literal('failed')
    ),
    clientId: v.id('clients'),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('payments', args);
  },
});
