import type { defaultNS, resources } from "./index";

// Make `t("...")` keys type-safe against the English resource shape.
declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: typeof defaultNS;
    resources: (typeof resources)["en"];
  }
}
