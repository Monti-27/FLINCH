"use client";

import { Toaster } from "sonner";

export function NotificationToaster() {
  return <Toaster className="flinch-toaster" theme="dark" richColors position="bottom-right" closeButton visibleToasts={1}
    offset={{ bottom: "calc(24px + env(safe-area-inset-bottom))", right: "calc(24px + env(safe-area-inset-right))" }}
    mobileOffset={{ bottom: "calc(16px + env(safe-area-inset-bottom))", left: 16, right: 16 }} />;
}
