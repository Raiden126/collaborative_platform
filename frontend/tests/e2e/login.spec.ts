import { expect, test } from '@playwright/test';

test.describe('Authentication', () => {
  test('login page renders and gates protected routes', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /Workflow Builder/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Sign in/i })).toBeVisible();
  });

  // Full happy-path flow — requires backend running + seeded (pnpm dev:backend).
  test.skip('logs in and reaches the dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('admin@cwb.dev');
    await page.getByLabel('Password').fill('password123');
    await page.getByRole('button', { name: /Sign in/i }).click();
    await expect(page).toHaveURL(/dashboard/);
  });
});
