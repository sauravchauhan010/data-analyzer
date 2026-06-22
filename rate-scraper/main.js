require("dotenv").config();
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { scrapeRaynaB2B } = require("./scrapers/raynab2b");

// For local testing only — asks for the OTP right in your terminal.
// (The Render-deployed version uses server.js + the admin panel instead.)
function askForOtpInTerminal() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question("Enter the OTP you just received for raynab2b.com: ", (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  // headless: false lets you WATCH the browser while testing, so you can
  // see exactly where it gets stuck. Switch to true once it's reliable.
  const browser = await chromium.launch({ headless: false });

  const results = [];

  try {
    console.log("Scraping raynab2b.com...");
    const raynaTours = await scrapeRaynaB2B(browser, askForOtpInTerminal);
    results.push(...raynaTours);
    console.log(`Got ${raynaTours.length} rows from raynab2b.com`);
  } catch (err) {
    console.error("raynab2b.com scrape failed:", err.message);
  }

  // Later: more scrapers get added here, e.g.
  // const site2Tours = await scrapeSite2(page);
  // results.push(...site2Tours);

  const outPath = path.join(__dirname, "data", "latest.json");
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`Saved ${results.length} total rows to ${outPath}`);

  await browser.close();
}

main();