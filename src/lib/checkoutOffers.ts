export const CHECKOUT_OFFERS = {
  "local-pif": {
    offerCode: "JCF_LOCAL_12W_PIF",
    destination: "https://buy.stripe.com/bJebJ37Kf6tI6cYaqnaIM0j",
  },
  "local-3pay": {
    offerCode: "JCF_LOCAL_12W_3PAY",
    destination: "https://buy.stripe.com/6oU4gB5C76tIeJu41ZaIM0l",
  },
  "remote-pif": {
    offerCode: "JCF_REMOTE_12W_PIF",
    destination: "https://buy.stripe.com/7sY4gB0hN9FUdFqeGDaIM0g",
  },
  private: {
    offerCode: "JCF_PRIVATE_60",
    destination: "https://buy.stripe.com/9B69AV3tZ3hw0SEdCzaIM0e",
  },
  reset: {
    offerCode: "JCF_SHIFT_RESET_2026_11",
    destination: "https://buy.stripe.com/8x26oJ0hN4lA1WIcyvaIM0k",
  },
} as const;

export type CheckoutOfferSlug = keyof typeof CHECKOUT_OFFERS;

export function checkoutOffer(slug: string) {
  return CHECKOUT_OFFERS[slug as CheckoutOfferSlug] ?? null;
}
