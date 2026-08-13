const startCurrent = document.querySelector("#startCurrent");
const status = document.querySelector("#status");

startCurrent.addEventListener("click", async () => {
  startCurrent.disabled = true;
  showStatus("開いているZoom録画を確認しています…", "working");
  const response = await chrome.runtime.sendMessage({ type: "START_CURRENT" });
  if (!response?.ok) {
    startCurrent.disabled = false;
    showStatus(response?.error || "Zoomの録画ページを開いてからお試しください。", "error");
    return;
  }
  window.close();
});

setInterval(refreshStatus, 700);
void refreshStatus();

async function refreshStatus() {
  const response = await chrome.runtime.sendMessage({ type: "GET_STATUS" }).catch(() => null);
  const job = response?.job;
  if (!job) return;
  const type = job.phase === "failed" ? "error" : job.phase === "complete" ? "success" : "working";
  showStatus(job.message, type);
  startCurrent.disabled = !["failed", "complete"].includes(job.phase);
}

function showStatus(message, type) {
  status.hidden = false;
  status.className = `status ${type}`;
  status.textContent = message;
}
