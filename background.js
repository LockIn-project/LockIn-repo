// ─── LockIn background.js ───────────────────────────────────────────────────
// Single onMessage listener handles all message types.
// Uses chrome.declarativeNetRequest for site blocking (MV3 compliant).

chrome.runtime.onInstalled.addListener(() => {
  console.log("LockIn installed.");
  // Seed storage defaults if first run
  chrome.storage.local.get(["lockInMainState"], (result) => {
    if (!result.lockInMainState) {
      chrome.storage.local.set({
        lockInMainState: {},
        lockInIsCompact: false,
        lockInStreak: { streakDays: 0, lastSessionDate: null },
        lockInFocusToggles: { facebook: false, instagram: false, twitter: false, tiktok: false, youtube: false },
        lockInScheduled: [],
        lockInTimerActive: false
      });
    }
  });
});

// ── Declarative Net Request rules for site blocking ──────────────────────────
const BLOCK_RULES = {
  facebook:  { id: 1, priority: 1, action: { type: "block" }, condition: { urlFilter: "*facebook.com*",  resourceTypes: ["main_frame"] } },
  instagram: { id: 2, priority: 1, action: { type: "block" }, condition: { urlFilter: "*instagram.com*", resourceTypes: ["main_frame"] } },
  twitter:   { id: 3, priority: 1, action: { type: "block" }, condition: { urlFilter: "*twitter.com*",   resourceTypes: ["main_frame"] } },
  tiktok:    { id: 4, priority: 1, action: { type: "block" }, condition: { urlFilter: "*tiktok.com*",    resourceTypes: ["main_frame"] } },
  youtube:   { id: 5, priority: 1, action: { type: "block" }, condition: { urlFilter: "*youtube.com*",   resourceTypes: ["main_frame"] } }
};

function applyFocusToggles(toggles) {
  const addRules = [];
  const removeIds = [];
  for (const [site, rule] of Object.entries(BLOCK_RULES)) {
    if (toggles[site]) {
      addRules.push(rule);
    } else {
      removeIds.push(rule.id);
    }
  }
  chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: removeIds, addRules });
}

// ── Main message listener ─────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  // ── saveState ──────────────────────────────────────────────────────────────
  if (message.type === "saveState") {
    chrome.storage.local.set({ lockInMainState: message.state }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  // ── loadState ──────────────────────────────────────────────────────────────
  if (message.type === "loadState") {
    chrome.storage.local.get([
      "lockInMainState", "lockInStreak", "lockInFocusToggles",
      "lockInScheduled", "lockInIsCompact"
    ], (result) => {
      sendResponse({
        state:        result.lockInMainState      || {},
        streak:       result.lockInStreak         || { streakDays: 0, lastSessionDate: null },
        focusToggles: result.lockInFocusToggles   || { facebook: false, instagram: false, twitter: false, tiktok: false, youtube: false },
        scheduled:    result.lockInScheduled      || [],
        isCompact:    result.lockInIsCompact      || false
      });
    });
    return true;
  }

  // ── saveStreak ─────────────────────────────────────────────────────────────
  if (message.type === "saveStreak") {
    chrome.storage.local.set({ lockInStreak: message.streak }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  // ── saveFocusToggles ───────────────────────────────────────────────────────
  if (message.type === "saveFocusToggles") {
    chrome.storage.local.set({ lockInFocusToggles: message.toggles }, () => {
      applyFocusToggles(message.toggles);
      sendResponse({ success: true });
    });
    return true;
  }

  // ── saveScheduled ──────────────────────────────────────────────────────────
  if (message.type === "saveScheduled") {
    chrome.storage.local.set({ lockInScheduled: message.scheduled }, () => {
      // Reschedule all alarms
      chrome.alarms.clearAll(() => {
        message.scheduled.forEach((sess, idx) => {
          const fireTime = new Date(sess.datetime).getTime();
          const now = Date.now();
          if (fireTime > now) {
            const delayMs = fireTime - now;
            chrome.alarms.create(`lockInSession_${idx}`, { delayInMinutes: delayMs / 60000 });
          }
        });
      });
      sendResponse({ success: true });
    });
    return true;
  }

  // ── toggleCompact ──────────────────────────────────────────────────────────
  if (message.type === "toggleCompact") {
    chrome.storage.local.get(["lockInIsCompact"], (result) => {
      const isCompact = !(result.lockInIsCompact || false);
      chrome.storage.local.set({ lockInIsCompact: isCompact }, () => {
        sendResponse({ isCompact });
      });
    });
    return true;
  }

  // ── sessionComplete (streak logic lives here so it persists) ──────────────
  if (message.type === "sessionComplete") {
    chrome.storage.local.get(["lockInStreak"], (result) => {
      let streak = result.lockInStreak || { streakDays: 0, lastSessionDate: null };
      const today = new Date().toDateString();
      if (streak.lastSessionDate !== today) {
        streak.streakDays += 1;
        streak.lastSessionDate = today;
      }
      chrome.storage.local.set({ lockInStreak: streak }, () => {
        // Show notification
        chrome.notifications.create({
          type: "basic",
          iconUrl: "icons/icon48.png",
          title: "LockIn – Session Complete!",
          message: `Great work! You're on a ${streak.streakDays}-day streak 🔥`
        });
        sendResponse({ streak });
      });
    });
    return true;
  }

  // ── startTimer / stopTimer (background alarm fallback) ────────────────────
  if (message.type === "startTimer") {
    chrome.storage.local.get(["lockInMainState"], (result) => {
      const state = result.lockInMainState || {};
      const durationInMinutes = state.isOnBreak ? state.sessionBreak / 60 : state.sessionDuration / 60;
      chrome.alarms.create("lockInTimer", { delayInMinutes: durationInMinutes });
      chrome.storage.local.set({ lockInTimerActive: true });
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === "stopTimer") {
    chrome.alarms.clear("lockInTimer", () => {
      chrome.storage.local.set({ lockInTimerActive: false }, () => {
        sendResponse({ success: true });
      });
    });
    return true;
  }

  // ── scheduledSessionNotification ──────────────────────────────────────────
  if (message.type === "testNotification") {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon48.png",
      title: "LockIn – Scheduled Session",
      message: message.text || "Your scheduled session is starting now!"
    });
    sendResponse({ success: true });
    return true;
  }

  sendResponse({});
  return false;
});

// ── Alarm listener ────────────────────────────────────────────────────────────
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "lockInTimer") {
    chrome.storage.local.get(["lockInMainState"], (result) => {
      let state = result.lockInMainState || {};
      state.isOnBreak = !state.isOnBreak;
      chrome.storage.local.set({ lockInMainState: state });
    });
  }

  if (alarm.name.startsWith("lockInSession_")) {
    const idx = parseInt(alarm.name.split("_")[1]);
    chrome.storage.local.get(["lockInScheduled"], (result) => {
      const scheduled = result.lockInScheduled || [];
      if (scheduled[idx]) {
        chrome.notifications.create({
          type: "basic",
          iconUrl: "icons/icon48.png",
          title: "LockIn – Time to Focus!",
          message: `Your scheduled ${scheduled[idx].duration}-minute session is starting now.`
        });
      }
    });
  }
});

// ── Restore alarms on startup ─────────────────────────────────────────────────
chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.get([
    "lockInTimerActive", "lockInMainState",
    "lockInFocusToggles", "lockInScheduled"
  ], (result) => {
    // Restore focus blocks
    if (result.lockInFocusToggles) {
      applyFocusToggles(result.lockInFocusToggles);
    }
    // Restore scheduled alarms
    if (result.lockInScheduled) {
      result.lockInScheduled.forEach((sess, idx) => {
        const fireTime = new Date(sess.datetime).getTime();
        if (fireTime > Date.now()) {
          chrome.alarms.create(`lockInSession_${idx}`, {
            delayInMinutes: (fireTime - Date.now()) / 60000
          });
        }
      });
    }
  });
});