import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeSupabase } from "@/test/fakeSupabase";

let db: FakeSupabase;
const createUser = vi.fn();
const signInWithPassword = vi.fn().mockResolvedValue({ error: null });

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => Object.assign(db, { auth: { admin: { createUser } } }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({ auth: { signInWithPassword: (...args: any[]) => signInWithPassword(...args) } }),
}));
const sendWelcomeEmailOnce = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/email/sendWelcome", () => ({
  sendWelcomeEmailOnce: (...args: any[]) => sendWelcomeEmailOnce(...args),
}));

function fakeRequest(body: unknown) {
  return { json: async () => body } as any;
}

beforeEach(() => {
  db = new FakeSupabase({ profiles: [], programs: [] });
  createUser.mockReset();
  sendWelcomeEmailOnce.mockClear();
  signInWithPassword.mockClear();
});

describe("POST /api/signup - free tier", () => {
  it("creates the account and leaves plan assignment to onboarding", async () => {
    createUser.mockResolvedValue({ data: { user: { id: "new-user-1" } }, error: null });
    // Production's auth trigger creates the profile row. The fake database needs it seeded.
    db.tables.profiles.push({
      id: "new-user-1",
      role: "client",
      tier: "free",
      full_name: null,
      goal: null,
      program_id: null,
    });

    const { POST } = await import("./route");
    const response = await POST(fakeRequest({
      fullName: "Jamie Lee",
      email: "jamie@example.com",
      password: "longenough1",
      tier: "free",
    }));

    expect(response.status).toBe(200);
    expect((await response.json()).checkoutUrl).toBeNull();
    const profile = db.tables.profiles.find((row) => row.id === "new-user-1")!;
    expect(profile.full_name).toBe("Jamie Lee");
    expect(profile.goal).toBeNull();
    expect(profile.program_id).toBeNull();
    expect(sendWelcomeEmailOnce).toHaveBeenCalledTimes(1);
  });

  it("rejects a duplicate email before creating an auth user", async () => {
    db.tables.profiles.push({ id: "existing", email: "jamie@example.com", role: "client" });
    const { POST } = await import("./route");
    const response = await POST(fakeRequest({
      fullName: "Jamie Lee",
      email: "jamie@example.com",
      password: "longenough1",
      tier: "free",
    }));
    expect(response.status).toBe(409);
    expect(createUser).not.toHaveBeenCalled();
  });

  it("rejects a password under 8 characters", async () => {
    const { POST } = await import("./route");
    const response = await POST(fakeRequest({
      fullName: "Jamie Lee",
      email: "jamie@example.com",
      password: "short",
      tier: "free",
    }));
    expect(response.status).toBe(400);
    expect(createUser).not.toHaveBeenCalled();
  });
});
