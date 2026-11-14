import { test, expect } from '@playwright/test'

test('首页可访问并包含品牌标识', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/弘识智教|AIMOOC/)
})

test('功能全览页可访问', async ({ page }) => {
  await page.goto('/features')
  await expect(page.getByText('功能全览')).toBeVisible()
})
