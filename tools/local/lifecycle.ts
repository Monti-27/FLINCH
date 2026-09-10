import type { ProcessExit } from "../../tests/stack/process.ts";

type Cleanup = () => Promise<unknown> | undefined;
export type LocalFailure = ProcessExit & { service: "stack" | "web" };

export class LocalLifecycle {
  private readonly cleanup: { rooms: Cleanup; web: Cleanup; stack: Cleanup; keys: Cleanup };
  private stopping = false;
  private stopped?: Promise<void>;
  private failureValue?: LocalFailure;
  private resolveFailure!: (failure: LocalFailure) => void;
  readonly failure = new Promise<LocalFailure>(resolve => { this.resolveFailure = resolve; });

  constructor(cleanup: { rooms: Cleanup; web: Cleanup; stack: Cleanup; keys: Cleanup }) { this.cleanup = cleanup; }

  watch(service: LocalFailure["service"], finished: Promise<ProcessExit>) {
    void finished.then(exit => {
      if (this.stopping || this.failureValue) return;
      this.failureValue = { service, ...exit };
      this.resolveFailure(this.failureValue);
    });
  }

  check() {
    if (this.failureValue) throw new Error(`Local ${this.failureValue.service} process stopped`);
    if (this.stopping) throw new Error("Local sandbox is stopping");
  }

  stop() {
    this.stopping = true;
    this.stopped ??= this.drain();
    return this.stopped;
  }

  private async drain() {
    const attempt = (cleanup: Cleanup) => Promise.resolve().then(cleanup);
    const first = await Promise.allSettled([attempt(this.cleanup.rooms), attempt(this.cleanup.web)]);
    const last = await Promise.allSettled([attempt(this.cleanup.stack),
      first[0].status === "fulfilled" ? attempt(this.cleanup.keys) : Promise.resolve()]);
    const failures = [...first, ...last].filter(result => result.status === "rejected");
    if (failures.length) throw new AggregateError(failures.map(result => result.reason), "Local cleanup incomplete; retained keys if keeper shutdown was unconfirmed");
  }
}
