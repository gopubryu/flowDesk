import { NextResponse } from "next/server";
import {
  CURRENCY_NAMES,
  DEMO_MARKET_RATES,
  DEMO_RATES,
  UNIT_100_DEFAULT,
  type ExchangeRate,
  type ExchangeResponse,
  type RateSourcePayload,
  currencyName,
} from "@/lib/exchange";

export const dynamic = "force-dynamic";

const NAVER_URL = "https://finance.naver.com/marketindex/exchangeList.naver";
const MARKET_URL = "https://open.er-api.com/v6/latest/USD";
const CACHE_TTL_MS = 3 * 60 * 1000; // ~3 min combined cache
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

type CacheEntry = { at: number; body: ExchangeResponse };

let cache: CacheEntry | null = null;

/**
 * Parse Naver exchange list HTML without euc-kr decoding.
 * FX codes and sale rates are ASCII; unit-100 markers appear as "100" in the link label.
 */
function parseNaverExchangeHtml(html: string): ExchangeRate[] {
  const rates: ExchangeRate[] = [
    { code: "KRW", name: currencyName("KRW"), rate: 1, unit: 1 },
  ];
  const seen = new Set<string>(["KRW"]);

  // Capture link label separately so sale numbers like 1,100.00 don't fake unit 100
  const rowRe =
    /marketindexCd=FX_([A-Z]{3})KRW[^>]*>([\s\S]*?)<\/a>\s*<\/td>\s*<td class="sale">([\d,]+\.?\d*)<\/td>/gi;

  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(html)) !== null) {
    const code = m[1].toUpperCase();
    if (seen.has(code)) continue;
    const label = m[2];
    const rateStr = m[3].replace(/,/g, "");
    const rate = Number(rateStr);
    if (!Number.isFinite(rate)) continue;

    const unitFromPage = /\b100\b/.test(label) || /\(100/.test(label);
    const unit = unitFromPage || UNIT_100_DEFAULT.has(code) ? 100 : 1;

    rates.push({
      code,
      name: CURRENCY_NAMES[code] ?? code,
      rate,
      unit,
    });
    seen.add(code);
  }

  return rates;
}

async function fetchBankRates(): Promise<RateSourcePayload> {
  const res = await fetch(NAVER_URL, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Naver responded ${res.status}`);
  }

  const buf = Buffer.from(await res.arrayBuffer());
  // Rates/codes are ASCII; latin1 preserves bytes for regex
  const html = buf.toString("latin1");
  const rates = parseNaverExchangeHtml(html);

  if (rates.length < 2) {
    throw new Error("Failed to parse exchange rates from Naver HTML");
  }

  return {
    source: "naver",
    updatedAt: new Date().toISOString(),
    rates,
  };
}

type OpenErApiResponse = {
  result?: string;
  time_last_update_utc?: string;
  rates?: Record<string, number>;
};

/**
 * Mid-market rates from open.er-api.com (USD base → KRW-per-1 for each C).
 * All market rates use unit: 1 (true per-1).
 */
async function fetchMarketRates(): Promise<RateSourcePayload> {
  const res = await fetch(MARKET_URL, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`open.er-api.com responded ${res.status}`);
  }

  const data = (await res.json()) as OpenErApiResponse;
  if (data.result !== "success" || !data.rates) {
    throw new Error("Invalid open.er-api.com response");
  }

  const usdRates = data.rates;
  const krwPerUsd = usdRates.KRW;
  if (!Number.isFinite(krwPerUsd) || krwPerUsd <= 0) {
    throw new Error("Missing KRW rate from open.er-api.com");
  }

  const rates: ExchangeRate[] = [
    { code: "KRW", name: currencyName("KRW"), rate: 1, unit: 1 },
  ];
  const seen = new Set<string>(["KRW"]);

  for (const [code, usdPerUnit] of Object.entries(usdRates)) {
    const c = code.toUpperCase();
    if (seen.has(c) || !Number.isFinite(usdPerUnit) || usdPerUnit <= 0) continue;

    // krwPerUnit = rates.KRW / rates.C when C≠USD; for USD: rates.KRW
    const krwPerOne = c === "USD" ? krwPerUsd : krwPerUsd / usdPerUnit;

    rates.push({
      code: c,
      name: CURRENCY_NAMES[c] ?? c,
      rate: krwPerOne,
      unit: 1,
    });
    seen.add(c);
  }

  if (rates.length < 2) {
    throw new Error("No market rates parsed");
  }

  let updatedAt = new Date().toISOString();
  if (data.time_last_update_utc) {
    const parsed = Date.parse(data.time_last_update_utc);
    if (!Number.isNaN(parsed)) updatedAt = new Date(parsed).toISOString();
  }

  return {
    source: "open-er-api",
    updatedAt,
    rates,
  };
}

function demoBank(error?: string): RateSourcePayload {
  return {
    source: "demo",
    updatedAt: new Date().toISOString(),
    rates: DEMO_RATES,
    ...(error ? { error } : {}),
  };
}

function demoMarket(error?: string): RateSourcePayload {
  return {
    source: "demo",
    updatedAt: new Date().toISOString(),
    rates: DEMO_MARKET_RATES,
    ...(error ? { error } : {}),
  };
}

export async function GET() {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return NextResponse.json(cache.body, {
      headers: { "Cache-Control": "private, max-age=60" },
    });
  }

  const [bankResult, marketResult] = await Promise.allSettled([
    fetchBankRates(),
    fetchMarketRates(),
  ]);

  const bank: RateSourcePayload =
    bankResult.status === "fulfilled"
      ? bankResult.value
      : demoBank(
          bankResult.reason instanceof Error
            ? bankResult.reason.message
            : "은행 고시 환율을 불러오지 못했습니다."
        );

  const market: RateSourcePayload =
    marketResult.status === "fulfilled"
      ? marketResult.value
      : demoMarket(
          marketResult.reason instanceof Error
            ? marketResult.reason.message
            : "시장 시세를 불러오지 못했습니다."
        );

  const updatedAt =
    bank.source !== "demo"
      ? bank.updatedAt
      : market.source !== "demo"
        ? market.updatedAt
        : new Date().toISOString();

  const body: ExchangeResponse = { updatedAt, bank, market };
  cache = { at: Date.now(), body };

  return NextResponse.json(body, {
    headers: { "Cache-Control": "private, max-age=60" },
  });
}
