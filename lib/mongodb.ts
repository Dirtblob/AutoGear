import { MongoClient } from "mongodb";

const globalForMongo = globalThis as unknown as {
  lifeUpgradeMongoClient?: MongoClient;
};

function getMongoUri(): string {
  const uri = process.env.MONGODB_URI?.trim();

  if (!uri) {
    throw new Error("MONGODB_URI is required for MongoDB-backed inventory.");
  }

  return uri;
}

export function getMongoDatabase() {
  const databaseName = process.env.MONGODB_DB_NAME?.trim() || "lifeupgrade";

  if (!globalForMongo.lifeUpgradeMongoClient) {
    const client = new MongoClient(getMongoUri());
    globalForMongo.lifeUpgradeMongoClient = client;
  }

  return globalForMongo.lifeUpgradeMongoClient.connect().then((client) => client.db(databaseName));
}
