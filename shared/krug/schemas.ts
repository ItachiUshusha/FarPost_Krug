import { z } from "zod";
import { areas, categories, conditions, itemTypes } from "./reference";

const oneOf = (values: readonly { id: string }[], message: string) => z.string().refine((value) => values.some((item) => item.id === value), message);
const keywords = z.array(z.string().trim().min(1).max(60)).max(10).default([]);
export const idSchema = z.string().regex(/^[a-f\d]{24}$/i, "Некорректный идентификатор.");
export const listingSchema = z.object({
  title: z.string().trim().min(3, "Напишите название вещи (от 3 символов).").max(100),
  description: z.string().trim().min(10, "Расскажите о вещи: минимум 10 символов.").max(3000),
  itemTypeId: oneOf(itemTypes, "Выберите тип вещи."),
  categoryId: oneOf(categories, "Выберите категорию."),
  condition: oneOf(conditions, "Укажите состояние."),
  wantText: z.string().trim().min(3, "Напишите, что хотите получить.").max(1000),
  wantedTypeIds: z.array(oneOf(itemTypes, "Неизвестный желаемый тип.")).max(6, "Выберите не больше шести подходящих типов.").default([]),
  wantedCategoryIds: z.array(oneOf(categories, "Неизвестная категория.")).max(4).default([]),
  requiredKeywords: keywords, excludedKeywords: keywords, preferredKeywords: keywords,
  minimumCondition: oneOf(conditions, "Неизвестное состояние.").default("repair"),
  areaId: oneOf(areas, "Выберите зону Владивостока."),
  meetingAreaIds: z.array(oneOf(areas, "Неизвестная зона встречи.")).max(6).default([]),
  pickupOnly: z.boolean().default(false),
  availability: z.array(z.object({ start: z.iso.datetime(), end: z.iso.datetime() }).strict()
    .refine((window) => Date.parse(window.end) - Date.parse(window.start) >= 15 * 60_000, "Окно встречи должно быть не меньше 15 минут.")).max(5).default([]),
  maxParticipants: z.number().int().min(2).max(4).default(4),
  notes: z.string().trim().max(1000).default(""),
}).strict().superRefine((value, context) => {
  if (itemTypes.find((type) => type.id === value.itemTypeId)?.categoryId !== value.categoryId) {
    context.addIssue({ code: "custom", path: ["categoryId"], message: "Категория не соответствует типу вещи." });
  }
});
export const guestSchema = z.object({ name: z.string().trim().min(2).max(40), areaId: oneOf(areas, "Выберите зону.") }).strict();
export const searchSchema = z.object({ listingId: idSchema, maxParticipants: z.number().int().min(2).max(4).default(4), limit: z.number().int().min(1).max(30).default(20) }).strict();
export const createCircleSchema = z.object({ listingIds: z.array(idSchema).min(2).max(4), versions: z.array(z.number().int().positive()).min(2).max(4) }).strict();
export const respondSchema = z.object({ decision: z.enum(["accept", "decline"]) }).strict();
