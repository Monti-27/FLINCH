import { forwardRef } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";
import { EcosystemIcon } from "../brand/ecosystem-icon.tsx";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "inputMode" | "children"> & {
  id: string; label: string; symbol: string; accessory?: ReactNode;
};

export const TokenAmountInput = forwardRef<HTMLInputElement, Props>(function TokenAmountInput(
  { label, symbol, accessory, id, ...props }, ref,
) {
  const icon = symbol === "SOL" || symbol === "WSOL" ? "solana" : symbol === "USDC" ? "usdc" : undefined;
  return <div className="token-input">
    <div className="token-input-heading"><label htmlFor={id}>{label}</label><span className="token-unit" aria-hidden>{icon && <EcosystemIcon name={icon} size={16} />}{symbol}</span></div>
    <div className="token-input-value">
      <input {...props} ref={ref} id={id} type="text" inputMode="decimal" autoComplete="off" spellCheck={false} />
    </div>
    {accessory && <div className="token-input-presets">{accessory}</div>}
  </div>;
});
