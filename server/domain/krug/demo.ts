import { emptyListing, type Listing, type ListingInput } from "../../../shared/krug/types";
import { itemTypes } from "../../../shared/krug/reference";

export const DEMO_DATASET = "krug-demo-v1";
export const demoPeople = [
  ["A", "Анна", "monitor", "bicycle", "Монитор LG 24 дюйма"],
  ["B", "Борис", "bicycle", "drill", "Городской велосипед"],
  ["C", "Вера", "drill", "monitor", "Дрель Bosch с набором свёрл"],
  ["D", "Глеб", "bicycle", "backpack", "Велосипед для прогулок"],
  ["E", "Даша", "backpack", "monitor", "Туристический рюкзак 40 л"],
  ["F", "Егор", "guitar", "books", "Акустическая гитара"],
  ["G", "Женя", "books", "camera", "Подборка книг о путешествиях"],
  ["H", "Илья", "camera", "lamp", "Фотоаппарат Canon"],
  ["I", "Катя", "lamp", "guitar", "Настольная лампа"],
  ["J", "Лена", "kettle", "toaster", "Электрический чайник"],
  ["K", "Миша", "toaster", "kettle", "Тостер на две порции"],
  ["L", "Никита", "helmet", "sewing_machine", "Велосипедный шлем"],
] as const;
export function demoInput(person: (typeof demoPeople)[number]): ListingInput {
  const [, , give, want, title] = person;
  return { ...emptyListing(), title, description: "Бережно пользовались, всё работает. Хочу обменять на полезную вещь и дать этой новую историю.",
    itemTypeId: give, categoryId: itemTypes.find((type) => type.id === give)!.categoryId,
    wantText: itemTypes.find((type) => type.id === want)!.label, wantedTypeIds: [want], areaId: "center" };
}
export function demoGraph(): Listing[] {
  return demoPeople.map((person, index) => ({ ...demoInput(person), id: String(index + 1).padStart(24, "0"), ownerId: String(index + 100).padStart(24, "0"),
    ownerName: person[1], version: 1, status: "active", isDemo: true, demoKey: person[0], createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }));
}
