import {
  DOWNLOAD_RULE_ID,
  JOB_KEY,
  JOB_TIMEOUT_MS,
  filenameFromMediaUrl,
  isZoomMediaUrl,
  parseZoomShareUrl,
  publicJob,
} from "./lib.js";

let startingDownload = false;

chrome.runtime.onInstalled.addListener(() => clearSensitiveState());
chrome.runtime.onStartup.addListener(() => clearSensitiveState());

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse).catch((error) => {
    sendResponse({ ok: false, error: normalizeError(error) });
  });
  return true;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  void getJob().then((job) => {
    if (job?.tabId === tabId && !["complete", "failed"].includes(job.phase)) {
      return failJob("Zoomタブが閉じられました。");
    }
  });
});

chrome.webRequest.onResponseStarted.addListener(
  (details) => void handleMediaResponse(details),
  { urls: ["https://zoom.us/*", "https://*.zoom.us/*"], types: ["media", "other"] },
);

async function handleMessage(message, sender) {
  switch (message?.type) {
    case "START_CURRENT": return startCurrentTabJob();
    case "GET_STATUS": return { ok: true, job: publicJob(await getJob()) };
    case "DOWNLOAD_COMPLETE": return finishDownload(sender.url);
    case "DOWNLOAD_FAILED": return failDownload(sender.url, message.message);
    case "CANCEL": await clearSensitiveState(); return { ok: true };
    default: return { ok: false, error: "未対応の操作です。" };
  }
}

async function startCurrentTabJob() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id === undefined || !tab.url) throw new Error("INVALID_SHARE_URL");
  const pageUrl = parseZoomShareUrl(tab.url);
  await clearSensitiveState();
  await setJob({
    tabId: tab.id,
    zoomOrigin: pageUrl.origin,
    phase: "waiting-media",
    message: "録画データを待っています…",
    startedAt: Date.now(),
  });
  await chrome.tabs.reload(tab.id);
  return { ok: true };
}

async function handleMediaResponse(details) {
  if (![200, 206].includes(details.statusCode) || !isZoomMediaUrl(details.url)) return;
  const job = await getJob();
  if (!job || job.tabId !== details.tabId || isExpired(job) || startingDownload || ["ready-to-save", "downloading", "complete"].includes(job.phase)) return;
  startingDownload = true;
  const filename = filenameFromMediaUrl(details.url);
  await setJob({
    ...job,
    mediaUrl: details.url,
    phase: "ready-to-save",
    message: "保存画面を準備しています…",
    filename,
  });
  try {
    const mediaHostname = new URL(details.url).hostname;
    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [DOWNLOAD_RULE_ID],
      addRules: [{
        id: DOWNLOAD_RULE_ID,
        priority: 1,
        action: {
          type: "modifyHeaders",
          requestHeaders: [
            { header: "referer", operation: "set", value: `${job.zoomOrigin}/` },
            { header: "accept", operation: "set", value: "*/*" },
            { header: "sec-fetch-dest", operation: "set", value: "video" },
            { header: "sec-fetch-mode", operation: "set", value: "no-cors" },
            { header: "sec-fetch-site", operation: "set", value: "same-site" },
          ],
        },
        condition: {
          requestDomains: [mediaHostname],
          resourceTypes: ["xmlhttprequest", "other", "media"],
        },
      }],
    });
    await chrome.tabs.update(details.tabId, { url: chrome.runtime.getURL("downloader.html"), active: true });
  } catch {
    await failJob("保存画面を開けませんでした。");
  } finally {
    startingDownload = false;
  }
}

async function finishDownload(senderUrl) {
  if (!senderUrl?.startsWith(chrome.runtime.getURL("downloader.html"))) return { ok: false };
  const job = await getJob();
  if (!job) return { ok: false };
  await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [DOWNLOAD_RULE_ID] });
  await setJob({ ...job, mediaUrl: undefined, phase: "complete", message: "保存が完了しました。" });
  return { ok: true };
}

async function failDownload(senderUrl, message) {
  if (!senderUrl?.startsWith(chrome.runtime.getURL("downloader.html"))) return { ok: false };
  const job = await getJob();
  if (job) await failJob(message || "Zoomからの保存が失敗しました。");
  return { ok: true };
}

async function failJob(message) {
  const job = await getJob();
  await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [DOWNLOAD_RULE_ID] }).catch(() => {});
  await setJob({ ...(job || {}), mediaUrl: undefined, phase: "failed", message });
  return { ok: false, error: message };
}

async function clearSensitiveState() {
  await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [DOWNLOAD_RULE_ID] }).catch(() => {});
  await chrome.storage.session.remove(JOB_KEY);
}

async function getJob() {
  const result = await chrome.storage.session.get(JOB_KEY);
  return result[JOB_KEY] || null;
}

async function setJob(job) {
  await chrome.storage.session.set({ [JOB_KEY]: job });
}

function isExpired(job) {
  if (Date.now() - job.startedAt <= JOB_TIMEOUT_MS) return false;
  void failJob("処理がタイムアウトしました。もう一度お試しください。");
  return true;
}

function normalizeError(error) {
  if (error?.message === "INVALID_SHARE_URL") return "Zoomの録画ページを開いてからお試しください。";
  return "処理を開始できませんでした。";
}
