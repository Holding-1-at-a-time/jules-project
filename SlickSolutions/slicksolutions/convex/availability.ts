import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

export const setAvailability = mutation({
  args: {
    detailerId: v.id('detailers'),
    availability: v.array(
      v.object({
        dayOfWeek: v.number(),
        startTime: v.string(),
        endTime: v.string(),
      })
    ),
  },
  handler: async (ctx, { detailerId, availability }) => {
    // First, clear any existing recurring availability for this detailer
    const existing = await ctx.db
      .query('detailerAvailability')
      .withIndex('by_detailer_id_date', (q) => q.eq('detailerId', detailerId))
      .filter((q) => q.eq(q.field('date'), undefined))
      .collect();

    for (const item of existing) {
      await ctx.db.delete(item._id);
    }

    // Then, insert the new availability
    for (const item of availability) {
      await ctx.db.insert('detailerAvailability', {
        detailerId,
        ...item,
      });
    }
  },
});

export const setOverride = mutation({
  args: {
    detailerId: v.id('detailers'),
    date: v.string(), // "YYYY-MM-DD"
    isUnavailable: v.optional(v.boolean()),
    startTime: v.optional(v.string()), // "HH:mm"
    endTime: v.optional(v.string()), // "HH:mm"
  },
  handler: async (ctx, args) => {
    // Check if an override for this date already exists
    const existing = await ctx.db
        .query('detailerAvailability')
        .withIndex('by_detailer_id_date', q => q.eq('detailerId', args.detailerId).eq('date', args.date))
        .first();

    if (existing) {
        await ctx.db.patch(existing._id, args);
    } else {
        await ctx.db.insert('detailerAvailability', args);
    }
  },
});

export const getAvailability = query({
    args: {
        detailerId: v.id('detailers'),
        date: v.string(), // "YYYY-MM-DD"
    },
    handler: async (ctx, { detailerId, date }) => {
        const dayOfWeek = new Date(date).getUTCDay();

        const recurring = await ctx.db
            .query('detailerAvailability')
            .withIndex('by_detailer_id_date', (q) => q.eq('detailerId', detailerId))
            .filter((q) => q.eq(q.field('date'), undefined))
            .collect();

        const override = await ctx.db
            .query('detailerAvailability')
            .withIndex('by_detailer_id_date', (q) => q.eq('detailerId', detailerId).eq('date', date))
            .first();

        let workingHours: { startTime: string; endTime: string }[] = [];
        let isUnavailable = false;

        if (override) {
            if (override.isUnavailable) {
                isUnavailable = true;
            } else if (override.startTime && override.endTime) {
                workingHours.push({ startTime: override.startTime, endTime: override.endTime });
            }
        } else {
            const recurringDay = recurring.filter(r => r.dayOfWeek === dayOfWeek);
            workingHours = recurringDay.map(r => ({ startTime: r.startTime!, endTime: r.endTime! }));
        }

        return { workingHours, isUnavailable };
    },
});
