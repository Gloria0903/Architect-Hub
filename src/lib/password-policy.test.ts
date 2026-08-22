import { describe, expect, it } from "vitest";
import { validatePassword, generateTemporaryPassword, PASSWORD_MIN_LENGTH } from "./password-policy";

describe("validatePassword", () => {
  it("accepts a password meeting every requirement", () => {
    expect(validatePassword("Str0ng!Password").valid).toBe(true);
  });

  it("rejects a password shorter than the minimum length", () => {
    const result = validatePassword("Ab1!");
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes(String(PASSWORD_MIN_LENGTH)))).toBe(true);
  });

  it("rejects a password missing a lowercase letter", () => {
    const result = validatePassword("STRONG1!PASSWORD");
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("lowercase"))).toBe(true);
  });

  it("rejects a password missing an uppercase letter", () => {
    const result = validatePassword("str0ng!password");
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("uppercase"))).toBe(true);
  });

  it("rejects a password missing a number", () => {
    const result = validatePassword("Strong!Password");
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("number"))).toBe(true);
  });

  it("rejects a password missing a symbol", () => {
    const result = validatePassword("Str0ngPassword");
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("symbol"))).toBe(true);
  });

  it("reports every violated rule at once, not just the first", () => {
    const result = validatePassword("short");
    expect(result.errors.length).toBeGreaterThan(1);
  });
});

describe("generateTemporaryPassword", () => {
  it("always generates a password that satisfies the policy it enforces", () => {
    // Run many times since this involves randomness/shuffling.
    for (let i = 0; i < 50; i++) {
      expect(validatePassword(generateTemporaryPassword()).valid).toBe(true);
    }
  });

  it("generates a reasonably long password", () => {
    expect(generateTemporaryPassword().length).toBeGreaterThanOrEqual(14);
  });

  it("does not repeat the exact same password across calls", () => {
    const a = generateTemporaryPassword();
    const b = generateTemporaryPassword();
    expect(a).not.toBe(b);
  });
});
