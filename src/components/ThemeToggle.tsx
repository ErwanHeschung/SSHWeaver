import { Moon, Sun } from "lucide-react";
import { ResolvedTheme, useTheme } from "@/theme/ThemeContext";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === ResolvedTheme.Dark;

  return (
    <button
      type="button"
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={toggleTheme}
      className="flex h-6 w-6 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
    >
      {isDark ? (
        <Moon size={15} strokeWidth={1.5} />
      ) : (
        <Sun size={15} strokeWidth={1.5} />
      )}
    </button>
  );
}
