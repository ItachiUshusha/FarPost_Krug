import type { CollectionDefinition } from "../../shared/database";
import { database } from "./client";

// Form definitions are stored separately from the user's documents.
export const definitions =
  database.collection<CollectionDefinition>("_collections");

export async function initializeDatabase() {
  await definitions.createIndex({ name: 1 }, { unique: true });
}
