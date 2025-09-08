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
  }).index('by_user_id', ['userId']),
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
    status: v.string(), // e.g., 'pending', 'completed'
    notes: v.optional(v.string()),
  })
    .index('by_tenant_id', ['tenantId'])
    .index('by_client_id', ['clientId']),
  estimates: defineTable({
    assessmentId: v.id('assessments'),
    totalPrice: v.number(),
    // Add other estimate-related fields here
  }).index('by_assessment_id', ['assessmentId']),
  bookings: defineTable({
    tenantId: v.id('tenants'),
    clientId: v.id('clients'),
    assessmentId: v.id('assessments'),
    scheduledTime: v.number(), // Unix timestamp
    status: v.string(), // e.g., 'scheduled', 'completed', 'canceled'
  })
    .index('by_tenant_id', ['tenantId'])
    .index('by_assessment_id', ['assessmentId'])
    .index('by_client_id', ['clientId']),
  payments: defineTable({
    tenantId: v.id('tenants'),
    bookingId: v.id('bookings'),
    amount: v.number(),
    paymentMethod: v.string(), // e.g., 'stripe', 'cash'
    stripePaymentId: v.optional(v.string()),
    status: v.string(), // e.g., 'pending', 'succeeded', 'failed'
  })
    .index('by_tenant_id', ['tenantId'])
    .index('by_booking_id', ['bookingId']),
  chatHistory: defineTable({
    tenantId: v.id('tenants'),
    clientId: v.id('clients'),
    message: v.string(),
    from: v.string(), // 'user' or 'ai'
  })
    .index('by_tenant_id', ['tenantId'])
    .index('by_client_id', ['clientId']),
  recommendations: defineTable({
    tenantId: v.id('tenants'),
    content: v.string(),
    createdAt: v.number(),
  }).index('by_tenant_id', ['tenantId']),
  subscriptions: defineTable({
    userId: v.id('users'),
    stripeSubscriptionId: v.string(),
    stripeCustomerId: v.string(),
    stripePriceId: v.string(),
    stripeCurrentPeriodEnd: v.number(),
  })
    .index('by_user_id', ['userId'])
    .index('by_stripe_subscription_id', ['stripeSubscriptionId']),
});
