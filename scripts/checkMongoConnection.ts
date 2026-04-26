import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { MongoClient, MongoServerError } from "mongodb";

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const fileContents = fs.readFileSync(filePath, "utf8");
  const lines = fileContents.split(/\r?\n/);

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

function loadEnvVars() {
  const projectRoot = path.resolve(__dirname, "..");

  loadEnvFile(path.join(projectRoot, ".env"));
  loadEnvFile(path.join(projectRoot, ".env.local"));
}

function getSanitizedClusterHost(uri: string) {
  try {
    const normalizedUri = uri.startsWith("mongodb://") || uri.startsWith("mongodb+srv://") ? uri : `mongodb://${uri}`;
    const parsedUri = new URL(normalizedUri);
    return parsedUri.host || "unknown";
  } catch {
    return "invalid-uri";
  }
}

function classifyConnectionError(error: unknown) {
  if (!error) {
    return "MongoDB connection failed for an unknown reason.";
  }

  const message = error instanceof Error ? error.message : String(error);
  const lowerMessage = message.toLowerCase();
  const serverError = error instanceof MongoServerError ? error : null;

  if (
    lowerMessage.includes("authentication failed") ||
    lowerMessage.includes("bad auth") ||
    serverError?.code === 18
  ) {
    return "MongoDB authentication failed. Check the username, password, auth database, and whether the database user exists for this cluster.";
  }

  if (
    lowerMessage.includes("ip") &&
    (lowerMessage.includes("whitelist") || lowerMessage.includes("not allowed") || lowerMessage.includes("access list"))
  ) {
    return "MongoDB connection was blocked by network access rules. Check whether your current IP address is allowed in the cluster access list.";
  }

  if (
    lowerMessage.includes("invalid scheme") ||
    lowerMessage.includes("invalid connection string") ||
    lowerMessage.includes("uri malformed") ||
    lowerMessage.includes("invalid uri") ||
    lowerMessage.includes("mongodb uri")
  ) {
    return "MongoDB URI appears invalid. Verify the scheme, credentials formatting, host, and query parameters in MONGODB_URI.";
  }

  return `MongoDB connection failed: ${message}`;
}

async function main() {
  loadEnvVars();

  const mongodbUri = process.env.MONGODB_URI?.trim();
  const databaseName = process.env.MONGODB_DB_NAME?.trim();

  console.log(`MONGODB_URI exists: ${Boolean(mongodbUri)}`);
  console.log(`MONGODB_DB_NAME exists: ${Boolean(databaseName)}`);
  console.log(`Sanitized cluster host: ${mongodbUri ? getSanitizedClusterHost(mongodbUri) : "missing"}`);
  console.log(`Database name: ${databaseName || "missing"}`);

  if (!mongodbUri || !databaseName) {
    console.error("Missing required environment variable. Set both MONGODB_URI and MONGODB_DB_NAME in .env.local or .env.");
    process.exitCode = 1;
    return;
  }

  let client: MongoClient | undefined;

  try {
    client = new MongoClient(mongodbUri);
    await client.connect();
    await client.db(databaseName).command({ ping: 1 });
    console.log("MongoDB connection successful");
  } catch (error) {
    console.error(classifyConnectionError(error));
    process.exitCode = 1;
  } finally {
    await client?.close();
  }
}

void main();
