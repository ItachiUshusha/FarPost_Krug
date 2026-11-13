import { z } from "zod";
import {
  fieldTypes,
  type CollectionDefinition,
  type FieldValue,
} from "../../shared/database";
import { ApiError } from "./errors";

const reserved = new Set([
  "_id",
  "id",
  "createdAt",
  "updatedAt",
  "__proto__",
  "constructor",
  "prototype",
]);

export const collectionName = z
  .string()
  .regex(
    /^[a-z][a-z0-9_]{0,47}$/,
    "Название коллекции: латинские буквы, цифры и подчёркивание; первая буква — строчная.",
  );

export const fieldDefinition = z
  .object({
    key: z
      .string()
      .regex(
        /^[a-zA-Z][a-zA-Z0-9_]{0,47}$/,
        "Ключ поля: латинские буквы, цифры и подчёркивание.",
      )
      .refine((key) => !reserved.has(key), "Это имя зарезервировано системой."),
    label: z.string().trim().min(1, "Укажите название поля.").max(80),
    type: z.enum(fieldTypes),
    required: z.boolean(),
  })
  .strict();

export const collectionDefinition = z
  .object({
    name: collectionName,
    label: z.string().trim().min(1, "Укажите название коллекции.").max(80),
    description: z.string().trim().max(400).default(""),
    fields: z
      .array(fieldDefinition)
      .min(1, "Добавьте хотя бы одно поле.")
      .max(30),
  })
  .strict()
  .superRefine((definition, context) => {
    const keys = definition.fields.map((field) => field.key);
    if (new Set(keys).size !== keys.length) {
      context.addIssue({
        code: "custom",
        path: ["fields"],
        message: "Ключи полей должны быть уникальны.",
      });
    }
  });

export const documentBody = z
  .object({
    values: z.record(
      z.string(),
      z.union([z.string(), z.number().finite(), z.boolean(), z.null()]),
    ),
  })
  .strict();

export function validateValues(
  definition: CollectionDefinition,
  input: Record<string, FieldValue>,
) {
  const allowed = new Set(definition.fields.map((field) => field.key));
  if (Object.keys(input).some((key) => !allowed.has(key))) {
    throw new ApiError(
      400,
      "В записи есть поля, которые отсутствуют в форме коллекции.",
    );
  }

  const values: Record<string, FieldValue> = {};
  for (const field of definition.fields) {
    const raw = input[field.key];
    const value = typeof raw === "string" ? raw.trim() : raw;
    if (value === undefined || value === null || value === "") {
      if (field.required)
        throw new ApiError(400, `Заполните поле «${field.label}».`);
      values[field.key] = null;
      continue;
    }

    const validType =
      field.type === "number"
        ? typeof value === "number" && Number.isFinite(value)
        : field.type === "boolean"
          ? typeof value === "boolean"
          : typeof value === "string";
    if (!validType)
      throw new ApiError(400, `Неверный тип поля «${field.label}».`);
    if (typeof value === "string" && value.length > 20_000) {
      throw new ApiError(
        400,
        `Поле «${field.label}» слишком длинное (максимум 20 000 символов).`,
      );
    }
    if (
      field.type === "url" &&
      !z.url({ protocol: /^https?$/ }).safeParse(value).success
    ) {
      throw new ApiError(
        400,
        `В поле «${field.label}» нужен адрес http:// или https://.`,
      );
    }
    if (
      field.type === "date" &&
      (typeof value !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
        Number.isNaN(Date.parse(value)) ||
        new Date(value).toISOString().slice(0, 10) !== value)
    ) {
      throw new ApiError(
        400,
        `Укажите корректную дату в поле «${field.label}».`,
      );
    }
    values[field.key] = value;
  }
  return values;
}
