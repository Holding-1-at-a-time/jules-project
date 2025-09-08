import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

export const getTheme = query({
    args: { tenantId: v.id('tenants') },
    handler: async (ctx, args) => {
        const theme = await ctx.db
            .query('themes')
            .withIndex('by_tenant_id', (q) => q.eq('tenantId', args.tenantId))
            .unique();
        return theme;
    },
});

export const saveTheme = mutation({
  args: {
    tenantId: v.id('tenants'),
    primaryColor: v.string(),
    secondaryColor: v.string(),
  },
  handler: async (ctx, args) => {
    const existingTheme = await ctx.db
        .query('themes')
        .withIndex('by_tenant_id', (q) => q.eq('tenantId', args.tenantId))
        .unique();

    if (existingTheme) {
        await ctx.db.patch(existingTheme._id, {
            primaryColor: args.primaryColor,
            secondaryColor: args.secondaryColor,
        });
    } else {
        await ctx.db.insert('themes', {
            tenantId: args.tenantId,
            primaryColor: args.primaryColor,
            secondaryColor: args.secondaryColor,
        });
    }
  },
});
