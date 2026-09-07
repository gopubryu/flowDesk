/** Korean particle helpers (batchim-aware). */

/**
 * Digit pronunciation → 을/를 (product/QA map).
 * Reading used: 0영 1일 2이 3삼 4사 5오 6육 7칠 8팔 9구
 * Standard batchim would give 3(삼/ㅁ)→을, but QA/product rule:
 * treat trailing digit 3 as 를 (삼, 받침 없음 for this product).
 * Map (을 = true batchim-like): 0,1,6,7,8 → 을; 2,3,4,5,9 → 를
 * Quick check: withEulReul("ADJ-260907-03") === "ADJ-260907-03를"
 */
const DIGIT_HAS_BATCHIM: Record<string, boolean> = {
  "0": true, // 영/공
  "1": true, // 일
  "2": false, // 이
  "3": false, // 삼 — QA: 를
  "4": false, // 사
  "5": false, // 오
  "6": true, // 육
  "7": true, // 칠
  "8": true, // 팔
  "9": false, // 구
};

function lastSignificantChar(word: string): string | null {
  const s = String(word ?? "").trim();
  if (!s) return null;
  return s[s.length - 1] ?? null;
}

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

/** True when the last character takes 을 (batchim / digit map / Latin consonant). */
export function hasBatchim(word: string): boolean {
  const s = String(word ?? "").trim();
  if (!s) return false;
  const last = lastSignificantChar(s)!;

  // Digits / alphanumeric codes: last char digit → pronunciation map
  if (/[0-9]/.test(last)) {
    return DIGIT_HAS_BATCHIM[last] ?? false;
  }

  // Hangul: real batchim of last Hangul syllable if last char is Hangul
  if (/[\uAC00-\uD7A3]/.test(last)) {
    return (last.charCodeAt(0) - 0xac00) % 28 !== 0;
  }

  // Latin letter: vowels → 를, consonants → 을 (common convention)
  if (/[A-Za-z]/.test(last)) {
    return !/[AEIOUaeiou]/.test(last);
  }

  // Fallback: scan last Hangul in the string
  const hangul = lastHangulChar(s);
  if (hangul) {
    return (hangul.charCodeAt(0) - 0xac00) % 28 !== 0;
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

/** `${word}${을/를}` — e.g. ADJ-260907-03 → ADJ-260907-03를 */
export function withEulReul(word: string): string {
  return `${word}${eulReul(word)}`;
}
