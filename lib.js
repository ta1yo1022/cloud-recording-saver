export const JOB_KEY = "zoomRecordingJob";
export const DOWNLOAD_RULE_ID = 91_201;
export const JOB_TIMEOUT_MS = 90_000;

export function parseZoomShareUrl(value) {
  if (typeof value !== "string" || value.length > 2048) throw new Error("INVALID_SHARE_URL");
  let url;
  try { url = new URL(value); } catch { throw new Error("INVALID_SHARE_URL"); }
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (
    url.protocol !== "https:" ||
    (hostname !== "zoom.us" && !hostname.endsWith(".zoom.us")) ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    !/^\/rec\/(?:share|play)\/[^/]+\/?$/.test(url.pathname)
  ) throw new Error("INVALID_SHARE_URL");
  return url;
}

export function isZoomMediaUrl(value) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    return url.protocol === "https:" &&
      (hostname === "zoom.us" || hostname.endsWith(".zoom.us")) &&
      /\.mp4$/i.test(url.pathname) &&
      url.searchParams.has("Signature") &&
      url.searchParams.has("Policy");
  } catch {
    return false;
  }
}

export function filenameFromMediaUrl(value) {
  try {
    const pathname = new URL(value).pathname;
    const raw = decodeURIComponent(pathname.slice(pathname.lastIndexOf("/") + 1));
    const clean = raw.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").trim().slice(0, 180);
    return clean.toLowerCase().endsWith(".mp4") ? clean : `${clean || "zoom-recording"}.mp4`;
  } catch {
    return "zoom-recording.mp4";
  }
}

export function publicJob(job) {
  if (!job) return null;
  return {
    phase: job.phase,
    message: job.message,
    startedAt: job.startedAt,
    filename: job.filename,
  };
}
