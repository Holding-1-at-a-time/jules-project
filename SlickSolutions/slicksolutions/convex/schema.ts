import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  tenants: defineTable({
    name: v.string(),
    orgId: v.string(), // Clerk organization ID
    qrCode: v.optional(v.string()),
    // Add other tenant-specific fields here
  }).index('by_org_id', ['orgId']),
  users: defineTable({
    tenantId: v.id(tenants),
    name: v.string(),
    email: v.string(),
    clerkId: v.string(), // Clerk user ID
    orgId: v.string(), // Clerk organization ID
    roles: v.array(v.string()), // e.g., ['admin', 'detailer', 'client']
    // Stripe fields
    stripeCustomerId: v.optional(v.string()),
    subscriptionId: v.optional(v.string()),
    plan: v.optional(
      v.union(v.literal('Launch'), v.literal('Grow'), v.literal('Scale'))
    ),
    subscriptionStatus: v.optional(
      v.union(
        v.literal('trialing'),
        v.literal('active'),
        v.literal('past_due'),
        v.literal('canceled'),
        v.literal('unpaid'),
        v.literal('incomplete'),
        v.literal('incomplete_expired')
      )
    ),
  })
    .index('by_clerk_id', ['clerkId'])
    .index('by_subscription_id', ['subscriptionId']),
  detailers: defineTable({
    userId: v.id('users'),
    tenantId: v.id('tenants'),
    // Add other detailer-specific fields here
  })
    .index('by_user_id', ['userId'])
    .index('by_tenant_id', ['tenantId']),
      
  clients: defineTable({
    userId: v.id('users'),
    tenantId: v.id('tenants'),
    // Add other client-specific fields here
  })
    .index('by_user_id', ['userId'])
    .index('by_tenant_id', ['tenantId']),
  services: defineTable({
    tenantId: v.id('tenants'),
    name: v.string(),
    description: v.string(),
    basePrice: v.number(),
  }).index('by_tenant_id', ['tenantId']),
  assessments: defineTable({
    tenantId: v.id('tenants'),
    clientId: v.id('users'), // Link to the user with the 'client' role
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
  chatHistory: defineTable({
    userId: v.id('users'),
    userMessage: v.string(),
    aiResponse: v.string(),
  }).index('by_user_id', ['userId']),
});
