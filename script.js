let sessionDuration = 0;
let sessionBreak = 0;
let timerInterval = null;
let isQuickieMode = false;
let originalSessionDuration = 0;
let isOnBreak = false;

function popUp_extension(quick_session){
    quick_session.innerHTML = "";
}

document.addEventListener("DOMContentLoaded", () => {
  const buttons = document.querySelectorAll(
    ".fifteenMin-btn, .thirtyMin-btn, .fortyfiveMin-btn, .sixtyMin-btn"
  );

  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      buttons.forEach(b => b.classList.remove("min-btn-selected"));
      btn.classList.add("min-btn-selected");
      
      // Set quickie mode and update display
      isQuickieMode = true;
      updateQuickieDisplay();
    });
  });
});


document.addEventListener("DOMContentLoaded", function() {
    document.querySelector('.fifteenMin-btn').addEventListener('click', function() {
        clearInterval(timerInterval);
        timerInterval = null;
        sessionDuration = 15 * 60;
        originalSessionDuration = sessionDuration;
        if (isQuickieMode) {
            updateQuickieDisplay();
        } else {
            updateDisplay();
        }
    });
    document.querySelector('.thirtyMin-btn').addEventListener('click', function() {
        clearInterval(timerInterval);
        timerInterval = null;
        sessionDuration = 30 * 60;
        originalSessionDuration = sessionDuration;
        if (isQuickieMode) {
            updateQuickieDisplay();
        } else {
            updateDisplay();
        }
    });
    document.querySelector('.fortyfiveMin-btn').addEventListener('click', function() {
        clearInterval(timerInterval);
        timerInterval = null;
        sessionDuration = 45 * 60;
        originalSessionDuration = sessionDuration;
        if (isQuickieMode) {
            updateQuickieDisplay();
        } else {
            updateDisplay();
        }
    });
    document.querySelector('.sixtyMin-btn').addEventListener('click', function() {
        clearInterval(timerInterval);
        timerInterval = null;
        sessionDuration = 60 * 60;
        originalSessionDuration = sessionDuration;
        if (isQuickieMode) {
            updateQuickieDisplay();
        } else {
            updateDisplay();
        }
    });
    document.getElementById('view-details-btn').addEventListener('click', function() {
        popUp_extension(document.querySelector('.quick-sessions-container'));
    });
    document.querySelector('.start-btn').addEventListener('click', startSession);
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