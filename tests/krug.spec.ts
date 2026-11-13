import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs/promises";
const headers = { "Content-Type": "application/json", "X-Krug-Client": "krug" };
async function select(page: Page, label: string, text: string) {
  const control = page.getByRole("combobox", { name: label, exact: true });
  await expect(control).toBeVisible();
  if (await control.evaluate((el) => el.tagName === "SELECT")) await control.selectOption({ label: text });
  else { await control.click(); await page.getByRole("option", { name: text, exact: true }).click(); }
}
async function demo(page: Page, key: string, name: string) { await select(page, "Демопрофиль", `${name} · ${key}`); await expect(page.locator(".profile-button,.mobile-profile")).toContainText(name); }
async function reset(page: Page) { const response = await page.request.post("/api/krug/demo/reset", { headers, data: {} }); expect(response.ok()).toBeTruthy(); }
async function noOverflow(page: Page) { expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy(); }

for (const [shell, width, height] of [["desktop",1440,1000], ["mobile",390,844]] as const) {
  test(`${shell}: real form, three sessions, agreed circle, deep link and resize`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage(), errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    await page.goto("/"); await expect(page.locator(".listing-card").first()).toBeVisible();
    if (shell === "mobile") { await expect(page.locator(".krug-mobile .toolbar")).toBeVisible(); await expect(page.locator(".desktop-app")).toHaveCount(0); }
    await demo(page, "A", "Анна"); await reset(page);
    await page.goto("/listings/new");
    await page.getByRole("textbox", { name: "Название вещи", exact: true }).fill("Монитор Samsung 24 дюйма");
    await page.setViewportSize({ width: width === 390 ? 1440 : 390, height });
    await expect(page.getByRole("textbox", { name: "Название вещи", exact: true })).toHaveValue("Монитор Samsung 24 дюйма");
    await page.setViewportSize({ width, height });
    await expect(page.getByRole("textbox", { name: "Название вещи", exact: true })).toHaveValue("Монитор Samsung 24 дюйма");
    await select(page, "Тип вещи", "Монитор");
    await page.getByRole("textbox", { name: "Описание", exact: true }).fill("Исправный монитор, отдаю вместе с кабелем и подставкой. Без повреждений.");
    await page.getByRole("textbox", { name: "Что ищете взамен?", exact: true }).fill("Ищу велосипед для города");
    await page.getByRole("button", { name: "Велосипед", exact: true }).click();
    await page.getByRole("button", { name: "Опубликовать заявку", exact: true }).click();
    await expect(page).toHaveURL(/\/listings\/[a-f0-9]{24}$/);
    const listingUrl = page.url();
    await page.reload(); await expect(page.getByRole("heading", { level: 1 })).toHaveText("Монитор Samsung 24 дюйма");
    await page.getByText("Найти мой круг ↻", { exact: true }).click();
    await expect(page.locator(".candidate-card")).toHaveCount(2);
    await expect(page.locator(".candidate-card").first().locator(".candidate-outcome h2")).toContainText(/велосипед/i);
    await expect(page.locator(".candidate-card").first()).toContainText("3 участника");
    await page.locator(".candidate-card").filter({ hasText: "Вера" }).getByText("Предложить этот круг", { exact: true }).click();
    await expect(page).toHaveURL(/\/circles\/[a-f0-9]{24}$/); const circleUrl = page.url();
    await expect(page.locator(".your-outcome")).toContainText("Городской велосипед");
    await page.getByText("Подтвердить интерес", { exact: true }).click();
    await expect(page.getByText("Вы подтвердили интерес. Ждём остальных участников.", { exact: true })).toBeVisible();
    for (const [key, name] of [["C","Вера"],["B","Борис"]]) {
      const other = await browser.newContext({ viewport: { width, height } }); const participant = await other.newPage();
      await participant.goto(circleUrl); await demo(participant, key, name);
      await participant.getByText("Подтвердить интерес", { exact: true }).click();
      if (key === "B") await expect(participant.getByRole("heading", { level: 1 })).toHaveText("Ваш круг сложился");
      await other.close();
    }
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ваш круг сложился", { timeout: 12_000 });
    await page.reload(); await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ваш круг сложился");
    await expect(page.locator(".transfer-list li")).toHaveCount(3);
    await noOverflow(page); await fs.mkdir(".local/qa", { recursive: true }); await page.screenshot({ path: `.local/qa/${shell}-circle.png`, fullPage: true });
    await page.goto(listingUrl); await expect(page.getByText("Зарезервировано в круге", { exact: true })).toBeVisible();
    await page.goBack(); await expect(page).toHaveURL(circleUrl);
    expect(errors).toEqual([]); await context.close();
  });
}

test("decline finds alternative; pair, four people and no match", async ({ browser }) => {
  const context = await browser.newContext(); const page = await context.newPage();
  await page.goto("/"); await demo(page, "A", "Анна"); await reset(page);
  await page.goto("/listings/new");
  await page.getByRole("textbox", { name: "Название вещи", exact: true }).fill("Монитор для обмена");
  await select(page, "Тип вещи", "Монитор");
  await page.getByRole("textbox", { name: "Описание", exact: true }).fill("Рабочий монитор с комплектом проводов и подставкой.");
  await page.getByRole("textbox", { name: "Что ищете взамен?", exact: true }).fill("Хочу велосипед");
  await page.getByRole("button", { name: "Опубликовать заявку", exact: true }).click();
  await page.getByText("Найти мой круг ↻", { exact: true }).click();
  await page.locator(".candidate-card").filter({ hasText: "Вера" }).getByText("Предложить этот круг", { exact: true }).click(); await expect(page).toHaveURL(/\/circles\/[a-f0-9]{24}$/); const circleUrl = page.url();
  const other = await browser.newContext(); const b = await other.newPage(); await b.goto(circleUrl); await demo(b, "B", "Борис");
  await b.getByText("Мне не подходит", { exact: true }).click(); await b.getByRole("button", { name: "Подтвердить отказ", exact: true }).click();
  await expect(b.getByText("Участник отказался", { exact: true })).toBeVisible();
  await page.reload(); await page.getByText("Поискать другой круг →", { exact: true }).click();
  await expect(page.locator(".candidate-card")).toHaveCount(1); await expect(page.locator(".candidate-card")).toContainText("Даша"); await expect(page.locator(".candidate-card")).toContainText("Глеб");
  await other.close();
  for (const [key, name, count] of [["F","Егор",4],["J","Лена",2],["L","Никита",0]] as const) {
    await demo(page, key, name); await page.goto("/my"); await page.locator(".listing-card").first().click(); await page.getByText("Найти мой круг ↻", { exact: true }).click();
    if (count) { await expect(page.locator(".candidate-card")).toHaveCount(1); await expect(page.locator(".candidate-card")).toContainText(`${count} участника`); }
    else { await expect(page.getByRole("heading", { name: "Подходящего круга пока нет", exact: true })).toBeVisible(); await expect(page.locator(".candidate-card")).toHaveCount(0); }
  }
  await context.close();
});

test("mobile popup, validation, 320/768px and studio after switching widths", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto("/");
  await page.locator(".mobile-profile").click();
  const modal = page.getByRole("dialog"); await expect(modal).toBeVisible();
  await modal.getByRole("textbox", { name: "Ваше имя", exact: true }).fill("Тестовый житель");
  await modal.getByRole("button", { name: "Продолжить", exact: true }).click(); await expect(modal).toBeHidden();
  await page.locator(".krug-tabbar").getByText("Предложить", { exact: true }).click();
  await page.getByRole("button", { name: "Опубликовать заявку", exact: true }).click(); await expect(page).toHaveURL(/\/listings\/new$/);
  await page.getByRole("textbox", { name: "Название вещи", exact: true }).fill("Очень длинное название вещи для проверки мобильного экрана и сохранения введённого текста");
  for (const width of [320,768,1440,390]) { await page.setViewportSize({ width, height: 844 }); await expect(page.getByRole("textbox", { name: "Название вещи", exact: true })).toHaveValue(/Очень длинное/); await noOverflow(page); }
  await page.goto("/studio"); await expect(page.getByRole("heading", { name: "База данных.", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Новая коллекция", exact: true }).first().click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: "Новая коллекция", exact: true })).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Отмена", exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 1000 }); await noOverflow(page);
  await page.goto("/"); await expect(page.locator(".desktop-app")).toBeVisible(); expect(errors).toEqual([]);
});
