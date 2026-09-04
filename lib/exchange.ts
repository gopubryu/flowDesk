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

export const POPULAR_CODES = ["USD", "EUR", "JPY", "CNY", "GBP"] as const;

export const CURRENCY_NAMES: Record<string, string> = {
  KRW: "대한민국 원",
  USD: "미국 달러",
  EUR: "유럽연합 유로",
  JPY: "일본 엔",
  CNY: "중국 위안",
  HKD: "홍콩 달러",
  TWD: "대만 달러",
  GBP: "영국 파운드",
  CAD: "캐나다 달러",
  CHF: "스위스 프랑",
  AUD: "호주 달러",
  NZD: "뉴질랜드 달러",
  SGD: "싱가포르 달러",
  THB: "태국 바트",
  VND: "베트남 동",
  IDR: "인도네시아 루피아",
  MYR: "말레이시아 링깃",
  PHP: "필리핀 페소",
  INR: "인도 루피",
  RUB: "러시아 루블",
  BRL: "브라질 헤알",
  SEK: "스웨덴 크로나",
  DKK: "덴마크 크로네",
  NOK: "노르웨이 크로네",
  TRY: "튀르키예 리라",
  MXN: "멕시코 페소",
  ZAR: "남아프리카 랜드",
  PLN: "폴란드 즈워티",
  CZK: "체코 코루나",
  HUF: "헝가리 포린트",
  AED: "아랍에미리트 디르함",
  SAR: "사우디 리얄",
  ILS: "이스라엘 셰켈",
  EGP: "이집트 파운드",
  PKR: "파키스탄 루피",
  BDT: "방글라데시 타카",
  KZT: "카자흐스탄 텡게",
  MNT: "몽골 투그릭",
  OMR: "오만 리알",
  KWD: "쿠웨이트 디나르",
  BHD: "바레인 디나르",
  JOD: "요르단 디나르",
  QAR: "카타르 리얄",
  BND: "브루나이 달러",
  CLP: "칠레 페소",
  COP: "콜롬비아 페소",
  LKR: "스리랑카 루피",
  NPR: "네팔 루피",
  RON: "루마니아 레우",
  LYD: "리비아 디나르",
  MOP: "마카오 파타카",
  MMK: "미얀마 짯",
  ETB: "에티오피아 비르",
  UZS: "우즈베키스탄 숨",
  KHR: "캄보디아 리엘",
  FJD: "피지 달러",
  DZD: "알제리 디나르",
  KES: "케냐 실링",
  TZS: "탄자니아 실링",
};

/** Currencies Naver quotes per 100 units by default */
export const UNIT_100_DEFAULT = new Set(["JPY", "VND", "IDR"]);

/** Snapshot for offline / API failure (예시 환율) — bank-style units */
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

/** Mid-market demo rates — always unit 1 (true per-1 KRW) */
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
  if (!Number.isFinite(n)) return "—";
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
