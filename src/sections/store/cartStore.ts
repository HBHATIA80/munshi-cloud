"use client";
export type CartEntry = { id: string; qty: number };
const KEY = "mc_cart_v2";
type Carts = Record<string, CartEntry[]>;

export function readAll(): Carts {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; }
}
export function read(tenantId: string): CartEntry[] { return readAll()[tenantId] ?? []; }
export function write(tenantId: string, entries: CartEntry[]) {
  const all = readAll();
  if (entries.length) all[tenantId] = entries; else delete all[tenantId];
  localStorage.setItem(KEY, JSON.stringify(all));
}
export function shopIds(): string[] { return Object.keys(readAll()); }