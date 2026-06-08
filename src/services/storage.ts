function isAvailable(): boolean {
  try {
    return typeof localStorage !== "undefined";
  } catch {
    return false;
  }
}

export function getItem<T>(key: string, fallback: T): T {
  if (!isAvailable()) return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function setItem<T>(key: string, value: T): void {
  if (!isAvailable()) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    console.error("Failed to store value in localStorage.");
  }
}

export function removeItem(key: string): void {
  if (!isAvailable()) return;
  try {
    localStorage.removeItem(key);
  } catch {
    console.error("Failed to remove value from localStorage.");
  }
}

export const storage = { getItem, setItem, removeItem };
