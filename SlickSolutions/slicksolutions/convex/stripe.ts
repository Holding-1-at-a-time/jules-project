import { action } from './_generated/server';
import { v } from 'convex/values';
import Stripe from 'stripe';
import { api } from './_generated/api';

const STRIPE_API_KEY = process.env.STRIPE_API_KEY;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL;

export const createStripeCheckoutSession = action({
  args: {
    planId: v.string(), // This is the Price ID from Stripe
  },
  handler: async (ctx, { planId }) => {
    if (!STRIPE_API_KEY) {
      throw new Error('STRIPE_API_KEY is not set in the environment.');
    }
    if (!APP_URL) {
      throw new Error('NEXT_PUBLIC_APP_URL is not set in the environment.');
    }

    const stripe = new Stripe(STRIPE_API_KEY, {
      apiVersion: '2024-04-10',
    });

    const user = await ctx.runQuery(api.users.me);
    if (!user) {
      throw new Error('User not authenticated.');
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: planId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${APP_URL}/dashboard?payment=success`,
      cancel_url: `${APP_URL}/dashboard?payment=cancelled`,
      customer_email: user.email,
      metadata: {
        userId: user._id,
      },
    });

    return session.url;
  },
});

export const fulfill = httpAction(async (ctx, request) => {
  const stripe = new Stripe(process.env.STRIPE_API_KEY!, {
    apiVersion: '2024-04-10',
  });

  const signature = request.headers.get('stripe-signature') as string;
  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error(err);
    return new Response('Webhook Error', { status: 400 });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const { userId } = session.metadata!;
      const subscription = await stripe.subscriptions.retrieve(
        session.subscription as string
      );
      await ctx.runMutation(api.subscriptions.create, {
        userId: userId as any,
        stripeSubscriptionId: subscription.id,
        stripeCustomerId: subscription.customer as string,
        stripePriceId: subscription.items.data[0].price.id,
        stripeCurrentPeriodEnd: subscription.current_period_end * 1000,
      });
      break;
    }
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      await ctx.runMutation(api.subscriptions.update, {
        stripeSubscriptionId: subscription.id,
        stripePriceId: subscription.items.data[0].price.id,
        stripeCurrentPeriodEnd: subscription.current_period_end * 1000,
      });
      break;
    }
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      await ctx.runMutation(api.subscriptions.del, {
        stripeSubscriptionId: subscription.id,
      });
      break;
    }
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      // Handle failed payment, e.g., by logging it or updating subscription status
      console.log(`Payment failed for invoice ${invoice.id}`);
      break;
    }
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  return new Response(null, { status: 200 });
});
