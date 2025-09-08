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
    name: v.string(),
    email: v.string(),
    clerkId: v.string(), // Clerk user ID
    orgId: v.optional(v.string()), // Clerk organization ID
    roles: v.array(v.string()), // e.g., ['admin', 'detailer', 'client']
  })
    .index('by_clerk_id', ['clerkId'])
    .index('by_org_id', ['orgId']),
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
    // Add other assessment-related fields here
  }).index('by_tenant_id', ['tenantId']),
  estimates: defineTable({
    assessmentId: v.id('assessments'),
    totalPrice: v.number(),
    // Add other estimate-related fields here
  }).index('by_assessment_id', ['assessmentId']),
});
