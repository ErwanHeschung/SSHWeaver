import { commands } from "@/bindings";
import type { ProfileDraft } from "@stores/useProfileStore";
import { unwrap } from "./result";

export const profileRepository = {
  list: () => unwrap(commands.profilesList()),

  // `password`: null leaves the keystore entry alone, "" clears it.
  create: (draft: ProfileDraft, password: string | null) =>
    unwrap(commands.profileCreate(draft, password)),

  update: (id: string, draft: ProfileDraft, password: string | null) =>
    unwrap(commands.profileUpdate(id, draft, password)),

  remove: (id: string) => unwrap(commands.profileDelete(id)),

  deletePassword: (id: string) => unwrap(commands.profileDeletePassword(id)),
};
