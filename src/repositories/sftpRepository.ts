import { commands } from "@/bindings";
import type { SftpEntry } from "@/bindings";
import { unwrap } from "./result";

export type { SftpEntry };

export const sftpRepository = {
  readDir: (sessionId: string, path: string): Promise<SftpEntry[]> =>
    unwrap(commands.sftpReadDir(sessionId, path)),

  homeDir: (sessionId: string): Promise<string> =>
    unwrap(commands.sftpHomeDir(sessionId)),

  readFile: (sessionId: string, path: string): Promise<Uint8Array> =>
    unwrap(commands.sftpReadFile(sessionId, path)).then((bytes) => new Uint8Array(bytes)),

  download: (sessionId: string, remotePath: string, localPath: string): Promise<null> =>
    unwrap(commands.sftpDownload(sessionId, remotePath, localPath)),

  uploadPath: (sessionId: string, localPath: string, remoteDir: string): Promise<null> =>
    unwrap(commands.sftpUploadPath(sessionId, localPath, remoteDir)),

  remove: (sessionId: string, path: string): Promise<null> =>
    unwrap(commands.sftpRemove(sessionId, path)),
};
