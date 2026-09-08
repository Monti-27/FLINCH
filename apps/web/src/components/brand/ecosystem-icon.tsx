import Image from "next/image";

const assets = {
  solana: "/brand/ecosystem/solana.svg",
  magicblock: "/brand/ecosystem/magicblock.svg",
  raydium: "/brand/ecosystem/raydium.png",
  usdc: "/brand/ecosystem/usdc.svg",
} as const;

export type EcosystemBrand = keyof typeof assets;

export function EcosystemIcon({ name, size = 20, label }: {
  name: EcosystemBrand; size?: 16 | 20 | 24; label?: string;
}) {
  return <Image className="ecosystem-icon" src={assets[name]} width={size} height={size}
    style={{ width: size, height: size }} alt={label ?? ""} aria-hidden={label ? undefined : true} unoptimized draggable={false} />;
}
