// Copy text to the clipboard. The clipboard API only works on https or
// localhost, so fall back to a prompt the person can copy from.
// Returns true if it copied automatically.
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    window.prompt("Copy this:", text);
    return false;
  }
}
