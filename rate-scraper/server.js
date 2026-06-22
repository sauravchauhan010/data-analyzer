require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const { scrapeRaynaB2B } = require("./scrapers/raynab2b");
const jobState = require("./lib/jobState");
const otpBroker = require("./lib/otpBroker");

const app = express();
app.use(cors()); // TODO: once your admin panel has a fixed URL, lock this down to it instead of allowing all origins
app.use(express.json());

// Admin panel calls this when you click "Sync"
app.post("/api/sync", (req, res) => {
  const current = jobState.getState();
  if (current.status === "running" || current.status === "waiting_for_otp") {
    return res.status(409).json({ error: "A sync is already in progress" });
  }

  jobState.setState({ status: "running", error: null });
  res.json({ status: "started" }); // respond immediately — scraping runs in the background

  runSync().catch((err) => {
    console.error("Sync failed:", err);
    jobState.setState({ status: "failed", error: err.message });
  });
});

// Admin panel polls this to know what's happening
app.get("/api/sync/status", (req, res) => {
  res.json(jobState.getState());
});

// Admin panel calls this once you've typed in the OTP
app.post("/api/sync/otp", (req, res) => {
  const { otp } = req.body || {};
  if (!otp) return res.status(400).json({ error: "Missing otp in request body" });

  const accepted = otpBroker.submitOtp(otp);
  if (!accepted) {
    return res.status(400).json({ error: "No OTP is currently being requested" });
  }
  res.json({ status: "submitted" });
});

async function runSync() {
  const browser = await chromium.launch({ headless: true });
  try {
    const getOtp = () => {
      jobState.setState({ status: "waiting_for_otp" });
      return otpBroker.waitForOtp().finally(() => {
        // Whatever happens next (success or failure), we're no longer
        // strictly "waiting" — runSync's outer catch handles failures.
        if (jobState.getState().status === "waiting_for_otp") {
          jobState.setState({ status: "running" });
        }
      });
    };

    const tours = await scrapeRaynaB2B(browser, getOtp);
    jobState.setState({ status: "completed", data: tours });

    const outPath = path.join(__dirname, "data", "latest.json");
    fs.writeFileSync(outPath, JSON.stringify(tours, null, 2));
  } finally {
    await browser.close();
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Rate scraper server running on port ${PORT}`));