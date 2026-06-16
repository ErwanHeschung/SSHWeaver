import { open, save } from "@tauri-apps/plugin-dialog";
import { sftpRepository } from "@repositories/sftpRepository";

export type TransferResult =
  | { status: "done"; count: number }
  | { status: "cancelled" }
  | { status: "error"; error: string };

export async function downloadEntry(
  sessionId: string,
  remotePath: string,
  name: string,
): Promise<TransferResult> {
  try {
    const local = await save({ defaultPath: name });
    if (!local) return { status: "cancelled" };
    await sftpRepository.download(sessionId, remotePath, local);
    return { status: "done", count: 1 };
  } catch (e) {
    return { status: "error", error: String(e) };
  }
}

export async function uploadPaths(
  sessionId: string,
  remoteDir: string,
  paths: string[],
): Promise<TransferResult> {
  try {
    for (const localPath of paths) {
      await sftpRepository.uploadPath(sessionId, localPath, remoteDir);
    }
    return { status: "done", count: paths.length };
  } catch (e) {
    return { status: "error", error: String(e) };
  }
}

export async function uploadInto(
  sessionId: string,
  remoteDir: string,
): Promise<TransferResult> {
  const selected = await open({ multiple: true });
  if (!selected) return { status: "cancelled" };
  const paths = Array.isArray(selected) ? selected : [selected];
  return uploadPaths(sessionId, remoteDir, paths);
}
