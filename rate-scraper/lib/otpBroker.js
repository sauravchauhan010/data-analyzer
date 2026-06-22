// Lets the scraper "pause" mid-login waiting for an OTP, and lets an API
// endpoint "wake it up" once the code arrives from the admin panel.
// Only one OTP request is tracked at a time (fine since sync is triggered
// manually, one at a time, by the sync button).

let pendingResolve = null;
let pendingReject = null;

function waitForOtp(timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingResolve = null;
      pendingReject = null;
      reject(new Error("Timed out waiting for OTP (no code submitted in time)"));
    }, timeoutMs);

    pendingResolve = (otp) => {
      clearTimeout(timer);
      resolve(otp);
    };
    pendingReject = (err) => {
      clearTimeout(timer);
      reject(err);
    };
  });
}

// Called by POST /api/sync/otp. Returns false if nothing is waiting.
function submitOtp(otp) {
  if (!pendingResolve) return false;
  pendingResolve(otp);
  pendingResolve = null;
  pendingReject = null;
  return true;
}

function isWaiting() {
  return pendingResolve !== null;
}

module.exports = { waitForOtp, submitOtp, isWaiting };