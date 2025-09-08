import { query } from './_generated/server';
import { v } from 'convex/values';

// Get a client by ID
export const get = query({
  args: { id: v.id('clients') },
  handler: async (ctx, args) => {
    const client = await ctx.db.get(args.id);
    return client;
  },
});

// Get a client by user ID
export const getByUserId = query({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    const client = await ctx.db
      .query('clients')
      .withIndex('by_user_id', (q) => q.eq('userId', args.userId))
      .unique();
    return client;
  },
});
