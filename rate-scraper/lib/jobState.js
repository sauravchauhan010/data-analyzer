// Simple in-memory job status. Good enough for a single-user internal
// tool with one sync running at a time. If this ever needs to survive
// a server restart mid-job, swap this for a tiny DB table — not needed yet.

let state = {
  status: "idle", // idle | running | waiting_for_otp | completed | failed
  data: [],
  error: null,
  updatedAt: null,
};

function getState() {
  return state;
}

function setState(partial) {
  state = { ...state, ...partial, updatedAt: new Date().toISOString() };
}

module.exports = { getState, setState };