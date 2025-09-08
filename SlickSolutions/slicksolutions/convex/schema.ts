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
    // Stripe fields
    stripeCustomerId: v.optional(v.string()),
    subscriptionId: v.optional(v.string()),
    plan: v.optional(v.string()),
    subscriptionStatus: v.optional(v.string()),
  })
    .index('by_clerk_id', ['clerkId'])
    .index('by_subscription_id', ['subscriptionId']),
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
    // Add other assessment-related fields here
  }).index('by_tenant_id', ['tenantId']),
  estimates: defineTable({
    assessmentId: v.id('assessments'),
    totalPrice: v.number(),
    // Add other estimate-related fields here
  }).index('by_assessment_id', ['assessmentId']),
});
