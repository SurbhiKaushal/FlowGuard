const statusElement = document.getElementById("connectionStatus");

const attentionState = document.getElementById("attentionState");

const timerElement = document.getElementById("timer");

const currentIntentElement = document.getElementById("currentIntent");

const taskList = document.getElementById("taskList");

const eventList = document.getElementById("eventList");

const intentInput = document.getElementById("intentInput");

const interruptModal = document.getElementById("interruptModal");

const interruptReason = document.getElementById("interruptReason");

const continueButton = document.getElementById("continueButton");

const queueButton = document.getElementById("queueButton");

const interruptButton = document.getElementById("interruptButton");

let socket;

function connect() {

    socket = new WebSocket(`ws://${window.location.host}`);

    socket.onopen = () => {

        statusElement.textContent = "● ONLINE";

        statusElement.className = "status online";

    };

    socket.onclose = () => {

        statusElement.textContent = "● OFFLINE";

        statusElement.className = "status offline";

        setTimeout(connect, 1500);

    };

    socket.onerror = () => {

        statusElement.textContent = "● CONNECTION ERROR";

        statusElement.className = "status offline";

    };

    socket.onmessage = event => {

        try {

            const data = JSON.parse(event.data);

            if (data.type === "state") {

                renderState(data.state);

            }

            if (data.type === "event") {

                addEvent(data.event);

            }

            if (data.type === "interrupt") {

                interruptReason.textContent = data.reason;

                interruptModal.classList.remove("hidden");

            }

            if (data.type === "userInterrupt") {

                interruptModal.classList.add("hidden");

            }

            if (data.type === "interruptDeferred") {

                interruptModal.classList.add("hidden");

            }

        } catch (error) {

            console.error("FLOWGUARD message error:", error);

        }

    };

}

function send(action, extra = {}) {

    if (!socket) {

        console.warn("WebSocket does not exist yet.");

        return;

    }

    if (socket.readyState !== WebSocket.OPEN) {

        console.warn("WebSocket is not connected.");

        return;

    }

    const message = {

        action,

        ...extra

    };

    console.log("Sending:", message);

    socket.send(JSON.stringify(message));

}

function renderState(state) {

    attentionState.textContent =
        state.attentionContract.state;

    currentIntentElement.textContent =
        state.currentIntent;

    renderTimer(
        state.attentionContract.remainingSeconds
    );

    renderTasks(state.tasks);

    renderEvents(state.events);

    document.getElementById("totalEvents").textContent =
        state.metrics.totalEvents;

    document.getElementById("continueCount").textContent =
        state.metrics.continueCount;

    document.getElementById("queueCount").textContent =
        state.metrics.queueCount;

    document.getElementById("interruptCount").textContent =
        state.metrics.interruptCount;

    document.getElementById("corrections").textContent =
        state.metrics.corrections;

    document.getElementById("staleCancelled").textContent =
        state.metrics.staleTasksCancelled;

    document.getElementById("interruptLatency").textContent =
        `${state.metrics.averageInterruptLatency} ms`;

}

function renderTimer(seconds) {

    const minutes = Math.floor(seconds / 60);

    const remaining = seconds % 60;

    timerElement.textContent =
        `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;

}

function renderTasks(tasks) {

    if (!tasks || tasks.length === 0) {

        taskList.innerHTML = `
            <div class="emptyTasks">
                <div class="emptyIcon">✦</div>
                <p>No background work yet.</p>
                <span>Start the agent to give FLOWGUARD something to handle.</span>
            </div>
        `;

        return;

    }

    taskList.innerHTML = tasks.map(task => {

        return `
            <div class="task">

                <div class="taskHeader">

                    <span class="taskName">
                        ${escapeHtml(task.name)}
                    </span>

                    <span class="taskStatus">
                        ${escapeHtml(task.status)}
                    </span>

                </div>

                <div class="progress">

                    <div
                        class="progressBar"
                        style="width:${task.progress}%"
                    ></div>

                </div>

                <div style="font-size:11px;margin-top:8px;color:#70798a;">
                    ${escapeHtml(task.currentStep || "")}
                </div>

            </div>
        `;

    }).join("");

}

function renderEvents(events) {

    if (!events || events.length === 0) {

        eventList.innerHTML = `
            <div class="emptyActivity">
                Waiting for the agent...
            </div>
        `;

        return;

    }

    eventList.innerHTML = events.map(event => {

        return `
            <div class="event">

                <div class="eventTime">
                    ${escapeHtml(event.time)}
                </div>

                <div class="eventMessage">
                    ${escapeHtml(event.message)}
                </div>

                <span class="eventType">
                    ${escapeHtml(event.type)}
                </span>

            </div>
        `;

    }).join("");

}

function addEvent(event) {

    console.log("Agent event:", event);

}

function escapeHtml(value) {

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}


/* -------------------------------- */
/* BUTTONS                          */
/* -------------------------------- */

document.getElementById("startButton").addEventListener(
    "click",
    () => {

        console.log("START clicked");

        send("start");

    }
);


/* CONTINUE */

continueButton?.addEventListener(
    "click",
    () => {

        console.log("CONTINUE clicked");

        send("continueEvent");

    }
);


/* QUEUE */

queueButton?.addEventListener(
    "click",
    () => {

        console.log("QUEUE clicked");

        send("queueEvent");

    }
);


/* INTERRUPT */

interruptButton?.addEventListener(
    "click",
    () => {

        console.log("INTERRUPT clicked");

        send("interrupt");

    }
);


document.getElementById("normalButton")?.addEventListener(
    "click",
    () => {

        console.log("NORMAL clicked");

        send("normalEvent");

    }
);

document.getElementById("criticalButton")?.addEventListener(
    "click",
    () => {

        console.log("CRITICAL clicked");

        send("criticalEvent");

    }
);

document.getElementById("deferButton")?.addEventListener(
    "click",
    () => {

        console.log("DEFER clicked");

        send("deferInterrupt");

    }
);

document.getElementById("resetButton")?.addEventListener(
    "click",
    () => {

        console.log("RESET clicked");

        send("reset");

    }
);

document.getElementById("updateIntentButton").addEventListener(
    "click",
    () => {

        const intent =
            intentInput.value.trim();

        if (!intent) {

            return;

        }

        console.log(
            "UPDATE INTENT clicked:",
            intent
        );

        send(
            "updateIntent",
            { intent }
        );

    }
);

document.getElementById("deferModalButton").addEventListener(
    "click",
    () => {

        console.log("DEFER MODAL clicked");

        send("deferInterrupt");

        interruptModal.classList.add("hidden");

    }
);

document.getElementById("handleModalButton").addEventListener(
    "click",
    () => {

        console.log("HANDLE MODAL clicked");

        interruptModal.classList.add("hidden");

        send("interrupt");

    }
);


/* -------------------------------- */
/* KEYBOARD                         */
/* -------------------------------- */

document.addEventListener(
    "keydown",
    event => {

        if (
            event.code === "Space" &&
            event.target.tagName !== "INPUT"
        ) {

            event.preventDefault();

            document
                .getElementById("startButton")
                .click();

        }

    }
);


/* -------------------------------- */
/* START                            */
/* -------------------------------- */

connect();