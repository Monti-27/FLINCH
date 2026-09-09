import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { RoomNavigation } from "../src/components/shell/room-navigation.tsx";

const address = "8mGLM6MoGgJBfJXAESN5C5fmKXCwnfinDGXX8drPFEie";

it.each([[false, false], [true, false], [true, true]])("renders connected=%s busy=%s without hiding room actions", (connected, busy) => {
  const html = renderToStaticMarkup(<RoomNavigation address={address} connected={connected} busy={busy} onLobby={() => {}} onCheck={async () => {}} />);
  expect(html).toContain('aria-label="Room navigation"');
  expect(html).toContain("Lobby");
  expect(html).toContain('aria-label="Invite players: copy invite link"');
  expect(html).toContain('aria-label="Check transaction"');
  expect(html.match(/type="button"/g)).toHaveLength(3);
  expect(html.includes('disabled=""')).toBe(!connected || busy);
  expect(html).not.toContain('type="submit"');
  if (!connected) expect(html).toContain("Connect a wallet to check its transactions");
});
