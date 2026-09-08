import { redirect } from "next/navigation";
import { LandingPage } from "../features/landing/landing-page.tsx";
import { legacyRoomDestination } from "../lib/room-link.ts";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const destination = legacyRoomDestination((await searchParams).room);
  if (destination) redirect(destination);
  return <LandingPage />;
}
