/* ============================================================
   script.js — Smart Traffic Intersection Simulator
   Web Development Class — Session 1 Scaffold
   ============================================================ */


/* ─────────────────────────────────────────────────────────────
   STATE
   Holds the current values of everything the app needs to track.
───────────────────────────────────────────────────────────── */
const State = {
  ns: 'stop',           // 'go' | 'warning' | 'stop'
  ew: 'go',            // 'go' | 'warning' | 'stop'
  mode: 'manual',       // 'manual' | 'timed'
  transitioning: false, // true while a transition animation is running
  timedTimeout: null,   // holds the setTimeout reference for timed mode
  timedInterval: null,  // holds the setInterval for visible countdown
  timedRemaining: 0,
  nsGoSeconds: 10,
  ewGoSeconds: 7,
  nextLaneAfterCrossing: null,
  crossingRemaining: 0,
  pedestrianRequested: false,
  pedestrianCrossing: false,
  phase: 'normal',      // 'normal' | 'requested' | 'crossing'
  crossingDuration: 5,
  countdownWindow: 3,
  crossingInterval: null,
};


const WARNING_DURATION_SECONDS = 1.5;
const ALL_RED_DURATION_SECONDS = 0.6;


/* ─────────────────────────────────────────────────────────────
   DOM REFERENCES
   Get all the elements we need to read or change.
   We use a helper function $() so we can write $('id')
   instead of document.getElementById('id') every time.
───────────────────────────────────────────────────────────── */
function $(id) {
  return document.getElementById(id);
}


// Light bulb elements for each lane
const nsLights = {
  red:    $('ns-red'),
  yellow: $('ns-yellow'),
  green:  $('ns-green'),
};


const ewLights = {
  red:    $('ew-red'),
  yellow: $('ew-yellow'),
  green:  $('ew-green'),
};


// State text labels below each light
const nsStateText = $('ns-state-text');
const ewStateText = $('ew-state-text');


// Controls
const modeSlider     = $('mode-slider');
const manualControls = $('manual-controls');
const timedControls  = $('timed-controls');
const btnTransition  = $('btn-transition');
const btnStartTimed  = $('btn-start-timed');
const btnStopTimed   = $('btn-stop-timed');
const greenTimeInput = $('greenTime');
const redTimeInput   = $('redTime');
const pedestrianTimeInput = $('pedestrianTime');
const logContainer   = $('log-container');
const btnClearLog    = $('btn-clear-log');
const labelManual    = $('label-manual');
const labelTimed     = $('label-timed');
const btnCross       = $('btn-cross');
const pedSignal      = $('ped-signal');
const pedStateText   = $('ped-state-text');
const pedTimer       = $('ped-timer');
const nsTimer        = $('ns-timer');
const ewTimer        = $('ew-timer');


/* ─────────────────────────────────────────────────────────────
   SETTINGS (LOCAL STORAGE)
   Saves and restores user timer values between page refreshes.
───────────────────────────────────────────────────────────── */
function saveSettings() {
  localStorage.setItem('greenTime', greenTimeInput.value);
  localStorage.setItem('redTime', redTimeInput.value);
  localStorage.setItem('pedestrianTime', pedestrianTimeInput.value);
}


function loadSettings() {
  const savedGreenTime = localStorage.getItem('greenTime');
  const savedRedTime = localStorage.getItem('redTime');
  const savedPedestrianTime = localStorage.getItem('pedestrianTime');

  if (savedGreenTime !== null) {
    greenTimeInput.value = savedGreenTime;
  }

  if (savedRedTime !== null) {
    redTimeInput.value = savedRedTime;
  }

  if (savedPedestrianTime !== null) {
    pedestrianTimeInput.value = savedPedestrianTime;
  }
}


/* ─────────────────────────────────────────────────────────────
   RENDER LIGHT
   Updates the bulbs and state label for one traffic light.


   Parameters:
     lights    — the object with .red, .yellow, .green elements
     stateText — the <div> that shows the text label
     state     — 'go' | 'warning' | 'stop'
───────────────────────────────────────────────────────────── */
function renderLight(lights, stateText, state) {
  // Turn off all bulbs first
  lights.red.classList.remove('active');
  lights.yellow.classList.remove('active');
  lights.green.classList.remove('active');


  // Turn on the correct bulb and update the label
  if (state === 'stop') {
    lights.red.classList.add('active');
    stateText.textContent = 'STOP';
    stateText.style.color = '#ef4444';
  } else if (state === 'warning') {
    lights.yellow.classList.add('active');
    stateText.textContent = 'SLOW';
    stateText.style.color = '#eab308';
  } else {
    // state === 'go'
    lights.green.classList.add('active');
    stateText.textContent = 'GO';
    stateText.style.color = '#22c55e';
  }
}


/* ─────────────────────────────────────────────────────────────
   RENDER ALL
   Re-renders both traffic lights using the current State values.
───────────────────────────────────────────────────────────── */
function renderAll() {
  renderLight(nsLights, nsStateText, State.ns);
  renderLight(ewLights, ewStateText, State.ew);
  renderTrafficTimers();
}


function renderTrafficTimers() {
  if (State.mode !== 'timed') {
    nsTimer.textContent = '--';
    ewTimer.textContent = '--';
    return;
  }


  if (State.pedestrianCrossing) {
    const pedLeft = State.crossingRemaining;


    if (State.nextLaneAfterCrossing === 'ns') {
      nsTimer.textContent = pedLeft + 's';
      ewTimer.textContent = (pedLeft + State.nsGoSeconds + getTransitionSeconds() + State.crossingDuration) + 's';
    } else if (State.nextLaneAfterCrossing === 'ew') {
      ewTimer.textContent = pedLeft + 's';
      nsTimer.textContent = (pedLeft + State.ewGoSeconds + getTransitionSeconds() + State.crossingDuration) + 's';
    } else {
      nsTimer.textContent = pedLeft + 's';
      ewTimer.textContent = pedLeft + 's';
    }


    setPedestrianSignal('countdown', pedLeft);
    return;
  }

  if (State.ns === 'go') {
    nsTimer.textContent = State.timedRemaining + 's';
    ewTimer.textContent = (State.timedRemaining + getTransitionSeconds() + State.crossingDuration) + 's';
    setPedestrianSignal('wait', State.timedRemaining + getTransitionSeconds());
    return;
  }

  if (State.ew === 'go') {
    ewTimer.textContent = State.timedRemaining + 's';
    nsTimer.textContent = (State.timedRemaining + getTransitionSeconds() + State.crossingDuration) + 's';
    setPedestrianSignal('wait', State.timedRemaining + getTransitionSeconds());
    return;
  }

  const transitionLeft = getTransitionSeconds() + State.crossingDuration;
  nsTimer.textContent = transitionLeft + 's';
  ewTimer.textContent = transitionLeft + 's';
  setPedestrianSignal('wait', getTransitionSeconds());
}


/* ─────────────────────────────────────────────────────────────
   PEDESTRIAN UI
   Keeps pedestrian signal and button in sync with state.
───────────────────────────────────────────────────────────── */
function setPedestrianSignal(signalState, secondsLeft) {
  pedSignal.classList.remove('wait', 'walk', 'countdown');
  pedSignal.classList.add(signalState);


  if (signalState === 'wait') {
    if (typeof secondsLeft === 'number') {
      pedStateText.textContent = 'NEXT WALK';
      pedTimer.textContent = String(secondsLeft);
    } else {
      pedStateText.textContent = 'WAIT';
      pedTimer.textContent = '--';
    }
  } else if (signalState === 'walk') {
    pedStateText.textContent = 'WALK';
    pedTimer.textContent = typeof secondsLeft === 'number' ? String(secondsLeft) : '--';
  } else {
    pedStateText.textContent = 'COUNTDOWN';
    pedTimer.textContent = String(secondsLeft);
  }
}


function renderCrossButton() {
  if (State.pedestrianCrossing) {
    btnCross.disabled = true;
    btnCross.textContent = 'Crossing...';
    return;
  }


  if (State.pedestrianRequested) {
    btnCross.disabled = true;
    btnCross.textContent = 'Request Queued';
    return;
  }


  btnCross.disabled = false;
  btnCross.textContent = 'Cross';
}


function clearCrossingInterval() {
  clearInterval(State.crossingInterval);
  State.crossingInterval = null;
}


function clearTimedCountdownInterval() {
  clearInterval(State.timedInterval);
  State.timedInterval = null;
  State.timedRemaining = 0;
}


function getTransitionSeconds() {
  return Math.ceil(WARNING_DURATION_SECONDS + ALL_RED_DURATION_SECONDS);
}


function requestPedestrianCrossing() {
  if (State.pedestrianRequested || State.pedestrianCrossing) {
    log('🚶 Crossing request already queued', 'warning');
    return;
  }


  State.pedestrianRequested = true;
  State.phase = 'requested';
  setPedestrianSignal('wait');
  renderCrossButton();
  log('🚶 Pedestrian request queued', 'info');


  // Manual mode has no auto-cycle, so start a transition to eventually serve the request.
  if (State.mode === 'manual' && !State.transitioning) {
    runManualTransition();
  }
}


function beginPedestrianCrossing(nextLane, callback) {
  const totalSeconds = State.crossingDuration;
  let remaining = totalSeconds;


  State.pedestrianRequested = false;
  State.pedestrianCrossing = true;
  State.nextLaneAfterCrossing = nextLane;
  State.crossingRemaining = remaining;
  State.phase = 'crossing';
  State.ns = 'stop';
  State.ew = 'stop';
  renderAll();
  setPedestrianSignal('countdown', remaining);
  renderCrossButton();
  log('🚶 Pedestrian crossing started — all traffic STOP', 'success');


  clearCrossingInterval();
  State.crossingInterval = setInterval(function () {
    remaining -= 1;
    State.crossingRemaining = Math.max(remaining, 0);
    renderTrafficTimers();


    if (remaining > 0) {
      setPedestrianSignal('countdown', remaining);
    }


    if (remaining <= 0) {
      clearCrossingInterval();
      State.pedestrianCrossing = false;
      State.nextLaneAfterCrossing = null;
      State.crossingRemaining = 0;
      State.phase = 'normal';
      setPedestrianSignal('wait');


      if (nextLane === 'ns') {
        State.ns = 'go';
        State.ew = 'stop';
        log('✅ N–S → GO (after pedestrian crossing)', 'success');
      } else {
        State.ew = 'go';
        State.ns = 'stop';
        log('✅ E–W → GO (after pedestrian crossing)', 'success');
      }


      renderAll();
      State.transitioning = false;
      btnTransition.disabled = false;
      renderCrossButton();


      if (typeof callback === 'function') {
        callback();
      }
    }
  }, 1000);
}


/* ─────────────────────────────────────────────────────────────
   LOG
   Adds a new entry to the Event Log panel.


   Parameters:
     message — the text to display
     type    — 'info' | 'success' | 'warning' | 'danger'
───────────────────────────────────────────────────────────── */
function log(message, type = 'info') {
  const entry = document.createElement('div');
  entry.className = 'log-entry ' + type;


  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour12: false });


  entry.innerHTML = '<span class="log-time">[' + timeStr + ']</span>' + message;


  // Add newest entries at the top
  logContainer.prepend(entry);


  // Keep only the last 80 entries to avoid memory issues
  while (logContainer.children.length > 80) {
    logContainer.removeChild(logContainer.lastChild);
  }
}


/* ─────────────────────────────────────────────────────────────
   RUN MANUAL TRANSITION
   Triggers a full transition sequence:
     Active lane:  go → warning (1.5s) → stop
     Waiting lane: stop → go


   Parameters:
     callback — optional function to call when transition is done
───────────────────────────────────────────────────────────── */
function runManualTransition(callback) {
  // Don't start a new transition if one is already running
  if (State.transitioning) return;


  State.transitioning = true;
  btnTransition.disabled = true;


  // Figure out which lane is currently going
  const activeIsNS = (State.ns === 'go');
  const activeLane  = activeIsNS ? 'N–S' : 'E–W';
  const waitingLane = activeIsNS ? 'E–W' : 'N–S';


  log('🔄 Transition triggered — ' + activeLane + ' going to WARNING', 'warning');


  // Step 1: Active lane → WARNING
  if (activeIsNS) {
    State.ns = 'warning';
  } else {
    State.ew = 'warning';
  }
  renderAll();


  // Step 2: After 1.5s → active lane goes to STOP
  setTimeout(function () {
    log('🛑 ' + activeLane + ' → STOP', 'danger');


    if (activeIsNS) {
      State.ns = 'stop';
    } else {
      State.ew = 'stop';
    }
    renderAll();


    // Step 3: After 0.6s → waiting lane goes to GO
    setTimeout(function () {
      if (State.pedestrianRequested) {
        const nextLaneKey = activeIsNS ? 'ew' : 'ns';
        log('🚶 Pedestrian phase started — both lanes held at STOP', 'warning');
        beginPedestrianCrossing(nextLaneKey, callback);
        return;
      }


      log('✅ ' + waitingLane + ' → GO', 'success');


      if (activeIsNS) {
        State.ew = 'go';
      } else {
        State.ns = 'go';
      }
      renderAll();


      // Transition complete
      State.transitioning = false;
      btnTransition.disabled = false;


      // Call the optional callback (used by timed mode)
      if (typeof callback === 'function') {
        callback();
      }


    }, 600);
  }, 1500);
}


/* ─────────────────────────────────────────────────────────────
   START TIMED MODE
   Reads the time inputs and starts the automatic cycle:
     - Set N–S to GO, E–W to STOP as the starting state
     - Wait for the go time, then trigger a transition
     - After the transition, wait the other lane's go time, repeat
───────────────────────────────────────────────────────────── */
function startTimedMode() {
  const nsSeconds = parseFloat(greenTimeInput.value) || 10;
  const ewSeconds = parseFloat(redTimeInput.value) || 7;
  const pedSeconds = parseFloat(pedestrianTimeInput.value) || 5;


  State.nsGoSeconds = nsSeconds;
  State.ewGoSeconds = ewSeconds;
  State.crossingDuration = pedSeconds;


  log('⏱ Timed mode started — N–S: ' + nsSeconds + 's | E–W: ' + ewSeconds + 's | Pedestrian: ' + pedSeconds + 's', 'info');


  // Set initial state: N–S goes first
  State.ns = 'go';
  State.ew = 'stop';
  renderAll();
  log('✅ N–S → GO (starting)', 'success');


  // Kick off the cycle
  runTimedCycle(nsSeconds, ewSeconds);
}


/* ─────────────────────────────────────────────────────────────
   RUN TIMED CYCLE
   Internal helper — schedules the next transition after
   the correct go time for the currently active lane.
───────────────────────────────────────────────────────────── */
function runTimedCycle(nsSeconds, ewSeconds) {
  // Stop if mode was switched away
  if (State.mode !== 'timed') return;


  // How long should the current GO lane stay green?
  const currentGoTime = (State.ns === 'go') ? nsSeconds : ewSeconds;


  clearTimedCountdownInterval();
  State.timedRemaining = currentGoTime;
  renderTrafficTimers();


  State.timedInterval = setInterval(function () {
    if (State.mode !== 'timed') {
      clearTimedCountdownInterval();
      renderTrafficTimers();
      return;
    }


    State.timedRemaining -= 1;
    renderTrafficTimers();


    if (State.timedRemaining <= 0) {
      clearTimedCountdownInterval();
      renderTrafficTimers();


      // Always include a pedestrian crossing phase in timed mode.
      State.pedestrianRequested = true;
      State.phase = 'requested';
      renderCrossButton();

      runManualTransition(function () {
        // After transition, schedule the next one
        runTimedCycle(nsSeconds, ewSeconds);
      });
    }
  }, 1000);
}


/* ─────────────────────────────────────────────────────────────
   STOP TIMED MODE
   Cancels any pending timeouts and resets transitioning state.
───────────────────────────────────────────────────────────── */
function stopTimedMode() {
  clearTimeout(State.timedTimeout);
  State.timedTimeout = null;
  clearTimedCountdownInterval();
  renderTrafficTimers();


  if (!State.pedestrianCrossing) {
    State.transitioning = false;
    btnTransition.disabled = false;
  }


  log('⏹ Timed mode stopped', 'warning');
}


/* ─────────────────────────────────────────────────────────────
   EVENT LISTENERS
   Connect each button and control to the correct function.
───────────────────────────────────────────────────────────── */


// Manual transition button
btnTransition.addEventListener('click', function () {
  runManualTransition();
});


// Timed mode — Start button
btnStartTimed.addEventListener('click', function () {
  saveSettings();
  stopTimedMode(); // clear any previous cycle first
  startTimedMode();
});


// Timed mode — Stop button
btnStopTimed.addEventListener('click', function () {
  stopTimedMode();
});


// Pedestrian crossing request button
btnCross.addEventListener('click', function () {
  requestPedestrianCrossing();
});


// Mode slider — switches between Manual and Timed
modeSlider.addEventListener('input', function () {
  const isTimed = modeSlider.value === '1';


  if (isTimed) {
    State.mode = 'timed';
    manualControls.classList.add('hidden');
    timedControls.classList.remove('hidden');
    labelManual.classList.remove('active-label');
    labelTimed.classList.add('active-label');
    renderTrafficTimers();
    log('🔀 Switched to TIMED mode', 'info');
  } else {
    State.mode = 'manual';
    stopTimedMode();
    timedControls.classList.add('hidden');
    manualControls.classList.remove('hidden');
    labelTimed.classList.remove('active-label');
    labelManual.classList.add('active-label');
    log('🔀 Switched to MANUAL mode', 'info');
  }
});


// Clear log button
btnClearLog.addEventListener('click', function () {
  logContainer.innerHTML = '';
});


/* ─────────────────────────────────────────────────────────────
   INIT
   Run when the page first loads — render the initial state.
───────────────────────────────────────────────────────────── */
renderAll();
setPedestrianSignal('wait');
renderCrossButton();
renderTrafficTimers();
loadSettings();
log('🚦 Traffic Simulator initialized', 'info');
log('N–S: STOP | E–W: GO', 'success');




