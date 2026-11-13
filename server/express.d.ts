import type { CollectionDefinition } from "../shared/database";

declare global {
  namespace Express {
    interface Locals {
      definition: CollectionDefinition;
    }
  }
}
