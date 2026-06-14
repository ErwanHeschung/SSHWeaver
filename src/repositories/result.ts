type CmdResult<T> =
  | { status: "ok"; data: T }
  | { status: "error"; error: string };

export async function unwrap<T>(result: Promise<CmdResult<T>>): Promise<T> {
  const res = await result;
  if (res.status === "error") throw new Error(res.error);
  return res.data;
}
