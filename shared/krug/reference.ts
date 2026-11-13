export const areas = [
  { id: "center", label: "Центр" },
  { id: "vtoraya-rechka", label: "Вторая Речка" },
  { id: "churkin", label: "Чуркин" },
  { id: "egersheld", label: "Эгершельд" },
  { id: "russky", label: "Остров Русский" },
  { id: "balyaeva", label: "Баляева" },
] as const;

export const categories = [
  { id: "electronics", label: "Электроника" },
  { id: "transport", label: "Велосипеды и транспорт" },
  { id: "tools", label: "Инструменты" },
  { id: "hobby", label: "Хобби и книги" },
  { id: "home", label: "Для дома" },
  { id: "outdoors", label: "Спорт и отдых" },
  { id: "other", label: "Другое" },
] as const;

export const itemTypes = [
  { id: "monitor", label: "Монитор", categoryId: "electronics", aliases: ["монитор", "монитора", "мониторы", "дисплей", "дисплея"] },
  { id: "bicycle", label: "Велосипед", categoryId: "transport", aliases: ["велосипед", "велосипеда", "велосипеды", "велик", "велика"] },
  { id: "drill", label: "Дрель", categoryId: "tools", aliases: ["дрель", "дрели", "дрелей"] },
  { id: "backpack", label: "Рюкзак", categoryId: "outdoors", aliases: ["рюкзак", "рюкзака", "рюкзаки"] },
  { id: "guitar", label: "Гитара", categoryId: "hobby", aliases: ["гитара", "гитару", "гитары", "гитарой"] },
  { id: "books", label: "Книги", categoryId: "hobby", aliases: ["книги", "книгу", "книга", "книг", "книжки"] },
  { id: "camera", label: "Фотоаппарат", categoryId: "electronics", aliases: ["фотоаппарат", "фотоаппарата", "фотокамера", "фотокамеру"] },
  { id: "lamp", label: "Лампа", categoryId: "home", aliases: ["лампа", "лампу", "лампы", "светильник", "светильника"] },
  { id: "kettle", label: "Чайник", categoryId: "home", aliases: ["чайник", "чайника", "чайники"] },
  { id: "toaster", label: "Тостер", categoryId: "home", aliases: ["тостер", "тостера", "тостеры"] },
  { id: "helmet", label: "Шлем", categoryId: "outdoors", aliases: ["шлем", "шлема", "шлемы"] },
  { id: "sewing_machine", label: "Швейная машина", categoryId: "home", aliases: ["швейная", "швейную", "швейной"] },
  { id: "other", label: "Другая вещь", categoryId: "other", aliases: [] },
] as const;

export const conditions = [
  { id: "repair", label: "Требует ремонта", rank: 0 },
  { id: "fair", label: "Есть недостатки", rank: 1 },
  { id: "good", label: "Хорошее", rank: 2 },
  { id: "excellent", label: "Отличное", rank: 3 },
  { id: "new", label: "Новое", rank: 4 },
] as const;

export const areaLabel = (id: string) => areas.find((a) => a.id === id)?.label ?? "Весь город";
export const typeLabel = (id: string) => itemTypes.find((a) => a.id === id)?.label ?? "Вещь";
export const conditionLabel = (id: string) => conditions.find((a) => a.id === id)?.label ?? id;
export const categoryLabel = (id: string) => categories.find((a) => a.id === id)?.label ?? id;
