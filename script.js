function popUp_extension(quick_session){
    quick_session.innerHTML = "";

}

function quickie_fifteen(container){
    container.innerHTML = "";

    document.addEventListener("DOMContentLoaded", () => {
    const fifteenBtn = document.querySelector('.fifteenMin-btn');

    fifteenBtn.addEventListener('click', () => {
        quickie_fifteen(document.querySelector('.session-wrapper'));
    });
    });

    

    let goal_wrapper = document.createElement('div');
    goal_wrapper.className = "today-goal-container";

    let today_container = document.createElement('div');
    today_container.className = "today-container";

    let today_text = document.createElement('span');
    today_text.className = "today-text";
    today_text.textContent = "TODAY";

    let today_time = document.createElement('span');
    today_time.className = "today-time";
    today_time.textContent = "0h 15m"; //should be dynamically implemented

    today_container.appendChild(today_text);
    today_container.appendChild(today_time);

    let goal_container = document.createElement('div');
    goal_container.className = "goal-container";

    let goal_text = document.createElement('span');
    goal_text.className = "goal-text";
    goal_text.textContent = "GOAL";

    let goal_time = document.createElement('span');
    goal_time.className = "goal-time";
    goal_time.textContent = "0h 15m"; //should also be dynamically implemented

    goal_container.appendChild(goal_text);
    goal_container.appendChild(goal_time);

    goal_wrapper.appendChild(today_container);
    goal_wrapper.appendChild(goal_container);

    container.appendChild(goal_wrapper);
}

function quickie_thirty(container){
    container.innerHTML = "";
}

function quickie_fortyfive(container){
    container.innerHTML = "";
}

function quickie_sixty(container){
    container.innerHTML = "";
}