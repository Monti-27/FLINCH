import { ClientError } from "@flinch/client";

export type RuntimeCode = "invalid_config" | "unsafe_file" | "invalid_keypair" | "journal_locked" | "journal_changed" | "execution_required" | "invalid_arguments";

export class KeeperError extends Error {
  readonly code: RuntimeCode;
  constructor(code: RuntimeCode) {
    super(code);
    this.name = "KeeperError";
    this.code = code;
  }
}

export function errorCode(error: unknown): string {
  if (error instanceof KeeperError || error instanceof ClientError) return error.code;
  return "operation_failed";
}
