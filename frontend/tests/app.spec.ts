import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
  test('should load the landing page with title', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Build Custom RAG Chatbots');
  });

  test('should show Sign In and Get Started buttons', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('navigation').getByRole('link', { name: 'Sign In' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Get Started' })).toBeVisible();
  });

  test('should navigate to login page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('navigation').getByRole('link', { name: 'Sign In' }).click();
    await expect(page).toHaveURL('/login');
    await expect(page.locator('h1')).toContainText('Welcome Back');
  });

  test('should navigate to signup page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Get Started' }).click();
    await expect(page).toHaveURL('/signup');
    await expect(page.locator('h1')).toContainText('Create Account');
  });
});

test.describe('Sign Up Page', () => {
  test('should show signup form', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.locator('h1')).toContainText('Create Account');
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Confirm Password')).toBeVisible();
  });

  test('should show error when passwords do not match', async ({ page }) => {
    await page.goto('/signup');
    await page.getByLabel('Email').fill('test@example.com');
    await page.getByLabel('Password', { exact: true }).fill('Password123');
    await page.getByLabel('Confirm Password').fill('Password456');
    await page.getByRole('button', { name: 'Create Account' }).click();
    await expect(page.getByText('Passwords do not match')).toBeVisible();
  });

  test('should show error for short password', async ({ page }) => {
    await page.goto('/signup');
    await page.getByLabel('Email').fill('test@example.com');
    await page.getByLabel('Password', { exact: true }).fill('Ab1');
    await page.getByLabel('Confirm Password').fill('Ab1');
    await page.getByRole('button', { name: 'Create Account' }).click();
    await expect(page.getByText('Password must be at least 8 characters')).toBeVisible();
  });

  test('should require email field', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.locator('#email')).toHaveAttribute('required');
  });

  test('should link to login page', async ({ page }) => {
    await page.goto('/signup');
    await page.getByRole('link', { name: 'Sign in' }).click();
    await expect(page).toHaveURL('/login');
  });
});

test.describe('Login Page', () => {
  test('should show login form', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('h1')).toContainText('Welcome Back');
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
  });

  test('should show error with wrong credentials', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('nonexistent@test.com');
    await page.getByLabel('Password').fill('WrongPassword123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page.getByText(/invalid|incorrect|user does not exist/i)).toBeVisible({ timeout: 15000 });
  });

  test('should show empty field validation', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#email')).toHaveAttribute('required');
  });

  test('should link to signup page', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: 'Sign up' }).click();
    await expect(page).toHaveURL('/signup');
  });
});

test.describe('Unauthenticated Access', () => {
  test('should redirect to login when accessing dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL('/login');
  });

  test('should redirect to login when accessing history', async ({ page }) => {
    await page.goto('/history');
    await expect(page).toHaveURL('/login');
  });
});

test.describe('Sign Up Flow (e2e)', () => {
  const testEmail = `playwright-test-${Date.now()}@example.com`;
  const testPassword = 'TestPass123!';

  test('should successfully submit signup and show verification screen', async ({ page }) => {
    await page.goto('/signup');
    await page.getByLabel('Email').fill(testEmail);
    await page.getByLabel('Password', { exact: true }).fill(testPassword);
    await page.getByLabel('Confirm Password').fill(testPassword);
    await page.getByRole('button', { name: 'Create Account' }).click();

    await expect(page.getByText('Check Your Email')).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(testEmail)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Enter Verification Code' })).toBeVisible();
  });

  test('should show error for duplicate signup', async ({ page }) => {
    await page.goto('/signup');
    await page.getByLabel('Email').fill(testEmail);
    await page.getByLabel('Password', { exact: true }).fill(testPassword);
    await page.getByLabel('Confirm Password').fill(testPassword);
    await page.getByRole('button', { name: 'Create Account' }).click();

    await expect(page.getByText(/user already exists|account already exists/i)).toBeVisible({ timeout: 30000 });
  });
});
