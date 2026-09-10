import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { UiProvider } from "../src/providers/ui-provider.tsx";
import { RoundTerms } from "../src/features/lobby/round-terms.tsx";
import { JoinRoom } from "../src/features/lobby/join-room.tsx";
import { RoomSidebar } from "../src/components/shell/room-sidebar.tsx";
import { EmptySeat } from "../src/features/match/player-seat.tsx";

describe("reference-led room controls", () => {
  it("keeps financial terms available without implying a fee-free transaction", () => {
    const html = renderToStaticMarkup(<UiProvider><RoundTerms /></UiProvider>);
    expect(html).toContain("Sell penalty");
    expect(html).toContain("0.25%");
    expect(html).toContain("Protocol fee");
    expect(html).toContain("0%");
    expect(html).toContain("Network fees, account rent and swap fees are separate.");
    expect(html).toContain("No game penalty if everyone sells together.");
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('inert=""');
  });

  it("retains an explicit form submission and labels opening as non-depositing", () => {
    const html = renderToStaticMarkup(<UiProvider><JoinRoom busy={false} open={() => {}} /></UiProvider>);
    expect(html).toContain('type="submit"');
    expect(html).toContain('for="room-address"');
    expect(html).toContain('autoComplete="off"');
    expect(html).toContain("Opening a room does not deposit any tokens.");
    expect(html).not.toContain("Paste room address or invite link");
    const busy = renderToStaticMarkup(<UiProvider><JoinRoom busy open={() => {}} /></UiProvider>);
    expect(busy.match(/disabled=""/g)).toHaveLength(2);
  });

  it("renders honest empty seats and a four-slot occupancy indicator", () => {
    const html = renderToStaticMarkup(<UiProvider><RoomSidebar onOpenSeat={() => {}} /></UiProvider>);
    expect(html.match(/data-filled="false"/g)).toHaveLength(8);
    expect(html).not.toContain('data-filled="true"');
    expect(html).toContain("Show players, 0 of 4 seats filled");
    expect(html.match(/view room entry/g)).toHaveLength(4);
    const seat = renderToStaticMarkup(<EmptySeat index={0} />);
    expect(seat).toContain('disabled=""');
    expect(seat).toContain("Open seat");
  });
});
