import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

// Mutation to submit a new review
export const submitReview = mutation({
  args: {
    tenantId: v.id('tenants'),
    clientId: v.id('clients'),
    detailerId: v.id('detailers'),
    assessmentId: v.id('assessments'),
    rating: v.number(),
    comment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const reviewId = await ctx.db.insert('reviews', {
        tenantId: args.tenantId,
        clientId: args.clientId,
        detailerId: args.detailerId,
        assessmentId: args.assessmentId,
        rating: args.rating,
        comment: args.comment,
    });
    return reviewId;
  },
});

// Query to get all reviews for a specific tenant
export const getTenantReviews = query({
  args: {
    tenantId: v.id('tenants'),
  },
  handler: async (ctx, args) => {
    const reviews = await ctx.db
      .query('reviews')
      .withIndex('by_tenant_id', (q) => q.eq('tenantId', args.tenantId))
      .collect();
    return reviews;
  },
});

// Query to get all reviews for a specific detailer
export const getDetailerReviews = query({
    args: {
        detailerId: v.id('detailers'),
    },
    handler: async (ctx, args) => {
        const reviews = await ctx.db
            .query('reviews')
            .withIndex('by_detailer_id', (q) => q.eq('detailerId', args.detailerId))
            .collect();
        return reviews;
    },
});
