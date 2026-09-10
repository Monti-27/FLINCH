import { expect, it } from "vitest";
import { Toaster } from "sonner";
import { NotificationToaster } from "../src/components/ui/notification-toaster.tsx";
import { operationNotification } from "../src/lib/notifications.ts";

it("uses the official Sonner host at the bottom right with rich colors and safe-area offsets", () => {
  const element = NotificationToaster();
  expect(element.type).toBe(Toaster);
  expect(element.props).toMatchObject({ theme: "dark", position: "bottom-right", richColors: true, closeButton: true, visibleToasts: 1 });
  expect(element.props.offset.bottom).toContain("safe-area-inset-bottom");
  expect(element.props.offset.right).toContain("safe-area-inset-right");
  expect(element.props.mobileOffset.bottom).toContain("safe-area-inset-bottom");
  expect(element.props.offset.top).toBeUndefined();
  expect(element.props.mobileOffset.top).toBeUndefined();
});

it("distinguishes a confirmed base action from an accepted MagicBlock intent", () => {
  expect(operationNotification({ action: "Create room", runtime: "base", status: "confirmed" }).tone).toBe("success");
  expect(operationNotification({ action: "Queue SELL", runtime: "er", status: "confirmed" }).tone).toBe("info");
});

it("uses warning for uncertainty and error only for a known failure", () => {
  for (const runtime of ["base", "er"] as const) {
    expect(operationNotification({ action: "Queue SELL", runtime, status: "pending" }).tone).toBe("warning");
    expect(operationNotification({ action: "Queue SELL", runtime, status: "not_sent" }).tone).toBe("warning");
    expect(operationNotification({ action: "Queue SELL", runtime, status: "failed" }).tone).toBe("error");
  }
  expect(operationNotification().tone).toBe("warning");
});
