"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  ExternalLink,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DEMO_MARKET_RATES,
  DEMO_RATES,
  MAJOR_CODES,
  POPULAR_CODES,
  UNIT_100_DEFAULT,
  convertAmount,
  displayRateForCompare,
  effectiveRate,
  formatRateNumber,
  naverDetailUrl,
  rateExplanation,
  type ExchangeRate,
  type ExchangeResponse,
  type RateSourcePayload,
} from "@/lib/exchange";
import { cn } from "@/lib/utils";

const QUICK_AMOUNTS = [1, 10, 100, 1000, 10000];

type ActiveSource = "bank" | "market";

function findRate(rates: ExchangeRate[], code: string): ExchangeRate | undefined {
  return rates.find((r) => r.code === code);
}

function sortRates(rates: ExchangeRate[]): ExchangeRate[] {
  const majorSet = new Set<string>(MAJOR_CODES);
  const major = MAJOR_CODES.map((c) => findRate(rates, c)).filter(
    Boolean
  ) as ExchangeRate[];
  const rest = rates
    .filter((r) => !majorSet.has(r.code))
    .sort((a, b) => a.code.localeCompare(b.code));
  const seen = new Set(major.map((r) => r.code));
  return [...major, ...rest.filter((r) => !seen.has(r.code))];
}

function formatUpdatedAt(iso: string): string {
  try {
    return new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function sourceLabel(kind: ActiveSource, payload: RateSourcePayload | null): string {
  if (kind === "bank") {
    if (payload?.source === "naver") return "네이버 금융 매매기준율";
    if (payload?.source === "demo") return "예시 데이터 (은행 고시)";
    return "은행 고시";
  }
  if (payload?.source === "open-er-api") return "시장 시세 (미드마켓 · open.er-api)";
  if (payload?.source === "demo") return "예시 데이터 (시장 시세)";
  return "시장 시세 (미드마켓)";
}

export default function ExchangePage() {
  const [bank, setBank] = useState<RateSourcePayload>({
    source: "demo",
    updatedAt: new Date().toISOString(),
    rates: DEMO_RATES,
  });
  const [market, setMarket] = useState<RateSourcePayload>({
    source: "demo",
    updatedAt: new Date().toISOString(),
    rates: DEMO_MARKET_RATES,
  });
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeSource, setActiveSource] = useState<ActiveSource>("bank");
  const [fromCode, setFromCode] = useState("USD");
  const [toCode, setToCode] = useState("KRW");
  const [fromAmount, setFromAmount] = useState("100");
  const [toAmount, setToAmount] = useState("");
  const [lastEdited, setLastEdited] = useState<"from" | "to">("from");

  const activeRates = activeSource === "bank" ? bank.rates : market.rates;
  const otherRates = activeSource === "bank" ? market.rates : bank.rates;
  const activePayload = activeSource === "bank" ? bank : market;
  const otherPayload = activeSource === "bank" ? market : bank;

  const sorted = useMemo(() => sortRates(activeRates), [activeRates]);
  const fromRate = findRate(activeRates, fromCode) ?? activeRates[0];
  const toRate = findRate(activeRates, toCode) ?? activeRates[0];
  const otherFrom = findRate(otherRates, fromCode);
  const otherTo = findRate(otherRates, toCode);

  const recalc = useCallback(
    (side: "from" | "to", raw: string, fr: ExchangeRate, tr: ExchangeRate) => {
      const n = Number(raw.replace(/,/g, ""));
      if (raw.trim() === "" || Number.isNaN(n)) {
        if (side === "from") setToAmount("");
        else setFromAmount("");
        return;
      }
      if (side === "from") {
        const result = convertAmount(n, fr, tr);
        setToAmount(formatRateNumber(result, 6));
      } else {
        const result = convertAmount(n, tr, fr);
        setFromAmount(formatRateNumber(result, 6));
      }
    },
    []
  );

  const loadRates = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/exchange", { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          body.message || body.error || "환율을 불러오지 못했습니다."
        );
      }
      const data = (await res.json()) as ExchangeResponse;
      if (!data.bank?.rates?.length && !data.market?.rates?.length) {
        throw new Error("환율 데이터가 비어 있습니다.");
      }
      if (data.bank?.rates?.length) setBank(data.bank);
      if (data.market?.rates?.length) setMarket(data.market);
      setUpdatedAt(data.updatedAt ?? null);
      setLoadError(null);
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "환율을 불러오지 못했습니다.";
      setLoadError(msg);
      setBank({
        source: "demo",
        updatedAt: new Date().toISOString(),
        rates: DEMO_RATES,
        error: msg,
      });
      setMarket({
        source: "demo",
        updatedAt: new Date().toISOString(),
        rates: DEMO_MARKET_RATES,
        error: msg,
      });
      setUpdatedAt(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRates();
  }, [loadRates]);

  // Recalculate when rates, pair, or active source change
  useEffect(() => {
    if (!fromRate || !toRate) return;
    if (lastEdited === "from") {
      recalc("from", fromAmount, fromRate, toRate);
    } else {
      recalc("to", toAmount, fromRate, toRate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when rates/pair/source change
  }, [activeRates, fromCode, toCode, fromRate, toRate, activeSource]);

  function onFromAmountChange(v: string) {
    setLastEdited("from");
    setFromAmount(v);
    if (fromRate && toRate) recalc("from", v, fromRate, toRate);
  }

  function onToAmountChange(v: string) {
    setLastEdited("to");
    setToAmount(v);
    if (fromRate && toRate) recalc("to", v, fromRate, toRate);
  }

  function swap() {
    setFromCode(toCode);
    setToCode(fromCode);
    setFromAmount(toAmount);
    setToAmount(fromAmount);
    setLastEdited("from");
  }

  const explanation =
    fromRate && toRate ? rateExplanation(fromRate, toRate) : "";

  const otherConverted = useMemo(() => {
    if (!otherFrom || !otherTo) return null;
    const n = Number(fromAmount.replace(/,/g, ""));
    if (!Number.isFinite(n) || fromAmount.trim() === "") return null;
    return convertAmount(n, otherFrom, otherTo);
  }, [fromAmount, otherFrom, otherTo]);

  const selectClass =
    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  const bankFailed = Boolean(bank.error) || bank.source === "demo";
  const marketFailed = Boolean(market.error) || market.source === "demo";
  const initialLoading = loading && bank.source === "demo" && market.source === "demo" && !loadError;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {loadError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">환율 API를 불러오지 못했습니다.</p>
          <p className="mt-1 text-amber-800/90">
            {loadError} — 아래는 <strong>예시 환율</strong>로 계산합니다. 새로고침을
            눌러 다시 시도하세요.
          </p>
        </div>
      )}

      {!loadError && bank.error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">은행 고시(네이버)를 불러오지 못했습니다.</p>
          <p className="mt-1 text-amber-800/90">
            {bank.error} — 은행 고시는 예시 데이터를 사용합니다. 시장 시세는 별도로
            표시됩니다.
          </p>
        </div>
      )}

      {!loadError && market.error && (
        <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          <p className="font-medium">시장 시세(미드마켓)를 불러오지 못했습니다.</p>
          <p className="mt-1 text-sky-800/90">
            {market.error} — 시장 시세는 예시 데이터를 사용합니다. 은행 고시는 별도로
            표시됩니다.
          </p>
        </div>
      )}

      {!loading && !loadError && bankFailed && !bank.error && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          현재 은행 고시는 <strong>예시 환율</strong>입니다. 새로고침으로 네이버 금융
          매매기준율을 불러올 수 있습니다.
        </div>
      )}

      <Card className="overflow-hidden border-indigo-100 shadow-sm">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0 border-b bg-gradient-to-r from-indigo-50/80 to-slate-50/50 pb-4">
          <div>
            <CardTitle className="text-base text-indigo-950">환율 계산기</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              출처: {sourceLabel(activeSource, activePayload)}
              {(activePayload.updatedAt || updatedAt) && (
                <>
                  {" "}
                  · 업데이트{" "}
                  {formatUpdatedAt(activePayload.updatedAt || updatedAt || "")}
                  <span className="text-muted-foreground/70"> (KST)</span>
                </>
              )}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void loadRates()}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            새로고침
          </Button>
        </CardHeader>
        <CardContent className="space-y-5 pt-6">
          {/* Source toggle */}
          <div className="inline-flex rounded-lg border border-indigo-100 bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => setActiveSource("bank")}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                activeSource === "bank"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-indigo-700"
              )}
            >
              은행 고시
            </button>
            <button
              type="button"
              onClick={() => setActiveSource("market")}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                activeSource === "market"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-indigo-700"
              )}
            >
              시장 시세
            </button>
          </div>

          {initialLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              환율을 불러오는 중…
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-end">
                <div className="space-y-2">
                  <Label htmlFor="from-currency">From</Label>
                  <select
                    id="from-currency"
                    className={selectClass}
                    value={fromCode}
                    onChange={(e) => setFromCode(e.target.value)}
                  >
                    <optgroup label="주요 통화">
                      {MAJOR_CODES.map((c) => {
                        const r = findRate(activeRates, c);
                        if (!r) return null;
                        return (
                          <option key={c} value={c}>
                            {r.code} — {r.name}
                          </option>
                        );
                      })}
                    </optgroup>
                    <optgroup label="전체">
                      {sorted.map((r) => (
                        <option key={`all-from-${r.code}`} value={r.code}>
                          {r.code} — {r.name}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                  <Input
                    id="from-amount"
                    inputMode="decimal"
                    value={fromAmount}
                    onChange={(e) => onFromAmountChange(e.target.value)}
                    placeholder="금액"
                    className="text-lg font-semibold tabular-nums"
                  />
                </div>

                <div className="flex justify-center pb-1 md:pb-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="rounded-full border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                    onClick={swap}
                    aria-label="통화 바꾸기"
                  >
                    <ArrowLeftRight className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="to-currency">To</Label>
                  <select
                    id="to-currency"
                    className={selectClass}
                    value={toCode}
                    onChange={(e) => setToCode(e.target.value)}
                  >
                    <optgroup label="주요 통화">
                      {MAJOR_CODES.map((c) => {
                        const r = findRate(activeRates, c);
                        if (!r) return null;
                        return (
                          <option key={c} value={c}>
                            {r.code} — {r.name}
                          </option>
                        );
                      })}
                    </optgroup>
                    <optgroup label="전체">
                      {sorted.map((r) => (
                        <option key={`all-to-${r.code}`} value={r.code}>
                          {r.code} — {r.name}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                  <Input
                    id="to-amount"
                    inputMode="decimal"
                    value={toAmount}
                    onChange={(e) => onToAmountChange(e.target.value)}
                    placeholder="금액"
                    className="text-lg font-semibold tabular-nums"
                  />
                </div>
              </div>

              <div className="rounded-lg bg-indigo-50/70 px-4 py-3 text-sm text-indigo-950">
                <span className="font-medium">적용 환율</span>
                <span className="mx-2 text-indigo-300">·</span>
                <span className="tabular-nums">{explanation}</span>
                {fromRate && fromRate.unit > 1 && fromRate.code !== "KRW" && (
                  <p className="mt-1 text-xs text-indigo-800/80">
                    ※ {fromRate.code}는 은행 고시처럼 {fromRate.unit}단위 기준입니다.
                  </p>
                )}
                {otherConverted != null && otherFrom && otherTo && (
                  <p className="mt-2 text-xs text-indigo-800/90">
                    {activeSource === "bank" ? "시장 시세" : "은행 고시"} 기준 ≈{" "}
                    <span className="font-semibold tabular-nums">
                      {formatRateNumber(otherConverted, 6)} {toCode}
                    </span>
                    <span className="text-indigo-400"> · </span>
                    {sourceLabel(
                      activeSource === "bank" ? "market" : "bank",
                      otherPayload
                    )}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="mr-1 self-center text-xs text-muted-foreground">
                  빠른 금액
                </span>
                {QUICK_AMOUNTS.map((n) => (
                  <Button
                    key={n}
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="tabular-nums"
                    onClick={() => onFromAmountChange(String(n))}
                  >
                    {n.toLocaleString("ko-KR")} {fromCode}
                  </Button>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Comparison table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">은행 고시 vs 시장 시세 비교</CardTitle>
          <p className="text-xs text-muted-foreground">
            주요 통화 · 동일 단위로 비교합니다. JPY 등은 /100엔 고시 기준으로 맞춥니다.
            시장 시세는 미드마켓(open.er-api.com)입니다.
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">통화</th>
                  <th className="px-4 py-2.5 font-medium">단위</th>
                  <th className="px-4 py-2.5 font-medium text-right">은행고시</th>
                  <th className="px-4 py-2.5 font-medium text-right">시장시세</th>
                  <th className="px-4 py-2.5 font-medium text-right">차이(원)</th>
                  <th className="px-4 py-2.5 font-medium text-right">차이(%)</th>
                  <th className="px-4 py-2.5 font-medium text-right">상세</th>
                </tr>
              </thead>
              <tbody>
                {POPULAR_CODES.map((code) => {
                  const bankR = findRate(bank.rates, code);
                  const marketR = findRate(market.rates, code);
                  // Prefer bank unit for display (JPY → 100); fallback unit-100 default
                  const displayUnit =
                    bankR?.unit ??
                    (UNIT_100_DEFAULT.has(code) ? 100 : 1);
                  const bankDisp = displayRateForCompare(bankR, displayUnit);
                  const marketDisp = displayRateForCompare(marketR, displayUnit);

                  let diffWon: number | null = null;
                  let diffPct: number | null = null;
                  if (
                    bankDisp != null &&
                    marketDisp != null &&
                    Number.isFinite(bankDisp) &&
                    Number.isFinite(marketDisp)
                  ) {
                    // Diff on KRW-per-1 then scale to display unit for “차이(원)”
                    const bankPer1 = bankR ? effectiveRate(bankR) : null;
                    const marketPer1 = marketR ? effectiveRate(marketR) : null;
                    if (bankPer1 != null && marketPer1 != null) {
                      diffWon = (bankPer1 - marketPer1) * displayUnit;
                      if (marketPer1 !== 0) {
                        diffPct = ((bankPer1 - marketPer1) / marketPer1) * 100;
                      }
                    }
                  }

                  return (
                    <tr key={code} className="border-b last:border-0">
                      <td className="px-4 py-3">
                        <span className="font-semibold text-foreground">{code}</span>
                        <span className="ml-2 text-muted-foreground">
                          {bankR?.name ?? marketR?.name ?? code}
                        </span>
                      </td>
                      <td className="px-4 py-3 tabular-nums text-muted-foreground">
                        {displayUnit}
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">
                        {bankDisp != null ? formatRateNumber(bankDisp, 2) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">
                        {marketDisp != null ? formatRateNumber(marketDisp, 2) : "—"}
                      </td>
                      <td
                        className={cn(
                          "px-4 py-3 text-right tabular-nums",
                          diffWon != null && diffWon > 0 && "text-rose-600",
                          diffWon != null && diffWon < 0 && "text-emerald-600"
                        )}
                      >
                        {diffWon != null
                          ? `${diffWon > 0 ? "+" : ""}${formatRateNumber(diffWon, 2)}`
                          : "—"}
                      </td>
                      <td
                        className={cn(
                          "px-4 py-3 text-right tabular-nums",
                          diffPct != null && diffPct > 0 && "text-rose-600",
                          diffPct != null && diffPct < 0 && "text-emerald-600"
                        )}
                      >
                        {diffPct != null
                          ? `${diffPct > 0 ? "+" : ""}${formatRateNumber(diffPct, 2)}%`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <a
                          href={naverDetailUrl(code)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                        >
                          네이버
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            차이(원) = 은행고시 − 시장시세 (표시 단위 기준). 양수면 은행 고시가
            미드마켓보다 높습니다. 시장 시세 출처: open.er-api.com (미드마켓).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
