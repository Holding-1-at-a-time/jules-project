import { type User } from 'convex/server';
import { type QueryCtx, type MutationCtx } from './_generated/server';

export const assertRole = (
  ctx: QueryCtx | MutationCtx,
  user: User,
  role: 'admin' | 'detailer' | 'client'
) => {
  if (!user.roles.includes(role)) {
    throw new Error(`User does not have the required role: ${role}`);
  }
};

export const getUser = async (
  ctx: QueryCtx | MutationCtx | ActionCtx
): Promise<Doc<'users'>> => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error('User is not authenticated');
  }

  const user = await ctx.db
    .query('users')
    .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
    .unique();

  if (!user) {
    throw new Error('User not found');
  }

  return user;
};
