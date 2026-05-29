// ─── LockIn script.js ───────────────────────────────────────────────────────

// ── State variables ──────────────────────────────────────────────────────────
let sessionDuration        = 0;
let sessionBreak           = 0;
let timerInterval          = null;
let isQuickieMode          = false;
let hasSelection           = false;
let originalSessionDuration = 0;
let isOnBreak              = false;
let pendingDuration        = null;
let isCompact              = false;

// Streak
let streakDays             = 0;
let lastSessionDate        = null;

// Focus toggles
let focusToggles = { facebook: false, instagram: false, twitter: false, tiktok: false, youtube: false };

// Scheduled sessions  [{ datetime, duration, label }]
let scheduledSessions = [];

// Idle detection
let lastActivityTime       = Date.now();
let idleInterval           = null;
let scheduledGoalDuration  = 0; // minutes, from next upcoming session

// ── Milestones ───────────────────────────────────────────────────────────────
const MILESTONES = [3, 7, 10, 14, 30];

function getNextMilestone(days) {
  return MILESTONES.find(m => m > days) || MILESTONES[MILESTONES.length - 1];
}

function getPrevMilestone(days) {
  const idx = MILESTONES.findIndex(m => m > days);
  return idx <= 0 ? 0 : MILESTONES[idx - 1];
}

// ── Utility ──────────────────────────────────────────────────────────────────
function formatTime(seconds) {
  if (timerInterval || isOnBreak) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function todayString() {
  return new Date().toDateString();
}

// ── State persistence ─────────────────────────────────────────────────────────
function saveState() {
  const state = {
    sessionDuration, sessionBreak, isQuickieMode,
    hasSelection, originalSessionDuration, isOnBreak, isCompact
  };
  chrome.runtime.sendMessage({ type: "saveState", state });
}

function saveStreak() {
  chrome.runtime.sendMessage({ type: "saveStreak", streak: { streakDays, lastSessionDate } });
}

function saveFocusToggles() {
  chrome.runtime.sendMessage({ type: "saveFocusToggles", toggles: focusToggles });
}

function saveScheduled() {
  chrome.runtime.sendMessage({ type: "saveScheduled", scheduled: scheduledSessions });
}

function loadState(callback) {
  chrome.runtime.sendMessage({ type: "loadState" }, (response) => {
    if (!response) { if (callback) callback(); return; }

    // Core session state
    const s = response.state || {};
    sessionDuration         = s.sessionDuration         ?? 0;
    originalSessionDuration = s.originalSessionDuration ?? sessionDuration;
    isQuickieMode           = s.isQuickieMode           ?? false;
    hasSelection            = s.hasSelection            ?? false;
    isOnBreak               = s.isOnBreak               ?? false;
    sessionBreak            = s.sessionBreak            ?? 0;
    isCompact               = response.isCompact        ?? false;

    // Streak
    const streak = response.streak || { streakDays: 0, lastSessionDate: null };
    streakDays       = streak.streakDays;
    lastSessionDate  = streak.lastSessionDate;

    // Focus toggles
    focusToggles = response.focusToggles || { facebook: false, instagram: false, twitter: false, tiktok: false, youtube: false };

    // Scheduled sessions
    scheduledSessions = response.scheduled || [];

    if (callback) callback();
  });
}

// ── Header streak display (always visible) ────────────────────────────────────
function updateHeaderStreak() {
  const countEl = document.getElementById('streak-count');
  if (countEl) countEl.textContent = streakDays;

  const header = document.getElementById('streak-header');
  if (header) {
    const next = getNextMilestone(streakDays);
    if (streakDays >= next || MILESTONES.includes(streakDays)) {
      header.classList.add('milestone');
    } else {
      header.classList.remove('milestone');
    }
  }

  // Header progress bar (session progress)
  updateHeaderProgressBar();
}

function updateHeaderProgressBar() {
  const bar     = document.getElementById('header-progress-bar');
  const percent = document.getElementById('header-progress-percent');
  if (!bar || !percent) return;

  // Goal is either scheduled goal or originalSessionDuration
  const goal = scheduledGoalDuration > 0
    ? scheduledGoalDuration * 60
    : (originalSessionDuration || 0);

  if (goal <= 0) {
    bar.style.width = '0%';
    percent.textContent = '0%';
    return;
  }

  const elapsed  = goal - sessionDuration;
  const pct      = Math.min(100, Math.max(0, Math.round((elapsed / goal) * 100)));
  bar.style.width      = pct + '%';
  percent.textContent  = pct + '%';
}

// ── Main view (compact) ───────────────────────────────────────────────────────
function updateCompactTimerDisplay() {
  const currentTimeEl = document.getElementById('current-time');
  const goalTimeEl    = document.getElementById('goal-time');
  if (!currentTimeEl) return;

  const display = sessionDuration > 0 ? formatTime(sessionDuration) : '0h 0m';

  currentTimeEl.innerHTML = display
    .split(' ')
    .map(part => `<span>${part}</span>`)
    .join('');

  // Goal
  const goal = scheduledGoalDuration > 0
    ? scheduledGoalDuration * 60
    : originalSessionDuration;

  if (goalTimeEl) {
    const gDisplay = goal > 0 ? formatTime(goal) : '0h 0m';
    goalTimeEl.innerHTML = gDisplay
      .split(' ')
      .map(part => `<span>${part}</span>`)
      .join('');
  }
}

function updateSessionOutputDisplay() {
  const output = document.getElementById('session-output');
  if (!output) return;
  output.innerHTML = '';

  if (isOnBreak && sessionBreak > 0) {
    const wrapper = document.createElement('div');
    wrapper.className = 'break-container';
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

// ── Confirm overlay ───────────────────────────────────────────────────────────
function showConfirmOverlay(message, onConfirm, onCancel) {
  const overlay = document.getElementById('confirmation-overlay');
  const text    = document.getElementById('confirmation-text');
  const yesBtn  = document.getElementById('confirm-yes');
  const noBtn   = document.getElementById('confirm-no');

  text.textContent    = message;
  overlay.style.display = 'flex';

  const cleanup = () => {
    yesBtn.removeEventListener('click', handleYes);
    noBtn.removeEventListener('click', handleNo);
  };

  const handleYes = () => { overlay.style.display = 'none'; if (onConfirm) onConfirm(); cleanup(); };
  const handleNo  = () => { overlay.style.display = 'none'; if (onCancel) onCancel(); cleanup(); };

  yesBtn.addEventListener('click', handleYes);
  noBtn.addEventListener('click', handleNo);
}

// ── Session control ───────────────────────────────────────────────────────────
function startSession() {
  if (sessionDuration <= 0) return;

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
        showStartButton();
        setMotivationText("Break ended! Resuming session...");
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
  chrome.runtime.sendMessage({ type: "sessionComplete" }, (res) => {
    if (res && res.streak) {
      streakDays      = res.streak.streakDays;
      lastSessionDate = res.streak.lastSessionDate;
      updateHeaderStreak();
      // If detail view is open, refresh streak section
      refreshDetailStreakSection();
    }
  });
  showStartButton();
  setMotivationText("Session complete! Great work 🎉");
  resetToDefault();
}

function takeBreak() {
  clearInterval(timerInterval);
  timerInterval = null;
  isOnBreak = true;
  originalSessionDuration = sessionDuration;

  sessionBreak = 5 * 60;

  timerInterval = setInterval(() => {
    sessionBreak--;

    if (sessionBreak <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      isOnBreak     = false;
      sessionDuration = originalSessionDuration;
      updateCompactTimerDisplay();
      showBreakStopButtons();
      const breakBtn = document.getElementById('break-btn');
      if (breakBtn) {
        breakBtn.innerHTML = `<img src="icons/break.png" class="stop-break-icon"> Break`;
        breakBtn.onclick = takeBreak;
      }
      setMotivationText("Break ended! Let's get back to it.");
    }

    updateSessionOutputDisplay();
    saveState();
  }, 1000);

  showBreakStopButtons();

  const breakBtn = document.getElementById('break-btn');
  if (breakBtn) {
    breakBtn.innerHTML = `<img src="icons/break.png" class="stop-break-icon"> Continue`;
    breakBtn.onclick = resumeSession;
  }

  saveState();
}

function resumeSession() {
  clearInterval(timerInterval);
  timerInterval = null;
  isOnBreak     = false;
  sessionDuration = originalSessionDuration;

  setMotivationText("Let's get back to work and perform better!");
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
    breakBtn.onclick = takeBreak;
  }

  saveState();
}

function stopSession() {
  clearInterval(timerInterval);
  timerInterval          = null;
  sessionDuration        = 0;
  isQuickieMode          = false;
  isOnBreak              = false;
  hasSelection           = false;
  originalSessionDuration = 0;

  updateCompactTimerDisplay();
  updateSessionOutputDisplay();
  updateHeaderProgressBar();
  setMotivationText("See you on your next session to Lock in.");
  showStartButton();

  document.querySelectorAll('.fifteenMin-btn,.thirtyMin-btn,.fortyfiveMin-btn,.sixtyMin-btn')
    .forEach(b => b.classList.remove('min-btn-selected'));

  saveState();
}

function resetToDefault() {
  hasSelection           = false;
  isQuickieMode          = false;
  isOnBreak              = false;
  sessionDuration        = 0;
  originalSessionDuration = 0;

  updateCompactTimerDisplay();
  updateSessionOutputDisplay();
  showStartButton();

  document.querySelectorAll('.fifteenMin-btn,.thirtyMin-btn,.fortyfiveMin-btn,.sixtyMin-btn')
    .forEach(b => b.classList.remove('min-btn-selected'));
}

// ── Button state helpers ──────────────────────────────────────────────────────
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
  document.getElementById('start-btn').addEventListener('click', startSession);
}

function setMotivationText(text) {
  const el = document.getElementById('motivation-text');
  if (el) el.textContent = text;
}

// ── Quick session button handlers ─────────────────────────────────────────────
function initButtonHandlers() {
  const buttons  = document.querySelectorAll('.fifteenMin-btn,.thirtyMin-btn,.fortyfiveMin-btn,.sixtyMin-btn');
  const durations = { 'fifteenMin-btn': 15, 'thirtyMin-btn': 30, 'fortyfiveMin-btn': 45, 'sixtyMin-btn': 60 };

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const duration = durations[btn.classList[0]];
      const isRunning = timerInterval && !isOnBreak;

      if (isRunning) {
        const prev = document.querySelector('.min-btn-selected');
        pendingDuration = { duration };
        showConfirmOverlay(
          `Switch from current session to ${duration} minutes?`,
          () => {
            clearInterval(timerInterval);
            timerInterval = null;
            isOnBreak     = false;
            buttons.forEach(b => b.classList.remove('min-btn-selected'));
            btn.classList.add('min-btn-selected');
            sessionDuration        = duration * 60;
            originalSessionDuration = sessionDuration;
            updateCompactTimerDisplay();
            hasSelection  = false;
            saveState();
            setTimeout(() => startSession(), 0);
          },
          () => {
            buttons.forEach(b => b.classList.remove('min-btn-selected'));
            if (prev) prev.classList.add('min-btn-selected');
            hasSelection  = true;
            pendingDuration = null;
          }
        );
        return;
      }

      buttons.forEach(b => b.classList.remove('min-btn-selected'));
      btn.classList.add('min-btn-selected');
      hasSelection           = true;
      isQuickieMode          = true;
      sessionDuration        = duration * 60;
      originalSessionDuration = sessionDuration;
      updateCompactTimerDisplay();
      saveState();
    });
  });

  // Restore highlight from saved state
  if (sessionDuration > 0 && !timerInterval) {
    const mins = Math.floor(sessionDuration / 60);
    const map  = { 15: 'fifteenMin-btn', 30: 'thirtyMin-btn', 45: 'fortyfiveMin-btn', 60: 'sixtyMin-btn' };
    const cls  = map[mins];
    if (cls) {
      const b = document.querySelector('.' + cls);
      if (b) b.classList.add('min-btn-selected');
    }
  }

  // Start session button
  const startBtn = document.getElementById('start-btn');
  if (startBtn) startBtn.addEventListener('click', startSession);

  // View details button
  document.getElementById('view-details-btn')?.addEventListener('click', () => {
    saveState();
    buildExtensionDetailView(document.getElementById('body-wrapper'));
  });

  // Compact btn (header)
  document.getElementById('compact-btn')?.addEventListener('click', () => {
    toggleCompactView();
  });
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

// ── Build main view DOM ───────────────────────────────────────────────────────
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
          <span class="today-time" id="current-time"><span class="hour">0h</span><span class="mins">0m</span></span>
        </div>
        <div class="goal-container">
          <span class="goal-text">DAILY GOAL</span>
          <span class="goal-time" id="goal-time"><span class="hour">0h</span><span class="mins">0m</span></span>
        </div>
      </div>

      <div class="session-output" id="session-output"></div>

      <span class="session-header-text">QUICK SESSION</span>
      <div class="quick-sessions-container" id="quick-sessions-container">
        <button class="fifteenMin-btn"><span class="session-header">15m</span><span class="session-subheader">quick</span></button>
        <button class="thirtyMin-btn"><span class="session-header">30m</span><span class="session-subheader">default</span></button>
        <button class="fortyfiveMin-btn"><span class="session-header">45m</span><span class="session-subheader">deep</span></button>
        <button class="sixtyMin-btn"><span class="session-header">60m</span><span class="session-subheader">flow</span></button>
      </div>

      <div class="duration-picker" id="duration-picker" style="display:none;">
        <span class="duration-picker-label">Choose session duration:</span>
        <div class="duration-btns">
          <button class="dur-btn" data-mins="15">15m</button>
          <button class="dur-btn" data-mins="30">30m</button>
          <button class="dur-btn" data-mins="45">45m</button>
          <button class="dur-btn" data-mins="60">60m</button>
        </div>
      </div>

      <div class="start-session-container" id="start-session-container">
        <button class="start-btn" id="start-btn">
          <img src="icons/play2.png" class="start-icon"> Start Session
        </button>
      </div>

      <div class="view-session-container">
        <button class="view-btn" id="view-details-btn">
          <img src="icons/down.png" class="view-icon"> View Details
        </button>
      </div>
    </div>
  `;
}

// ── EXTENSION DETAIL VIEW ─────────────────────────────────────────────────────
function buildExtensionDetailView(bodyWrapper) {
  bodyWrapper.innerHTML = '';

  const section = document.createElement('section');
  section.className = 'extension-section';

  // ── Header motivator ──
  section.appendChild(buildEl('div', 'extension_header_container', `
    <img src="icons/mascot3.png" class="mascot_extension">
    <span class="extension_header_text">Strive to be 1% better today than you were yesterday.</span>
  `));

  // ── Streak header row ──
  const streakCont = buildEl('div', 'streak_container_extension');
  const fireCont   = buildEl('div', 'fire_container_extension', `
    <img src="icons/fire2.png" class="fire_icon_extension">
    <span class="fire_text_extension">Streak</span>
  `);
  const nextCont = buildEl('div', 'next_container_extension', `
    <span class="next_extension">Next:</span>
    <span class="days_extension" id="ext-next-days">${getNextMilestone(streakDays)} days</span>
  `);
  streakCont.appendChild(fireCont);
  streakCont.appendChild(nextCont);

  // ── Milestone icons + progress bar ──
  const extWrapper = buildEl('div', 'extension_container_wrapper');

  const iconWrapper = buildEl('div', 'day_icon_wrapper');
  const milestoneData = [
    { days: 3,  icon: 'icons/trophy.png',  cls: 'trophy_extension' },
    { days: 7,  icon: 'icons/trophy.png',  cls: 'trophy_extension' },
    { days: 10, icon: 'icons/star.png',    cls: 'star_extension' },
    { days: 14, icon: 'icons/target.png',  cls: 'target_extension' },
    { days: 30, icon: 'icons/diamond.png', cls: 'target_extension' }
  ];

  milestoneData.forEach(m => {
    const cont = buildEl('div', 'day_icon_container');
    const img  = document.createElement('img');
    img.src = m.icon;
    img.className = m.cls + (streakDays >= m.days ? ' unlocked' : '');

    const numCls = (m.days === 3 || m.days === 7) ? 'day_num_extension' : 'day_num_extension_other';
    const num    = buildEl('span', numCls, `${m.days}d`);

    cont.appendChild(img);
    cont.appendChild(num);
    iconWrapper.appendChild(cont);
  });

  // Streak bar
  const next = getNextMilestone(streakDays);
  const prev = getPrevMilestone(streakDays);
  const pct  = next === prev ? 100 : Math.round(((streakDays - prev) / (next - prev)) * 100);
  const daysToGo = Math.max(0, next - streakDays);

  const barWrapper = buildEl('div', 'bar_text_wrapper');
  const barCont    = buildEl('div', 'streak_bar_container');
  const bar        = buildEl('div', 'streak_bar');
  bar.style.width  = Math.min(pct, 100) + '%';
  bar.id           = 'streak-bar-detail';
  barCont.appendChild(bar);

  const toNum = buildEl('div', 'to_num_container', `
    <span class="extension_num_days" id="ext-days-to-go">${daysToGo}</span>
    <span class="extension_to_go">days to go</span>
  `);

  barWrapper.appendChild(barCont);
  barWrapper.appendChild(toNum);

  extWrapper.appendChild(iconWrapper);
  extWrapper.appendChild(barWrapper);

  section.appendChild(streakCont);
  section.appendChild(extWrapper);

  // ── Focus Mode ──
  section.appendChild(buildFocusSection());

  // ── Schedule ──
  section.appendChild(buildScheduleSection());

  // ── AI suggestion placeholder ──
  section.appendChild(buildEl('div', 'suggestion_container', `
    <div class="ai_icon_text_container">
      <img src="icons/ai.png" class="ai_icon">
      <span class="ai_text">AI suggestions</span>
    </div>
    <span class="past_sesh">from past sessions</span>
  `));
  section.appendChild(buildEl('div', 'lower_suggestion_container', 'Complete more sessions for AI-powered suggestions.'));

  // ── Idle Detection ──
  section.appendChild(buildIdleSection());

  // ── Footer ──
  const footer = buildEl('div', 'footer_container');
  const newBtn = buildEl('button', 'new_sesh_btn', `
    <img src="icons/play2.png" class="sesh_icon"> Start new session
  `);
  newBtn.addEventListener('click', () => handleNewSessionFromDetail(bodyWrapper));
  footer.appendChild(newBtn);
  section.appendChild(footer);

  bodyWrapper.appendChild(section);

  // Start idle detection loop
  startIdleDetection();
}

function refreshDetailStreakSection() {
  // Only refresh if detail view is showing
  const bar     = document.getElementById('streak-bar-detail');
  const daysEl  = document.getElementById('ext-days-to-go');
  const nextEl  = document.getElementById('ext-next-days');
  if (!bar) return;

  const next    = getNextMilestone(streakDays);
  const prev    = getPrevMilestone(streakDays);
  const pct     = next === prev ? 100 : Math.round(((streakDays - prev) / (next - prev)) * 100);
  const daysToGo = Math.max(0, next - streakDays);

  bar.style.width = Math.min(pct, 100) + '%';
  if (daysEl) daysEl.textContent = daysToGo;
  if (nextEl) nextEl.textContent = `${next} days`;

  // Update milestone icons
  const milestones = [3, 7, 10, 14, 30];
  const icons = document.querySelectorAll('.day_icon_wrapper img');
  icons.forEach((img, i) => {
    if (streakDays >= milestones[i]) img.classList.add('unlocked');
    else img.classList.remove('unlocked');
  });
}

// ── Focus Section ─────────────────────────────────────────────────────────────
function buildFocusSection() {
  const frag = document.createDocumentFragment();

  const header = buildEl('div', 'focus_header_container', `
    <div class="icon_text_focus">
      <img src="icons/focus.png" class="focus_icon">
      <span class="focus_text">Focus Mode</span>
    </div>
  `);

  const statusSpan = document.createElement('span');
  statusSpan.className = 'focus_status' + (isAnyFocusActive() ? ' active' : '');
  statusSpan.id        = 'focus-status-text';
  statusSpan.textContent = isAnyFocusActive() ? 'Active' : 'Inactive';
  header.appendChild(statusSpan);

  const body = buildEl('div', 'focus_body');

  const sites = [
    { key: 'facebook',  icon: 'icons/fb.png',     label: 'Facebook' },
    { key: 'instagram', icon: 'icons/ig.png',     label: 'Instagram' },
    { key: 'twitter',   icon: 'icons/x.png',      label: 'X/Twitter' },
    { key: 'tiktok',    icon: 'icons/tiktok.png', label: 'Tiktok' },
    { key: 'youtube',   icon: 'icons/yt.png',     label: 'Youtube' }
  ];

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

      // Update status label
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

  frag.appendChild(header);
  frag.appendChild(body);
  return frag;
}

function isAnyFocusActive() {
  return Object.values(focusToggles).some(v => v);
}

// ── Schedule Section ──────────────────────────────────────────────────────────
function buildScheduleSection() {
  const frag = document.createDocumentFragment();

  const schedCont = buildEl('div', 'sched_container');
  const headerRow = buildEl('div', 'sched_header_container', `
    <img src="icons/calendar.png" class="sched_icon_text">
    <span class="sched_text">Plan sessions</span>
  `);

  const planCont = buildEl('div', 'plan_container');
  const dayNum   = document.createElement('span');
  dayNum.className   = 'day_planned_sched';
  dayNum.id          = 'sched-count';
  dayNum.textContent = scheduledSessions.length;

  const schedLabel = document.createElement('span');
  schedLabel.className   = 'day_planned_sched';
  schedLabel.textContent = 'scheduled';

  planCont.appendChild(dayNum);
  planCont.appendChild(schedLabel);
  schedCont.appendChild(headerRow);
  schedCont.appendChild(planCont);

  // Session list
  const sessList = buildEl('div', 'sched_sessions_container', '');
  sessList.id = 'sched-sessions-list';
  renderScheduledSessions(sessList);

  // Add button
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
    const dt   = new Date(sess.datetime);
    const label = `${dt.toLocaleDateString()} ${dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · ${sess.duration}m`;

    item.innerHTML = `
      <span>${label}</span>
      <button class="session_delete_btn" data-idx="${idx}">✕</button>
    `;
    item.querySelector('.session_delete_btn').addEventListener('click', () => {
      scheduledSessions.splice(idx, 1);
      saveScheduled();
      updateScheduledGoal();
      renderScheduledSessions();
      // update count
      const cnt = document.getElementById('sched-count');
      if (cnt) cnt.textContent = scheduledSessions.length;
    });

    container.appendChild(item);
  });
}

function updateScheduledGoal() {
  // Find the next upcoming session
  const now = Date.now();
  const upcoming = scheduledSessions
    .filter(s => new Date(s.datetime).getTime() > now)
    .sort((a, b) => new Date(a.datetime) - new Date(b.datetime));

  scheduledGoalDuration = upcoming.length > 0 ? upcoming[0].duration : 0;
  updateHeaderProgressBar();
  updateCompactTimerDisplay();
}

// Schedule modal
function openScheduleModal() {
  const modal = document.getElementById('schedule-modal');
  if (!modal) return;

  // Reset steps
  document.getElementById('sched-step-1').style.display = '';
  document.getElementById('sched-step-2').style.display = 'none';

  // Clear inputs
  document.getElementById('sched-date-input').value = '';
  document.getElementById('sched-time-input').value = '';
  let selectedDur = 15;
  document.querySelectorAll('.sched-dur-btn').forEach(b => {
    b.classList.toggle('active', parseInt(b.dataset.dur) === 15);
    b.onclick = () => {
      selectedDur = parseInt(b.dataset.dur);
      document.querySelectorAll('.sched-dur-btn').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
    };
  });

  modal.style.display = 'flex';

  document.getElementById('schedule-modal-close').onclick = () => {
    modal.style.display = 'none';
  };

  document.getElementById('sched-date-confirm').onclick = () => {
    const dateVal = document.getElementById('sched-date-input').value;
    if (!dateVal) return;
    document.getElementById('sched-step-1').style.display = 'none';
    document.getElementById('sched-step-2').style.display = '';
  };

  document.getElementById('sched-confirm-btn').onclick = () => {
    const dateVal = document.getElementById('sched-date-input').value;
    const timeVal = document.getElementById('sched-time-input').value;
    if (!dateVal || !timeVal) return;

    const datetime = new Date(`${dateVal}T${timeVal}`).toISOString();
    scheduledSessions.push({ datetime, duration: selectedDur, label: `${selectedDur}m session` });
    saveScheduled();
    updateScheduledGoal();

    // Refresh list
    const list = document.getElementById('sched-sessions-list');
    if (!list) {
      // Insert list element after sched container if not present
      const btnCont = document.querySelector('.sched_btns_container');
      if (btnCont) {
        const newList = buildEl('div', 'sched_sessions_container', '');
        newList.id = 'sched-sessions-list';
        btnCont.parentNode.insertBefore(newList, btnCont);
        renderScheduledSessions(newList);
      }
    } else {
      renderScheduledSessions(list);
    }

    const cnt = document.getElementById('sched-count');
    if (cnt) cnt.textContent = scheduledSessions.length;

    modal.style.display = 'none';

    // Show notification
    chrome.runtime.sendMessage({
      type: "testNotification",
      text: `Session scheduled for ${new Date(datetime).toLocaleString()}!`
    });
  };
}

// ── Idle Detection Section ────────────────────────────────────────────────────
function buildIdleSection() {
  const frag = document.createDocumentFragment();

  frag.appendChild(buildEl('div', 'detection_container', `
    <img src="icons/idle.png" class="detection_icon">
    <span class="detection_text">Idle detection</span>
  `));

  const lower = buildEl('div', 'lower_detection_container');
  const inner = buildEl('div', 'inner_detection_container');

  const circle = buildEl('div', 'status-circle');
  circle.id = 'idle-status-circle';

  const actCont = buildEl('div', 'active_container');
  const actText = buildEl('span', 'active_text', 'Active Now -');
  actText.id = 'idle-status-text';

  const actMsg = buildEl('span', 'active_msg', ' no idle detected in the last 0 minutes.');
  actMsg.id = 'idle-status-msg';

  actCont.appendChild(actText);
  actCont.appendChild(actMsg);
  inner.appendChild(circle);
  inner.appendChild(actCont);
  lower.appendChild(inner);
  frag.appendChild(lower);
  return frag;
}

function startIdleDetection() {
  clearInterval(idleInterval);

  // Listen for user activity
  document.addEventListener('mousemove',  onActivity, { passive: true });
  document.addEventListener('keydown',    onActivity, { passive: true });
  document.addEventListener('mousedown',  onActivity, { passive: true });
  document.addEventListener('touchstart', onActivity, { passive: true });

  idleInterval = setInterval(updateIdleDisplay, 5000);
  updateIdleDisplay(); // immediate first update
}

function onActivity() {
  lastActivityTime = Date.now();
  updateIdleDisplay();
}

function updateIdleDisplay() {
  const circle  = document.getElementById('idle-status-circle');
  const textEl  = document.getElementById('idle-status-text');
  const msgEl   = document.getElementById('idle-status-msg');
  if (!circle || !textEl || !msgEl) return;

  const elapsed       = Math.floor((Date.now() - lastActivityTime) / 1000);
  const isActiveNow   = elapsed < 60;

  circle.className = 'status-circle' + (isActiveNow ? ' active' : '');

  if (isActiveNow) {
    textEl.textContent = 'Active Now -';
    const mins = Math.floor(elapsed / 60);
    msgEl.textContent  = ` no idle detected in the last ${Math.max(1, Math.ceil(elapsed / 60))} minute${elapsed >= 120 ? 's' : ''}.`;
  } else {
    const mins = Math.floor(elapsed / 60);
    const hrs  = Math.floor(mins / 60);
    const display = hrs > 0 ? `${hrs}h ${mins % 60}m` : `${mins}m`;
    textEl.textContent = 'Idle -';
    msgEl.textContent  = ` idle for ${display}. Take a break or come back when ready.`;
  }
}

// ── Handle "Start new session" from detail view ────────────────────────────────
function handleNewSessionFromDetail(bodyWrapper) {
  saveState();
  // Rebuild main view and show duration picker
  bodyWrapper.innerHTML = '';
  buildMainViewDOM(bodyWrapper);
  initButtonHandlers();
  updateCompactTimerDisplay();
  updateSessionOutputDisplay();

  // Show duration picker
  const picker = document.getElementById('duration-picker');
  if (picker) picker.style.display = '';

  // Wire up dur buttons
  document.querySelectorAll('.dur-btn').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.dur-btn').forEach(x => x.classList.remove('selected'));
      b.classList.add('selected');

      const mins = parseInt(b.dataset.mins);
      sessionDuration        = mins * 60;
      originalSessionDuration = sessionDuration;
      isQuickieMode           = true;
      hasSelection            = true;
      updateCompactTimerDisplay();
      saveState();

      // Hide picker and start
      if (picker) picker.style.display = 'none';
      startSession();
    });
  });
}

// ── Utility DOM builder ───────────────────────────────────────────────────────
function buildEl(tag, className, html) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (html !== undefined) el.innerHTML = html;
  return el;
}

// ── Initialisation ────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadState(() => {
    // Restore compact state
    if (isCompact) {
      const bw = document.getElementById('body-wrapper');
      if (bw) bw.style.display = 'none';
      const img = document.getElementById('compact-icon-img');
      if (img) img.src = 'icons/down.png';
    }

    // Update header streak
    updateHeaderStreak();

    // Update timer display
    updateCompactTimerDisplay();
    updateSessionOutputDisplay();
    updateHeaderProgressBar();

    // Determine goal from scheduled sessions
    updateScheduledGoal();

    // Init handlers
    initButtonHandlers();

    // If session was running, restore running state (visual only — interval was lost)
    if (timerInterval === null && sessionDuration > 0 && isOnBreak === false) {
      // Session was mid-run when popup closed; show break/stop and re-start
      if (hasSelection && sessionDuration > 0) {
        showBreakStopButtons();
      }
    }

    if (isOnBreak && sessionBreak > 0) {
      showBreakStopButtons();
    }

    // Compact btn icon
    const img = document.getElementById('compact-icon-img');
    if (img) img.src = isCompact ? 'icons/down.png' : 'icons/up.png';

    // Compact btn click
    document.getElementById('compact-btn')?.addEventListener('click', toggleCompactView);
  });
});