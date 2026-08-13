import { JOB_KEY, isZoomMediaUrl } from "./lib.js";

const filenameElement = document.querySelector("#filename");
const messageElement = document.querySelector("#message");
const progressElement = document.querySelector("#progress");
const saveButton = document.querySelector("#save");

const stored = await chrome.storage.session.get(JOB_KEY);
const job = stored[JOB_KEY];

if (!job?.mediaUrl || !job?.filename || !isZoomMediaUrl(job.mediaUrl)) {
  showError("保存する録画データが見つかりません。Zoomページからやり直してください。");
} else {
  filenameElement.textContent = job.filename;
  await verifyConnection(job.mediaUrl);
  saveButton.addEventListener("click", () => void saveRecording(job));
}

async function verifyConnection(mediaUrl) {
  try {
    const response = await fetch(mediaUrl, { headers: { range: "bytes=0-0" }, cache: "no-store" });
    if (![200, 206].includes(response.status) || !response.headers.get("content-type")?.toLowerCase().includes("video/mp4")) {
      throw new Error("VIDEO_UNAVAILABLE");
    }
    await response.body?.cancel();
    messageElement.textContent = "接続できました。保存先を選んでください。";
    saveButton.disabled = false;
  } catch {
    showError("Zoomから動画を読み込めませんでした。録画ページを再読み込みして、もう一度お試しください。");
    await chrome.runtime.sendMessage({ type: "DOWNLOAD_FAILED", message: messageElement.textContent });
  }
}

async function saveRecording(currentJob) {
  saveButton.disabled = true;
  try {
    const fileHandle = await showSaveFilePicker({
      suggestedName: currentJob.filename,
      types: [{ description: "MP4動画", accept: { "video/mp4": [".mp4"] } }],
    });
    const response = await fetch(currentJob.mediaUrl, { headers: { range: "bytes=0-" }, cache: "no-store" });
    if (![200, 206].includes(response.status) || !response.body) throw new Error("VIDEO_UNAVAILABLE");

    const total = Number(response.headers.get("content-length")) || 0;
    const reader = response.body.getReader();
    const writable = await fileHandle.createWritable();
    let received = 0;
    progressElement.hidden = false;
    messageElement.textContent = "保存しています…";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        await writable.write(value);
        received += value.byteLength;
        if (total) progressElement.value = Math.min(100, (received / total) * 100);
      }
      await writable.close();
    } catch (error) {
      await writable.abort().catch(() => {});
      throw error;
    }

    progressElement.value = 100;
    messageElement.textContent = "保存が完了しました。";
    messageElement.className = "message success";
    await chrome.runtime.sendMessage({ type: "DOWNLOAD_COMPLETE" });
  } catch (error) {
    if (error?.name === "AbortError") {
      messageElement.textContent = "保存をキャンセルしました。";
      saveButton.disabled = false;
      return;
    }
    showError("保存に失敗しました。Zoom録画ページからもう一度お試しください。");
    await chrome.runtime.sendMessage({ type: "DOWNLOAD_FAILED", message: messageElement.textContent });
  }
}

function showError(message) {
  messageElement.textContent = message;
  messageElement.className = "message error";
  saveButton.disabled = true;
}
