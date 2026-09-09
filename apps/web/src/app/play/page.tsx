import type { Metadata } from "next";
import { Application } from "../../components/application.tsx";

export const metadata: Metadata = { title: "FLINCH · The arena" };

export default function PlayPage() {
  return <Application />;
}
