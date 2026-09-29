import { updateSession } from "@/lib/supabase/middleware";
import { type NextRequest } from "next/server";
import {
  captureAttributionOnRequest,
  persistAttributionCookies,
} from "@/lib/attribution";

export async function proxy(request: NextRequest) {
  // Capture campaign parameters before the auth middleware clones the request.
  // Mutating request.cookies here makes the attribution available to the route
  // being served on this same request, while persisting it on the response keeps
  // first-touch and last-touch context alive through the later Stripe redirect.
  const attribution = captureAttributionOnRequest(request);
  const response = await updateSession(request);
  persistAttributionCookies(response, attribution.cookiesToPersist);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|json|js)$).*)"],
};
