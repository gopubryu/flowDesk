/** Korean particle helpers (batchim-aware). */

function lastHangulChar(word: string): string | null {
  const s = String(word ?? "").trim();
  if (!s) return null;
  for (let i = s.length - 1; i >= 0; i--) {
    const ch = s[i]!;
    const code = ch.charCodeAt(0);
    if (code >= 0xac00 && code <= 0xd7a3) return ch;
  }
  return null;
}

/** True when the last Hangul syllable has a batchim (받침). Digits/Latin: odd last digit / consonant-ish → batchim-like. */
export function hasBatchim(word: string): boolean {
  const hangul = lastHangulChar(word);
  if (hangul) {
    return (hangul.charCodeAt(0) - 0xac00) % 28 !== 0;
  }
  const s = String(word ?? "").trim();
  if (!s) return false;
  const last = s[s.length - 1]!;
  if (/[0-9]/.test(last)) {
    // 1,3,6,7,8 typically take 을; 0,2,4,5,9 take 를 — approximate by Korean reading
    return "136780".includes(last);
  }
  // Latin letter: treat consonant as batchim-like
  if (/[A-Za-z]/.test(last)) {
    return !/[AEIOUaeiou]/.test(last);
  }
  return false;
}

/** 을/를 */
export function eulReul(word: string): string {
  return hasBatchim(word) ? "을" : "를";
}

/** 이/가 */
export function iGa(word: string): string {
  return hasBatchim(word) ? "이" : "가";
}

/** 은/는 */
export function eunNeun(word: string): string {
  return hasBatchim(word) ? "은" : "는";
}

/** `${word}${을/를}` */
export function withEulReul(word: string): string {
  return `${word}${eulReul(word)}`;
}
