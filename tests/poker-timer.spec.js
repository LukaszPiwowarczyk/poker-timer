const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('loads default settings and the initial blind level', async ({ page }) => {
  await expect(page.locator('#settingsPanel')).toBeVisible();
  await expect(page.locator('#gamePanel')).toBeHidden();
  await expect(page.locator('#inputRoundMin')).toHaveValue('10');
  await expect(page.locator('#inputPlayers')).toHaveValue('7');
  await expect(page.locator('#inputStack')).toHaveValue('200000');
  await expect(page.locator('#inputRebuy')).toHaveValue('200000');
  await expect(page.locator('#inputAddon')).toHaveValue('100000');
  await expect(page.locator('#levelsTable tbody tr')).toHaveCount(1);
  await expect(page.locator('#levelsTable tbody tr').first()).toContainText('500');
});

test('starts the game and advances to the next blind level', async ({ page }) => {
  await page.locator('#inputAddIncrement').fill('1000');
  await page.locator('#btnAddLevel').click();
  await expect(page.locator('#levelsTable tbody tr')).toHaveCount(2);

  await page.locator('#btnStartGame').click();
  await expect(page.locator('#settingsPanel')).toBeHidden();
  await expect(page.locator('#gamePanel')).toBeVisible();
  await expect(page.locator('#currentBlinds')).toContainText('Blindy: 500 / 1000');
  await expect(page.locator('#roundTimer')).toHaveText('10:00');

  await page.locator('#btnNext').click();
  await expect(page.locator('#currentBlinds')).toContainText('Blindy: 1000 / 2000');
  await expect(page.locator('#currentBlinds')).toContainText('Poziom 2 / 2');
  await expect(page.locator('#roundTimer')).toHaveText('10:00');
});

test('pause starts a break and resume continues the round timer', async ({ page }) => {
  await page.locator('#btnStartGame').click();
  await page.locator('#btnStart').click();
  await page.clock.fastForward(2_000);
  await expect(page.locator('#roundTimer')).toHaveText('9:58');

  await page.locator('#btnPause').click();
  await expect(page.locator('#breakTimerWrap')).toBeVisible();
  await page.clock.fastForward(3_000);
  await expect(page.locator('#breakTimer')).toContainText('0:03');
  await expect(page.locator('#roundTimer')).toHaveText('9:58');

  await page.locator('#btnPause').click();
  await expect(page.locator('#breakTimerWrap')).toBeHidden();
  await expect(page.locator('#roundTimerWrap')).toBeVisible();
  await page.clock.fastForward(1_000);
  await expect(page.locator('#roundTimer')).toHaveText('9:57');
});

test('rebuys and add-ons update counters and chip totals', async ({ page }) => {
  await page.locator('#btnStartGame').click();
  await expect(page.locator('#chipsInGame')).toHaveText('1 400 000');
  await expect(page.locator('#avgStack')).toHaveText('200 000');

  await page.locator('#rebuyPlus').click();
  await page.locator('#addonPlus').click();
  await expect(page.locator('#rebuyCount')).toHaveText('1');
  await expect(page.locator('#addonCount')).toHaveText('1');
  await expect(page.locator('#chipsInGame')).toHaveText('1 700 000');
  await expect(page.locator('#avgStack')).toHaveText('242 857');

  await page.locator('#rebuyMinus').click();
  await page.locator('#addonMinus').click();
  await expect(page.locator('#rebuyCount')).toHaveText('0');
  await expect(page.locator('#addonCount')).toHaveText('0');
  await expect(page.locator('#chipsInGame')).toHaveText('1 400 000');
});

test('persists levels and rebuy/add-on counters after reload', async ({ page }) => {
  await page.locator('#inputAddIncrement').fill('1000');
  await page.locator('#btnAddLevel').click();
  await page.locator('#btnStartGame').click();
  await page.locator('#rebuyPlus').click();
  await page.locator('#addonPlus').click();

  await page.reload();

  await expect(page.locator('#settingsPanel')).toBeVisible();
  await expect(page.locator('#levelsTable tbody tr')).toHaveCount(2);
  await expect(page.locator('#rebuyCount')).toHaveText('1');
  await expect(page.locator('#addonCount')).toHaveText('1');
  await expect(page.locator('#inputPlayers')).toHaveValue('7');
});

test('reset stops the game and returns to settings', async ({ page }) => {
  await page.locator('#btnStartGame').click();
  await page.locator('#btnStart').click();
  await page.clock.fastForward(2_000);
  await page.evaluate(() => { window.confirm = () => true; });
  await page.locator('#btnReset').click();

  await expect(page.locator('#settingsPanel')).toBeVisible();
  await expect(page.locator('#gamePanel')).toBeHidden();
  await expect(page.locator('#modeLabel')).toHaveText('Ustawienia');
  await expect(page.locator('#roundTimer')).toHaveText('10:00');
  await expect(page.locator('#rebuyCount')).toHaveText('0');
  await expect(page.locator('#addonCount')).toHaveText('0');
});

test('keeps the main controls usable on a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.locator('#btnStartGame')).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 1);
});
