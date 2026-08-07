/**
 * Password complexity policy, enforced server-side everywhere a password is
 * set: initial user creation, admin reset, forced first-login reset, and
 * self-service change. Never trust a frontend-only check for this.
 */
export const PASSWORD_MIN_LENGTH = 10;

export interface PasswordCheck {
  valid: boolean;
  errors: string[];
}

export function validatePassword(password: string): PasswordCheck {
  const errors: string[] = [];

  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Must be at least ${PASSWORD_MIN_LENGTH} characters.`);
  }
  if (!/[a-z]/.test(password)) errors.push("Must include a lowercase letter.");
  if (!/[A-Z]/.test(password)) errors.push("Must include an uppercase letter.");
  if (!/[0-9]/.test(password)) errors.push("Must include a number.");
  if (!/[^a-zA-Z0-9]/.test(password)) errors.push("Must include a symbol.");

  return { valid: errors.length === 0, errors };
}

/** Generates a random temporary password that satisfies the policy above. */
export function generateTemporaryPassword(): string {
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const upper = "ABCDEFGHJKMNPQRSTUVWXYZ";
  const digits = "23456789";
  const symbols = "!@#$%^&*";
  const all = lower + upper + digits + symbols;

  function pick(chars: string) {
    return chars[Math.floor(Math.random() * chars.length)];
  }

  let pwd = pick(lower) + pick(upper) + pick(digits) + pick(symbols);
  for (let i = pwd.length; i < 14; i++) pwd += pick(all);

  // Shuffle so the guaranteed-class characters aren't always in the same spot
  return pwd
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
}
