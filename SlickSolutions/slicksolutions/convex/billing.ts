import { v } from 'convex/values';
import { internalAction, httpAction } from './_generated/server';
import Stripe from 'stripe';
import { internal } from './_generated/api';

// Initialize Stripe with the API key from environment variables
const stripe = new Stripe(process.env.STRIPE_API_KEY!, {
  apiVersion: '2024-04-10',
});

// Action to create a Stripe Checkout session
export const pay = internalAction({
  args: {
    serviceId: v.id('services'),
    clientId: v.id('clients'),
    appointmentId: v.id('appointments'),
  },
  handler: async (ctx, { serviceId, clientId, appointmentId }) => {
    const service = await ctx.runQuery(internal.services.getService, { id: serviceId });

    if (!service) {
      throw new Error('Service not found');
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: service.name,
              description: service.description,
            },
            unit_amount: service.basePrice * 100, // Stripe expects the amount in cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.CONVEX_SITE_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CONVEX_SITE_URL}/payment-cancel`,
      metadata: {
        clientId,
        serviceId,
        appointmentId,
      },
    });

    return session.url;
  },
});

export const createSubscription = internalAction({
    args: {
        clientId: v.id('clients'),
        plan: v.string(), // e.g., 'basic', 'premium'
        planPriceId: v.string(), // e.g., price_12345
    },
    handler: async (ctx, { clientId, plan, planPriceId }) => {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price: planPriceId,
                    quantity: 1,
                },
            ],
            mode: 'subscription',
            success_url: `${process.env.CONVEX_SITE_URL}/subscription-success`,
            cancel_url: `${process.env.CONVEX_SITE_URL}/subscription-cancel`,
            metadata: {
                clientId,
                plan,
            },
        });

        return session.url;
    },
});

export const cancelSubscription = internalAction({
    args: {
        subscriptionId: v.id('subscriptions'),
    },
    handler: async (ctx, { subscriptionId }) => {
        const subscription = await ctx.db.get(subscriptionId);
        if (!subscription) {
            throw new Error('Subscription not found');
        }

        const deletedSubscription = await stripe.subscriptions.del(subscription.stripeSubscriptionId);

        return deletedSubscription;
    },
});


// Webhook to handle Stripe events
export const fulfill = httpAction(async (ctx, request) => {
  const signature = request.headers.get('stripe-signature') as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      await request.text(),
      signature,
      webhookSecret
    );
  } catch (err) {
    console.error(err);
    return new Response('Webhook Error', { status: 400 });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const { clientId, serviceId, appointmentId, plan } = session.metadata!;

      if (session.mode === 'payment') {
        const paymentId = await ctx.runMutation(internal.payments.create, {
          stripePaymentId: session.id,
          amount: session.amount_total! / 100,
          currency: session.currency!,
          status: 'succeeded',
          clientId: clientId as any,
        });

        await ctx.runMutation(internal.bookings.create, {
            appointmentId: appointmentId as any,
            paymentId: paymentId as any,
            status: 'confirmed',
        });
      } else if (session.mode === 'subscription') {
          await ctx.runMutation(internal.subscriptions.create, {
              stripeSubscriptionId: session.subscription as string,
              clientId: clientId as any,
              plan: plan,
              status: 'active',
          });
      }
      break;
    }
    case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const sub = await ctx.runQuery(internal.subscriptions.getSubscriptionByStripeId, { stripeSubscriptionId: subscription.id });
        if (sub) {
            await ctx.runMutation(internal.subscriptions.updateStatus, {
                id: sub._id,
                status: subscription.status as any,
            });
        }
        break;
    }
    case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const sub = await ctx.runQuery(internal.subscriptions.getSubscriptionByStripeId, { stripeSubscriptionId: subscription.id });
        if (sub) {
            await ctx.runMutation(internal.subscriptions.updateStatus, {
                id: sub._id,
                status: 'cancelled',
            });
        }
        break;
    }
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  return new Response(null, { status: 200 });
});
