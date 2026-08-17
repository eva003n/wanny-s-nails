import describe from "@playwright/test";
import { test, expect } from "@playwright/test";

  

describe("Login Flow ->", () => {
  // clean state before any tests
//   test.beforeEach(async ({ page }) => {
//     await page.goto("/login");

//     await page.getByLabel("Email").fill("");
//     await page.getByLabel("Password").fill("");
//   });
  test("User can login with valid credentials", async ({ page }) => {
    await page.goto("/login");

    await page.getByLabel("Email").fill("wanny@wannysnails.com");
    await page.getByLabel("Password").fill("Admin123!");
    await page.getByRole("button", { name: "Sign In" }).click();

    expect(page).toHaveURL("/dashboard");
    expect(page.getByRole("heading")).toHaveText(/Good Morning, Wanny/i);
  });

  test("shows an error with invalid credentials", async ({ page }) => {
    await page.goto("/login");

    await page.getByLabel("Email").fill("user@example.com");
    await page.getByLabel("Password").fill("Admin123452");
    await page.getByRole("button", { name: "Sign In" }).click();

    await expect(page.getByRole("alert")).toHaveText(/invalid credentials/i);
    await expect(page).toHaveURL("/login");
  });
});
