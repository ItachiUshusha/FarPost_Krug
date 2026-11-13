import "dotenv/config";
import { mkdir } from "node:fs/promises";
import { test, expect } from "@playwright/test";
import { MongoClient } from "mongodb";

const collectionName = `ui_check_${Date.now()}`;
const collectionLabel = "Проверка интерфейса";

test.afterAll(async () => {
  const client = new MongoClient(
    process.env.MONGODB_URI || "mongodb://127.0.0.1:27018",
  );
  try {
    await client.connect();
    const database = client.db(process.env.MONGODB_DATABASE || "vibe_farpost");
    if (!collectionName.startsWith("ui_check_"))
      throw new Error("Refusing to clean an unrelated collection.");
    if (await database.listCollections({ name: collectionName }).hasNext())
      await database.dropCollection(collectionName);
    await database
      .collection("_collections")
      .deleteOne({ name: collectionName });
  } finally {
    await client.close();
  }
});

test("create a form, save and edit a record, extend the schema and delete the record", async ({
  page,
}) => {
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  await mkdir(".local/qa", { recursive: true });
  await page.goto("/");
  await expect(
    page.getByText("MongoDB подключена", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: ".local/qa/studio-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Новая коллекция", exact: true })
    .click();
  const schema = page.getByRole("dialog");
  await schema.getByLabel("Название", { exact: true }).fill(collectionLabel);
  await schema.getByLabel(/^Имя в базе/).fill(collectionName);

  const firstField = schema.locator(".field-builder").nth(0);
  await firstField.getByLabel("Подпись").fill("Заголовок");
  await firstField.getByLabel("Ключ").fill("title");
  await firstField.getByLabel("Обязательное").check();
  await schema.getByRole("button", { name: "Добавить поле" }).click();
  const secondField = schema.locator(".field-builder").nth(1);
  await secondField.getByLabel("Подпись").fill("Стоимость");
  await secondField.getByLabel("Ключ").fill("price");
  await secondField.getByRole("combobox").selectOption("number");
  await schema.getByRole("button", { name: "Добавить поле" }).click();
  const thirdField = schema.locator(".field-builder").nth(2);
  await thirdField.getByLabel("Подпись").fill("Активна");
  await thirdField.getByLabel("Ключ").fill("active");
  await thirdField.getByRole("combobox").selectOption("boolean");
  await schema
    .getByRole("button", { name: "Создать коллекцию", exact: true })
    .click();
  await expect(schema).not.toBeVisible();
  await expect(
    page.getByRole("heading", { name: new RegExp(collectionLabel) }),
  ).toBeVisible();

  await page
    .getByRole("button", { name: "Добавить запись", exact: true })
    .first()
    .click();
  const form = page.getByRole("dialog");
  await form.getByLabel(/^Заголовок/).fill("Запись из браузера");
  await form.getByLabel(/^Стоимость/).fill("1250.5");
  await form.getByLabel(/^Активна/).check();
  await page.screenshot({ path: ".local/qa/studio-form.png", fullPage: true });
  await form.getByRole("button", { name: "Сохранить запись" }).click();
  await expect(
    page.getByRole("cell", { name: "Запись из браузера", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "Да", exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: /^Редактировать запись/ }).click();
  await page
    .getByRole("dialog")
    .getByLabel(/^Заголовок/)
    .fill("Изменённая запись");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Сохранить запись" })
    .click();
  await expect(
    page.getByRole("cell", { name: "Изменённая запись" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Поля формы" }).click();
  await schema.getByRole("button", { name: "Добавить поле" }).click();
  const addedField = schema.locator(".field-builder").nth(3);
  await addedField.getByLabel("Подпись").fill("Заметка");
  await addedField.getByLabel("Ключ").fill("note");
  await schema.getByRole("button", { name: "Сохранить настройки" }).click();
  await expect(
    page.getByRole("columnheader", { name: /^Заметка/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "Изменённая запись" }),
  ).toBeVisible();
  await page.screenshot({
    path: ".local/qa/studio-records.png",
    fullPage: true,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("button", { name: "Поля формы" })).toBeVisible();
  const viewport = await page.evaluate(() => ({
    width: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.width);
  await page.screenshot({
    path: ".local/qa/studio-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Добавить запись", exact: true })
    .first()
    .click();
  await expect(page.getByRole("dialog").getByLabel(/^Заметка/)).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Отмена", exact: true })
    .click();

  await page.getByRole("button", { name: /^Удалить запись/ }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Удалить запись", exact: true })
    .click();
  await expect(
    page.getByText("Первая запись — начало истории", { exact: true }),
  ).toBeVisible();
  expect(browserErrors).toEqual([]);
});
