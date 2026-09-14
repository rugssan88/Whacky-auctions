/**
 * Yoco Checkout adapter for Whacky Auctions.
 *
 * The secret key is read only at runtime from Netlify. Never expose it to the
 * browser or commit it to source control.
 */
export type CheckoutInput = {
  orderId: string;
  auctionId: string;
  userId: string;
  email: string;
  amountCents: number;
  description: string;
  returnUrl: string;
  cancelUrl: string;
  notifyUrl: string;
  purpose?: 'auction-payment' | 'bidder-verification';
  verificationId?: string;
};

export type CheckoutResult = {
  redirectUrl: string;
  providerReference?: string;
};

export async function createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
  const secretKey = (Netlify.env.get('YOCO_SECRET_KEY') || '').trim();
  if (!secretKey) {
    throw Object.assign(new Error('Yoco is not configured.'), {
      status: 503,
      code: 'YOCO_NOT_CONFIGURED'
    });
  }

  const response = await fetch('https://payments.yoco.com/api/checkouts', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${secretKey}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      amount: input.amountCents,
      currency: 'ZAR',
      successUrl: input.returnUrl,
      cancelUrl: input.cancelUrl,
      failureUrl: input.cancelUrl,
      metadata: {
        orderId: input.orderId,
        auctionId: input.auctionId,
        userId: input.userId,
        purpose: input.purpose || 'auction-payment',
        verificationId: input.verificationId || ''
      }
    })
  });

  const data: any = await response.json().catch(() => ({}));
  if (!response.ok || !data.redirectUrl) {
    const message = data?.message || data?.error || 'Yoco could not create the checkout.';
    throw Object.assign(new Error(message), {
      status: response.status >= 400 ? response.status : 502,
      code: 'YOCO_CHECKOUT_FAILED'
    });
  }

  return {
    redirectUrl: String(data.redirectUrl),
    providerReference: data.id ? String(data.id) : undefined
  };
}
