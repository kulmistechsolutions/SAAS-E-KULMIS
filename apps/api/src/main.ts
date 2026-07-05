import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Structured logging (Pino) as the app logger.
  app.useLogger(app.get(Logger));

  // Global API prefix; health stays reachable at /health.
  app.setGlobalPrefix("api", { exclude: ["health"] });

  // CORS for the Next.js web app (tightened per-tenant later).
  app.enableCors({ origin: true, credentials: true });

  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port);
  app.get(Logger).log(`API listening on http://localhost:${port}`);
}

void bootstrap();
