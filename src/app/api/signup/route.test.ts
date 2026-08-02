import { describe, it, expect, vi, beforeEach } from "vitest";
import { FakeSupabase } from "@/test/fakeSupabase";

let db: FakeSupabase;
const createUser = vi.fn();
const signInWithPassword = vi.fn().mockResolvedValue({ error: null });

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => Object.assign(db, { auth: { admin: { createUser } } }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({ auth: { signInWithPassword: (...a: any[]) => signInWithPassword(...a) } }),
}));
const sendWelcomeEmailOnce = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/email/sendWelcome", () => ({ sendWelcomeEmailOnce: (...a: any[]) => sendWelcomeEmailOnce(...a) }));

function fakeRequest(body: unknown) {
  return { json: async () => body } as any;
}

beforeEach(() => {
  db = new FakeSupabase({
    profiles: [],
    programs: [
      { id: "tmpl-1", goal: "strength_gain", name: "Strength Gain — Starting Template", description: "d", structure: { weeks: [] }, is_template: true, is_default_template: true, client_id: null },
    ],
  });
  createUser.mockReset();
  sendWelcomeEmailOnce.mockClear();
  signInWithPassword.mockClear();
});

describe("POST /api/signup — free tier", () => {
  it("creates the auth user, assigns the default template for the chosen goal, and sends the welcome email", async () => {
    createUser.mockResolvedValue({ data: { user: { id: "new-user-1" } }, error: null });
    // In production, handle_new_auth_user() (a Postgres trigger on auth.users,
    // see supabase/migrations/0014) inserts this profiles row the instant
    // createUser() succeeds. The fake DB doesn't run real triggers, so this seeds
    // the row it would have created.
    db.tables.profiles.push({ id: "new-user-1", role: "client", tier: "free", full_name: null, goal: null, program_id: null });

    const { POST } = await import("./route");
    const res = await POST(
      fakeRequest({ fullName: "Jamie Lee", email: "jamie@example.com", password: "longenough1", goal: "strength_gain", tier: "free" }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.checkoutUrl).toBeNull();

    const profile = db.tables.profiles.find((p) => p.id === "new-user-1")!;
    expect(profile.full_name).toBe("Jamie Lee");
    expect(profile.goal).toBe("strength_gain");
    expect(profile.program_id).toBeTruthy();

    const program = db.tables.programs.find((p) => p.id === profile.program_id)!;
    expect(program.is_template).toBe(false);
    expect(program.client_id).toBe("new-user-1");
    expect(program.name).toBe("Strength Gain — Starting Template");

    expect(sendWelcomeEmailOnce).toHaveBeenCalledTimes(1);
  });

  it("rejects a duplicate email before creating an auth user", async () => {
    db.tables.profiles.push({ id: "existing", email: "jamie@example.com", role: "client" });
    const { POST } = await import("./route");
    const res = await POST(
      fakeRequest({ fullName: "Jamie Lee", email: "jamie@example.com", password: "longenough1", goal: "strength_gain", tier: "free" }),
    );
    expect(res.status).toBe(409);
    expect(createUser).not.toHaveBeenCalled();
  });

  it("rejects a password under 8 characters", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      fakeRequest({ fullName: "Jamie Lee", email: "jamie@example.com", password: "short", goal: "strength_gain", tier: "free" }),
    );
    expect(res.status).toBe(400);
    expect(createUser).not.toHaveBeenCalled();
  });
});
