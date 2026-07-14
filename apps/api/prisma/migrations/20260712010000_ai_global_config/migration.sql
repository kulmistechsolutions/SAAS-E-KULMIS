CREATE TABLE IF NOT EXISTS "ai_global_config" (
  "id" TEXT PRIMARY KEY,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "provider" TEXT NOT NULL DEFAULT 'openai',
  "apiKey" TEXT NOT NULL DEFAULT '',
  "model" TEXT NOT NULL DEFAULT 'gpt-4o-mini',
  "connectionStatus" TEXT NOT NULL DEFAULT 'DISCONNECTED',
  "connectionMessage" TEXT,
  "lastTestedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
