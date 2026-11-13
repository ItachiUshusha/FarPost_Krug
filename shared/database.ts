export const fieldTypes = [
  "text",
  "textarea",
  "number",
  "boolean",
  "date",
  "url",
] as const;

export type FieldType = (typeof fieldTypes)[number];
export type FieldValue = string | number | boolean | null;

export interface FieldDefinition {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
}

export interface CollectionDefinition {
  name: string;
  label: string;
  description: string;
  fields: FieldDefinition[];
}

export interface CollectionSummary extends CollectionDefinition {
  count: number;
}

export interface DatabaseStatus {
  connected: boolean;
  database: string;
  collections: number;
  documents: number;
}

export interface DocumentRecord {
  id: string;
  values: Record<string, FieldValue>;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentPage {
  items: DocumentRecord[];
  total: number;
  page: number;
  pageSize: number;
}
