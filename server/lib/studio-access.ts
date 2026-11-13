import { ApiError } from "./errors";
export function ensureStudioCollection(name: string) {
  if (name.startsWith("krug_")) throw new ApiError(403, "Коллекции «Круга» доступны только через защищённое API продукта.");
}
