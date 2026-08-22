import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  notifyFilePickerOpening,
  isFilePickerOpen,
  consumeFilePickerReturn,
} from "./file-picker-guard";

// This module holds module-level singleton state (not per-instance), so
// each test resets it via consumeFilePickerReturn() to avoid leaking state
// between tests.
beforeEach(() => {
  consumeFilePickerReturn();
});

describe("file-picker-guard", () => {
  it("starts closed: no picker open, nothing to consume", () => {
    expect(isFilePickerOpen()).toBe(false);
    expect(consumeFilePickerReturn()).toBe(false);
  });

  it("marks the picker open when notified", () => {
    notifyFilePickerOpening();
    expect(isFilePickerOpen()).toBe(true);
  });

  it("consumes exactly once: the first focus-return clears the flag", () => {
    notifyFilePickerOpening();

    expect(consumeFilePickerReturn()).toBe(true);
    expect(isFilePickerOpen()).toBe(false);

    // A second focus event right after should NOT be treated as another
    // picker close -- this is what lets normal tab-switching refreshes
    // resume immediately afterward.
    expect(consumeFilePickerReturn()).toBe(false);
  });

  it("has no fixed cooldown -- stays open no matter how long the picker takes", () => {
    vi.useFakeTimers();
    try {
      notifyFilePickerOpening();

      // The old (buggy) v1 guard expired after a fixed 2 seconds. This
      // version has no such timer for normal use -- simulate someone
      // spending a full minute browsing to a file.
      vi.advanceTimersByTime(60_000);

      expect(isFilePickerOpen()).toBe(true);
      expect(consumeFilePickerReturn()).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("self-clears via the safety net if focus never returns (backstop only)", () => {
    vi.useFakeTimers();
    try {
      notifyFilePickerOpening();
      expect(isFilePickerOpen()).toBe(true);

      vi.advanceTimersByTime(5 * 60 * 1000 + 1);

      expect(isFilePickerOpen()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("re-arms the safety net if a picker is opened again before the first one clears", () => {
    vi.useFakeTimers();
    try {
      notifyFilePickerOpening();
      vi.advanceTimersByTime(4 * 60 * 1000); // 4 minutes in, still within safety window

      notifyFilePickerOpening(); // opened again -- should extend, not expire early
      vi.advanceTimersByTime(4 * 60 * 1000); // another 4 minutes (8 total from first call)

      // Still open because the second call reset the 5-minute backstop.
      expect(isFilePickerOpen()).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
