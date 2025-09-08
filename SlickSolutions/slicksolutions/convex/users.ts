import { internalMutation, mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { getUser, assertRole } from './auth';
import { Clerk } from '@clerk/clerk-sdk-node';

const clerk = new Clerk({
  secretKey: process.env.CLERK_SECRET_KEY,
});

export const me = query({
  args: {},
  handler: async (ctx) => {
    return await getUser(ctx);
  },
});

export const createOrUpdateUser = internalMutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
  },
  handler: async (ctx, { clerkId, email, name }) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
      .unique();

    if (user) {
      await ctx.db.patch(user._id, { email, name });
    } else {
      await ctx.db.insert('users', {
        clerkId,
        email,
        name,
        roles: [],
      });
    }
  },
});

export const deleteUser = internalMutation({
  args: { clerkId: v.string() },
  handler: async (ctx, { clerkId }) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
      .unique();

    if (user) {
      await ctx.db.delete(user._id);
    }
  },
});

export const inviteClient = mutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const user = await getUser(ctx);
    if (!user.roles.includes('admin') && !user.roles.includes('detailer')) {
      throw new Error('User does not have permission to invite clients');
    }

    if (!user.orgId) {
      throw new Error('User does not belong to an organization');
    }

    await clerk.invitations.createInvitation({
      emailAddress: email,
      organizationId: user.orgId,
      role: 'org:member',
      redirectUrl: `${process.env.NEXT_PUBLIC_URL}/`,
    });
  },
});

export const assignRole = mutation({
  args: { userId: v.id('users'), role: v.string() },
  handler: async (ctx, { userId, role }) => {
    const user = await getUser(ctx);
    assertRole(ctx, user, 'admin');

    const targetUser = await ctx.db.get(userId);
    if (!targetUser) {
      throw new Error('User not found');
    }

    if (targetUser.roles.includes(role)) {
      // Role already exists, do nothing
      return;
    }

    await ctx.db.patch(targetUser._id, {
      roles: targetUser.roles.includes(role) ? targetUser.roles : [...targetUser.roles, role],
    });
  },
});
