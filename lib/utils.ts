import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatKRW(amount: number): string {
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: string | Date, pattern = "yyyy-MM-dd"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  if (pattern === "yyyy-MM-dd") return `${y}-${m}-${day}`;
  if (pattern === "MM/dd") return `${m}/${day}`;
  if (pattern === "M월 d일") return `${d.getMonth() + 1}월 ${d.getDate()}일`;
  return `${y}-${m}-${day}`;
}
