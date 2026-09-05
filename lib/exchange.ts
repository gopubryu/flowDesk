export type ExchangeRate = {
  code: string;
  name: string;
  rate: number;
  unit: number;
};

export type RateSourcePayload = {
  source: "naver" | "open-er-api" | "demo";
  updatedAt: string;
  rates: ExchangeRate[];
  error?: string;
};

/** Dual-source response from /api/exchange */
export type ExchangeResponse = {
  updatedAt: string;
  bank: RateSourcePayload;
  market: RateSourcePayload;
};

/** @deprecated Prefer ExchangeResponse with bank/market; kept for legacy single-source shape */
export type LegacyExchangeResponse = {
  updatedAt: string;
  source: "naver" | "demo";
  base: "KRW";
  rates: ExchangeRate[];
};

/** Major currencies highlighted in selects */
export const MAJOR_CODES = [
  "KRW",
  "USD",
  "EUR",
  "JPY",
  "CNY",
  "GBP",
  "HKD",
  "TWD",
  "AUD",
  "CAD",
  "SGD",
  "THB",
  "VND",
  "IDR",
] as const;

export const POPULAR_CODES = ["JPY", "USD", "EUR", "CNY", "GBP"] as const;

export const CURRENCY_NAMES: Record<string, string> = {
  KRW: "?€?œë?êµ???,
  USD: "ë¯¸êµ­ ?¬ëŸ¬",
  EUR: "? ëŸ½?°í•© ? ë¡œ",
  JPY: "?¼ë³¸ ??,
  CNY: "ì¤‘êµ­ ?„ì•ˆ",
  HKD: "?ì½© ?¬ëŸ¬",
  TWD: "?€ë§??¬ëŸ¬",
  GBP: "?êµ­ ?Œìš´??,
  CAD: "ìºë‚˜???¬ëŸ¬",
  CHF: "?¤ìœ„???„ëž‘",
  AUD: "?¸ì£¼ ?¬ëŸ¬",
  NZD: "?´ì§ˆ?œë“œ ?¬ëŸ¬",
  SGD: "?±ê??¬ë¥´ ?¬ëŸ¬",
  THB: "?œêµ­ ë°”íŠ¸",
  VND: "ë² íŠ¸????,
  IDR: "?¸ë„?¤ì‹œ??ë£¨í”¼??,
  MYR: "ë§ë ˆ?´ì‹œ??ë§ê¹ƒ",
  PHP: "?„ë¦¬?€ ?˜ì†Œ",
  INR: "?¸ë„ ë£¨í”¼",
  RUB: "?¬ì‹œ??ë£¨ë¸”",
  BRL: "ë¸Œë¼ì§??¤ì•Œ",
  SEK: "?¤ì›¨???¬ë¡œ??,
  DKK: "?´ë§ˆ???¬ë¡œ??,
  NOK: "?¸ë¥´?¨ì´ ?¬ë¡œ??,
  TRY: "?€ë¥´í‚¤??ë¦¬ë¼",
  MXN: "ë©•ì‹œì½??˜ì†Œ",
  ZAR: "?¨ì•„?„ë¦¬ì¹??œë“œ",
  PLN: "?´ë???ì¦ˆì›Œ??,
  CZK: "ì²´ì½” ì½”ë£¨??,
  HUF: "?ê?ë¦??¬ë¦°??,
  AED: "?„ëž?ë?ë¦¬íŠ¸ ?”ë¥´??,
  SAR: "?¬ìš°??ë¦¬ì–„",
  ILS: "?´ìŠ¤?¼ì—˜ ?°ì¼ˆ",
  EGP: "?´ì§‘???Œìš´??,
  PKR: "?Œí‚¤?¤íƒ„ ë£¨í”¼",
  BDT: "ë°©ê??¼ë°???€ì¹?,
  KZT: "ì¹´ìž?ìŠ¤???¡ê²Œ",
  MNT: "ëª½ê³¨ ?¬ê·¸ë¦?,
  OMR: "?¤ë§Œ ë¦¬ì•Œ",
  KWD: "ì¿ ì›¨?´íŠ¸ ?”ë‚˜ë¥?,
  BHD: "ë°”ë ˆ???”ë‚˜ë¥?,
  JOD: "?”ë¥´???”ë‚˜ë¥?,
  QAR: "ì¹´í?ë¥?ë¦¬ì–„",
  BND: "ë¸Œë£¨?˜ì´ ?¬ëŸ¬",
  CLP: "ì¹ ë ˆ ?˜ì†Œ",
  COP: "ì½œë¡¬ë¹„ì•„ ?˜ì†Œ",
  LKR: "?¤ë¦¬?‘ì¹´ ë£¨í”¼",
  NPR: "?¤íŒ” ë£¨í”¼",
  RON: "ë£¨ë§ˆ?ˆì•„ ?ˆìš°",
  LYD: "ë¦¬ë¹„???”ë‚˜ë¥?,
  MOP: "ë§ˆì¹´???Œí?ì¹?,
  MMK: "ë¯¸ì?ë§?ì§?,
  ETB: "?í‹°?¤í”¼??ë¹„ë¥´",
  UZS: "?°ì¦ˆë² í‚¤?¤íƒ„ ??,
  KHR: "ìº„ë³´?”ì•„ ë¦¬ì—˜",
  FJD: "?¼ì? ?¬ëŸ¬",
  DZD: "?Œì œë¦??”ë‚˜ë¥?,
  KES: "ì¼€???¤ë§",
  TZS: "?„ìž?ˆì•„ ?¤ë§",
};

/** Currencies Naver quotes per 100 units by default */
export const UNIT_100_DEFAULT = new Set(["JPY", "VND", "IDR"]);

/** Snapshot for offline / API failure (?ˆì‹œ ?˜ìœ¨) ??bank-style units */
export const DEMO_RATES: ExchangeRate[] = [
  { code: "KRW", name: CURRENCY_NAMES.KRW, rate: 1, unit: 1 },
  { code: "USD", name: CURRENCY_NAMES.USD, rate: 1348.2, unit: 1 },
  { code: "EUR", name: CURRENCY_NAMES.EUR, rate: 1565.4, unit: 1 },
  { code: "JPY", name: CURRENCY_NAMES.JPY, rate: 864.59, unit: 100 },
  { code: "CNY", name: CURRENCY_NAMES.CNY, rate: 201.03, unit: 1 },
  { code: "HKD", name: CURRENCY_NAMES.HKD, rate: 172.0, unit: 1 },
  { code: "TWD", name: CURRENCY_NAMES.TWD, rate: 42.6, unit: 1 },
  { code: "GBP", name: CURRENCY_NAMES.GBP, rate: 1821.0, unit: 1 },
  { code: "CAD", name: CURRENCY_NAMES.CAD, rate: 973.0, unit: 1 },
  { code: "CHF", name: CURRENCY_NAMES.CHF, rate: 1663.0, unit: 1 },
  { code: "AUD", name: CURRENCY_NAMES.AUD, rate: 970.0, unit: 1 },
  { code: "NZD", name: CURRENCY_NAMES.NZD, rate: 793.0, unit: 1 },
  { code: "SGD", name: CURRENCY_NAMES.SGD, rate: 1064.0, unit: 1 },
  { code: "THB", name: CURRENCY_NAMES.THB, rate: 40.94, unit: 1 },
  { code: "VND", name: CURRENCY_NAMES.VND, rate: 5.18, unit: 100 },
  { code: "IDR", name: CURRENCY_NAMES.IDR, rate: 7.66, unit: 100 },
  { code: "MYR", name: CURRENCY_NAMES.MYR, rate: 333.0, unit: 1 },
  { code: "PHP", name: CURRENCY_NAMES.PHP, rate: 21.55, unit: 1 },
  { code: "INR", name: CURRENCY_NAMES.INR, rate: 14.27, unit: 1 },
  { code: "RUB", name: CURRENCY_NAMES.RUB, rate: 15.66, unit: 1 },
  { code: "BRL", name: CURRENCY_NAMES.BRL, rate: 262.86, unit: 1 },
];

/** Mid-market demo rates ??always unit 1 (true per-1 KRW) */
export const DEMO_MARKET_RATES: ExchangeRate[] = DEMO_RATES.map((r) => ({
  ...r,
  rate: r.rate / r.unit,
  unit: 1,
}));

export function currencyName(code: string): string {
  return CURRENCY_NAMES[code] ?? code;
}

/** KRW per 1 unit of foreign currency (normalized). Alias: effectiveRate. */
export function krwPerUnit(r: ExchangeRate): number {
  return r.rate / r.unit;
}

/** Effective KRW-per-1 rate (= rate / unit). */
export function effectiveRate(r: ExchangeRate): number {
  return krwPerUnit(r);
}

export function convertAmount(
  amount: number,
  from: ExchangeRate,
  to: ExchangeRate
): number {
  if (!Number.isFinite(amount)) return 0;
  const amountKRW = amount * krwPerUnit(from);
  return amountKRW / krwPerUnit(to);
}

export function formatRateNumber(n: number, maxFrac = 4): string {
  if (!Number.isFinite(n)) return "??;
  const abs = Math.abs(n);
  let fractionDigits = maxFrac;
  if (abs >= 100) fractionDigits = 2;
  else if (abs >= 1) fractionDigits = 2;
  else if (abs >= 0.01) fractionDigits = 4;
  else fractionDigits = 6;
  return new Intl.NumberFormat("ko-KR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  }).format(n);
}

export function rateExplanation(from: ExchangeRate, to: ExchangeRate): string {
  if (from.code === to.code) return `1 ${from.code} = 1 ${to.code}`;
  // Prefer showing bank quote style when one side is KRW
  if (to.code === "KRW") {
    return `${from.unit} ${from.code} = ${formatRateNumber(from.rate, 2)} KRW`;
  }
  if (from.code === "KRW") {
    const oneKrwInTo = 1 / krwPerUnit(to);
    return `1 KRW = ${formatRateNumber(oneKrwInTo)} ${to.code}`;
  }
  const oneFromInTo = convertAmount(1, from, to);
  return `1 ${from.code} = ${formatRateNumber(oneFromInTo)} ${to.code}`;
}

/**
 * Display rate for comparison tables.
 * For unit-100 currencies (JPY etc.), show KRW per 100 to match Naver style.
 */
export function displayRateForCompare(
  r: ExchangeRate | undefined,
  preferUnit: number
): number | null {
  if (!r) return null;
  const per1 = effectiveRate(r);
  return per1 * preferUnit;
}

export function naverDetailUrl(code: string): string {
  return `https://finance.naver.com/marketindex/exchangeDetail.naver?marketindexCd=FX_${code}KRW`;
}
