import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeSupabase } from "@/test/fakeSupabase";

let db: FakeSupabase;
const assignProgram = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  supabaseForRequest: async () => ({
    client: db,
    session: {
      id: "client-1",
      role: "client",
      fullName: "Jamie",
      tier: "free",
      onboarded: false,
      timezone: "America/New_York",
    },
    profile: db.tables.profiles.find((row) => row.id === "client-1"),
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: () => db }));
vi.mock("@/server/schedule", () => ({
  assignProgram: (...args: any[]) => assignProgram(...args),
}));

function request(body: unknown) {
  return { json: async () => body } as any;
}

beforeEach(() => {
  db = new FakeSupabase({
    profiles: [{
      id: "client-1",
      full_name: "Jamie",
      goal: null,
      program_id: null,
      timezone: "America/New_York",
      onboarded: false,
    }],
    programs: [{
      id: "template-1",
      goal: "fat_loss",
      name: "Fat Loss - Starting Template",
      description: "Five-day fat-loss plan.",
      is_template: true,
      is_default_template: true,
      structure: {
        weeks: [{
          week: 1,
          days: Array.from({ length: 5 }, (_, index) => ({
            day: index + 1,
            label: `Day ${index + 1}`,
            exercises: [],
          })),
        }],
      },
    }],
    measurements: [],
  });
  assignProgram.mockReset();
  assignProgram.mockResolvedValue({ assignment: { id: "assignment-1" }, sessions: 3 });
});

describe("POST /api/profile", () => {
  it("calculates targets and assigns a goal template fitted to training days", async () => {
    const { POST } = await import("./route");
    const response = await POST(request({
      fullName: "Jamie Lee",
      goal: "fat_loss",
      sex: "female",
      age: 32,
      units: "imperial",
      height: 66,
      weight: 200,
      experience: "intermediate",
      trainingDays: 3,
      equipment: ["full_gym"],
      dietaryPreferences: ["gluten_free"],
      dietaryNotes: "Peanut allergy",
    }));

    expect(response.status).toBe(200);
    const profile = db.tables.profiles[0];
    expect(profile.goal).toBe("fat_loss");
    expect(profile.maintenance_calories).toBe(2400);
    expect(profile.target_calories).toBe(2040);
    expect(profile.protein_grams).toBe(179);
    expect(profile.carb_grams).toBe(204);
    expect(profile.fat_grams).toBe(57);
    expect(profile.available_equipment).toEqual(["full_gym"]);
    expect(profile.onboarded).toBe(true);

    const assignedProgram = db.tables.programs.find((row) => row.client_id === "client-1")!;
    expect(assignedProgram.structure.weeks[0].days).toHaveLength(3);
    expect(assignProgram).toHaveBeenCalledWith(db, expect.objectContaining({
      profileId: "client-1",
      programId: assignedProgram.id,
      scheduleMode: "sequential",
    }));
  });

  it("rejects an implausible body measurement", async () => {
    const { POST } = await import("./route");
    const response = await POST(request({
      fullName: "Jamie Lee",
      goal: "fat_loss",
      sex: "female",
      age: 32,
      units: "metric",
      height: 30,
      weight: 90,
      experience: "beginner",
      trainingDays: 3,
      equipment: ["dumbbells"],
      dietaryPreferences: [],
    }));
    expect(response.status).toBe(400);
  });
});
