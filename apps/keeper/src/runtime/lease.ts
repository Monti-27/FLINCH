import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { lstat, mkdir, open, unlink } from "node:fs/promises";
import { join } from "node:path";
import { KeeperError } from "./errors.ts";

export async function acquireJournal(directory: string): Promise<() => Promise<void>> {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const stat = await lstat(directory);
  if (!stat.isDirectory() || (stat.mode & 0o077) !== 0 || stat.uid !== process.getuid?.()) throw new KeeperError("unsafe_file");
  const path = join(directory, "keeper.lock");
  const file = await open(path, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600)
    .catch(error => { if (error.code === "EEXIST") throw new KeeperError("journal_locked"); throw error; });
  const identity = await file.stat();
  try {
    await file.writeFile(JSON.stringify({ version: 1, pid: process.pid, token: randomUUID() }));
    await file.sync();
  } finally { await file.close(); }
  let released = false;
  return async () => {
    if (released) return;
    const current = await lstat(path);
    if (current.ino !== identity.ino || current.dev !== identity.dev) throw new KeeperError("journal_changed");
    await unlink(path);
    released = true;
  };
}
