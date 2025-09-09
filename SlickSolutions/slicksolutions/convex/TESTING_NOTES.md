Testing library/framework: Vitest preferred (globals + vi). Compatible with Jest by replacing vi with jest or enabling Jest globals.
Coverage focus (based on current stripe.ts implementation):
- Actions: createStripeCheckoutSession (happy paths + login/user errors), createStripeCustomerPortalSession (happy path + errors), getBillingHistory.
- Internal mutations: storeStripeCustomerId, fulfillSubscription, updateSubscription (not-found & patch), cancelSubscription (not-found & patch), handleFailedPayment (not-found & patch).
- Webhook: signature failure (400), checkout.session.completed (mapped + missing line items + unmapped price id), customer.subscription.updated (mapped + unmapped), customer.subscription.deleted, invoice.payment_failed, default/unhandled events.
External calls are mocked (Stripe SDK). Convex ctx (db/auth/runQuery/runMutation) is stubbed per test. Env vars are set in beforeEach and restored in afterEach.