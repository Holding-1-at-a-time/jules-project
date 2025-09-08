import { v } from 'convex/values';
import { internalMutation, internalQuery } from './_generated/server';

export const create = internalMutation({
  args: {
    stripeSubscriptionId: v.string(),
    clientId: v.id('clients'),
    plan: v.string(),
    status: v.union(
      v.literal('active'),
      v.literal('cancelled'),
      v.literal('past_due')
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('subscriptions', args);
  },
});

export const getSubscriptionByStripeId = internalQuery({
    args: { stripeSubscriptionId: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query('subscriptions')
            .withIndex('by_stripe_subscription_id', (q) => q.eq('stripeSubscriptionId', args.stripeSubscriptionId))
            .unique();
    },
});

export const updateStatus = internalMutation({
    args: {
        id: v.id('subscriptions'),
        status: v.union(
            v.literal('active'),
            v.literal('cancelled'),
            v.literal('past_due')
        ),
    },
    handler: async (ctx, { id, status }) => {
        await ctx.db.patch(id, { status });
    },
});
