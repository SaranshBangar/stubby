import Stripe from "stripe";

/**
 * Edge-compatible Stripe client. The Workers runtime has no Node http, so we
 * give Stripe a fetch-based HTTP client and the Web Crypto provider. Always
 * use the *Async* webhook verify (constructEventAsync) on the edge.
 */
export function getStripe(secretKey: string): Stripe {
  return new Stripe(secretKey, {
    apiVersion: "2024-12-18.acacia",
    httpClient: Stripe.createFetchHttpClient(),
  });
}
