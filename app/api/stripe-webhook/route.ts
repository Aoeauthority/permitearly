// POST /api/stripe-webhook
// Handles Stripe events: checkout completed, subscription deleted, payment failed.

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// App Router: tell Next.js not to parse the body (Stripe needs raw bytes)
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  const rawBody = await req.arrayBuffer();
  const buf = Buffer.from(rawBody);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      buf,
      sig!,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = createServiceClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const customerId = session.customer as string;
      const subscriptionId = session.subscription as string;

      await supabase
        .from("contractors")
        .update({
          stripe_subscription_id: subscriptionId,
          subscription_status: "active",
        })
        .eq("stripe_customer_id", customerId);

      console.log(`Activated subscription for customer ${customerId}`);
      break;
    }

    case "invoice.paid": {
      // Confirm recurring billing succeeded — keep status active
      const paidInvoice = event.data.object as Stripe.Invoice;
      const paidSubId =
        typeof paidInvoice.subscription === "string"
          ? paidInvoice.subscription
          : paidInvoice.subscription?.id;

      if (paidSubId) {
        await supabase
          .from("contractors")
          .update({ subscription_status: "active" })
          .eq("stripe_subscription_id", paidSubId);

        console.log(`Confirmed active billing for subscription ${paidSubId}`);
      }
      break;
    }

    case "customer.subscription.updated": {
      const updatedSub = event.data.object as Stripe.Subscription;
      const newStatus =
        updatedSub.status === "active" || updatedSub.status === "trialing"
          ? "active"
          : updatedSub.status === "past_due"
          ? "past_due"
          : updatedSub.status === "canceled"
          ? "cancelled"
          : updatedSub.status;

      await supabase
        .from("contractors")
        .update({ subscription_status: newStatus })
        .eq("stripe_subscription_id", updatedSub.id);

      console.log(`Updated subscription ${updatedSub.id} → ${newStatus}`);
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      await supabase
        .from("contractors")
        .update({ subscription_status: "cancelled" })
        .eq("stripe_subscription_id", sub.id);

      console.log(`Cancelled subscription ${sub.id}`);
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const subId =
        typeof invoice.subscription === "string"
          ? invoice.subscription
          : invoice.subscription?.id;

      if (subId) {
        await supabase
          .from("contractors")
          .update({ subscription_status: "past_due" })
          .eq("stripe_subscription_id", subId);

        console.log(`Marked past_due for subscription ${subId}`);
      }
      break;
    }

    default:
      // Silently ignore unhandled events
      break;
  }

  return NextResponse.json({ received: true });
}
