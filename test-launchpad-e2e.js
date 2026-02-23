#!/usr/bin/env node
/**
 * LaunchPadAI E2E Test Script
 * Run: npx playwright install chromium && node test-launchpad-e2e.js
 * Requires: npm install playwright (or use from project with playwright)
 */
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const BASE_URL = "http://localhost:3001";
const OUTPUT_DIR = path.join(__dirname, "test-screenshots");
const REPORT = [];

function log(msg, status = "info") {
  const icon = status === "ok" ? "✓" : status === "fail" ? "✗" : "•";
  console.log(`${icon} ${msg}`);
  REPORT.push({ status, msg });
}

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
  });

  const consoleLogs = [];
  page.on("console", (msg) => {
    const text = msg.text();
    const type = msg.type();
    if (type === "error" || type === "warning") {
      consoleLogs.push({ type, text });
    }
  });

  try {
    // Step 1: Homepage
    log("Step 1: Navigating to homepage...");
    const homeRes = await page.goto(BASE_URL, {
      waitUntil: "networkidle",
      timeout: 15000,
    });
    if (!homeRes || homeRes.status() >= 400) {
      log(`Homepage failed to load: ${homeRes?.status()}`, "fail");
    } else {
      const hasBranding = await page
        .locator("text=LaunchPadAI")
        .first()
        .isVisible()
        .catch(() => false);
      if (hasBranding) {
        log("Homepage loads with LaunchPadAI branding", "ok");
      } else {
        log("LaunchPadAI branding not found on homepage", "fail");
      }
      await page.screenshot({
        path: path.join(OUTPUT_DIR, "01-homepage.png"),
        fullPage: false,
      });
    }

    // Step 2: Login page
    log("Step 2: Navigating to login page...");
    await page.goto(`${BASE_URL}/auth/login`, {
      waitUntil: "networkidle",
      timeout: 15000,
    });
    const hasLoginForm = await page
      .locator('input[type="email"]')
      .isVisible()
      .catch(() => false);
    if (hasLoginForm) {
      log("Login page loads with email/password form", "ok");
    } else {
      log("Login form not found", "fail");
    }
    await page.screenshot({
      path: path.join(OUTPUT_DIR, "02-login-page.png"),
      fullPage: false,
    });

    // Step 3: Try login
    log("Step 3: Attempting login with test@test.com / Test1234!...");
    await page.fill('input[type="email"]', "test@test.com");
    await page.fill('input[type="password"]', "Test1234!");
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    const url = page.url();
    const hasError = await page
      .locator("text=Invalid username or password")
      .isVisible()
      .catch(() => false);
    const hasDashboard = url.includes("/dashboard");

    if (hasDashboard) {
      log("Login succeeded - reached dashboard", "ok");
      await page.screenshot({
        path: path.join(OUTPUT_DIR, "03-dashboard.png"),
        fullPage: false,
      });

      // Step 4: Click first project
      const projectLink = page.locator('a[href^="/project/"]').first();
      if (await projectLink.isVisible().catch(() => false)) {
        log("Step 4: Clicking first project...");
        await projectLink.click();
        await page.waitForTimeout(2000);

        const projectUrl = page.url();
        if (projectUrl.includes("/project/")) {
          log("Project page loads", "ok");

          const hasChatPanel = await page
            .locator('[class*="ChatPanel"], [class*="chat"]')
            .first()
            .isVisible()
            .catch(() => false);
          log(
            hasChatPanel ? "Chat panel visible on left" : "Chat panel not found",
            hasChatPanel ? "ok" : "fail"
          );

          const hasCanvas = await page
            .locator('.react-flow, [class*="canvas"], [class*="workflow"]')
            .first()
            .isVisible()
            .catch(() => false);
          log(
            hasCanvas ? "Canvas visible on right" : "Canvas not found",
            hasCanvas ? "ok" : "fail"
          );

          const hasAgentFeed = await page
            .locator('text="AI Agents"')
            .first()
            .isVisible()
            .catch(() => false);
          log(
            hasAgentFeed
              ? "Agent Activity Feed may be present (shows when agents run)"
              : "Agent Activity Feed not visible (expected when no agents running)",
            "info"
          );

          const hasToastContainer = await page
            .locator('[class*="fixed"][class*="bottom"][class*="right"]')
            .first()
            .isVisible()
            .catch(() => false);
          log(
            hasToastContainer
              ? "Toast container area present (bottom-right)"
              : "Toast container: fixed bottom-4 right-4 (empty when no toasts)",
            "info"
          );

          await page.screenshot({
            path: path.join(OUTPUT_DIR, "04-project-page.png"),
            fullPage: false,
          });
        } else {
          log("Project page did not load", "fail");
        }
      } else {
        log("No projects found on dashboard - cannot test project page", "info");
      }
    } else if (hasError) {
      log("Login failed with proper error: 'Invalid username or password'", "ok");
      await page.screenshot({
        path: path.join(OUTPUT_DIR, "03-login-error.png"),
        fullPage: false,
      });
    } else {
      log("Login failed - no error message visible (possible silent failure)", "fail");
      await page.screenshot({
        path: path.join(OUTPUT_DIR, "03-login-unknown.png"),
        fullPage: false,
      });
    }

    // Console errors
    if (consoleLogs.length > 0) {
      log(`Browser console: ${consoleLogs.length} error(s)/warning(s)`, "info");
      consoleLogs.forEach(({ type, text }) =>
        console.log(`  [${type}] ${text.slice(0, 100)}`)
      );
    }
  } catch (err) {
    log(`Error: ${err.message}`, "fail");
  } finally {
    await browser.close();
  }

  console.log("\n--- Report ---");
  REPORT.forEach(({ status, msg }) => {
    const icon = status === "ok" ? "✓" : status === "fail" ? "✗" : "•";
    console.log(`${icon} ${msg}`);
  });
  console.log(`\nScreenshots saved to ${OUTPUT_DIR}`);
}

main();
