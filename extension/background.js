// ─── LockIn background.js ────────────────────────────────────────────────────
// Handles: persistence, alarms, idle detection, focus blocking,
//          session timers, break scheduling, AI history logging

const SITE_RULE_IDS = {
  facebook:  1,
  instagram: 2,
  x:         3,
  tiktok:    4,
  youtube:   5
};

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

  const urlMap = {
    1: "||facebook.com/*",
    2: "||instagram.com/*",
    3: "||x.com/*",
    4: "||tiktok.com/*",
    5: "||youtube.com/*"
  };

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

let idleMinutesAccumulated = 0;
let lastIdleState = 'active';

chrome.idle.setDetectionInterval(60);

chrome.storage.local.get(['lockInIdleMinutes'], (result) => {
  idleMinutesAccumulated = result.lockInIdleMinutes || 0;
});

chrome.idle.onStateChanged.addListener((newState) => {
  chrome.storage.local.get(['lockInTimerRunning', 'lockInOnBreak'], (res) => {
    const running = res.lockInTimerRunning || false;
    if (running && newState === 'idle') {
      idleMinutesAccumulated++;
      chrome.storage.local.set({ lockInIdleMinutes: idleMinutesAccumulated });
    }
    if (newState === 'active') {
      chrome.storage.local.set({ lockInIdleState: 'active' });
    }
    lastIdleState = newState;
    chrome.storage.local.set({ lockInIdleState: newState });
  });
});

function scheduleSessionAlarms(sessionData) {
  const { startTime, durationSeconds, breakFreqMinutes, breakDurationMinutes } = sessionData;

  chrome.alarms.clearAll(() => {
    const now = Date.now();
    const endTime = startTime + durationSeconds * 1000;
    const delayToEnd = Math.max(0, (endTime - now) / 60000);

    chrome.alarms.create('lockInSessionEnd', { delayInMinutes: delayToEnd });

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

function logSessionHistory(record) {
  chrome.storage.local.get(['lockInHistory'], (res) => {
    const history = res.lockInHistory || [];
    history.push(record);
    if (history.length > 100) history.splice(0, history.length - 100);
    chrome.storage.local.set({ lockInHistory: history });
  });
}

let breakEndTime = null;
let breakAlarmIndex = 0;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  if (message.type === 'saveState') {
    chrome.storage.local.set({ lockInMainState: message.state }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === 'loadState') {
    chrome.storage.local.get([
      'lockInMainState', 'lockInStreak', 'lockInFocusToggles',
      'lockInScheduled', 'lockInIsCompact', 'lockInHistory',
      'lockInIdleMinutes', 'lockInIdleState', 'lockInActiveSession',
      'lockInSessionGoal', 'lockInScheduledGoalDuration'
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
        activeSession:  result.lockInActiveSession  || null,
        sessionGoal:    result.lockInSessionGoal    || '',
        scheduledGoalDuration: result.lockInScheduledGoalDuration || 0
      });
    });
    return true;
  }

  if (message.type === 'saveStreak') {
    chrome.storage.local.set({ lockInStreak: message.streak }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === 'saveFocusToggles') {
    chrome.storage.local.set({ lockInFocusToggles: message.toggles }, () => {
      applyFocusToggles(message.toggles);
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === 'saveScheduled') {
    chrome.storage.local.set({ lockInScheduled: message.scheduled }, () => {
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

  if (message.type === 'startSession') {
    const { durationSeconds, breakFreqMinutes, breakDurationMinutes, focusSites, scheduledStart, scheduledEnd, goal } = message;
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
      lockInIdleMinutes: 0,
      lockInOnBreak: false,
      lockInSessionGoal: goal || '',
      lockInBreakRemaining: 0
    }, () => {
      scheduleSessionAlarms({ startTime, durationSeconds, breakFreqMinutes: breakFreqMinutes || 0, breakDurationMinutes: breakDurationMinutes || 0 });
      sendResponse({ success: true, startTime });
    });
    return true;
  }

  if (message.type === 'stopSession') {
    chrome.alarms.clearAll();
    chrome.storage.local.set({
      lockInTimerRunning: false,
      lockInOnBreak: false,
      lockInProgressPercent: 0,
      lockInBreakRemaining: 0
    }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === 'sessionComplete') {
    chrome.storage.local.get(['lockInStreak', 'lockInActiveSession', 'lockInIdleMinutes', 'lockInFocusToggles', 'lockInScheduled', 'lockInScheduledGoalDuration'], (result) => {
      let streak = result.lockInStreak || { streakDays: 0, lastSessionDate: null };
      const today = new Date().toDateString();
      if (streak.lastSessionDate !== today) {
        streak.streakDays += 1;
        streak.lastSessionDate = today;
      }

      const sess    = result.lockInActiveSession || {};
      const idleMins = result.lockInIdleMinutes || 0;
      const totalMins = Math.round((sess.durationSeconds || 0) / 60);

      const breaksTaken = sess.breakFreqMinutes > 0 ? Math.floor(totalMins / sess.breakFreqMinutes) : 0;

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

      const scheduledGoal = result.lockInScheduledGoalDuration || 0;
      const updatedScheduled = (result.lockInScheduled || []).filter(s =>
        new Date(s.scheduledStart).getTime() > Date.now()
      );

      chrome.storage.local.set({
        lockInStreak: streak,
        lockInTimerRunning: false,
        lockInActiveSession: null,
        lockInOnBreak: false,
        lockInProgressPercent: 0,
        lockInScheduled: updatedScheduled,
        lockInScheduledGoalDuration: scheduledGoal
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

  if (message.type === 'breakStarted') {
    const { remainingSeconds, breakIndex } = message;
    breakEndTime = Date.now() + remainingSeconds * 1000;
    breakAlarmIndex = breakIndex;
    chrome.storage.local.set({
      lockInOnBreak: true,
      lockInBreakRemaining: remainingSeconds
    });
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'getBreakTime') {
    chrome.storage.local.get(['lockInBreakRemaining', 'lockInOnBreak'], (res) => {
      sendResponse({
        remaining: res.lockInBreakRemaining || 0,
        isOnBreak: res.lockInOnBreak || false
      });
    });
    return true;
  }

  if (message.type === 'continueSession') {
    chrome.storage.local.set({ lockInOnBreak: false });
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'getIdleState') {
    chrome.storage.local.get(['lockInIdleMinutes', 'lockInIdleState'], (res) => {
      sendResponse({
        idleMinutes: res.lockInIdleMinutes || 0,
        idleState:   res.lockInIdleState   || 'active'
      });
    });
    return true;
  }

  if (message.type === 'getSessionProgress') {
    chrome.storage.local.get(['lockInActiveSession', 'lockInTimerRunning', 'lockInBreakRemaining', 'lockInOnBreak', 'lockInProgressPercent'], (res) => {
      const sess    = res.lockInActiveSession;
      const running = res.lockInTimerRunning || false;
      if (!sess || !running) {
        sendResponse({ running: false });
        return;
      }
      const elapsed   = Math.floor((Date.now() - sess.startTime) / 1000);
      const remaining = Math.max(0, sess.durationSeconds - elapsed);
      const progress  = res.lockInProgressPercent || Math.min(100, Math.max(0, Math.round((elapsed / sess.durationSeconds) * 100)));
      sendResponse({ running: true, remaining, elapsed, sess, progress, isOnBreak: res.lockInOnBreak || false });
    });
    return true;
  }

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

  if (message.type === 'saveScheduledGoal') {
    chrome.storage.local.set({ lockInScheduledGoalDuration: message.duration });
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'clearScheduled') {
    const idx = message.idx;
    chrome.storage.local.get(['lockInScheduled'], (res) => {
      const scheduled = res.lockInScheduled || [];
      if (idx !== undefined && idx >= 0 && idx < scheduled.length) {
        scheduled.splice(idx, 1);
        chrome.storage.local.set({ lockInScheduled: scheduled });
        chrome.alarms.clear(`lockInSched_${idx}`);
      }
    });
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'delayScheduled') {
    const { idx, delayMinutes } = message;
    chrome.storage.local.get(['lockInScheduled'], (res) => {
      const scheduled = res.lockInScheduled || [];
      if (idx !== undefined && idx >= 0 && idx < scheduled.length) {
        const sess = scheduled[idx];
        const newStart = new Date(new Date(sess.scheduledStart).getTime() + delayMinutes * 60000);
        const newEnd   = new Date(new Date(sess.scheduledEnd).getTime()   + delayMinutes * 60000);
        sess.scheduledStart = newStart.toISOString();
        sess.scheduledEnd   = newEnd.toISOString();
        chrome.storage.local.set({ lockInScheduled: scheduled });
        chrome.runtime.sendMessage({ type: 'testNotification', text: `Session delayed to ${newStart.toLocaleTimeString()}` });
      }
    });
    sendResponse({ success: true });
    return true;
  }

  sendResponse({});
  return false;
});

chrome.alarms.onAlarm.addListener((alarm) => {

  if (alarm.name === 'lockInSessionEnd') {
    chrome.storage.local.get(['lockInActiveSession', 'lockInIdleMinutes', 'lockInFocusToggles', 'lockInStreak'], (res) => {
      const sess     = res.lockInActiveSession;
      const idleMins = res.lockInIdleMinutes || 0;
      if (!sess) return;

      let streak = res.lockInStreak || { streakDays: 0, lastSessionDate: null };
      const today = new Date().toDateString();
      if (streak.lastSessionDate !== today) {
        streak.streakDays += 1;
        streak.lastSessionDate = today;
      }

      const totalMins   = Math.round(sess.durationSeconds / 60);
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
      message: 'Time for a scheduled break. Step away and recharge.',
      buttons: [{ title: 'Continue' }]
    });
    chrome.storage.local.set({ lockInOnBreak: true });
  }

  if (alarm.name.startsWith('lockInBreakEnd_')) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'LockIn – Back to Work!',
      message: 'Break over! Your session is paused. Click Continue to resume.',
      buttons: [{ title: 'Continue' }]
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
          message: `Your scheduled session is starting now. Duration: ${sess.duration || 0} min.`,
          buttons: [{ title: 'Start' }, { title: 'Delay 5m' }, { title: 'Skip' }]
        });
      }
    });
  }
});

chrome.notifications.onButtonClicked.addListener((notifId, buttonIndex) => {
  chrome.storage.local.get(['lockInScheduled', 'lockInActiveSession', 'lockInTimerRunning'], (res) => {
    const scheduled = res.lockInScheduled || [];

    if (buttonIndex === 0 && scheduled.length > 0) {
      // Start button - start the first scheduled session
      const sess = scheduled[0];
      chrome.runtime.sendMessage({
        type: 'startSession',
        durationSeconds: (sess.duration || 30) * 60,
        breakFreqMinutes: sess.breakFrequency || 0,
        breakDurationMinutes: sess.breakDurationMinutes || 5,
        focusSites: {},
        scheduledStart: sess.scheduledStart,
        scheduledEnd: sess.scheduledEnd
      });
      scheduled.shift();
      const now = Date.now();
      const remaining = scheduled.filter(s => new Date(s.scheduledStart).getTime() > now);
      chrome.storage.local.set({ lockInScheduled: remaining });
    } else if (buttonIndex === 1 && scheduled.length > 0) {
      // Delay 5m button
      const sess = scheduled[0];
      const newStart = new Date(new Date(sess.scheduledStart).getTime() + 5 * 60000);
      const newEnd   = new Date(new Date(sess.scheduledEnd).getTime()   + 5 * 60000);
      sess.scheduledStart = newStart.toISOString();
      sess.scheduledEnd   = newEnd.toISOString();
      chrome.storage.local.set({ lockInScheduled: scheduled });
      chrome.runtime.sendMessage({ type: 'testNotification', text: `Session delayed to ${newStart.toLocaleTimeString()}` });
    } else if (buttonIndex === 2 && scheduled.length > 0) {
      // Skip button
      scheduled.shift();
      chrome.storage.local.set({ lockInScheduled: scheduled });
      chrome.runtime.sendMessage({ type: 'testNotification', text: 'Session skipped.' });
    }

    if (buttonIndex === 0 && res.lockInOnBreak === true) {
      // Continue from break in notification
      chrome.storage.local.set({ lockInOnBreak: false });
    }
  });
});

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
    if (result.lockInActiveSession && result.lockInTimerRunning) {
      const sess    = result.lockInActiveSession;
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