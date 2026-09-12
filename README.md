# Whacky Auctions v1.0

Production-oriented pre-launch build for Whacky Auctions PTY LTD.

## Current launch state

The platform is intentionally locked for binding trade. Browsing, bidder registration, admin, auction creation, statutory records, bidding engine, 2-minute rolling soft close, winning orders, POPIA/auction legal pages and mobile PWA installation are implemented. Live auction publication and binding bids require both:

1. A current SAPS second-hand-goods dealer registration recorded in the Admin dashboard.
2. A connected payment gateway.

The payment provider is the only external commerce integration left intentionally blank. Implement it in `netlify/functions/lib/payment-gateway.mts`, add its webhook verification, then set Netlify `PAYMENT_GATEWAY_ENABLED=true`. After both launch requirements are recorded, the Admin dashboard exposes the final trading switch.

## Soft close

Each auction defaults to 120 seconds. Any valid bid received in the final soft-close window resets that lot to a full 120 seconds. Further valid bids during each renewed final window extend again without a fixed maximum.

## Netlify architecture

- Static/PWA client: `public/`
- API: `netlify/functions/api.mts`
- Scheduled auction closer: `netlify/functions/close-auctions.mts`
- PostgreSQL via Netlify Database migrations: `netlify/database/migrations/`
- Auction photos: Netlify Blobs
- Payment adapter boundary: `netlify/functions/lib/payment-gateway.mts`

## First admin setup

The deployment uses a one-time setup-code hash in Netlify environment variables. Visit `/admin-setup`, enter the private one-time setup code supplied to the owner, and choose an administrator password. Once the first admin exists, the endpoint refuses subsequent setup attempts.

## Mobile

The web app is a PWA and can be installed directly from Chrome/Android and Safari/iPhone. Native wrapper source is supplied separately for Android and iOS packaging. A signed iOS IPA/App Store build requires the owner's Apple Developer signing credentials and a macOS/Xcode build.
