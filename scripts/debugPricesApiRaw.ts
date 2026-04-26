import fs from "node:fs";
import path from "node:path";
import process from "node:process";

type EnvSource = ".env" | ".env.local";

interface LoadedEnvInfo {
  loadedFiles: EnvSource[];
}

function loadEnvFile(filePath: string, source: EnvSource, info: LoadedEnvInfo) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const fileContents = fs.readFileSync(filePath, "utf8");
  const lines = fileContents.split(/\r?\n/);

  info.loadedFiles.push(source);

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmedLine.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmedLine.slice(0, separatorIndex).trim();
    let value = trimmedLine.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

function loadEnvVars(): LoadedEnvInfo {
  const projectRoot = path.resolve(__dirname, "..");
  const info: LoadedEnvInfo = { loadedFiles: [] };

  loadEnvFile(path.join(projectRoot, ".env"), ".env", info);
  loadEnvFile(path.join(projectRoot, ".env.local"), ".env.local", info);

  return info;
}

function definedText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function sanitizeJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeJson);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => {
      if (key.toLowerCase().includes("api") && key.toLowerCase().includes("key")) {
        return [key, "[redacted]"];
      }

      return [key, sanitizeJson(item)];
    }),
  );
}

async function main() {
  const envInfo = loadEnvVars();
  const apiKey = definedText(process.env.PRICES_API_KEY ?? process.env.PRICE_API_KEY);
  const baseUrl = definedText(process.env.PRICES_API_BASE_URL ?? process.env.PRICE_API_BASE_URL) ?? "https://api.pricesapi.io";
  const country = definedText(process.env.PRICES_API_COUNTRY ?? process.env.PRICE_API_COUNTRY) ?? "us";
  const query = "Logitech MX Master 3S";

  console.log(`Loaded env files: ${envInfo.loadedFiles.length > 0 ? envInfo.loadedFiles.join(", ") : "none"}`);
  console.log(`PRICES_API_KEY exists: ${Boolean(apiKey)}`);

  if (!apiKey) {
    console.error("PricesAPI is not configured. Add PRICES_API_KEY to .env.local or .env.");
    process.exitCode = 1;
    return;
  }

  const url = new URL("/api/v1/products/search", baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  url.searchParams.set("q", query);

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "x-api-key": apiKey,
    },
  });

  let json: unknown = null;

  try {
    json = sanitizeJson(await response.json());
  } catch {
    json = "[non-json response]";
  }

  console.log(`Base URL: ${baseUrl}`);
  console.log(`Endpoint path: ${url.pathname}${url.search}`);
  console.log(`Query: ${query}`);
  console.log(`Country: ${country}`);
  console.log(`HTTP status: ${response.status}`);
  console.log(`Sanitized raw JSON: ${JSON.stringify(json, null, 2)}`);
}

void main();
