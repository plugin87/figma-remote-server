import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import type { ServerConfig } from "./types/config.js";

function loadEnvFile(): void {
  try {
    // Look for .env in project root
    const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
    const envPath = resolve(projectRoot, ".env");
    const content = readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // .env file is optional
  }
}

export function loadConfig(): ServerConfig {
  loadEnvFile();
  const token = process.env.FIGMA_ACCESS_TOKEN;
  if (!token) {
    throw new Error(
      "FIGMA_ACCESS_TOKEN environment variable is required. " +
        "Get a Personal Access Token from Figma → Settings → Personal Access Tokens."
    );
  }

  return Object.freeze({
    figmaAccessToken: token,
    figmaApiBase: process.env.FIGMA_API_BASE ?? "https://api.figma.com",
    cacheMaxSize: parseInt(process.env.CACHE_MAX_SIZE ?? "10", 10),
    cacheTtlMs: parseInt(process.env.CACHE_TTL_MS ?? "300000", 10),
    logLevel: process.env.LOG_LEVEL ?? "info",
    wsPortStart: parseInt(process.env.WS_PORT_START ?? "9223", 10),
    wsPortEnd: parseInt(process.env.WS_PORT_END ?? "9232", 10),
  });
}
