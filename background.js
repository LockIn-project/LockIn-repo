chrome.runtime.onInstalled.addListener(() => {
  console.log("LockIn extension installed and background service worker running.");
});

// Message listener for communication with popup.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle saveState request from popup
  if (message.type === "saveState") {
    chrome.storage.local.set({ lockInMainState: message.state }, () => {
      sendResponse({ success: true });
    });
    return true; // Will respond asynchronously
  }

  // Handle loadState request from popup
  if (message.type === "loadState") {
    chrome.storage.local.get(["lockInMainState"], (result) => {
      const state = result.lockInMainState || {};
      sendResponse({ state });
    });
    return true; // Will respond asynchronously
  }

  // Handle toggleCompact request from popup
  if (message.type === "toggleCompact") {
    chrome.storage.local.get(["lockInIsCompact"], (result) => {
      let isCompact = result.lockInIsCompact || false;
      isCompact = !isCompact;
      chrome.storage.local.set({ lockInIsCompact: isCompact }, () => {
        sendResponse({ isCompact });
      });
    });
    return true; // Will respond asynchronously
  }

  // Optional: Handle timer alarms if popup is closed
  if (message.type === "startTimer") {
    // Start a timer based on current state
    chrome.storage.local.get(["lockInMainState"], (result) => {
      const state = result.lockInMainState || {};
      const durationInMinutes = state.isOnBreak ? state.sessionBreak : state.sessionDuration;
      // Create a repeating alarm for the timer
      chrome.alarms.create("lockInTimer", { delayInMinutes: durationInMinutes, periodInMinutes: durationInMinutes });
      // Mark timer as active
      chrome.storage.local.set({ lockInTimerActive: true });
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === "stopTimer") {
    // Clear the timer alarm
    chrome.alarms.clear("lockInTimer", () => {
      // Mark timer as inactive
      chrome.storage.local.set({ lockInTimerActive: false }, () => {
        sendResponse({ success: true });
      });
    });
    return true;
  }

  // Handle alarm events for timer completion
  if (message.type === "checkAlarm") {
    // This is handled by the alarm listener below
    sendResponse({});
    return true;
  }

  // Default response for unhandled messages
  sendResponse({});
  return false;
});

// Optional: Handle timer alarms to persist state when popup is closed
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "lockInTimer") {
    // Toggle between session and break when timer completes
    chrome.storage.local.get(["lockInMainState"], (result) => {
      let state = result.lockInMainState || {};
      state.isOnBreak = !state.isOnBreak;
      // Save updated main state
      chrome.storage.local.set({ lockInMainState: state }, () => {
        // Optionally restart timer for the new period
        const durationInMinutes = state.isOnBreak ? state.sessionBreak : state.sessionDuration;
        chrome.alarms.create("lockInTimer", { delayInMinutes: durationInMinutes, periodInMinutes: durationInMinutes });
      });
    });
  }
});

// Optional: Restore timer alarm on extension startup if needed
chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.get(["lockInTimerActive", "lockInMainState"], (result) => {
    if (result.lockInTimerActive) {
      const state = result.lockInMainState || {};
      const durationInMinutes = state.isOnBreak ? state.sessionBreak : state.sessionDuration;
      chrome.alarms.create("lockInTimer", { delayInMinutes: durationInMinutes, periodInMinutes: durationInMinutes });
    }
  });
});