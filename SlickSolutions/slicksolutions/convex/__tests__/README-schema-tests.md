These tests validate the Convex schema structure by mocking 'convex/server' and 'convex/values'.
Framework: Vitest (preferred) or Jest (fallback). No new dependencies added.

- With Vitest: npx vitest run slicksolutions/convex/__tests__/schema.spec.ts
- With Jest: npx jest SlickSolutions/slicksolutions/convex/__tests__/schema.spec.ts

The tests assert:
- Tables defined, fields and validators, relational id() targets, and declared indexes.
- Enum-like unions for 'plan' and 'subscriptionStatus' on users.
- Object shapes for vehicleInfo and arrays of service IDs.