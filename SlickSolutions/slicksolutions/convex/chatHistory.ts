import { mutation } from './_generated/server';
import { v } from 'convex/values';

export const add = mutation({
  args: {
    userId: v.id('users'),
    userMessage: v.string(),
    aiResponse: v.string(),
  },
  handler: async (ctx, { userId, userMessage, aiResponse }) => {
    await ctx.db.insert('chatHistory', {
      userId,
      userMessage,
      aiResponse,
    });
  },
});
