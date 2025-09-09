import { query } from './_generated/server';
import { v } from 'convex/values';

export const getByUserId = query({
  args: {
    userId: v.id('users'),
  },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query('clients')
      .withIndex('by_user_id', (q) => q.eq('userId', userId))
      .unique();
  },
});
