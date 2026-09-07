import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { KeeperError } from "./errors.ts";

export async function readBoundedFile(path: string, maximum: number, ownerOnly = false): Promise<Buffer> {
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.size > maximum || (ownerOnly && ((stat.mode & 0o077) !== 0
      || stat.nlink !== 1 || stat.uid !== process.getuid?.()))) throw new KeeperError("unsafe_file");
    const buffer = Buffer.alloc(maximum + 1);
    let total = 0;
    while (total < buffer.length) {
      const { bytesRead } = await file.read(buffer, total, buffer.length - total, total);
      if (bytesRead === 0) break;
      total += bytesRead;
    }
    if (total > maximum) { buffer.fill(0); throw new KeeperError("unsafe_file"); }
    return buffer.subarray(0, total);
  } finally { await file.close(); }
}
