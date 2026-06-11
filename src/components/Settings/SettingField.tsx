import type { ReactNode } from "react";

interface SettingFieldProps {
  label: string;
  hint?: string;
  children: ReactNode;
}

export function SettingField({ label, hint, children }: Readonly<SettingFieldProps>) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">{label}</p>
      {hint && <p className="text-sm text-muted">{hint}</p>}
      <div className="pt-2">{children}</div>
    </div>
  );
}
