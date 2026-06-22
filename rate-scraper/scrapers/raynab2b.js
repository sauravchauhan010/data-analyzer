// Scraper for raynab2b.com
//
// This module logs in (AGT code + username + password + OTP), navigates
// to the tour rates section, and extracts tour + option + rate data into
// a common shape the rest of the pipeline can understand.
//
// Several spots below are marked TODO — these need the real selectors
// from the raynab2b.com pages (right-click a field -> Inspect -> copy
// its id/name/class).

const fs = require("fs");
const path = require("path");

const SUPPLIER_NAME = "raynab2b";
const SESSION_FILE = path.join(__dirname, "..", "data", "raynab2b-session.json");

// Checks whether a saved session is still valid by visiting a page that
// only logged-in users can see. If it bounces back to /login, it's expired.
async function isSessionValid(page) {
  await page.goto("https://www.raynab2b.com/dashboard", { waitUntil: "networkidle" }); // TODO: replace with real dashboard URL
  return !page.url().includes("/login");
}

async function login(context, page, getOtp) {
  // TODO: replace with the actual login page URL
  await page.goto("https://www.raynab2b.com/login", { waitUntil: "networkidle" });

  // TODO: replace these selectors with the real input field selectors.
  // To find them: right-click each field in Chrome -> Inspect,
  // then use its id (e.g. "#agtCode") or name (e.g. "input[name='agtCode']").
  await page.fill("#agtCode", process.env.RAYNAB2B_AGT_CODE);
  await page.fill("#username", process.env.RAYNAB2B_USERNAME);
  await page.fill("#password", process.env.RAYNAB2B_PASSWORD);

  // TODO: replace with the real submit button selector
  await page.click("button[type='submit']");

  // Wait for the OTP field to show up after the first submit.
  // TODO: replace with the real OTP input selector
  await page.waitForSelector("#otp", { timeout: 15000 });

  // getOtp() is supplied by whoever called scrapeRaynaB2B — locally it
  // asks in the terminal, on Render it waits for the admin panel to send
  // the code through the API.
  const otp = await getOtp();
  await page.fill("#otp", otp); // TODO: replace selector
  await page.click("#verifyOtpBtn"); // TODO: replace selector

  // Wait for something that only appears after a successful login.
  await page.waitForSelector("#dashboard", { timeout: 15000 }); // TODO: replace selector

  // Save cookies/session so future syncs can skip the OTP step,
  // as long as raynab2b.com's session hasn't expired.
  await context.storageState({ path: SESSION_FILE });
  console.log("Session saved — next sync may skip the OTP step.");
}

async function extractTours(page) {
  // TODO: replace with the actual URL of the tours/rates listing page
  await page.goto("https://www.raynab2b.com/tours", { waitUntil: "networkidle" });

  // TODO: this is a placeholder. Once we know the real page structure
  // (and can look at your existing console script), this will be
  // replaced with real DOM extraction logic — including a fix for the
  // tour-name/option-name pairing issue you ran into before.
  const rawTours = await page.evaluate(() => {
    return []; // placeholder
  });

  // Normalize into the common schema used across all sites
  return rawTours.map((t) => ({
    supplier: SUPPLIER_NAME,
    destination: t.destination || null,
    tour_name: t.tourName || null,
    option_name: t.optionName || null,
    price: t.price || null,
    currency: t.currency || "AED",
    validity: t.validity || null,
  }));
}

async function scrapeRaynaB2B(browser, getOtp) {
  const hasSavedSession = fs.existsSync(SESSION_FILE);
  const context = await browser.newContext(
    hasSavedSession ? { storageState: SESSION_FILE } : {}
  );
  const page = await context.newPage();

  let loggedIn = false;
  if (hasSavedSession) {
    console.log("Found a saved session, checking if it's still valid...");
    loggedIn = await isSessionValid(page);
  }

  if (!loggedIn) {
    console.log("Logging in fresh (OTP will be required)...");
    await login(context, page, getOtp);
  } else {
    console.log("Saved session still valid — skipping OTP.");
  }

  const tours = await extractTours(page);
  await context.close();
  return tours;
}

module.exports = { scrapeRaynaB2B };