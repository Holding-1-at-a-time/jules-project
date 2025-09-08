import { query } from './_generated/server';
import { v } from 'convex/values';

export const generate = query({
  args: {
    tenantId: v.id('tenants'),
    startDate: v.string(),
    endDate: v.string(),
    filters: v.object({
      serviceType: v.optional(v.array(v.string())),
      paymentMethod: v.optional(v.array(v.string())),
    }),
    dataPoints: v.array(v.string()),
  },
  handler: async (ctx, { tenantId, startDate, endDate, filters, dataPoints }) => {
    // 1. Fetch bookings within the date range
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();

    const bookings = await ctx.db
      .query('bookings')
      .withIndex('by_tenant_id', (q) => q.eq('tenantId', tenantId))
      .filter((q) => q.and(q.gte(q.field('scheduledTime'), start), q.lte(q.field('scheduledTime'), end)))
      .collect();

    let filteredBookings = bookings;

    // 2. Apply filters (This is a simplified example)
    if (filters.serviceType && filters.serviceType.length > 0) {
      // In a real app, you'd need to fetch the services for each booking to filter by service type.
      // This is a placeholder to demonstrate the logic.
    }
    if (filters.paymentMethod && filters.paymentMethod.length > 0) {
      // Similarly, you'd need to fetch payments for each booking.
    }

    // 3. Aggregate data
    const report: { [key: string]: any } = {};

    if (dataPoints.includes('booking_count')) {
      report.booking_count = filteredBookings.length;
    }

    if (dataPoints.includes('revenue')) {
      let totalRevenue = 0;
      for (const booking of filteredBookings) {
        const payments = await ctx.db
          .query('payments')
          .filter((q) => q.eq(q.field('bookingId'), booking._id))
          .collect();
        totalRevenue += payments.reduce((sum, p) => sum + p.amount, 0);
      }
      report.revenue = totalRevenue;
    }

    return report;
  },
});

import { action } from './_generated/server';

export const generateCsv = action({
  args: {
    tenantId: v.id('tenants'),
    startDate: v.string(),
    endDate: v.string(),
    filters: v.object({
      serviceType: v.optional(v.array(v.string())),
      paymentMethod: v.optional(v.array(v.string())),
    }),
    dataPoints: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const reportData = await ctx.runQuery(generate, args);

    if (!reportData) {
      return '';
    }

    const headers = Object.keys(reportData).join(',');
    const values = Object.values(reportData).join(',');
    const csv = `${headers}\n${values}`;

    return csv;
  },
});
