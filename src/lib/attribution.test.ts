import { describe, expect, it } from "vitest";
import {
  decodeTouch,
  encodeTouch,
  defaultOnsiteTouch,
  touchDbFields,
  type AttributionTouch,
} from "./attribution";

describe("attribution cookie encoding", () => {
  it("round-trips unicode and campaign values", () => {
    const touch: AttributionTouch = {
      source: "instagram",
      medium: "organic",
      campaign: "oct_2026_launch",
      contentId: "reel_014_4am",
      term: null,
      landingPath: "/pricing?utm_source=instagram",
      referrer: "https://instagram.com/",
      capturedAt: "2026-09-29T05:00:00.000Z",
    };

    expect(decodeTouch(encodeTouch(touch))).toEqual(touch);
  });

  it("rejects garbage cookie values", () => {
    expect(decodeTouch("not-a-valid-payload")).toBeNull();
  });

  it("creates a useful onsite fallback", () => {
    const touch = defaultOnsiteTouch("/pricing", "local-pif");
    expect(touch.source).toBe("website");
    expect(touch.medium).toBe("onsite");
    expect(touch.contentId).toBe("local-pif");
  });

  it("maps first and last touch fields for persistence", () => {
    const touch: AttributionTouch = {
      source: "instagram",
      medium: "dm",
      campaign: "launch",
      contentId: "reel_7",
      term: null,
      landingPath: "/go/local-pif",
      referrer: null,
      capturedAt: "2026-09-29T05:00:00.000Z",
    };

    expect(touchDbFields("last", touch)).toMatchObject({
      last_source: "instagram",
      last_medium: "dm",
      last_campaign: "launch",
      last_content_id: "reel_7",
    });
  });
});
