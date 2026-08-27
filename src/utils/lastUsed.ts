import type { TFunction } from "i18next";

interface Used {
  lastUsedAt: string | null;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

function instant(connection: Used): number {
  if (!connection.lastUsedAt) return 0;
  const parsed = Date.parse(connection.lastUsedAt);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/** Most recent first; never used sinks to the bottom. */
export function compareLastUsed(a: Used, b: Used): number {
  return instant(b) - instant(a);
}

export function formatLastUsed(connection: Used, t: TFunction): string | null {
  const used = instant(connection);
  if (used === 0) return null;

  const elapsed = Math.max(0, Date.now() - used);
  if (elapsed < MINUTE) return t("time.now");
  if (elapsed < HOUR) return t("time.minutes", { count: Math.floor(elapsed / MINUTE) });
  if (elapsed < DAY) return t("time.hours", { count: Math.floor(elapsed / HOUR) });
  if (elapsed < MONTH) return t("time.days", { count: Math.floor(elapsed / DAY) });
  if (elapsed < YEAR) return t("time.months", { count: Math.floor(elapsed / MONTH) });
  return t("time.years", { count: Math.floor(elapsed / YEAR) });
}
