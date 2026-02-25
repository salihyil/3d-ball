import express from 'express';
import { verifySupabaseToken } from '../auth/jwt.js';
import { stripe } from '../config/stripe.js';
import { supabaseAdmin } from '../config/supabase.js';

export const stripeRouter = express.Router();

// Middleware for parsing Webhook raw body
stripeRouter.post(
  '/api/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const io = req.io;
    const sig = req.headers['stripe-signature'];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error(`[STRIPE] Webhook Error: ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const { userId, type } = session.metadata;

      try {
        if (type === 'coin_pack') {
          // --- Coin Pack Purchase ---
          const coinAmount = parseInt(session.metadata.coinAmount, 10);
          console.log(
            `[STRIPE] Coin pack payment success for user ${userId}, +${coinAmount} coins`
          );

          const { error: coinError } = await supabaseAdmin
            .rpc('increment_brawl_coins', {
              p_user_id: userId,
              p_amount: coinAmount,
            })
            .maybeSingle();

          // Fallback: direct update if RPC doesn't exist
          if (coinError) {
            const { data: currentProfile } = await supabaseAdmin
              .from('profiles')
              .select('brawl_coins')
              .eq('id', userId)
              .single();

            if (currentProfile) {
              await supabaseAdmin
                .from('profiles')
                .update({
                  brawl_coins: currentProfile.brawl_coins + coinAmount,
                })
                .eq('id', userId);
            }
          }

          // Notify player via Socket if connected
          for (const [id, s] of io.sockets.sockets) {
            if (s.user?.id === userId) {
              // Fetch updated balance
              const { data: updatedProfile } = await supabaseAdmin
                .from('profiles')
                .select('brawl_coins')
                .eq('id', userId)
                .single();

              s.emit('coin-balance-updated', {
                balance: updatedProfile?.brawl_coins ?? 0,
              });
              console.log(
                `[STRIPE] Notified socket ${id} of coin balance update`
              );
            }
          }
        } else {
          // --- Legacy Accessory Purchase ---
          const { accessoryId } = session.metadata;
          console.log(
            `[STRIPE] Payment success for user ${userId}, item ${accessoryId}`
          );

          const { error: accError } = await supabaseAdmin
            .from('user_accessories')
            .insert({
              user_id: userId,
              accessoryId,
              is_equipped: false,
            });

          if (accError) throw accError;

          for (const [id, s] of io.sockets.sockets) {
            if (s.user?.id === userId) {
              s.emit('item-unlocked', { id: accessoryId });
              console.log(`[STRIPE] Notified socket ${id} of unlock`);
            }
          }
        }
      } catch (err) {
        console.error('[STRIPE] DB Error during grant:', err.message);
        return res.status(500).json({ error: 'Failed to grant item' });
      }
    }

    res.json({ received: true });
  }
);

// Stripe: Create Checkout Session (supports both coin_pack and accessory)
stripeRouter.post(
  '/api/create-checkout-session',
  express.json(),
  async (req, res) => {
    const { accessToken, type, coinPackId, accessoryId, priceId } = req.body;

    try {
      // 1. Verify User
      const decoded = verifySupabaseToken(accessToken);
      const userId = decoded.sub;

      // 2. Determine price and metadata based on type
      let finalPriceId;
      let metadata;

      if (type === 'coin_pack') {
        // Coin Pack definitions
        const COIN_PACKS = {
          starter: {
            priceId: 'price_1T43WzFAhwt6dCXVAWu91H2F',
            coinAmount: 500,
            label: 'Starter Pack',
          },
          value: {
            priceId: 'price_1T43WzFAhwt6dCXVkHsYHB2m',
            coinAmount: 1200,
            label: 'Value Pack',
          },
        };

        const pack = COIN_PACKS[coinPackId];
        if (!pack) {
          return res.status(400).json({ error: 'Invalid coin pack ID' });
        }

        finalPriceId = pack.priceId;
        metadata = {
          userId,
          type: 'coin_pack',
          coinAmount: String(pack.coinAmount),
          packId: coinPackId,
        };
      } else {
        // Legacy accessory purchase
        finalPriceId = priceId || process.env.STRIPE_TEST_PRICE_ID;
        metadata = { userId, type: 'accessory', accessoryId };
      }

      if (!finalPriceId) {
        return res.status(400).json({
          error:
            'This item does not have a Stripe Price ID configured. Set STRIPE_TEST_PRICE_ID in .env for testing.',
        });
      }

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{ price: finalPriceId, quantity: 1 }],
        mode: 'payment',
        success_url: `${req.headers.origin}/?purchase=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${req.headers.origin}/?purchase=cancel`,
        metadata,
      });

      res.json({ url: session.url });
    } catch (err) {
      console.error('[STRIPE] Checkout failed:', err.message);
      res.status(500).json({ error: err.message });
    }
  }
);

// Stripe: Confirm Checkout Session (fallback when webhook is missing)
stripeRouter.post(
  '/api/confirm-checkout-session',
  express.json(),
  async (req, res) => {
    const io = req.io;
    const { accessToken, sessionId } = req.body;

    try {
      if (!accessToken) {
        return res.status(401).json({ error: 'Missing accessToken' });
      }

      if (!sessionId) {
        return res.status(400).json({ error: 'Missing sessionId' });
      }

      const decoded = verifySupabaseToken(accessToken);
      const userId = decoded.sub;

      const session = await stripe.checkout.sessions.retrieve(sessionId);

      if (!session) {
        return res.status(404).json({ error: 'Checkout session not found' });
      }

      if (session.payment_status !== 'paid') {
        return res.status(400).json({
          error: `Checkout session not paid (status=${session.payment_status})`,
        });
      }

      const sessionUserId = session.metadata?.userId;

      if (!sessionUserId) {
        return res.status(400).json({
          error: 'Checkout session is missing required metadata (userId)',
        });
      }

      if (sessionUserId !== userId) {
        return res.status(403).json({ error: 'Session user mismatch' });
      }

      const sessionType = session.metadata?.type;

      if (sessionType === 'coin_pack') {
        // --- Coin Pack confirm ---
        const coinAmount = parseInt(session.metadata.coinAmount, 10);
        const { data: currentProfile } = await supabaseAdmin
          .from('profiles')
          .select('brawl_coins')
          .eq('id', userId)
          .single();

        if (currentProfile) {
          await supabaseAdmin
            .from('profiles')
            .update({ brawl_coins: currentProfile.brawl_coins + coinAmount })
            .eq('id', userId);
        }

        // Notify via socket
        for (const [id, s] of io.sockets.sockets) {
          if (s.user?.id === userId) {
            const { data: updatedProfile } = await supabaseAdmin
              .from('profiles')
              .select('brawl_coins')
              .eq('id', userId)
              .single();
            s.emit('coin-balance-updated', {
              balance: updatedProfile?.brawl_coins ?? 0,
            });
            console.log(
              `[STRIPE] Notified socket ${id} of coin balance (confirm)`
            );
          }
        }

        res.json({ ok: true, type: 'coin_pack', coinAmount });
      } else {
        // --- Legacy Accessory confirm ---
        const accessoryId = session.metadata?.accessoryId;

        if (!accessoryId) {
          return res.status(400).json({
            error:
              'Checkout session is missing required metadata (accessoryId)',
          });
        }

        const { data: existing, error: existingError } = await supabaseAdmin
          .from('user_accessories')
          .select('user_id, accessory_id')
          .eq('user_id', userId)
          .eq('accessory_id', accessoryId)
          .maybeSingle();

        if (existingError) throw existingError;
        let createdNew = false;

        if (!existing) {
          const { error: insertError } = await supabaseAdmin
            .from('user_accessories')
            .insert({
              user_id: userId,
              accessory_id: accessoryId,
              is_equipped: false,
            });

          createdNew = true;
          if (insertError) throw insertError;
        }

        if (createdNew) {
          for (const [id, s] of io.sockets.sockets) {
            if (s.user?.id === userId) {
              s.emit('item-unlocked', { id: accessoryId });
              console.log(`[STRIPE] Notified socket ${id} of unlock (confirm)`);
            }
          }
        }

        res.json({ ok: true, accessoryId, alreadyOwned: Boolean(existing) });
      }
    } catch (err) {
      console.error('[STRIPE] Confirm checkout failed:', err.message);
      res.status(500).json({ error: err.message });
    }
  }
);
