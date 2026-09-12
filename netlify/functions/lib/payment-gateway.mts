/**
 * Payment gateway adapter boundary for Whacky Auctions.
 *
 * Replace createCheckout() with the chosen South African payment provider.
 * Keep provider secrets in Netlify environment variables, never in source.
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
};

export type CheckoutResult = {
  redirectUrl: string;
  providerReference?: string;
};

export async function createCheckout(_input: CheckoutInput): Promise<CheckoutResult> {
  throw Object.assign(new Error('Payment gateway adapter has not yet been configured.'), {
    status: 503,
    code: 'PAYMENT_ADAPTER_PENDING'
  });
}
