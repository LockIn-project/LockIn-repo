// ─── LockIn background.js ────────────────────────────────────────────────────
// Handles: persistence, alarms, idle detection, focus blocking,
//          session timers, break scheduling, AI history logging

// ── Focus site rule IDs ───────────────────────────────────────────────────────
const SITE_RULE_IDS = {
  facebook:  1,
  instagram: 2,
  x:         3,
  tiktok:    4,
  youtube:   5
};

// ── Apply focus toggles via declarativeNetRequest ─────────────────────────────
function applyFocusToggles(toggles) {
  const enableIds  = [];
  const disableIds = [];

  Object.entries(SITE_RULE_IDS).forEach(([site, id]) => {
    if (toggles[site]) {
      enableIds.push(id);
    } else {
      disableIds.push(id);
    }
  });

  // Clear any enabled rulesets (safe reset)
  chrome.declarativeNetRequest.updateEnabledRulesets(
    { enableRulesetIds: [], disableRulesetIds: [] },
    () => {}
  );

  // Map rule IDs to proper URL filters
  const urlMap = {
    1: "*://*.facebook.com/*",
    2: "*://*.instagram.com/*",
    3: "*://*.x.com/*",
    4: "*://*.tiktok.com/*",
    5: "*://*.youtube.com/*"
  };

  // Apply dynamic rules
  chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [...enableIds, ...disableIds],
    addRules: enableIds.map(id => ({
      id,
      priority: 1,
      action: { type: 'block' },
      condition: {
        urlFilter: urlMap[id],
        resourceTypes: ['main_frame', 'sub_frame']
      }
    }))
  }, () => {
    if (chrome.runtime.lastError) {
      console.warn('Rule update error:', chrome.runtime.lastError.message);
    }
  });
}


// ── Idle detection (background, continuous) ───────────────────────────────────
let idleMinutesAccumulated = 0;
let lastIdleState = 'active';

chrome.idle.setDetectionInterval(60); // 1-minute granularity

// Load accumulated idle minutes from storage
chrome.storage.local.get(['lockInIdleMinutes'], (result) => {
  idleMinutesAccumulated = result.lockInIdleMinutes || 0;
});

chrome.idle.onStateChanged.addListener((newState) => {
  chrome.storage.local.get(['lockInTimerRunning'], (res) => {
    const running = res.lockInTimerRunning || false;
    if (running && newState === 'idle') {
      idleMinutesAccumulated++;
      chrome.storage.local.set({ lockInIdleMinutes: idleMinutesAccumulated });
    }
    if (newState === 'active') {
      // persist current accumulated idle on resume
      chrome.storage.local.set({ lockInIdleState: 'active' });
    }
    lastIdleState = newState;
    chrome.storage.local.set({ lockInIdleState: newState });
  });
});

// ── Timer alarm tick (background countdown) ───────────────────────────────────
// We use a 1-second interval alarm isn't feasible (minimum 1 min).
// Instead: store startTime + totalDuration. Popup computes remaining from those.
// Background fires alarms at: session end, each break start, each break end.

function scheduleSessionAlarms(sessionData) {
  // sessionData: { startTime, durationSeconds, breakFreqMinutes, breakDurationMinutes }
  const { startTime, durationSeconds, breakFreqMinutes, breakDurationMinutes } = sessionData;

  chrome.alarms.clearAll(() => {
    const now = Date.now();
    const endTime = startTime + durationSeconds * 1000;
    const delayToEnd = Math.max(0, (endTime - now) / 60000);

    // Session complete alarm
    chrome.alarms.create('lockInSessionEnd', { delayInMinutes: delayToEnd });

    // Break alarms
    if (breakFreqMinutes > 0 && breakDurationMinutes > 0) {
      let breakStart = startTime + breakFreqMinutes * 60 * 1000;
      let breakIndex = 0;
      while (breakStart < endTime) {
        const delayStart = Math.max(0, (breakStart - now) / 60000);
        const delayEnd   = delayStart + breakDurationMinutes;
        chrome.alarms.create(`lockInBreakStart_${breakIndex}`, { delayInMinutes: delayStart });
        chrome.alarms.create(`lockInBreakEnd_${breakIndex}`,   { delayInMinutes: delayEnd });
        breakStart += (breakFreqMinutes + breakDurationMinutes) * 60 * 1000;
        breakIndex++;
      }
    }

    // Scheduled session alarms
    chrome.storage.local.get(['lockInScheduled'], (res) => {
      const scheduled = res.lockInScheduled || [];
      scheduled.forEach((sess, idx) => {
        const fireTime = new Date(sess.scheduledStart).getTime();
        if (fireTime > now) {
          chrome.alarms.create(`lockInSched_${idx}`, {
            delayInMinutes: (fireTime - now) / 60000
          });
        }
      });
    });
  });
}

// ── Log completed session to history ─────────────────────────────────────────
function logSessionHistory(record) {
  chrome.storage.local.get(['lockInHistory'], (res) => {
    const history = res.lockInHistory || [];
    history.push(record);
    // Keep last 100 sessions
    if (history.length > 100) history.splice(0, history.length - 100);
    chrome.storage.local.set({ lockInHistory: history });
  });
}

// ── Message handler ───────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  // ── saveState ──────────────────────────────────────────────────────────────
  if (message.type === 'saveState') {
    chrome.storage.local.set({ lockInMainState: message.state }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  // ── loadState ──────────────────────────────────────────────────────────────
  if (message.type === 'loadState') {
    chrome.storage.local.get([
      'lockInMainState', 'lockInStreak', 'lockInFocusToggles',
      'lockInScheduled', 'lockInIsCompact', 'lockInHistory',
      'lockInIdleMinutes', 'lockInIdleState', 'lockInActiveSession'
    ], (result) => {
      sendResponse({
        state:          result.lockInMainState      || {},
        streak:         result.lockInStreak         || { streakDays: 0, lastSessionDate: null },
        focusToggles:   result.lockInFocusToggles   || { facebook: false, instagram: false, twitter: false, tiktok: false, youtube: false },
        scheduled:      result.lockInScheduled      || [],
        isCompact:      result.lockInIsCompact      || false,
        history:        result.lockInHistory        || [],
        idleMinutes:    result.lockInIdleMinutes    || 0,
        idleState:      result.lockInIdleState      || 'active',
        activeSession:  result.lockInActiveSession  || null
      });
    });
    return true;
  }

  // ── saveStreak ─────────────────────────────────────────────────────────────
  if (message.type === 'saveStreak') {
    chrome.storage.local.set({ lockInStreak: message.streak }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  // ── saveFocusToggles ───────────────────────────────────────────────────────
  if (message.type === 'saveFocusToggles') {
    chrome.storage.local.set({ lockInFocusToggles: message.toggles }, () => {
      applyFocusToggles(message.toggles);
      sendResponse({ success: true });
    });
    return true;
  }

  // ── saveScheduled ──────────────────────────────────────────────────────────
  if (message.type === 'saveScheduled') {
    chrome.storage.local.set({ lockInScheduled: message.scheduled }, () => {
      // Clear old session alarms, re-register
      chrome.alarms.getAll((alarms) => {
        const schedAlarms = alarms.filter(a => a.name.startsWith('lockInSched_'));
        schedAlarms.forEach(a => chrome.alarms.clear(a.name));
        const now = Date.now();
        message.scheduled.forEach((sess, idx) => {
          const fireTime = new Date(sess.scheduledStart).getTime();
          if (fireTime > now) {
            chrome.alarms.create(`lockInSched_${idx}`, {
              delayInMinutes: Math.max(0.1, (fireTime - now) / 60000)
            });
          }
        });
      });
      sendResponse({ success: true });
    });
    return true;
  }

  // ── startSession (background timer bookkeeping) ────────────────────────────
  if (message.type === 'startSession') {
    const { durationSeconds, breakFreqMinutes, breakDurationMinutes, focusSites, scheduledStart, scheduledEnd } = message;
    const startTime = Date.now();
    const activeSession = {
      startTime,
      durationSeconds,
      breakFreqMinutes: breakFreqMinutes || 0,
      breakDurationMinutes: breakDurationMinutes || 0,
      focusSites: focusSites || {},
      scheduledStart: scheduledStart || new Date(startTime).toISOString(),
      scheduledEnd: scheduledEnd || new Date(startTime + durationSeconds * 1000).toISOString()
    };
    idleMinutesAccumulated = 0;
    chrome.storage.local.set({
      lockInActiveSession: activeSession,
      lockInTimerRunning: true,
      lockInIdleMinutes: 0
    }, () => {
      scheduleSessionAlarms({ startTime, durationSeconds, breakFreqMinutes: breakFreqMinutes || 0, breakDurationMinutes: breakDurationMinutes || 0 });
      sendResponse({ success: true, startTime });
    });
    return true;
  }

  // ── stopSession ────────────────────────────────────────────────────────────
  if (message.type === 'stopSession') {
    chrome.alarms.clearAll();
    chrome.storage.local.set({ lockInTimerRunning: false }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

   // ── sessionComplete ────────────────────────────────────────────────────────
   if (message.type === 'sessionComplete') {
     chrome.storage.local.get(['lockInStreak', 'lockInActiveSession', 'lockInIdleMinutes', 'lockInFocusToggles'], (result) => {
       let streak = result.lockInStreak || { streakDays: 0, lastSessionDate: null };
       const today = new Date().toDateString();
       if (streak.lastSessionDate !== today) {
         streak.streakDays += 1;
         streak.lastSessionDate = today;
       }

       const sess   = result.lockInActiveSession || {};
       const idleMins = result.lockInIdleMinutes || 0;
       const totalMins = Math.round((sess.durationSeconds || 0) / 60);

       // Calculate breaks taken: totalMins / breakFreqMinutes (if breakFreqMinutes > 0)
       const breaksTaken = sess.breakFreqMinutes > 0 ? Math.floor(totalMins / sess.breakFreqMinutes) : 0;

       // Build history record
       const record = {
         datetime:     new Date().toISOString(),
         duration:     totalMins,
         focusSites:   result.lockInFocusToggles || {},
         streakDays:   streak.streakDays,
         idleMinutes:  idleMins,
         breakFrequency:   sess.breakFreqMinutes    || 0,
         breakDuration:    sess.breakDurationMinutes || 0,
         scheduledStart:   sess.scheduledStart || null,
         scheduledEnd:     sess.scheduledEnd   || null,
         actualPerformance: {
           focusedMinutes: Math.max(0, totalMins - idleMins),
           breaksTaken:    breaksTaken,
           idleMinutes:    idleMins
         }
       };

       logSessionHistory(record);

       chrome.storage.local.set({
         lockInStreak: streak,
         lockInTimerRunning: false,
         lockInActiveSession: null
       }, () => {
         chrome.notifications.create({
           type: 'basic',
           iconUrl: 'icons/icon48.png',
           title: 'LockIn – Session Complete!',
           message: `Great work! You're on a ${streak.streakDays}-day streak 🔥`
         });
         sendResponse({ streak, record });
       });
     });
     return true;
   }

  // ── getIdleState ───────────────────────────────────────────────────────────
  if (message.type === 'getIdleState') {
    chrome.storage.local.get(['lockInIdleMinutes', 'lockInIdleState'], (res) => {
      sendResponse({
        idleMinutes: res.lockInIdleMinutes || 0,
        idleState:   res.lockInIdleState   || 'active'
      });
    });
    return true;
  }

  // ── getSessionProgress ────────────────────────────────────────────────────
  if (message.type === 'getSessionProgress') {
    chrome.storage.local.get(['lockInActiveSession', 'lockInTimerRunning'], (res) => {
      const sess    = res.lockInActiveSession;
      const running = res.lockInTimerRunning || false;
      if (!sess || !running) {
        sendResponse({ running: false });
        return;
      }
      const elapsed  = Math.floor((Date.now() - sess.startTime) / 1000);
      const remaining = Math.max(0, sess.durationSeconds - elapsed);
      sendResponse({ running: true, remaining, elapsed, sess });
    });
    return true;
  }

  // ── testNotification ───────────────────────────────────────────────────────
  if (message.type === 'testNotification') {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'LockIn – Scheduled Session',
      message: message.text || 'Your scheduled session is starting now!'
    });
    sendResponse({ success: true });
    return true;
  }

  sendResponse({});
  return false;
});

// ── Alarm listener ────────────────────────────────────────────────────────────
chrome.alarms.onAlarm.addListener((alarm) => {

   if (alarm.name === 'lockInSessionEnd') {
     chrome.storage.local.get(['lockInActiveSession', 'lockInIdleMinutes', 'lockInFocusToggles', 'lockInStreak'], (res) => {
       const sess   = res.lockInActiveSession;
       const idleMins = res.lockInIdleMinutes || 0;
       if (!sess) return;

       let streak = res.lockInStreak || { streakDays: 0, lastSessionDate: null };
       const today = new Date().toDateString();
       if (streak.lastSessionDate !== today) {
         streak.streakDays += 1;
         streak.lastSessionDate = today;
       }

       const totalMins = Math.round(sess.durationSeconds / 60);

       // Calculate breaks taken: totalMins / breakFreqMinutes (if breakFreqMinutes > 0)
       const breaksTaken = sess.breakFreqMinutes > 0 ? Math.floor(totalMins / sess.breakFreqMinutes) : 0;

       const record = {
         datetime:  new Date().toISOString(),
         duration:  totalMins,
         focusSites: res.lockInFocusToggles || {},
         streakDays: streak.streakDays,
         idleMinutes: idleMins,
         breakFrequency:    sess.breakFreqMinutes    || 0,
         breakDuration:     sess.breakDurationMinutes || 0,
         scheduledStart:    sess.scheduledStart || null,
         scheduledEnd:      sess.scheduledEnd   || null,
         actualPerformance: {
           focusedMinutes: Math.max(0, totalMins - idleMins),
           breaksTaken:    breaksTaken,
           idleMinutes:    idleMins
         }
       };

       logSessionHistory(record);
       chrome.storage.local.set({
         lockInStreak: streak,
         lockInTimerRunning: false,
         lockInActiveSession: null
       });

       chrome.notifications.create({
         type: 'basic',
         iconUrl: 'icons/icon48.png',
         title: 'LockIn – Session Complete!',
         message: `Session done! ${streak.streakDays}-day streak 🔥`
       });
     });
   }

  if (alarm.name.startsWith('lockInBreakStart_')) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'LockIn – Break Time!',
      message: 'Time for a scheduled break. Step away and recharge.'
    });
    chrome.storage.local.set({ lockInOnBreak: true });
  }

  if (alarm.name.startsWith('lockInBreakEnd_')) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'LockIn – Back to Work!',
      message: 'Break over. Let\'s get back to focusing!'
    });
    chrome.storage.local.set({ lockInOnBreak: false });
  }

  if (alarm.name.startsWith('lockInSched_')) {
    const idx = parseInt(alarm.name.split('_')[1]);
    chrome.storage.local.get(['lockInScheduled'], (res) => {
      const scheduled = res.lockInScheduled || [];
      const sess = scheduled[idx];
      if (sess) {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: 'LockIn – Time to Focus!',
          message: `Your scheduled session is starting now. Duration: ${sess.duration || 0} min.`
        });
      }
    });
  }
});

// ── Restore state on startup ──────────────────────────────────────────────────
chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.get([
    'lockInFocusToggles', 'lockInScheduled', 'lockInActiveSession', 'lockInTimerRunning'
  ], (result) => {
    if (result.lockInFocusToggles) {
      applyFocusToggles(result.lockInFocusToggles);
    }
    if (result.lockInScheduled) {
      const now = Date.now();
      result.lockInScheduled.forEach((sess, idx) => {
        const fireTime = new Date(sess.scheduledStart).getTime();
        if (fireTime > now) {
          chrome.alarms.create(`lockInSched_${idx}`, {
            delayInMinutes: Math.max(0.1, (fireTime - now) / 60000)
          });
        }
      });
    }
    // If a session was running before restart, reschedule end alarm
    if (result.lockInActiveSession && result.lockInTimerRunning) {
      const sess = result.lockInActiveSession;
      const elapsed = Math.floor((Date.now() - sess.startTime) / 1000);
      const remaining = Math.max(0, sess.durationSeconds - elapsed);
      if (remaining > 0) {
        chrome.alarms.create('lockInSessionEnd', { delayInMinutes: remaining / 60 });
      } else {
        chrome.storage.local.set({ lockInTimerRunning: false, lockInActiveSession: null });
      }
    }
  });
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['lockInFocusToggles'], (result) => {
    if (result.lockInFocusToggles) {
      applyFocusToggles(result.lockInFocusToggles);
    }
  });
});