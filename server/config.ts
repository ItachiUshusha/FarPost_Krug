import "dotenv/config";
import { z } from "zod";

const environment = z
  .object({
    MONGODB_URI: z
      .string()
      .regex(/^mongodb(?:\+srv)?:\/\//)
      .default("mongodb://127.0.0.1:27018"),
    MONGODB_DATABASE: z
      .string()
      .regex(/^[a-zA-Z][a-zA-Z0-9_-]{0,62}$/)
      .default("vibe_farpost"),
    API_PORT: z.coerce.number().int().min(1024).max(65535).default(4000),
  })
  .parse(process.env);

export const config = {
  mongoUri: environment.MONGODB_URI,
  database: environment.MONGODB_DATABASE,
  port: environment.API_PORT,
};
