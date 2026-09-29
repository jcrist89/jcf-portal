import type { Profile } from "@/lib/types";

/**
 * Legacy imported accounts were given generated reacher-build.invalid emails.
 * Those are useful identifiers, but they are not usable client-facing names.
 */
export function profileDisplayName(profile: Pick<Profile, "full_name" | "email">): string {
  const fullName = profile.full_name?.trim();
  if (fullName) return fullName;

  const email = profile.email?.trim();
  if (!email || email.endsWith("@accounts.reacher-build.invalid")) return "Pending client";

  return email;
}
