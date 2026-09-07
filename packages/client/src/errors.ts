type ErrorCode = "invalid_account" | "wrong_network" | "unsafe_endpoint" | "placement_pending" | "rpc_error" | "invalid_amount" | "invalid_signature" | "invalid_commitment";

export class ClientError extends Error {
  readonly code: ErrorCode;
  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = "ClientError";
    this.code = code;
  }
}

export function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new ClientError("invalid_account", message);
}
