export class SubmissionGate {
  private readonly batches = new Map<string, { signatures: Set<string>; wait: Promise<void>; release: () => void;
    timer: ReturnType<typeof setTimeout>; paired: boolean; released: boolean }>();
  private readonly timeout: number;

  constructor(timeout = 2000) { this.timeout = timeout; }

  wait(receipt: string, signature: string) {
    const previous = this.batches.get(receipt);
    if (previous) {
      previous.signatures.add(signature);
      if (previous.signatures.size >= 2 && !previous.released) {
        previous.paired = true; clearTimeout(previous.timer); previous.release();
      }
      return previous.wait;
    }
    if (this.batches.size >= 64) throw new Error("Submission gate capacity reached");
    let release!: () => void;
    const wait = new Promise<void>(resolve => { release = resolve; });
    const finish = () => { batch.released = true; release(); };
    const timer = setTimeout(finish, this.timeout);
    const batch = { signatures: new Set([signature]), wait, release: finish, timer, paired: false, released: false };
    this.batches.set(receipt, batch);
    return wait;
  }

  summary() {
    return [...this.batches].map(([receipt, batch]) => ({ receipt, signatures: [...batch.signatures], paired: batch.paired }));
  }

  stop() { for (const batch of this.batches.values()) { clearTimeout(batch.timer); batch.release(); } }
}
