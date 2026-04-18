/**
 * POST /api/stripe/webhook
 */
module.exports = async function postStripeWebhook(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(501).json({ message: 'Stripe webhook not configured' })
  }

  return res.status(501).json({
    message:
      'Webhook handler stub — use stripe.webhooks.constructEvent with raw body, then upsert public.entitlements.',
  })
}
