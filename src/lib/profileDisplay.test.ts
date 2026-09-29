import { describe, expect, it } from "vitest";
import { profileDisplayName } from "@/lib/profileDisplay";

describe("profileDisplayName", () => {
  it("uses the client's entered name when available", () => {
    expect(profileDisplayName({ full_name: "  Chace Miller ", email: "chace@example.com" })).toBe("Chace Miller");
  });

  it("hides legacy generated placeholder emails", () => {
    expect(profileDisplayName({ full_name: null, email: "abc@accounts.reacher-build.invalid" })).toBe("Pending client");
  });

  it("uses a normal email until the client supplies a name", () => {
    expect(profileDisplayName({ full_name: null, email: "new.client@example.com" })).toBe("new.client@example.com");
  });
});