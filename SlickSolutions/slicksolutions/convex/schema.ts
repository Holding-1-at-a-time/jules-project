import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  tenants: defineTable({
    name: v.string(),
    qrCode: v.optional(v.string()),
    // Add other tenant-specific fields here
  }),
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
    tenantId: v.optional(v.id('tenants')),
    roles: v.array(v.string()), // e.g., ['admin', 'detailer', 'client']
  }).index('by_clerk_id', ['clerkId']),
  detailers: defineTable({
    userId: v.id('users'),
    tenantId: v.id('tenants'),
    // Add other detailer-specific fields here
  }).index('by_user_id', ['userId'])
  .index('by_tenant_id', ['tenantId']),
  clients: defineTable({
    userId: v.id('users'),
    tenantId: v.id('tenants'),
    // Add other client-specific fields here
  }).index('by_user_id', ['userId']),
  services: defineTable({
    tenantId: v.id('tenants'),
    name: v.string(),
    description: v.string(),
    basePrice: v.number(),
    duration: v.number(), // in minutes
  }).index('by_tenant_id', ['tenantId']),
  assessments: defineTable({
    tenantId: v.id('tenants'),
    clientId: v.id('clients'),
    vehicleInfo: v.object({
      vin: v.string(),
      make: v.string(),
      model: v.string(),
      year: v.number(),
    }),
    selectedServices: v.array(v.id('services')),
    // Add other assessment-related fields here
  }).index('by_tenant_id', ['tenantId']),
  estimates: defineTable({
    assessmentId: v.id('assessments'),
    totalPrice: v.number(),
    // Add other estimate-related fields here
  }).index('by_assessment_id', ['assessmentId']),
  appointments: defineTable({
    detailerId: v.id('detailers'),
    clientId: v.id('clients'),
    serviceId: v.id('services'),
    startTime: v.number(), // Using number for Unix timestamp
    endTime: v.number(), // Using number for Unix timestamp
    status: v.union(
      v.literal('scheduled'),
      v.literal('completed'),
      v.literal('cancelled')
    ),
    reminderSent: v.optional(v.boolean()),
  })
    .index('by_detailer_id_start_time', ['detailerId', 'startTime'])
    .index('by_client_id_start_time', ['clientId', 'startTime']),

  detailerAvailability: defineTable({
    detailerId: v.id('detailers'),
    dayOfWeek: v.optional(v.number()), // 0 for Sunday, 6 for Saturday
    startTime: v.optional(v.string()), // "HH:mm"
    endTime: v.optional(v.string()), // "HH:mm"
    date: v.optional(v.string()), // "YYYY-MM-DD"
    isUnavailable: v.optional(v.boolean()),
  }).index('by_detailer_id_date', ['detailerId', 'date']),

  bookings: defineTable({
    appointmentId: v.id('appointments'),
    paymentId: v.id('payments'),
    status: v.union(v.literal('confirmed'), v.literal('cancelled')),
  }).index('by_appointment_id', ['appointmentId']),

  payments: defineTable({
    stripePaymentId: v.string(),
    amount: v.number(),
    currency: v.string(),
    status: v.union(
      v.literal('succeeded'),
      v.literal('pending'),
      v.literal('failed')
    ),
    clientId: v.id('clients'),
  })
    .index('by_stripe_payment_id', ['stripePaymentId'])
    .index('by_client_id', ['clientId']),

  subscriptions: defineTable({
    stripeSubscriptionId: v.string(),
    clientId: v.id('clients'),
    plan: v.string(),
    status: v.union(
      v.literal('active'),
      v.literal('cancelled'),
      v.literal('past_due')
    ),
  })
    .index('by_stripe_subscription_id', ['stripeSubscriptionId'])
    .index('by_client_id', ['clientId']),
});
