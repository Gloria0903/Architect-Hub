/**
 * Fixes the silent file-upload-drop bug.
 *
 * ROOT CAUSE
 * ----------
 * AppProvider (src/store/app-store.tsx) refreshes app data whenever the
 * browser window regains focus, so staff always see current data after
 * switching tabs/apps. But opening a native OS file picker (input.click())
 * also blurs the window, and closing it (after picking a file) also
 * re-focuses it. That fires the same "focus" listener, which kicks off a
 * refresh/re-render cycle that can unmount or reset the uploader before
 * React's onChange handler for the file input has run — so the selected
 * file is silently lost and the user has to try again with no error shown.
 *
 * FIX (v2 -- state-based, not time-based)
 * ----------------------------------------
 * An earlier version of this file used a fixed cooldown timer starting
 * when the picker opened. That was wrong: a native file dialog can stay
 * open for as long as the person takes to browse to a file -- seconds or
 * minutes -- so a short fixed timer expires before the dialog even
 * closes, and the bug comes right back.
 *
 * This version instead tracks a simple "is a picker currently open" flag
 * with no time limit. It's set the moment a picker is triggered, and
 * cleared the moment the window regains focus afterward -- however long
 * that takes. AppProvider skips exactly one refresh (the one caused by
 * the picker closing) and resumes normal behavior immediately after.
 *
 * A long safety-net timeout exists only to prevent a permanently-stuck
 * flag in the rare case a picker is triggered but never actually opens.
 */

const SAFETY_NET_MS = 5 * 60 * 1000; // 5 minutes -- just a backstop, not the mechanism

let pickerOpen = false;
let safetyTimer: ReturnType<typeof setTimeout> | null = null;

/** Call this immediately before triggering a native file picker (input.click()). */
export function notifyFilePickerOpening(): void {
  pickerOpen = true;

  if (safetyTimer) clearTimeout(safetyTimer);
  safetyTimer = setTimeout(() => {
    pickerOpen = false;
  }, SAFETY_NET_MS);
}

/**
 * Whether a data refresh should currently be skipped because a file
 * picker is open (used by the 30s polling refresh, which can fire while
 * the OS dialog is still open and visibility hasn't changed).
 */
export function isFilePickerOpen(): boolean {
  return pickerOpen;
}

/**
 * Called from the window "focus" handler. If a picker was open, this
 * focus event is almost certainly the dialog closing -- consume the flag
 * and tell the caller to skip exactly this one refresh. Returns false
 * (does nothing) for every other focus event, so normal tab-switching
 * refreshes are unaffected.
 */
export function consumeFilePickerReturn(): boolean {
  if (!pickerOpen) return false;

  pickerOpen = false;
  if (safetyTimer) {
    clearTimeout(safetyTimer);
    safetyTimer = null;
  }
  return true;
}
