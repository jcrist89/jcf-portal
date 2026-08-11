import { describe, it, expect, vi, beforeEach } from "vitest";

const redirectMock = vi.fn((path: string) => {
  throw new Error(`REDIRECT:${path}`);
});
vi.mock("next/navigation", () => ({ redirect: (path: string) => redirectMock(path) }));

const mockSupabaseForRequest = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ supabaseForRequest: () => mockSupabaseForRequest() }));

function session(overrides: Partial<{ role: "client" | "coach"; onboarded: boolean }> = {}) {
  return {
    id: "u1",
    email: "a@b.com",
    role: "client" as const,
    fullName: "A",
    tier: "free",
    onboarded: true,
    ...overrides,
  };
}

beforeEach(() => {
  redirectMock.mockClear();
});

describe("requireUser — interrupted onboarding recovery", () => {
  it("redirects an un-onboarded client to /onboarding when a client page is required", async () => {
    mockSupabaseForRequest.mockResolvedValue({ client: {}, session: session({ onboarded: false }) });
    const { requireUser } = await import("./require");
    await expect(requireUser("client")).rejects.toThrow("REDIRECT:/onboarding");
  });

  it("does not redirect an onboarded client", async () => {
    mockSupabaseForRequest.mockResolvedValue({ client: {}, session: session({ onboarded: true }) });
    const { requireUser } = await import("./require");
    const result = await requireUser("client");
    expect(result.session.onboarded).toBe(true);
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("does not gate on onboarding when no specific role is required (e.g. settings)", async () => {
    mockSupabaseForRequest.mockResolvedValue({ client: {}, session: session({ onboarded: false }) });
    const { requireUser } = await import("./require");
    const result = await requireUser();
    expect(result.session.onboarded).toBe(false);
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("sends a signed-out visitor to /login before any onboarding check", async () => {
    mockSupabaseForRequest.mockResolvedValue(null);
    const { requireUser } = await import("./require");
    await expect(requireUser("client")).rejects.toThrow("REDIRECT:/login");
  });

  it("redirects a client requesting a coach-only page to /dashboard", async () => {
    mockSupabaseForRequest.mockResolvedValue({ client: {}, session: session({ role: "client", onboarded: true }) });
    const { requireUser } = await import("./require");
    await expect(requireUser("coach")).rejects.toThrow("REDIRECT:/dashboard");
  });
});
