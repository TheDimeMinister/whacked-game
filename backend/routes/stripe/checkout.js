/**
 * POST /api/stripe/checkout
 * Body: { packId: string, slug?: string }
 */
module.exports = async function postStripeCheckout(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(501).json({
      message:
        'Stripe is not configured (set STRIPE_SECRET_KEY on the API host). Cosmetic packs only.',
    })
  }

  return res.status(501).json({
    message:
      'Checkout session not wired in this MVP — add stripe_price_id on weapon_packs and create a Checkout Session here.',
  })
}
