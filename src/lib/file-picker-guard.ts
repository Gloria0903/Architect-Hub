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
 * React's onChange handler for the file input has run â€” so the selected
 * file is silently lost and the user has to try again with no error shown.
 *
 * FIX
 * ---
 * Anything that is about to open a native file picker calls
 * `notifyFilePickerOpening()` first. That starts a short cooldown window.
 * AppProvider's focus/visibility handlers check `isFilePickerCooldownActive()`
 * and skip the refresh while the cooldown is active, giving the file input's
 * onChange time to run first. The refresh simply happens on the next
 * interval tick or the next real focus event instead â€” nothing is lost.
 */

const COOLDOWN_MS = 2000;

let cooldownUntil = 0;

/** Call this immediately before triggering a native file picker (input.click()). */
export function notifyFilePickerOpening(): void {
  cooldownUntil = Date.now() + COOLDOWN_MS;
}

/** Whether a file picker was opened recently enough that a data refresh should be skipped. */
export function isFilePickerCooldownActive(): boolean {
  return Date.now() < cooldownUntil;
}
