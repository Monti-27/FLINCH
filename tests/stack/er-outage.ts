import { createServer } from "node:http";
import { journal } from "./evidence.ts";

export async function erOutage(directory: string) {
  let requests = 0;
  const server = createServer((request, response) => {
    requests++;
    request.resume();
    journal(directory, "er-outage", { request: requests, status: 503 });
    response.writeHead(503, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "Injected ER transport outage" }));
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => { server.off("error", reject); resolve(); });
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing outage endpoint");
  return { url: `http://127.0.0.1:${address.port}`, requests: () => requests,
    stop: () => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())) };
}
