import type { IncomingMessage, ServerResponse } from "node:http";

// Importa o bundle SSR gerado por `npm run build` (dist/server/index.js).
// O TanStack Start exporta um handler web-standard: { fetch(Request): Promise<Response> }
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — arquivo gerado em build-time, não existe no source
import app from "../dist/server/server.js";

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
) {
  const proto =
    (req.headers["x-forwarded-proto"] as string | undefined) ?? "https";
  const host = req.headers.host ?? "localhost";
  const url = `${proto}://${host}${req.url}`;

  const webReq = new Request(url, {
    method: req.method ?? "GET",
    headers: req.headers as Record<string, string>,
    ...(req.method !== "GET" && req.method !== "HEAD"
      ? { body: req as unknown as BodyInit, duplex: "half" }
      : {}),
  });

  const webRes: Response = await app.fetch(webReq);

  res.statusCode = webRes.status;
  webRes.headers.forEach((value, key) => res.setHeader(key, value));
  const buf = await webRes.arrayBuffer();
  res.end(Buffer.from(buf));
}
