import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import helmet from "helmet";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module";

/**
 * Which browser origins may call the API with credentials.
 *
 * `origin: true` reflects whatever Origin the caller sends, so ANY website
 * could have a logged-in user's browser make credentialed requests to this API.
 * Instead only the app's own apex and its school subdomains are allowed —
 * `ekulmis.com`, `www.ekulmis.com` and `<school>.ekulmis.com`.
 */
function buildCorsOrigin(): (
  origin: string | undefined,
  cb: (err: Error | null, allow?: boolean) => void,
) => void {
  const root = (process.env.APP_ROOT_DOMAIN ?? "").trim().toLowerCase();
  const extra = (process.env.CORS_EXTRA_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const isDev = process.env.NODE_ENV !== "production";

  // A root domain that is an IP, an sslip.io stand-in, or missing is a
  // deployment that was never told its real domain. Locking CORS to it would
  // block the actual app, so we keep the old permissive behaviour and say so
  // loudly — the moment APP_ROOT_DOMAIN is set properly the lock takes effect.
  const usableRoot =
    !!root &&
    root.includes(".") &&
    !root.endsWith(".sslip.io") &&
    !root.endsWith(".nip.io") &&
    !/^\d{1,3}(\.\d{1,3}){3}$/.test(root);

  if (!usableRoot && extra.length === 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `[cors] APP_ROOT_DOMAIN is "${root || "(unset)"}" — not a real domain, ` +
        "so CORS stays open. Set APP_ROOT_DOMAIN to the app's domain " +
        "(e.g. ekulmis.com) to restrict it to this app's own origins.",
    );
    return (_origin, cb) => cb(null, true);
  }

  return (origin, cb) => {
    // Same-origin / server-to-server calls send no Origin header.
    if (!origin) return cb(null, true);
    let host: string;
    try {
      host = new URL(origin).hostname.toLowerCase();
    } catch {
      return cb(null, false);
    }
    if (isDev && (host === "localhost" || host === "127.0.0.1")) {
      return cb(null, true);
    }
    if (extra.includes(origin.toLowerCase())) return cb(null, true);
    if (usableRoot && (host === root || host.endsWith(`.${root}`))) {
      return cb(null, true);
    }
    return cb(null, false);
  };
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  // Base64 photo uploads need a larger JSON body than Express's 100 KB default.
  // 2 MB image ≈ 2.7 MB base64 inside JSON; 5 MB leaves comfortable headroom.
  const bodyLimit = process.env.API_JSON_BODY_LIMIT ?? "5mb";
  app.useBodyParser("json", { limit: bodyLimit });
  app.useBodyParser("urlencoded", { limit: bodyLimit, extended: true });

  // Structured logging (Pino) as the app logger.
  app.useLogger(app.get(Logger));

  // Global API prefix; health stays reachable at /health.
  app.setGlobalPrefix("api", { exclude: ["health", ""] });

  // Security headers. The API serves JSON and a few images, never HTML, so the
  // HTML-oriented CSP is off; the rest (nosniff, frameguard, HSTS, referrer
  // policy) all apply.
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );

  // Only this app's own origins may call the API with credentials.
  app.enableCors({ origin: buildCorsOrigin(), credentials: true });

  // Behind Traefik: trust the proxy so req.ip is the real client address, which
  // rate limiting and the login audit trail both depend on.
  app.set("trust proxy", 1);

  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port);
  app.get(Logger).log(`API listening on http://localhost:${port}`);
}

void bootstrap();
