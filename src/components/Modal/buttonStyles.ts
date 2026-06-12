const BASE =
  "inline-flex h-8 items-center justify-center rounded-md px-3 text-sm font-medium transition-colors focus:outline-none disabled:cursor-not-allowed disabled:opacity-50";

export const PRIMARY_BUTTON = `${BASE} bg-accent text-accent-foreground hover:bg-accent-hover`;
export const SECONDARY_BUTTON = `${BASE} border border-border text-foreground hover:bg-surface-hover`;
export const DANGER_BUTTON = `${BASE} bg-danger text-white hover:opacity-90`;
