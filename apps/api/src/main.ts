import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module";

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

  // CORS for the Next.js web app (tightened per-tenant later).
  app.enableCors({ origin: true, credentials: true });

  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port);
  app.get(Logger).log(`API listening on http://localhost:${port}`);
}

void bootstrap();
