import bcrypt from "bcryptjs";

/** Generate a random numeric PIN of the given length (default 6 digits). */
export function generatePin(length = 6): string {
  let pin = "";
  for (let i = 0; i < length; i++) {
    pin += Math.floor(Math.random() * 10).toString();
  }
  return pin;
}

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 10);
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash);
}

/** username: lowercase, alphanumeric + dashes/underscores, 3-24 chars. */
export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
}
