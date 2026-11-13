import { MongoClient } from "mongodb";
import { config } from "../config";

export const mongoClient = new MongoClient(config.mongoUri, {
  serverSelectionTimeoutMS: 5_000,
  connectTimeoutMS: 5_000,
  maxPoolSize: 10,
});

export const database = mongoClient.db(config.database);

export async function connectDatabase() {
  await mongoClient.connect();
  await database.command({ ping: 1 });
  return database;
}
