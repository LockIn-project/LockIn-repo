let sessionDuration = 0;
let sessionBreak = 0;
let timerInterval = null;
let isQuickieMode = false;
let hasSelection = false;
let originalSessionDuration = 0;
let isOnBreak = false;
let pendingDuration = null;

function popUp_extension(body_wrapper){
    body_wrapper.innerHTML = "";

    let body_section = document.createElement('section');
    body_section.className = "extension-section";

    let extension_header_container = document.createElement('div');
    extension_header_container.className = "extension_header_container";

    let mascot = document.createElement('img');
    mascot.src = 'icons/mascot3.png';
    mascot.className = 'mascot_extension';

    let extension_header_text = document.createElement('span');
    extension_header_text.className = "extension_header_text";
    extension_header_text.textContent = "Strive to be 1% better today than you were yesterday.";

    extension_header_container.appendChild(mascot);
    extension_header_container.appendChild(extension_header_text);

    let streak_wrapper = document.createElement('div');
    streak_wrapper.className = 'streak_wrapper_extension';

    let streak_container = document.createElement('div');
    streak_container.className = 'streak_container_extension';

    let fire_container = document.createElement('div');
    fire_container.className = 'fire_container_extension';

    let next_container = document.createElement('div');
    next_container.className = 'next_container_extension';

    let fire_icon = document.createElement('img');
    fire_icon.className = 'fire_icon_extension';
    fire_icon.src = 'icons/fire2.png';

    let fire_text = document.createElement('span');
    fire_text.className = 'fire_text_extension';
    fire_text.textContent = 'Streak';

    fire_container.appendChild(fire_icon);
    fire_container.appendChild(fire_text);
    streak_container.appendChild(fire_container);

    let next = document.createElement('span');
    next.className = 'next_extension';
    next.textContent = 'Next:';

    let next_days = document.createElement('span');
    next_days.className = 'days_extension';
    next_days.textContent = '10 days'; //should be implemented dynamically

    next_container.appendChild(next);
    next_container.appendChild(next_days);
    streak_container.appendChild(next_container);

    let bottom_streak_container = document.createElement('div');
    bottom_streak_container.className = "bottom_streak_container";

    let day_icon_wrapper = document.createElement('div');
    day_icon_wrapper.className = "day_icon_wrapper";

    let day_icon_container3 = document.createElement('div');
    day_icon_container3.className = "day_icon_container";

    let day_icon_container7 = document.createElement('div');
    day_icon_container7.className = "day_icon_container";

    let day_icon3 = document.createElement('img');
    day_icon3.src = 'icons/trophy.png';
    day_icon3.className = "trophy_extension";

    let day_num3 = document.createElement('span');
    day_num3.className = 'day_num_extension';
    day_num3.textContent = "3d";

    day_icon_container3.appendChild(day_icon3);
    day_icon_container3.appendChild(day_num3);

    let day_icon7 = document.createElement('img');
    day_icon7.src = 'icons/trophy.png';
    day_icon7.className = "trophy_extension";

    let day_num7 = document.createElement('span');
    day_num7.className = 'day_num_extension';
    day_num7.textContent = "7d";

    day_icon_container7.appendChild(day_icon7);
    day_icon_container7.appendChild(day_num7);

    let day_icon_container10 = document.createElement('div');
    day_icon_container10.className = "day_icon_container";

    let day_icon10 = document.createElement('img');
    day_icon10.src = 'icons/star.png';
    day_icon10.className = "star_extension";

    let day_num10 = document.createElement('span');
    day_num10.className = 'day_num_extension_other';
    day_num10.textContent = "10d";

    day_icon_container10.appendChild(day_icon10);
    day_icon_container10.appendChild(day_num10);

    let day_icon_container14 = document.createElement('div');
    day_icon_container14.className = "day_icon_container";

    let day_icon14 = document.createElement('img');
    day_icon14.src = 'icons/target.png';
    day_icon14.className = "target_extension";

    let day_num14 = document.createElement('span');
    day_num14.className = 'day_num_extension_other';
    day_num14.textContent = "14d";

    day_icon_container14.appendChild(day_icon14);
    day_icon_container14.appendChild(day_num14);

    let day_icon_container30 = document.createElement('div');
    day_icon_container30.className = "day_icon_container";

    let day_icon30 = document.createElement('img');
    day_icon30.src = 'icons/diamond.png';
    day_icon30.className = "target_extension";

    let day_num30 = document.createElement('span');
    day_num30.className = 'day_num_extension_other';
    day_num30.textContent = "30d";

    day_icon_container30.appendChild(day_icon30);
    day_icon_container30.appendChild(day_num30);

    day_icon_wrapper.appendChild(day_icon_container3);
    day_icon_wrapper.appendChild(day_icon_container7);
    day_icon_wrapper.appendChild(day_icon_container10);
    day_icon_wrapper.appendChild(day_icon_container14);
    day_icon_wrapper.appendChild(day_icon_container30);

    let container_wrapper = document.createElement('div');
    container_wrapper.className = 'extension_container_wrapper';

    let bar_text_wrapper = document.createElement('div');
    bar_text_wrapper.className = 'bar_text_wrapper';

    let streak_bar_container = document.createElement('div');
    streak_bar_container.className = 'streak_bar_container';

    let streak_bar = document.createElement('div');
    streak_bar.className = 'streak_bar';

    streak_bar_container.appendChild(streak_bar);

    let to_num_container = document.createElement('div');
    to_num_container.className = 'to_num_container';

    let num_days = document.createElement('span');
    num_days.className = 'extension_num_days';
    num_days.textContent = '2';

    let to_go = document.createElement('span');
    to_go.className = 'extension_to_go';
    to_go.textContent = 'days to go';

    to_num_container.appendChild(num_days);
    to_num_container.appendChild(to_go);

    bar_text_wrapper.appendChild(streak_bar_container);
    bar_text_wrapper.appendChild(to_num_container);

    container_wrapper.appendChild(day_icon_wrapper);
    container_wrapper.appendChild(bar_text_wrapper);

    let focus_mode_wrapper = document.createElement('div');
    focus_mode_wrapper.className = "focus_mode_wrapper";

    let focus_header_container = document.createElement('div');
    focus_header_container.className = 'focus_header_container';

    let icon_text = document.createElement('div');
    icon_text.className = 'icon_text_focus';

    let focus_icon = document.createElement('img');
    focus_icon.className = 'focus_icon';
    focus_icon.src = 'icons/focus.png';

    let focus_text = document.createElement('span');
    focus_text.className = 'focus_text';
    focus_text.textContent = 'Focus Mode';

    icon_text.appendChild(focus_icon);
    icon_text.appendChild(focus_text);

    let focus_status = document.createElement('span');
    focus_status.className = 'focus_status';
    focus_status.textContent = 'Active'; //should be applied dynamically active/inactive

    focus_header_container.appendChild(icon_text);
    focus_header_container.appendChild(focus_status);

    let focus_body = document.createElement('div');
    focus_body.className = 'focus_body';

    let fb_wrapper = document.createElement('div');
    fb_wrapper.className = 'focuses_wrapper';

    let fb_container = document.createElement('div');
    fb_container.className = 'focuses_container';

    let fb_icon = document.createElement('img');
    fb_icon.className = 'focus_icon';
    fb_icon.src = 'icons/fb.png';

    let fb_text = document.createElement('span');
    fb_text.className = 'focus_icon_text';
    fb_text.textContent = 'Facebook';

    fb_container.appendChild(fb_icon);
    fb_container.appendChild(fb_text);

    let toggle1 = document.createElement('div');
    toggle1.className = 'toggle';

    let knob1 = document.createElement('div');
    knob1.className = 'knob';

    toggle1.appendChild(knob1);

    fb_wrapper.appendChild(fb_container);
    fb_wrapper.appendChild(toggle1);

    let ig_wrapper = document.createElement('div');
    ig_wrapper.className = 'focuses_wrapper';

    let ig_container = document.createElement('div');
    ig_container.className = 'focuses_container';

    let ig_icon = document.createElement('img');
    ig_icon.className = 'focus_icon';
    ig_icon.src = 'icons/ig.png';

    let ig_text = document.createElement('span');
    ig_text.className = 'focus_icon_text';
    ig_text.textContent = 'Instagram';

    ig_container.appendChild(ig_icon);
    ig_container.appendChild(ig_text);

    let toggle2 = document.createElement('div');
    toggle2.className = 'toggle';

    let knob2 = document.createElement('div');
    knob2.className = 'knob';

    toggle2.appendChild(knob2);

    ig_wrapper.appendChild(ig_container);
    ig_wrapper.appendChild(toggle2);

    let breakline1 = document.createElement('hr');

    let x_wrapper = document.createElement('div');
    x_wrapper.className = 'focuses_wrapper';

    let x_container = document.createElement('div');
    x_container.className = 'focuses_container';

    let x_icon = document.createElement('img');
    x_icon.className = 'focus_icon';
    x_icon.src = 'icons/x.png';

    let x_text = document.createElement('span');
    x_text.className = 'focus_icon_text';
    x_text.textContent = 'X/Twitter';

    x_container.appendChild(x_icon);
    x_container.appendChild(x_text);

    let toggle3 = document.createElement('div');
    toggle3.className = 'toggle';

    let knob3 = document.createElement('div');
    knob3.className = 'knob';

    toggle3.appendChild(knob3);

    x_wrapper.appendChild(x_container);
    x_wrapper.appendChild(toggle3);


    let breakline2 = document.createElement('hr');

    let tiktok_wrapper = document.createElement('div');
    tiktok_wrapper.className = 'focuses_wrapper';

    let tiktok_container = document.createElement('div');
    tiktok_container.className = 'focuses_container';

    let tiktok_icon = document.createElement('img');
    tiktok_icon.className = 'focus_icon';
    tiktok_icon.src = 'icons/tiktok.png';

    let tiktok_text = document.createElement('span');
    tiktok_text.className = 'focus_icon_text';
    tiktok_text.textContent = 'Tiktok';

    tiktok_container.appendChild(tiktok_icon);
    tiktok_container.appendChild(tiktok_text);

    let toggle4 = document.createElement('div');
    toggle4.className = 'toggle';

    let knob4 = document.createElement('div');
    knob4.className = 'knob';

    toggle4.appendChild(knob4);

    tiktok_wrapper.appendChild(tiktok_container);
    tiktok_wrapper.appendChild(toggle4);

    let breakline3 = document.createElement('hr');

    let yt_wrapper = document.createElement('div');
    yt_wrapper.className = 'focuses_wrapper';

    let yt_container = document.createElement('div');
    yt_container.className = 'focuses_container';

    let yt_icon = document.createElement('img');
    yt_icon.className = 'focus_icon';
    yt_icon.src = 'icons/yt.png';

    let yt_text = document.createElement('span');
    yt_text.className = 'focus_icon_text';
    yt_text.textContent = 'Youtube';

    yt_container.appendChild(yt_icon);
    yt_container.appendChild(yt_text);

    let toggle5 = document.createElement('div');
    toggle5.className = 'toggle';

    let knob5 = document.createElement('div');
    knob5.className = 'knob';

    toggle5.appendChild(knob5);

    yt_wrapper.appendChild(yt_container);
    yt_wrapper.appendChild(toggle5);

    let breakline4 = document.createElement('hr');

    focus_body.appendChild(fb_wrapper);
    focus_body.appendChild(breakline1);
    focus_body.appendChild(ig_wrapper);
    focus_body.appendChild(breakline2);
    focus_body.appendChild(x_wrapper);
    focus_body.appendChild(breakline3);
    focus_body.appendChild(tiktok_wrapper);
    focus_body.appendChild(breakline4);
    focus_body.appendChild(yt_wrapper);

    let sched_wrapper = document.createElement('div');
    sched_wrapper.className = 'sched_wrapper';

    let sched_container = document.createElement('div');
    sched_container.className = 'sched_container';

    let sched_header_container = document.createElement('div');
    sched_header_container.className = 'sched_header_container';

    let sched_icon = document.createElement('img');
    sched_icon.className = 'sched_icon_text';
    sched_icon.src = 'icons/';

    let sched_text = document.createElement('span');
    sched_text.className = 'sched_text';
    sched_text.textContent = 'Plan sessions';

    sched_header_container.appendChild(sched_icon);
    sched_header_container.appendChild(sched_text);

    let plan_container = document.createElement('div');
    plan_container.className = 'plan_container';

    let day_planned_sched = document.createElement('span');
    day_planned_sched.className = 'day_planned_sched';
    day_planned_sched.textContent = '0'; //should be dynamic

    let planned_sched = document.createElement('span');
    planned_sched.className = 'day_planned_sched';
    planned_sched.textContent = 'scheduled';

    plan_container.appendChild(day_planned_sched);
    plan_container.appendChild(planned_sched);

    sched_container.appendChild(sched_header_container);
    sched_container.appendChild(plan_container);

    let sched_sessions = document.createElement('div');
    sched_sessions.className = 'sched_sessions_container'; //append the new created session here   

    let each_session = document.createElement('div');
    each_session.className = 'each_session_container'; //each created session will use this container

    sched_sessions.appendChild(each_session); //here too

    let sched_btns_container = document.createElement('div');
    sched_btns_container.className = 'sched_btns_container';

    let sched_btn = document.createElement('button');
    sched_btn.className = 'sched_btn';
    sched_btn.textContent = '+ Schedule Session';

    sched_btns_container.appendChild(sched_btn);

    let suggestion_wrapper = document.createElement('div');
    suggestion_wrapper.className = 'suggestion_wrapper';

    let suggestion_container = document.createElement('div');
    suggestion_container.className = 'suggestion_container';

    let ai_icon_text = document.createElement('div');
    ai_icon_text.className = 'ai_icon_text_container';

    let ai_icon = document.createElement('img');
    ai_icon.src = 'icons/ai.png';
    ai_icon.className = 'ai_icon';

    let ai_text = document.createElement('span');
    ai_text.className = 'ai_icon';
    ai_text.textContent = 'AI suggestions';

    ai_icon_text.appendChild(ai_icon);
    ai_icon_text.appendChild(ai_text);

    let past_sesh = document.createElement('span');
    past_sesh.className = 'past_sesh';
    past_sesh.textContent = 'from past sessions';

    suggestion_container.appendChild(ai_icon_text);
    suggestion_container.appendChild(past_sesh);

    


    body_section.appendChild(extension_header_container);
    body_section.appendChild(streak_container);
    body_section.appendChild(container_wrapper);
    body_section.appendChild(focus_header_container);
    body_section.appendChild(focus_body);
    body_section.appendChild(sched_container);
    body_section.appendChild(sched_btns_container);
    body_section.appendChild(suggestion_container);

    body_wrapper.appendChild(body_section);
}


// Save state to chrome storage
function saveState() {
    chrome.storage.local.set({
        sessionDuration: sessionDuration,
        sessionBreak: sessionBreak,
        isQuickieMode: isQuickieMode,
        hasSelection: hasSelection,
        originalSessionDuration: originalSessionDuration,
        isOnBreak: isOnBreak
    });
}

// Load state from chrome storage
function loadState(callback) {
    chrome.storage.local.get([
        'sessionDuration',
        'sessionBreak',
        'isQuickieMode',
        'hasSelection',
        'originalSessionDuration',
        'isOnBreak'
    ], (result) => {
        if (result.sessionDuration !== undefined) {
            sessionDuration = result.sessionDuration;
            originalSessionDuration = result.originalSessionDuration || result.sessionDuration;
            isQuickieMode = result.isQuickieMode;
            hasSelection = result.hasSelection;
            isOnBreak = result.isOnBreak;
            sessionBreak = result.sessionBreak || 0;
            
            // Update UI
            updateQuickieDisplay();
            
            // Re-highlight the selected button based on time
            if (sessionDuration > 0) {
                const minutes = Math.floor(sessionDuration / 60);
                const btnMap = {15: 'fifteenMin-btn', 30: 'thirtyMin-btn', 45: 'fortyfiveMin-btn', 60: 'sixtyMin-btn'};
                const selectedBtn = btnMap[minutes];
                if (selectedBtn) {
                    const btn = document.querySelector('.' + selectedBtn);
                    if (btn) btn.classList.add('min-btn-selected');
                }
            }
        }
        if (callback) callback();
    });
}

function showConfirmOverlay(message, onConfirm, onCancel) {
    const overlay = document.getElementById('confirmation-overlay');
    const text = document.getElementById('confirmation-text');
    const yesBtn = document.getElementById('confirm-yes');
    const noBtn = document.getElementById('confirm-no');
    
    text.textContent = message;
    overlay.style.display = 'flex';
    
    const handleYes = () => {
        overlay.style.display = 'none';
        if (onConfirm) onConfirm();
        cleanup();
    };
    
    const handleNo = () => {
        overlay.style.display = 'none';
        if (onCancel) onCancel();
        cleanup();
    };
    
    const cleanup = () => {
        yesBtn.removeEventListener('click', handleYes);
        noBtn.removeEventListener('click', handleNo);
    };
    
    yesBtn.addEventListener('click', handleYes);
    noBtn.addEventListener('click', handleNo);
}

// Initialize button handlers
function initButtonHandlers() {
    const buttons = document.querySelectorAll(
        ".fifteenMin-btn, .thirtyMin-btn, .fortyfiveMin-btn, .sixtyMin-btn"
    );

    const durations = {
        'fifteenMin-btn': 15,
        'thirtyMin-btn': 30,
        'fortyfiveMin-btn': 45,
        'sixtyMin-btn': 60
    };

    buttons.forEach(btn => {
        btn.addEventListener("click", () => {
            const duration = durations[btn.classList[0]];
            
            // Only block switching if session timer is running (not break timer)
            // Allow switching during break
            const isSessionRunning = timerInterval && !isOnBreak;
            
            if (isSessionRunning) {
                // Store the previously selected button to restore on "No"
                const previouslySelected = document.querySelector('.min-btn-selected');
                
                pendingDuration = { duration };
                showConfirmOverlay(
                    `Switch from current session to ${duration} minutes?`,
                    () => {
                        // User clicked Yes - switch to new time and start immediately
                        clearInterval(timerInterval);
                        timerInterval = null;
                        isOnBreak = false;
                        
                        // Update selection highlight
                        buttons.forEach(b => b.classList.remove("min-btn-selected"));
                        btn.classList.add("min-btn-selected");
                        
                        sessionDuration = duration * 60;
                        originalSessionDuration = sessionDuration;
                        updateQuickieDisplay();
                        hasSelection = false;
                        saveState();
                        
                        // Immediately start the new session
                        setTimeout(() => startSession(), 0);
                    },
                    () => {
                        // User clicked No - restore previous highlight
                        buttons.forEach(b => b.classList.remove("min-btn-selected"));
                        if (previouslySelected) {
                            previouslySelected.classList.add("min-btn-selected");
                        }
                        hasSelection = true;
                        pendingDuration = null;
                    }
                );
                return;
            }
            
            // If timer not running or only break timer is running, allow selection
            buttons.forEach(b => b.classList.remove("min-btn-selected"));
            btn.classList.add("min-btn-selected");
            
            hasSelection = true;
            isQuickieMode = true;
            
            sessionDuration = duration * 60;
            originalSessionDuration = sessionDuration;
            updateQuickieDisplay();
            saveState();
        });
    });
    
    document.getElementById('view-details-btn')?.addEventListener('click', function() {
        popUp_extension(document.querySelector('.body-wrapper'));
    });
    document.querySelector('.start-btn')?.addEventListener('click', startSession);
}

// Load saved state and initialize
document.addEventListener("DOMContentLoaded", () => {
    // Load saved state first
    loadState(() => {
        // Initialize button handlers after state is loaded
        initButtonHandlers();
    });
});

function updateDisplay() {
    const output = document.querySelector('.session-output');
    output.innerHTML = "";

    let goal_wrapper = document.createElement('div');
    goal_wrapper.className = "today-goal-container";

    let today_container = document.createElement('div');
    today_container.className = "today-container";

    let today_text = document.createElement('span');
    today_text.className = "today-text";
    today_text.textContent = "TODAY";

    let today_time = document.createElement('span');
    today_time.className = "today-time";
    today_time.textContent = formatTime(sessionDuration);

    today_container.appendChild(today_text);
    today_container.appendChild(today_time);

    let goal_container = document.createElement('div');
    goal_container.className = "goal-container";

    let goal_text = document.createElement('span');
    goal_text.className = "goal-text";
    goal_text.textContent = "GOAL";

    let goal_time = document.createElement('span');
    goal_time.className = "goal-time";
    goal_time.textContent = formatTime(sessionDuration);

    goal_container.appendChild(goal_text);
    goal_container.appendChild(goal_time);

    goal_wrapper.appendChild(today_container);
    goal_wrapper.appendChild(goal_container);

    output.appendChild(goal_wrapper);
}

function updateQuickieDisplay() {
    const output = document.querySelector('.today-time');
    output.innerHTML = "";

    let quickie_time = document.createElement('span');
    quickie_time.className = "quickie-time";
    quickie_time.textContent = formatTime(sessionDuration);

    output.appendChild(quickie_time);
}

function updateBreakDisplay() {
    const output = document.querySelector('.dynamic-motivation-text');
    output.innerHTML = "";

    let break_wrapper = document.createElement('div');
    break_wrapper.className = "break-container";

    let break_text = document.createElement('span');
    break_text.className = "break-text";
    break_text.textContent = "REST: ";

    let break_time = document.createElement('span');
    break_time.className = "break-time";
    break_time.textContent = formatTime(sessionBreak);

    break_wrapper.appendChild(break_text);
    break_wrapper.appendChild(break_time);

    output.appendChild(break_wrapper);
}

function formatTime(seconds) {
    if (timerInterval) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
}

function startSession() {
    if (sessionDuration <= 0) return;
    
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        sessionDuration--;
        if (sessionDuration <= 0) {
            clearInterval(timerInterval);
            timerInterval = null;
            if (isOnBreak) {
                // Break ended, resume original session
                isOnBreak = false;
                sessionDuration = originalSessionDuration;
                updateDisplay(); // Back to normal quickie display
                showStartButton();
                alert("Break ended! Resuming session...");
            } else {
                // Session completed
                showStartButton();
                alert("Session complete!");
                resetToDefault();
            }
        }
        updateDisplayBasedOnState();
    }, 1000);
    
    showBreakStopButtons();
    saveState();
}

function showBreakStopButtons() {
    const container = document.querySelector('.start-session-container');
    container.innerHTML = `
        <div class="break_stop_container">
            <div class="btns-stop-break">
                <button class="break-btn" id="break-btn">
                    <img src="icons/break.png" class="stop-break-icon">
                    Break
                </button>
            </div>

            <div class="btns-stop-break">
                <button class="stop-btn" id="stop-btn">
                    <img src="icons/stop.png" class="stop-break-icon">
                    Stop
                </button>
            </div>
        </div>
    `;
    document.getElementById('break-btn').addEventListener('click', takeBreak);
    document.getElementById('stop-btn').addEventListener('click', stopSession);
}

function showStartButton() {
    const container = document.querySelector('.start-session-container');
    container.innerHTML = `
        <button class="start-btn">
            <img src="icons/play2.png" class="start-icon">
            Start Session
        </button>
    `;
    document.querySelector('.start-btn').addEventListener('click', startSession);
}

function takeBreak() {
    clearInterval(timerInterval);
    timerInterval = null;
    isOnBreak = true;

    // Save remaining Quickie time
    originalSessionDuration = sessionDuration;

    // Start break timer (5 minutes)
    sessionBreak = 5 * 60;
    updateBreakDisplay();

    timerInterval = setInterval(() => {
        sessionBreak--; // decrement break, not sessionDuration
        if (sessionBreak <= 0) {
            clearInterval(timerInterval);
            timerInterval = null;
            isOnBreak = false;

            // Resume Quickie from saved time
            sessionDuration = originalSessionDuration;
            updateQuickieDisplay();
            showBreakStopButtons();

            const breakBtn = document.getElementById('break-btn');
            if (breakBtn) {
                breakBtn.innerHTML = `<img src="icons/break.png" class="stop-break-icon"> Break`;
                breakBtn.onclick = takeBreak;
            }
            alert("Break ended! Resuming session...");
        }
        updateBreakDisplay();
    }, 1000);

    showBreakStopButtons();

    // Change Break button to Continue
    const breakBtn = document.getElementById('break-btn');
    if (breakBtn) {
        breakBtn.innerHTML = `<img src="icons/break.png" class="stop-break-icon"> Continue`;
        breakBtn.onclick = resumeSession;
    }
}


function stopSession() {
    clearInterval(timerInterval);
    hasSelection = false;
    timerInterval = null;
    sessionDuration = 0;
    isQuickieMode = false;
    isOnBreak = false;
    originalSessionDuration = 0;
    const output = document.querySelector('.today-time');
    output.innerHTML = "0h 0m";
    const mascot_text = document.querySelector('.dynamic-motivation-text');
    mascot_text.innerHTML = "See you on your next session to Lock in.";
    showStartButton();
    
    const buttons = document.querySelectorAll(
        ".fifteenMin-btn, .thirtyMin-btn, .fortyfiveMin-btn, .sixtyMin-btn"
    );
    buttons.forEach(btn => btn.classList.remove("min-btn-selected"));
    saveState();
}

function resumeSession() {
    const output = document.querySelector('.dynamic-motivation-text');
    output.innerHTML = "";

    let continue_text = document.createElement('span');
    continue_text.textContent = "Let's get back to work and perform better!" 
    
    output.appendChild(continue_text);

    clearInterval(timerInterval);
    timerInterval = null;
    isOnBreak = false;
    // sessionDuration is already set to originalSessionDuration in takeBreak when break ends
    // But if user clicks continue during break, we need to resume from remaining break time
    // Actually, let's just resume the original session (not the break)
    sessionDuration = originalSessionDuration; // Resume the original session
    
    updateQuickieDisplay(); // Back to quickie display
    showBreakStopButtons(); // Reset buttons to break and stop
    // Change the continue button back to a break button
    
    timerInterval = setInterval(() => {
        sessionDuration--;
        if (sessionDuration <= 0) {
            clearInterval(timerInterval);
            timerInterval = null;
            showStartButton();
            alert("Session complete!");
            resetToDefault();
        }
        updateQuickieDisplay();
    }, 1000);
    
    const breakBtn = document.getElementById('break-btn');
    if (breakBtn) {
        breakBtn.innerHTML = `<img src="icons/break.png" class="stop-break-icon"> Break`;
        breakBtn.onclick = takeBreak;
    }
}

function updateDisplayBasedOnState() {
    if (isOnBreak) {
        updateBreakDisplay();
    } else if (isQuickieMode) {
        updateQuickieDisplay();
    } else {
        updateDisplay();
    }
}

function resetToDefault() {
    hasSelection = false;
    isQuickieMode = false;
    isOnBreak = false;
    sessionDuration = 0;
    originalSessionDuration = 0;
    updateDisplay();
    showStartButton();
    
    // Remove selection from buttons
    const buttons = document.querySelectorAll(
        ".fifteenMin-btn, .thirtyMin-btn, .fortyfiveMin-btn, .sixtyMin-btn"
    );
    buttons.forEach(btn => btn.classList.remove("min-btn-selected"));
}

function quickie_fifteen(container){
    clearInterval(timerInterval);
    timerInterval = null;
    sessionDuration = 15 * 60;
    originalSessionDuration = sessionDuration;
    updateDisplay();
}

function quickie_thirty(container){
    clearInterval(timerInterval);
    timerInterval = null;
    sessionDuration = 30 * 60;
    originalSessionDuration = sessionDuration;
    updateDisplay();
}

function quickie_fortyfive(container){
    clearInterval(timerInterval);
    timerInterval = null;
    sessionDuration = 45 * 60;
    originalSessionDuration = sessionDuration;
    updateDisplay();
}

function quickie_sixty(container){
    clearInterval(timerInterval);
    timerInterval = null;
    sessionDuration = 60 * 60;
    originalSessionDuration = sessionDuration;
    updateDisplay();
}