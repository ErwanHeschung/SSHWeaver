import { commands } from "@/bindings";
import { unwrap } from "./result";

export const secretsRepository = {
  hasPassword: (connectionId: string) => commands.secretHasPassword(connectionId),

  deletePassword: (connectionId: string) =>
    unwrap(commands.secretDeletePassword(connectionId)),
};
