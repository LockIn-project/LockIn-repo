// ─── LockIn script.js ────────────────────────────────────────────────────────

// ── State ─────────────────────────────────────────────────────────────────────
let sessionDuration         = 0;
let sessionBreak            = 0;
let timerInterval           = null;
let isOnBreak               = false;
let isCompact               = false;
let hasSelection            = false;
let originalSessionDuration = 0;
let pendingDuration         = null;
let breakFreqMinutes        = 0;
let breakDurationMinutes    = 5;
let breaksTakenThisSession  = 0;

// Background session tracking
let bgSessionStartTime      = null;
let bgSessionDuration       = 0; // seconds

// Streak
let streakDays        = 0;
let lastSessionDate   = null;

// Focus toggles
let focusToggles = { facebook: false, instagram: false, twitter: false, tiktok: false, youtube: false };

// Scheduled sessions
let scheduledSessions = [];

// AI history
let sessionHistory = [];

// Idle state from background
let idleMinutesFromBg = 0;
let idleStateFromBg   = 'active';

// Scheduled goal for progress bar
let scheduledGoalDuration = 0; // minutes

const MILESTONES = [3, 7, 10, 14, 30];

// ── Utilities ─────────────────────────────────────────────────────────────────
function getNextMilestone(days) {
  return MILESTONES.find(m => m > days) || MILESTONES[MILESTONES.length - 1];
}

function getPrevMilestone(days) {
  const idx = MILESTONES.findIndex(m => m > days);
  return idx <= 0 ? 0 : MILESTONES[idx - 1];
}

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (timerInterval || isOnBreak) {
    return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }
  return `${h}h ${m}m`;
}

function buildEl(tag, className, html) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (html !== undefined) el.innerHTML = html;
  return el;
}

// ── Persistence ───────────────────────────────────────────────────────────────
function saveState() {
  const state = {
    sessionDuration, sessionBreak, hasSelection,
    originalSessionDuration, isOnBreak, isCompact,
    breakFreqMinutes, breakDurationMinutes, breaksTakenThisSession,
    bgSessionStartTime, bgSessionDuration
  };
  chrome.runtime.sendMessage({ type: 'saveState', state });
}

function saveFocusToggles() {
  chrome.runtime.sendMessage({ type: 'saveFocusToggles', toggles: focusToggles });
}

function saveScheduled() {
  chrome.runtime.sendMessage({ type: 'saveScheduled', scheduled: scheduledSessions });
}

function loadState(callback) {
  chrome.runtime.sendMessage({ type: 'loadState' }, (response) => {
    if (!response) { if (callback) callback(); return; }

    const s = response.state || {};
    sessionDuration         = s.sessionDuration         ?? 0;
    originalSessionDuration = s.originalSessionDuration ?? 0;
    hasSelection            = s.hasSelection            ?? false;
    isOnBreak               = s.isOnBreak               ?? false;
    sessionBreak            = s.sessionBreak            ?? 0;
    isCompact               = s.isCompact               ?? (response.isCompact ?? false);
    breakFreqMinutes        = s.breakFreqMinutes        ?? 0;
    breakDurationMinutes    = s.breakDurationMinutes    ?? 5;
    breaksTakenThisSession  = s.breaksTakenThisSession  ?? 0;
    bgSessionStartTime      = s.bgSessionStartTime      ?? null;
    bgSessionDuration       = s.bgSessionDuration       ?? 0;

    const streak = response.streak || { streakDays: 0, lastSessionDate: null };
    streakDays      = streak.streakDays;
    lastSessionDate = streak.lastSessionDate;

     focusToggles    = { ...{ facebook: false, instagram: false, twitter: false, tiktok: false, youtube: false }, ...(response.focusToggles || {}) };
    scheduledSessions = response.scheduled  || [];
    sessionHistory    = response.history    || [];
    idleMinutesFromBg = response.idleMinutes || 0;
    idleStateFromBg   = response.idleState   || 'active';

    // Sync with background session if running
    if (response.activeSession && response.activeSession.startTime) {
      const sess    = response.activeSession;
      const elapsed = Math.floor((Date.now() - sess.startTime) / 1000);
      const remaining = Math.max(0, sess.durationSeconds - elapsed);
      if (remaining > 0) {
        sessionDuration         = remaining;
        originalSessionDuration = sess.durationSeconds;
        bgSessionStartTime      = sess.startTime;
        bgSessionDuration       = sess.durationSeconds;
        breakFreqMinutes        = sess.breakFreqMinutes || 0;
        breakDurationMinutes    = sess.breakDurationMinutes || 0;
        hasSelection            = true;
      }
    }

    if (callback) callback();
  });
}

// ── Header ────────────────────────────────────────────────────────────────────
function updateHeaderStreak() {
  const countEl = document.getElementById('streak-count');
  if (countEl) countEl.textContent = streakDays;

  const header = document.getElementById('streak-header');
  if (header) {
    const next = getNextMilestone(streakDays);
    header.classList.toggle('milestone', MILESTONES.includes(streakDays) || streakDays >= next);
  }
  updateHeaderProgressBar();
}

function updateHeaderProgressBar() {
  const bar     = document.getElementById('header-progress-bar');
  const percent = document.getElementById('header-progress-percent');
  if (!bar || !percent) return;

  const totalSeconds = bgSessionDuration || 0;
  const goal = scheduledGoalDuration > 0 ? scheduledGoalDuration * 60 : totalSeconds;

  if (goal <= 0) {
    bar.style.width = '0%';
    percent.textContent = '0%';
    return;
  }

  const elapsed = goal - sessionDuration;
  const pct = Math.min(100, Math.max(0, Math.round((elapsed / goal) * 100)));
  bar.style.width     = pct + '%';
  percent.textContent = pct + '%';
}

// ── Compact toggle ────────────────────────────────────────────────────────────
function toggleCompactView() {
  isCompact = !isCompact;
  chrome.storage.local.set({ lockInIsCompact: isCompact });

  const img = document.getElementById('compact-icon-img');
  if (img) img.src = isCompact ? 'icons/down.png' : 'icons/up.png';

  const bodyWrapper = document.getElementById('body-wrapper');
  if (isCompact) {
    bodyWrapper.style.display = 'none';
  } else {
    bodyWrapper.style.display = '';
    if (!document.getElementById('main-view')) {
      restoreMainView();
    }
  }
  saveState();
}

function restoreMainView() {
  const bw = document.getElementById('body-wrapper');
  bw.innerHTML = '';
  buildMainViewDOM(bw);
  initButtonHandlers();
}

// ── Main view DOM ─────────────────────────────────────────────────────────────
function buildMainViewDOM(wrapper) {
  wrapper.innerHTML = `
    <div class="body-container" id="main-view">
      <div class="mascot-container">
        <img src="icons/mascot3.png" class="mascot-icon">
        <span class="dynamic-motivation-text" id="motivation-text">
          Strive to be 1% better today than you were yesterday.
        </span>
      </div>
      <div class="today-goal-wrapper">
        <div class="today-container">
          <span class="today-text">CURRENT</span>
          <span class="today-time" id="current-time"><span>0h</span><span>0m</span></span>
        </div>
        <div class="goal-container">
          <span class="goal-text">GOAL</span>
          <span class="goal-time" id="goal-time"><span>0h</span><span>0m</span></span>
        </div>
      </div>
      <div class="session-output" id="session-output"></div>
      <span class="session-header-text">QUICK SESSION</span>
      <div class="quick-sessions-container" id="quick-sessions-container">
        <button class="fifteenMin-btn">
          <span class="session-header">15m</span>
          <span class="session-subheader">quick</span>
        </button>
        <button class="thirtyMin-btn">
          <span class="session-header">30m</span>
          <span class="session-subheader">default</span>
        </button>
        <button class="fortyfiveMin-btn">
          <span class="session-header">45m</span>
          <span class="session-subheader">deep</span>
        </button>
        <button class="sixtyMin-btn">
          <span class="session-header">60m</span>
          <span class="session-subheader">flow</span>
        </button>
      </div>
      <div class="start-session-container" id="start-session-container">
        <button class="start-btn" id="start-btn">
          <img src="icons/play2.png" class="start-icon">
          Start Session
        </button>
      </div>
      <div class="view-session-container">
        <button class="view-btn" id="view-details-btn">
          <img src="icons/down.png" class="view-icon">
          View Details
        </button>
      </div>
    </div>
  `;
}

// ── Timer display ─────────────────────────────────────────────────────────────
function updateCompactTimerDisplay() {
  const currentTimeEl = document.getElementById('current-time');
  const goalTimeEl    = document.getElementById('goal-time');
  if (!currentTimeEl) return;

  const display = sessionDuration > 0 ? formatTime(sessionDuration) : '0h 0m';
  currentTimeEl.innerHTML = display.split(' ')
    .map(part => `<span>${part}</span>`).join('');

  const goal = scheduledGoalDuration > 0 ? scheduledGoalDuration * 60 : bgSessionDuration;

  if (goalTimeEl) {
    const gDisplay = goal > 0 ? formatTime(goal) : '0h 0m';
    goalTimeEl.innerHTML = gDisplay.split(' ')
      .map(part => `<span>${part}</span>`).join('');
  }
}

function updateSessionOutputDisplay() {
  const output = document.getElementById('session-output');
  if (!output) return;
  output.innerHTML = '';

  if (isOnBreak && sessionBreak > 0) {
    const wrapper = buildEl('div', 'break-container');
    wrapper.innerHTML = `
      <span class="break-text">REST:</span>
      <span class="break-time">${formatTime(sessionBreak)}</span>
    `;
    output.appendChild(wrapper);
    return;
  }

  if (timerInterval && sessionDuration > 0) {
    const el = document.createElement('span');
    el.style.cssText = 'font-size:20px;font-weight:bold;color:#213448;font-family:system-ui';
    el.textContent = formatTime(sessionDuration);
    output.appendChild(el);
  }
}

// ── Session control ───────────────────────────────────────────────────────────
function startSession(overrideDuration, overrideBreakFreq, overrideBreakDur) {
  if (overrideDuration) {
    sessionDuration         = overrideDuration * 60;
    originalSessionDuration = sessionDuration;
    breakFreqMinutes        = overrideBreakFreq  ?? breakFreqMinutes;
    breakDurationMinutes    = overrideBreakDur   ?? breakDurationMinutes;
  }

  if (sessionDuration <= 0) return;

  breaksTakenThisSession = 0;

  // Tell background to track the session
  chrome.runtime.sendMessage({
    type: 'startSession',
    durationSeconds:     sessionDuration,
    breakFreqMinutes:    breakFreqMinutes,
    breakDurationMinutes: breakDurationMinutes,
    focusSites:          focusToggles,
    scheduledStart:      new Date().toISOString(),
    scheduledEnd:        new Date(Date.now() + sessionDuration * 1000).toISOString()
  }, (res) => {
    if (res && res.startTime) {
      bgSessionStartTime = res.startTime;
      bgSessionDuration  = sessionDuration;
    }
  });

  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    sessionDuration--;

    if (sessionDuration <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      if (isOnBreak) {
        isOnBreak       = false;
        sessionDuration = originalSessionDuration;
        updateCompactTimerDisplay();
        showBreakStopButtons();
        setMotivationText('Break ended! Let\'s get back to it.');
      } else {
        onSessionComplete();
      }
    }

    updateCompactTimerDisplay();
    updateSessionOutputDisplay();
    updateHeaderProgressBar();
    saveState();
  }, 1000);

  showBreakStopButtons();
  saveState();
}

function onSessionComplete() {
  chrome.runtime.sendMessage({ type: 'sessionComplete', breaksTaken: breaksTakenThisSession }, (res) => {
    if (res && res.streak) {
      streakDays      = res.streak.streakDays;
      lastSessionDate = res.streak.lastSessionDate;
      updateHeaderStreak();
      refreshDetailStreakSection();
    }
    if (res && res.record) {
      sessionHistory.push(res.record);
    }
  });
  showStartButton();
  setMotivationText('Session complete! Great work 🎉');
  resetToDefault();
}

function takeBreak() {
  clearInterval(timerInterval);
  timerInterval           = null;
  isOnBreak               = true;
  originalSessionDuration = sessionDuration;
  sessionBreak            = (breakDurationMinutes || 5) * 60;
  breaksTakenThisSession++;

  timerInterval = setInterval(() => {
    sessionBreak--;
    if (sessionBreak <= 0) {
      clearInterval(timerInterval);
      timerInterval   = null;
      isOnBreak       = false;
      sessionDuration = originalSessionDuration;
      updateCompactTimerDisplay();
      showBreakStopButtons();
      const breakBtn = document.getElementById('break-btn');
      if (breakBtn) {
        breakBtn.innerHTML = `<img src="icons/break.png" class="stop-break-icon"> Break`;
        breakBtn.onclick   = takeBreak;
      }
      setMotivationText("Break ended! Let's get back to work.");
    }
    updateSessionOutputDisplay();
    saveState();
  }, 1000);

  showBreakStopButtons();
  const breakBtn = document.getElementById('break-btn');
  if (breakBtn) {
    breakBtn.innerHTML = `<img src="icons/break.png" class="stop-break-icon"> Continue`;
    breakBtn.onclick   = resumeSession;
  }
  saveState();
}

function resumeSession() {
  clearInterval(timerInterval);
  timerInterval = null;
  isOnBreak     = false;
  sessionDuration = originalSessionDuration;

  setMotivationText("Let's get back to work!");
  updateCompactTimerDisplay();
  showBreakStopButtons();

  timerInterval = setInterval(() => {
    sessionDuration--;
    if (sessionDuration <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      onSessionComplete();
    }
    updateCompactTimerDisplay();
    updateSessionOutputDisplay();
    updateHeaderProgressBar();
    saveState();
  }, 1000);

  const breakBtn = document.getElementById('break-btn');
  if (breakBtn) {
    breakBtn.innerHTML = `<img src="icons/break.png" class="stop-break-icon"> Break`;
    breakBtn.onclick   = takeBreak;
  }
  saveState();
}

function stopSession() {
  clearInterval(timerInterval);
  timerInterval           = null;
  sessionDuration         = 0;
  isOnBreak               = false;
  hasSelection            = false;
  originalSessionDuration = 0;
  bgSessionStartTime      = null;

  chrome.runtime.sendMessage({ type: 'stopSession' });

  updateCompactTimerDisplay();
  updateSessionOutputDisplay();
  updateHeaderProgressBar();
  setMotivationText('See you on your next session to Lock in.');
  showStartButton();

  document.querySelectorAll('.fifteenMin-btn,.thirtyMin-btn,.fortyfiveMin-btn,.sixtyMin-btn')
    .forEach(b => b.classList.remove('min-btn-selected'));

  saveState();
}

function resetToDefault() {
  hasSelection            = false;
  isOnBreak               = false;
  sessionDuration         = 0;
  originalSessionDuration = 0;
  bgSessionStartTime      = null;
  bgSessionDuration       = 0;

  updateCompactTimerDisplay();
  updateSessionOutputDisplay();
  showStartButton();

  document.querySelectorAll('.fifteenMin-btn,.thirtyMin-btn,.fortyfiveMin-btn,.sixtyMin-btn')
    .forEach(b => b.classList.remove('min-btn-selected'));
}

// ── Button helpers ────────────────────────────────────────────────────────────
function showBreakStopButtons() {
  const container = document.getElementById('start-session-container');
  if (!container) return;
  container.innerHTML = `
    <div class="break_stop_container">
      <div class="btns-stop-break">
        <button class="break-btn" id="break-btn">
          <img src="icons/break.png" class="stop-break-icon"> Break
        </button>
      </div>
      <div class="btns-stop-break">
        <button class="stop-btn" id="stop-btn">
          <img src="icons/stop.png" class="stop-break-icon"> Stop
        </button>
      </div>
    </div>
  `;
  document.getElementById('break-btn').addEventListener('click', takeBreak);
  document.getElementById('stop-btn').addEventListener('click', stopSession);
}

function showStartButton() {
  const container = document.getElementById('start-session-container');
  if (!container) return;
  container.innerHTML = `
    <button class="start-btn" id="start-btn">
      <img src="icons/play2.png" class="start-icon">
      Start Session
    </button>
  `;
  document.getElementById('start-btn').addEventListener('click', () => startSession());
}

function setMotivationText(text) {
  const el = document.getElementById('motivation-text');
  if (el) el.textContent = text;
}

// ── Confirm overlay ───────────────────────────────────────────────────────────
function showConfirmOverlay(message, onConfirm, onCancel) {
  const overlay = document.getElementById('confirmation-overlay');
  const text    = document.getElementById('confirmation-text');
  const yesBtn  = document.getElementById('confirm-yes');
  const noBtn   = document.getElementById('confirm-no');

  text.textContent      = message;
  overlay.style.display = 'flex';

  const cleanup    = () => { yesBtn.removeEventListener('click', handleYes); noBtn.removeEventListener('click', handleNo); };
  const handleYes  = () => { overlay.style.display = 'none'; if (onConfirm) onConfirm(); cleanup(); };
  const handleNo   = () => { overlay.style.display = 'none'; if (onCancel) onCancel(); cleanup(); };

  yesBtn.addEventListener('click', handleYes);
  noBtn.addEventListener('click', handleNo);
}

// ── Quick session buttons ─────────────────────────────────────────────────────
function initButtonHandlers() {
  const buttons  = document.querySelectorAll('.fifteenMin-btn,.thirtyMin-btn,.fortyfiveMin-btn,.sixtyMin-btn');
  const durations = {
    'fifteenMin-btn': 15, 'thirtyMin-btn': 30,
    'fortyfiveMin-btn': 45, 'sixtyMin-btn': 60
  };

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const duration  = durations[btn.classList[0]];
      const isRunning = timerInterval && !isOnBreak;

      if (isRunning) {
        const prev = document.querySelector('.min-btn-selected');
        showConfirmOverlay(
          `Switch to a new ${duration}m session?`,
          () => {
            clearInterval(timerInterval);
            timerInterval   = null;
            isOnBreak       = false;
            buttons.forEach(b => b.classList.remove('min-btn-selected'));
            btn.classList.add('min-btn-selected');
            sessionDuration         = duration * 60;
            originalSessionDuration = sessionDuration;
            hasSelection            = false;
            saveState();
            setTimeout(() => startSession(), 0);
          },
          () => {
            buttons.forEach(b => b.classList.remove('min-btn-selected'));
            if (prev) prev.classList.add('min-btn-selected');
            hasSelection = true;
          }
        );
        return;
      }

      buttons.forEach(b => b.classList.remove('min-btn-selected'));
      btn.classList.add('min-btn-selected');
      hasSelection            = true;
      sessionDuration         = duration * 60;
      originalSessionDuration = sessionDuration;
      updateCompactTimerDisplay();
      saveState();
    });
  });

  // Restore selected button
  if (sessionDuration > 0 && !timerInterval) {
    const mins = Math.floor(originalSessionDuration / 60);
    const map  = { 15: 'fifteenMin-btn', 30: 'thirtyMin-btn', 45: 'fortyfiveMin-btn', 60: 'sixtyMin-btn' };
    const cls  = map[mins];
    if (cls) {
      const b = document.querySelector('.' + cls);
      if (b) b.classList.add('min-btn-selected');
    }
  }

  const startBtn = document.getElementById('start-btn');
  if (startBtn) startBtn.addEventListener('click', () => startSession());

  document.getElementById('view-details-btn')?.addEventListener('click', () => {
    saveState();
    buildExtensionDetailView(document.getElementById('body-wrapper'));
  });

  document.getElementById('compact-btn')?.addEventListener('click', toggleCompactView);
}

// ── Extension detail view ─────────────────────────────────────────────────────
function buildExtensionDetailView(bodyWrapper) {
  bodyWrapper.innerHTML = '';
  const section = buildEl('div', 'extension-section');

  // Back button row
  const backRow = buildEl('div', '', `
    <button id="back-to-main" style="background:none;border:none;cursor:pointer;
      padding:10px 17px;font-family:system-ui;font-size:12px;color:#547792;
      display:flex;align-items:center;gap:4px;">
      ← Back
    </button>
  `);
  section.appendChild(backRow);

  // ── Streak ──
  section.appendChild(buildStreakSection());

  // ── Focus ──
  const focusHeader = buildEl('div', 'focus_header_container');
  focusHeader.innerHTML = `
    <div class="icon_text_focus">
      <img src="icons/focus.png" class="focus_icon">
      <span class="focus_text">Focus Mode</span>
    </div>
  `;
  const statusSpan = buildEl('span', 'focus_status' + (isAnyFocusActive() ? ' active' : ''));
  statusSpan.id        = 'focus-status-text';
  statusSpan.textContent = isAnyFocusActive() ? 'Active' : 'Inactive';
  focusHeader.appendChild(statusSpan);
  section.appendChild(focusHeader);
  section.appendChild(buildFocusBody());

  // ── Schedule ──
  section.appendChild(buildScheduleSection());

  // ── AI Suggestions ──
  section.appendChild(buildAISuggestionsSection());

  // ── Idle Detection ──
  section.appendChild(buildIdleSection());

  // ── Footer ──
  const footer = buildEl('div', 'footer_container');
  const newBtn  = buildEl('button', 'new_sesh_btn', `<img src="icons/play2.png" class="sesh_icon"> Start new session`);
  newBtn.addEventListener('click', () => openSessionOverlay());
  footer.appendChild(newBtn);
  section.appendChild(footer);

  bodyWrapper.appendChild(section);

  // Back button
  document.getElementById('back-to-main').addEventListener('click', () => {
    saveState();
    bodyWrapper.innerHTML = '';
    buildMainViewDOM(bodyWrapper);
    initButtonHandlers();
    updateCompactTimerDisplay();
    updateSessionOutputDisplay();
    updateHeaderProgressBar();
    if (timerInterval) showBreakStopButtons();
  });

  startIdleDetection();
  updateIdleDisplay();
}

// ── Streak section ────────────────────────────────────────────────────────────
function buildStreakSection() {
  const frag = document.createDocumentFragment();

  const header = buildEl('div', 'streak_container');
  header.innerHTML = `
    <img src="icons/fire.png" class="streak_icon_text">
    <span class="streak_text">Streak</span>
    <span class="streak_count" id="streak-count-detail">${streakDays} days</span>
  `;

  const next    = getNextMilestone(streakDays);
  const prev    = getPrevMilestone(streakDays);
  const pct     = next === prev ? 100 : Math.round(((streakDays - prev) / (next - prev)) * 100);
  const daysToGo = Math.max(0, next - streakDays);

  const lower = buildEl('div', 'lower_streak_container');
  lower.innerHTML = `
    <div class="streak-bar-bg">
      <div class="streak-bar-fill" id="streak-bar-detail" style="width:${Math.min(pct,100)}%"></div>
    </div>
    <div class="streak-days-row">
      <span><span id="ext-days-to-go">${daysToGo}</span> days to next milestone</span>
      <span id="ext-next-days">${next} days</span>
    </div>
    <div class="milestone-icons-row" id="milestone-icons-row">
      ${MILESTONES.map(m => `
        <div class="day_icon_wrapper">
          <img src="icons/fire.png" class="${streakDays >= m ? 'unlocked' : ''}">
        </div>
      `).join('')}
    </div>
  `;

  frag.appendChild(header);
  frag.appendChild(lower);
  return frag;
}

function refreshDetailStreakSection() {
  const bar    = document.getElementById('streak-bar-detail');
  const daysEl = document.getElementById('ext-days-to-go');
  const nextEl = document.getElementById('ext-next-days');
  if (!bar) return;

  const next    = getNextMilestone(streakDays);
  const prev    = getPrevMilestone(streakDays);
  const pct     = next === prev ? 100 : Math.round(((streakDays - prev) / (next - prev)) * 100);
  const daysToGo = Math.max(0, next - streakDays);

  bar.style.width = Math.min(pct, 100) + '%';
  if (daysEl) daysEl.textContent = daysToGo;
  if (nextEl) nextEl.textContent = `${next} days`;

  document.querySelectorAll('.day_icon_wrapper img').forEach((img, i) => {
    img.classList.toggle('unlocked', streakDays >= MILESTONES[i]);
  });
}

// ── Focus section ─────────────────────────────────────────────────────────────
function buildFocusBody() {
  const sites = [
    { key: 'facebook',  icon: 'icons/fb.png',     label: 'Facebook' },
    { key: 'instagram', icon: 'icons/ig.png',      label: 'Instagram' },
    { key: 'twitter',   icon: 'icons/x.png',       label: 'X / Twitter' },
    { key: 'tiktok',    icon: 'icons/tiktok.png',  label: 'TikTok' },
    { key: 'youtube',   icon: 'icons/yt.png',      label: 'YouTube' }
  ];

  const body = buildEl('div', 'focus_body');

  sites.forEach((site, i) => {
    if (i > 0) body.appendChild(document.createElement('hr'));

    const wrapper = buildEl('div', 'focuses_wrapper');
    const cont    = buildEl('div', 'focuses_container', `
      <img src="${site.icon}" class="focus_icon">
      <span class="focus_icon_text">${site.label}</span>
    `);

    const toggle = buildEl('div', 'toggle' + (focusToggles[site.key] ? ' on' : ''));
    const knob   = buildEl('div', 'knob');
    toggle.appendChild(knob);

    toggle.addEventListener('click', () => {
      focusToggles[site.key] = !focusToggles[site.key];
      toggle.classList.toggle('on', focusToggles[site.key]);

      const statusEl = document.getElementById('focus-status-text');
      if (statusEl) {
        const active = isAnyFocusActive();
        statusEl.textContent = active ? 'Active' : 'Inactive';
        statusEl.className   = 'focus_status' + (active ? ' active' : '');
      }
      saveFocusToggles();
    });

    wrapper.appendChild(cont);
    wrapper.appendChild(toggle);
    body.appendChild(wrapper);
  });

  return body;
}

function isAnyFocusActive() {
  return Object.values(focusToggles).some(v => v);
}

// ── Schedule section ──────────────────────────────────────────────────────────
function buildScheduleSection() {
  const frag = document.createDocumentFragment();

  const schedCont = buildEl('div', 'sched_container');
  schedCont.innerHTML = `
    <div class="sched_header_container">
      <img src="icons/calendar.png" class="sched_icon_text">
      <span class="sched_text">Plan sessions</span>
    </div>
    <div class="plan_container">
      <span class="day_planned_sched" id="sched-count">${scheduledSessions.length}</span>
      <span class="day_planned_sched"> scheduled</span>
    </div>
  `;

  const sessList = buildEl('div', 'sched_sessions_container', '');
  sessList.id = 'sched-sessions-list';
  renderScheduledSessions(sessList);

  const btnCont = buildEl('div', 'sched_btns_container');
  const addBtn  = buildEl('button', 'sched_btn', '+ Schedule Session');
  addBtn.addEventListener('click', () => openScheduleModal());
  btnCont.appendChild(addBtn);

  frag.appendChild(schedCont);
  if (scheduledSessions.length > 0) frag.appendChild(sessList);
  frag.appendChild(btnCont);
  return frag;
}

function renderScheduledSessions(container) {
  if (!container) container = document.getElementById('sched-sessions-list');
  if (!container) return;
  container.innerHTML = '';

  scheduledSessions.forEach((sess, idx) => {
    const item = buildEl('div', 'each_session_container');
    const start = new Date(sess.scheduledStart);
    const end   = new Date(sess.scheduledEnd);
    const dur   = Math.round((end - start) / 60000);
    const label = `${start.toLocaleDateString()} ${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}–${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · ${dur}m`;

    const breakInfo = sess.breakFrequency > 0
      ? ` · Break ${sess.breakFrequency}m/${sess.breakDurationMinutes}m`
      : '';

    item.innerHTML = `
      <span style="flex:1">${label}${breakInfo}</span>
      <button class="session_delete_btn" data-idx="${idx}">✕</button>
    `;
    item.querySelector('.session_delete_btn').addEventListener('click', () => {
      scheduledSessions.splice(idx, 1);
      saveScheduled();
      updateScheduledGoal();
      renderScheduledSessions();
      const cnt = document.getElementById('sched-count');
      if (cnt) cnt.textContent = scheduledSessions.length;
    });
    container.appendChild(item);
  });
}

function updateScheduledGoal() {
  const now = Date.now();
  const upcoming = scheduledSessions
    .filter(s => new Date(s.scheduledStart).getTime() > now)
    .sort((a, b) => new Date(a.scheduledStart) - new Date(b.scheduledStart));

  if (upcoming.length > 0) {
    const next = upcoming[0];
    const dur  = Math.round((new Date(next.scheduledEnd) - new Date(next.scheduledStart)) / 60000);
    scheduledGoalDuration = dur;
  } else {
    scheduledGoalDuration = 0;
  }
  updateHeaderProgressBar();
  updateCompactTimerDisplay();
}

// ── Schedule modal ────────────────────────────────────────────────────────────
function openScheduleModal() {
  const modal = document.getElementById('schedule-modal');
  if (!modal) return;

  // Reset steps
  document.getElementById('sched-step-1').style.display = '';
  document.getElementById('sched-step-2').style.display = 'none';
  document.getElementById('sched-step-3').style.display = 'none';
  document.getElementById('sched-date-input').value  = '';
  document.getElementById('sched-start-time').value  = '';
  document.getElementById('sched-end-time').value    = '';

  let selectedBreakFreq = 0;
  let selectedBreakDur  = 5;

  // Reset break freq buttons
  document.querySelectorAll('#sched-break-freq-btns .sched-dur-btn').forEach(b => {
    b.classList.toggle('active', parseInt(b.dataset.freq) === 0);
    b.onclick = () => {
      selectedBreakFreq = parseInt(b.dataset.freq);
      document.querySelectorAll('#sched-break-freq-btns .sched-dur-btn').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
    };
  });

  document.querySelectorAll('#sched-break-dur-btns .sched-dur-btn').forEach(b => {
    b.classList.toggle('active', parseInt(b.dataset.brkdur) === 5);
    b.onclick = () => {
      selectedBreakDur = parseInt(b.dataset.brkdur);
      document.querySelectorAll('#sched-break-dur-btns .sched-dur-btn').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
    };
  });

  modal.style.display = 'flex';

  document.getElementById('schedule-modal-close').onclick = () => { modal.style.display = 'none'; };

  document.getElementById('sched-date-confirm').onclick = () => {
    if (!document.getElementById('sched-date-input').value) return;
    document.getElementById('sched-step-1').style.display = 'none';
    document.getElementById('sched-step-2').style.display = '';
  };

  document.getElementById('sched-time-confirm').onclick = () => {
    const startVal = document.getElementById('sched-start-time').value;
    const endVal   = document.getElementById('sched-end-time').value;
    if (!startVal || !endVal) return;
    if (endVal <= startVal) {
      alert('End time must be after start time.');
      return;
    }
    document.getElementById('sched-step-2').style.display = 'none';
    document.getElementById('sched-step-3').style.display = '';
  };

  document.getElementById('sched-confirm-btn').onclick = () => {
    const dateVal  = document.getElementById('sched-date-input').value;
    const startVal = document.getElementById('sched-start-time').value;
    const endVal   = document.getElementById('sched-end-time').value;
    if (!dateVal || !startVal || !endVal) return;

    const scheduledStart = new Date(`${dateVal}T${startVal}`).toISOString();
    const scheduledEnd   = new Date(`${dateVal}T${endVal}`).toISOString();
    const duration       = Math.round((new Date(scheduledEnd) - new Date(scheduledStart)) / 60000);

    scheduledSessions.push({
      scheduledStart,
      scheduledEnd,
      duration,
      breakFrequency:    selectedBreakFreq,
      breakDurationMinutes: selectedBreakDur,
      label: `${duration}m session`
    });

    saveScheduled();
    updateScheduledGoal();

    // Refresh list
    let list = document.getElementById('sched-sessions-list');
    if (!list) {
      list    = buildEl('div', 'sched_sessions_container', '');
      list.id = 'sched-sessions-list';
      const btnCont = document.querySelector('.sched_btns_container');
      if (btnCont) btnCont.parentNode.insertBefore(list, btnCont);
    }
    renderScheduledSessions(list);

    const cnt = document.getElementById('sched-count');
    if (cnt) cnt.textContent = scheduledSessions.length;

    modal.style.display = 'none';

    chrome.runtime.sendMessage({
      type: 'testNotification',
      text: `Session scheduled for ${new Date(scheduledStart).toLocaleString()}!`
    });
  };
}

// ── Start New Session overlay (expanded view) ─────────────────────────────────
function openSessionOverlay() {
  const overlay = document.getElementById('session-overlay');
  if (!overlay) return;

  let selectedDur      = 30;
  let selectedFreq     = 0;
  let selectedBreakDur = 5;

  // Duration buttons
  document.querySelectorAll('#new-session-dur-btns .sched-dur-btn').forEach(b => {
    b.classList.toggle('active', parseInt(b.dataset.dur) === 30);
    b.onclick = () => {
      selectedDur = parseInt(b.dataset.dur);
      document.querySelectorAll('#new-session-dur-btns .sched-dur-btn').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
    };
  });

  // Break freq buttons
  document.querySelectorAll('#new-session-break-freq-btns .sched-dur-btn').forEach(b => {
    b.classList.toggle('active', parseInt(b.dataset.freq) === 0);
    b.onclick = () => {
      selectedFreq = parseInt(b.dataset.freq);
      document.querySelectorAll('#new-session-break-freq-btns .sched-dur-btn').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
    };
  });

  // Break dur buttons
  document.querySelectorAll('#new-session-break-dur-btns .sched-dur-btn').forEach(b => {
    b.classList.toggle('active', parseInt(b.dataset.brkdur) === 5);
    b.onclick = () => {
      selectedBreakDur = parseInt(b.dataset.brkdur);
      document.querySelectorAll('#new-session-break-dur-btns .sched-dur-btn').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
    };
  });

  overlay.style.display = 'flex';

  document.getElementById('session-overlay-close').onclick = () => {
    overlay.style.display = 'none';
  };

  document.getElementById('session-overlay-stop').onclick = () => {
    // Stop → revert UI, keep overlay hidden, don't start
    overlay.style.display = 'none';
    stopSession();
  };

  document.getElementById('session-overlay-start').onclick = () => {
    overlay.style.display = 'none';
    // Set params
    sessionDuration         = selectedDur * 60;
    originalSessionDuration = sessionDuration;
    breakFreqMinutes        = selectedFreq;
    breakDurationMinutes    = selectedBreakDur;
    hasSelection            = true;

    // Collapse to compact view and start
    isCompact = true;
    chrome.storage.local.set({ lockInIsCompact: true });
    const img = document.getElementById('compact-icon-img');
    if (img) img.src = 'icons/down.png';
    const bw = document.getElementById('body-wrapper');
    if (bw) bw.style.display = 'none';

    startSession();
    saveState();
  };
}

// ── AI Suggestions section ────────────────────────────────────────────────────
function buildAISuggestionsSection() {
  const frag = document.createDocumentFragment();

  const header = buildEl('div', 'suggestion_container');
  header.innerHTML = `
    <img src="icons/ai.png" class="suggestion_icon">
    <span class="suggestion_text">AI Suggestions</span>
    <span class="suggestion_badge">Beta</span>
  `;

  const body = buildEl('div', 'lower_suggestion_container');
  body.id = 'ai-suggestions-body';

  if (sessionHistory.length < 3) {
    body.innerHTML = `<div class="ai-placeholder">Complete at least 3 sessions to get AI-powered suggestions.</div>`;
  } else {
    body.innerHTML = `<div class="ai-loading">⏳ Loading suggestions...</div>`;
    loadAISuggestions(body);
  }

  frag.appendChild(header);
  frag.appendChild(body);
  return frag;
}

function loadAISuggestions(container) {
  // Send history to local AI server
  fetch('http://localhost:8000/suggest-sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ history: sessionHistory })
  })
  .then(r => r.json())
  .then(data => {
    renderAISuggestions(container, data.suggestions || []);
  })
  .catch(() => {
    // Fallback: generate simple suggestions from history data
    const suggestions = generateLocalSuggestions(sessionHistory);
    renderAISuggestions(container, suggestions);
  });
}

function generateLocalSuggestions(history) {
  // Compute averages from history
  const totalSessions = history.length;
  const avgDuration   = Math.round(history.reduce((s, r) => s + (r.duration || 0), 0) / totalSessions);
  const avgIdle       = Math.round(history.reduce((s, r) => s + (r.idleMinutes || 0), 0) / totalSessions);

  // Suggest break freq based on idle pattern
  const suggestedBreakFreq = avgIdle > 0 ? Math.max(15, Math.min(45, avgIdle + 5)) : 25;

  // Determine best time from history
  const hours = history.map(r => new Date(r.datetime).getHours());
  const bestHour = hours.sort((a,b) =>
    hours.filter(v => v === a).length - hours.filter(v => v === b).length
  ).pop() || 9;

  const bestHourStr = `${String(bestHour).padStart(2,'0')}:00`;
  const endHour     = bestHour + Math.ceil(avgDuration / 60);
  const endHourStr  = `${String(endHour % 24).padStart(2,'0')}:00`;

  return [
    {
      title: `${avgDuration}m Focus Session`,
      startTime: bestHourStr,
      endTime: endHourStr,
      breakFrequency: suggestedBreakFreq,
      breakDuration: 5,
      detail: `Based on your last ${totalSessions} sessions. Break every ${suggestedBreakFreq}m.`
    },
    {
      title: `${Math.round(avgDuration * 1.2)}m Deep Work`,
      startTime: `${String((bestHour + 1) % 24).padStart(2,'0')}:00`,
      endTime: `${String(((bestHour + 1 + Math.ceil(avgDuration * 1.2 / 60)) % 24)).padStart(2,'0')}:00`,
      breakFrequency: 30,
      breakDuration: 10,
      detail: `Stretch session with longer breaks. Good for focused deep work.`
    }
  ];
}

function renderAISuggestions(container, suggestions) {
  container.innerHTML = '';

  if (!suggestions || suggestions.length === 0) {
    container.innerHTML = `<div class="ai-placeholder">No suggestions yet. Keep completing sessions!</div>`;
    return;
  }

  suggestions.forEach(s => {
    const card = buildEl('div', 'ai-suggestion-card');
    card.innerHTML = `
      <div class="ai-card-title">⏱ ${s.title || 'Session'}</div>
      <div class="ai-card-detail">
        ${s.startTime && s.endTime ? `🕐 ${s.startTime}–${s.endTime}` : ''}
        ${s.breakFrequency > 0 ? ` · Break every ${s.breakFrequency}m (${s.breakDuration}m)` : ''}
        ${s.detail ? `<br>${s.detail}` : ''}
      </div>
    `;

    card.addEventListener('click', () => {
      // Open session overlay pre-filled with this suggestion
      openSuggestionOverlay(s);
    });

    container.appendChild(card);
  });

  const refreshBtn = buildEl('button', 'ai-refresh-btn', '↻ Refresh');
  refreshBtn.addEventListener('click', () => {
    container.innerHTML = `<div class="ai-loading">⏳ Refreshing suggestions...</div>`;
    loadAISuggestions(container);
  });
  container.appendChild(refreshBtn);
}

function openSuggestionOverlay(suggestion) {
  // Compute duration from suggestion
  let dur = 30;
  if (suggestion.startTime && suggestion.endTime) {
    const [sh, sm] = suggestion.startTime.split(':').map(Number);
    const [eh, em] = suggestion.endTime.split(':').map(Number);
    dur = Math.max(15, (eh * 60 + em) - (sh * 60 + sm));
  } else if (suggestion.title) {
    const match = suggestion.title.match(/(\d+)/);
    if (match) dur = parseInt(match[1]);
  }

  const overlay = document.getElementById('session-overlay');
  if (!overlay) return;

  // Pre-select duration buttons
  document.querySelectorAll('#new-session-dur-btns .sched-dur-btn').forEach(b => {
    b.classList.toggle('active', parseInt(b.dataset.dur) === dur);
  });

  document.querySelectorAll('#new-session-break-freq-btns .sched-dur-btn').forEach(b => {
    b.classList.toggle('active', parseInt(b.dataset.freq) === (suggestion.breakFrequency || 0));
  });

  document.querySelectorAll('#new-session-break-dur-btns .sched-dur-btn').forEach(b => {
    b.classList.toggle('active', parseInt(b.dataset.brkdur) === (suggestion.breakDuration || 5));
  });

  openSessionOverlay();
}

// ── Idle Detection section ────────────────────────────────────────────────────
function buildIdleSection() {
  const frag = document.createDocumentFragment();

  frag.appendChild(buildEl('div', 'detection_container', `
    <img src="icons/idle.png" class="detection_icon">
    <span class="detection_text">Idle Detection</span>
  `));

  const lower = buildEl('div', 'lower_detection_container');
  const inner = buildEl('div', 'inner_detection_container');

  const circle = buildEl('div', 'status-circle');
  circle.id = 'idle-status-circle';

  const actCont = buildEl('div', 'active_container');
  const actText = buildEl('span', 'active_text', 'Active Now -');
  actText.id = 'idle-status-text';
  const actMsg = buildEl('span', 'active_msg', ' checking...');
  actMsg.id = 'idle-status-msg';

  actCont.appendChild(actText);
  actCont.appendChild(actMsg);
  inner.appendChild(circle);
  inner.appendChild(actCont);
  lower.appendChild(inner);
  frag.appendChild(lower);
  return frag;
}

let idleDisplayInterval = null;

function startIdleDetection() {
  clearInterval(idleDisplayInterval);
  idleDisplayInterval = setInterval(updateIdleDisplay, 5000);
  updateIdleDisplay();
}

function updateIdleDisplay() {
  chrome.runtime.sendMessage({ type: 'getIdleState' }, (res) => {
    if (res) {
      idleMinutesFromBg = res.idleMinutes || 0;
      idleStateFromBg   = res.idleState   || 'active';
    }

    const circle = document.getElementById('idle-status-circle');
    const textEl = document.getElementById('idle-status-text');
    const msgEl  = document.getElementById('idle-status-msg');
    if (!circle || !textEl || !msgEl) return;

    const isActive = idleStateFromBg === 'active';
    circle.className = 'status-circle' + (isActive ? ' active' : '');

    if (isActive) {
      textEl.textContent = 'Active Now -';
      msgEl.textContent  = idleMinutesFromBg > 0
        ? ` ${idleMinutesFromBg} idle min recorded this session.`
        : ' no idle detected.';
    } else {
      textEl.textContent = 'Idle -';
      msgEl.textContent  = ` idle for ${idleMinutesFromBg}m. Take a break or come back when ready.`;
    }
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadState(() => {
    // Compact state
    const bw  = document.getElementById('body-wrapper');
    const img = document.getElementById('compact-icon-img');

    if (isCompact) {
      if (bw)  bw.style.display  = 'none';
      if (img) img.src            = 'icons/down.png';
    } else {
      if (img) img.src            = 'icons/up.png';
    }

    updateHeaderStreak();
    updateCompactTimerDisplay();
    updateSessionOutputDisplay();
    updateHeaderProgressBar();
    updateScheduledGoal();
    initButtonHandlers();

    // If session was running, restore visuals
    if (hasSelection && sessionDuration > 0 && !isOnBreak) {
      showBreakStopButtons();
      // Re-start local countdown (synced with background time)
      clearInterval(timerInterval);
      timerInterval = setInterval(() => {
        sessionDuration--;
        if (sessionDuration <= 0) {
          clearInterval(timerInterval);
          timerInterval = null;
          onSessionComplete();
        }
        updateCompactTimerDisplay();
        updateSessionOutputDisplay();
        updateHeaderProgressBar();
        saveState();
      }, 1000);
    }

    if (isOnBreak && sessionBreak > 0) {
      showBreakStopButtons();
      timerInterval = setInterval(() => {
        sessionBreak--;
        if (sessionBreak <= 0) {
          clearInterval(timerInterval);
          timerInterval   = null;
          isOnBreak       = false;
          sessionDuration = originalSessionDuration;
          updateCompactTimerDisplay();
          showBreakStopButtons();
        }
        updateSessionOutputDisplay();
        saveState();
      }, 1000);
    }

    document.getElementById('compact-btn')?.addEventListener('click', toggleCompactView);
  });
});