"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { BaseWalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Wallet } from "lucide-react";

const labels = {
  "change-wallet": "Change wallet", connecting: "Connecting…", "copy-address": "Copy address",
  copied: "Copied", disconnect: "Disconnect", "has-wallet": "Connect wallet", "no-wallet": "Connect wallet",
};

export function WalletControl() {
  const { publicKey, connecting, disconnecting } = useWallet();
  return <div className="wallet-control" aria-busy={connecting || disconnecting}>
    <BaseWalletMultiButton labels={labels} disabled={connecting || disconnecting}>
      {!publicKey ? <><Wallet size={16} aria-hidden /><span>{connecting ? labels.connecting : labels["no-wallet"]}</span></> : undefined}
    </BaseWalletMultiButton>
  </div>;
}
