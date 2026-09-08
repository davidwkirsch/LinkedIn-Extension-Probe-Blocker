// background.js — manages enabled/disabled state and badge UI

const BADGE_ON  = { text: "ON",  color: "#4dff88", textColor: "#000" };
const BADGE_OFF = { text: "OFF", color: "#ff4d4d", textColor: "#fff" };

function isLinkedInUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return url.protocol === "https:" && url.hostname === "www.linkedin.com";
  } catch (_) {
    return false;
  }
}

// --- Init on install / startup ---
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ enabled: true });
  applyBadge(true);
  console.log("[ProbeBlocker] Installed. Blocking enabled.");
});

chrome.runtime.onStartup.addListener(async () => {
  const { enabled = true } = await chrome.storage.local.get("enabled");
  applyBadge(enabled);
});

// --- Badge helper ---
function applyBadge(enabled) {
  const b = enabled ? BADGE_ON : BADGE_OFF;
  chrome.action.setBadgeText({ text: b.text });
  chrome.action.setBadgeBackgroundColor({ color: b.color });
  // Badge text colour requires Chrome 111+
  if (chrome.action.setBadgeTextColor) {
    chrome.action.setBadgeTextColor({ color: b.textColor });
  }
  chrome.action.setTitle({
    title: `Extension Probe Blocker — ${enabled ? "ON (click to disable)" : "OFF (click to enable)"}`,
  });
}

// --- Toggle on icon click ---
chrome.action.onClicked.addListener(async (tab) => {
  const { enabled = true } = await chrome.storage.local.get("enabled");
  const next = !enabled;
  await chrome.storage.local.set({ enabled: next });
  applyBadge(next);
  console.log(`[ProbeBlocker] Toggled → ${next ? "ON" : "OFF"}`);

  // Stamp the new state onto already-open tabs so content.js picks it up
  // (new navigations will get the fresh state from storage automatically)
  const tabs = await chrome.tabs.query({});
  for (const t of tabs) {
    if (!t.id || !t.url || !isLinkedInUrl(t.url)) continue;
    try {
      await chrome.scripting.executeScript({
        target: { tabId: t.id, allFrames: true },
        world: "MAIN",
        func: (isEnabled) => {
          document.documentElement.dataset.probeBlocker = isEnabled ? "enabled" : "disabled";
          console.log(`%c[ProbeBlocker] State updated → ${isEnabled ? "ON" : "OFF"}`, "color: #4dff88; font-weight: bold;");
        },
        args: [next],
      });
    } catch (_) {
      // Tab may not be injectable (e.g. devtools, PDFs) — skip silently
    }
  }
});

// --- Inject state into new tabs before page scripts run ---
// content.js already runs at document_start, but it reads the data attribute.
// We push the stored state via scripting API on navigation committed.
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== "loading") return;
  if (!tab.url || !isLinkedInUrl(tab.url)) return;

  const { enabled = true } = await chrome.storage.local.get("enabled");
  try {
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      world: "MAIN",
      func: (isEnabled) => {
        document.documentElement.dataset.probeBlocker = isEnabled ? "enabled" : "disabled";
      },
      args: [enabled],
    });
  } catch (_) {}
});
