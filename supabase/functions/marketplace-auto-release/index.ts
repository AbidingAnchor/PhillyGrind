import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const HANDOFF_WINDOW_MS = 2 * 60 * 60 * 1000;

async function releaseEscrow(supabase, stripe, order) {
  const pi = await stripe.paymentIntents.retrieve(order.stripe_payment_intent_id);
  if (pi.status === 'requires_capture') {
    await stripe.paymentIntents.capture(order.stripe_payment_intent_id);
  }

  const { error } = await supabase
    .from('marketplace_orders')
    .update({
      status: 'completed',
      confirmed_at: new Date().toISOString(),
    })
    .eq('id', order.id);

  if (error) throw error;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const stripe = new Stripe(stripeSecret, { apiVersion: '2024-06-20' });

    const cutoff = new Date(Date.now() - HANDOFF_WINDOW_MS).toISOString();

    const { data: dueOrders, error } = await supabase
      .from('marketplace_orders')
      .select('id, stripe_payment_intent_id')
      .eq('status', 'delivered_pending_confirmation')
      .lte('handoff_at', cutoff);

    if (error) {
      console.error('Failed to fetch due orders:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch orders' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const released: string[] = [];
    const failed: { id: string; error: string }[] = [];

    for (const order of dueOrders ?? []) {
      const { data: dispute } = await supabase
        .from('disputes')
        .select('id')
        .eq('order_id', order.id)
        .maybeSingle();

      if (dispute) continue;

      try {
        await releaseEscrow(supabase, stripe, order);
        released.push(order.id);
      } catch (err) {
        console.error(`Auto-release failed for ${order.id}:`, err);
        failed.push({ id: order.id, error: err.message });
      }
    }

    return new Response(
      JSON.stringify({
        message: 'Marketplace auto-release complete',
        checked: dueOrders?.length ?? 0,
        released: released.length,
        released_ids: released,
        failed,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('marketplace-auto-release error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
