import type { NextRequest, NextResponse } from "next/server";

export const ATTR_VISITOR_COOKIE = "jcf_vid";
export const ATTR_FIRST_COOKIE = "jcf_attr_first";
export const ATTR_LAST_COOKIE = "jcf_attr_last";
export const ATTR_COOKIE_MAX_AGE = 60 * 60 * 24 * 90;

export type AttributionTouch = {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  contentId: string | null;
  term: string | null;
  landingPath: string | null;
  referrer: string | null;
  capturedAt: string;
};

const MAX_VALUE = 160;
const MAX_PATH = 500;

function clean(value: string | null | undefined, max = MAX_VALUE): string | null {
  if (!value) return null;
  const normalized = value.trim().replace(/[\u0000-\u001F\u007F]/g, "").slice(0, max);
  return normalized || null;
}

function cleanReferrer(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return clean(`${url.origin}${url.pathname}`, MAX_PATH);
  } catch {
    return clean(value, MAX_PATH);
  }
}

function encodeUtf8Base64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeUtf8Base64Url(value: string): string {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeTouch(touch: AttributionTouch): string {
  return encodeUtf8Base64Url(JSON.stringify(touch));
}

export function decodeTouch(value: string | null | undefined): AttributionTouch | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(decodeUtf8Base64Url(value)) as Partial<AttributionTouch>;
    if (!parsed.capturedAt) return null;
    return {
      source: clean(parsed.source),
      medium: clean(parsed.medium),
      campaign: clean(parsed.campaign),
      contentId: clean(parsed.contentId),
      term: clean(parsed.term),
      landingPath: clean(parsed.landingPath, MAX_PATH),
      referrer: clean(parsed.referrer, MAX_PATH),
      capturedAt: String(parsed.capturedAt),
    };
  } catch {
    return null;
  }
}

export function touchFromRequest(request: NextRequest): AttributionTouch | null {
  const params = request.nextUrl.searchParams;
  const source = clean(params.get("utm_source") ?? params.get("source") ?? params.get("src"));
  const medium = clean(params.get("utm_medium") ?? params.get("medium"));
  const campaign = clean(params.get("utm_campaign") ?? params.get("campaign"));
  const contentId = clean(
    params.get("utm_content") ?? params.get("content_id") ?? params.get("content"),
  );
  const term = clean(params.get("utm_term") ?? params.get("term"));

  if (![source, medium, campaign, contentId, term].some(Boolean)) return null;

  return {
    source,
    medium,
    campaign,
    contentId,
    term,
    // Campaign fields are stored separately. Keeping arbitrary query strings
    // adds no analytical value and can accidentally retain unrelated identifiers.
    landingPath: clean(request.nextUrl.pathname, MAX_PATH),
    referrer: cleanReferrer(request.headers.get("referer")),
    capturedAt: new Date().toISOString(),
  };
}

export function defaultOnsiteTouch(path: string, contentId: string): AttributionTouch {
  return {
    source: "website",
    medium: "onsite",
    campaign: "core_offers",
    contentId,
    term: null,
    landingPath: clean(path, MAX_PATH),
    referrer: null,
    capturedAt: new Date().toISOString(),
  };
}

export function ensureVisitorId(request: NextRequest): { visitorId: string; created: boolean } {
  const existing = request.cookies.get(ATTR_VISITOR_COOKIE)?.value;
  if (existing && /^[0-9a-f-]{36}$/i.test(existing)) return { visitorId: existing, created: false };
  const visitorId = crypto.randomUUID();
  request.cookies.set(ATTR_VISITOR_COOKIE, visitorId);
  return { visitorId, created: true };
}

export function captureAttributionOnRequest(request: NextRequest): {
  visitorId: string | null;
  first: AttributionTouch | null;
  last: AttributionTouch | null;
  cookiesToPersist: Array<{ name: string; value: string }>;
} {
  const inbound = touchFromRequest(request);
  if (!inbound) {
    return {
      visitorId: request.cookies.get(ATTR_VISITOR_COOKIE)?.value ?? null,
      first: decodeTouch(request.cookies.get(ATTR_FIRST_COOKIE)?.value),
      last: decodeTouch(request.cookies.get(ATTR_LAST_COOKIE)?.value),
      cookiesToPersist: [],
    };
  }

  const { visitorId, created } = ensureVisitorId(request);
  const existingFirst = decodeTouch(request.cookies.get(ATTR_FIRST_COOKIE)?.value);
  const first = existingFirst ?? inbound;
  const last = inbound;

  request.cookies.set(ATTR_FIRST_COOKIE, encodeTouch(first));
  request.cookies.set(ATTR_LAST_COOKIE, encodeTouch(last));

  const cookiesToPersist = [
    ...(created ? [{ name: ATTR_VISITOR_COOKIE, value: visitorId }] : []),
    ...(existingFirst ? [] : [{ name: ATTR_FIRST_COOKIE, value: encodeTouch(first) }]),
    { name: ATTR_LAST_COOKIE, value: encodeTouch(last) },
  ];

  return { visitorId, first, last, cookiesToPersist };
}

export function persistAttributionCookies(
  response: NextResponse,
  cookies: Array<{ name: string; value: string }>,
): void {
  for (const cookie of cookies) {
    response.cookies.set(cookie.name, cookie.value, {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: ATTR_COOKIE_MAX_AGE,
    });
  }
}

export function touchDbFields(prefix: "first" | "last", touch: AttributionTouch | null) {
  return {
    [`${prefix}_source`]: touch?.source ?? null,
    [`${prefix}_medium`]: touch?.medium ?? null,
    [`${prefix}_campaign`]: touch?.campaign ?? null,
    [`${prefix}_content_id`]: touch?.contentId ?? null,
    [`${prefix}_term`]: touch?.term ?? null,
    [`${prefix}_landing_path`]: touch?.landingPath ?? null,
    [`${prefix}_referrer`]: touch?.referrer ?? null,
    [`${prefix}_captured_at`]: touch?.capturedAt ?? null,
  };
}
