import { mutation } from './_generated/server';
import { v } from 'convex/values';

// Create a new recommendation
export const create = mutation({
  args: {
    tenantId: v.id('tenants'),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('recommendations', {
      ...args,
      createdAt: Date.now(),
    });
  },
});
