// Field hockey referee app for a Suunto watch (SuuntoPlus sports app).
// 4 quarters, home/visitors score, time penalties (2/5/10 min, max 2 per team).
//
// HOW IT FITS TOGETHER
//   main.js  (this file)  all game logic and state. The watch calls the callbacks at the
//                         bottom: onLoad, evaluate (clock), onEvent (user input).
//   t.html                the UI. It only DISPLAYS the output values below and SENDS event
//                         numbers back to onEvent. It contains no game logic.
//   manifest.json         declares the output values (tit, clk, hs, ...) used by t.html.
//
// DATA FLOW
//   button/tap in t.html --> onEvent(eventId) --> change state --> publish() --> output.*
//   every second         --> evaluate()       --> tick clock   --> publish() --> output.*
//   t.html reads the output.* values and redraws. Output set in onEvent only appears on
//   screen after the next evaluate tick (max 1 second later).
//
// evaluate() is called once per second (+/- 5 ms) and is used as the game clock.
//
// GAME MODES (variable "mode")
//   READY  clock stopped, start of a quarter (shows full quarter time)
//   RUN    clock running (quarter counts down, penalties count down)
//   STOP   clock stopped during a quarter (injury, penalty corner review, ...)
//   BREAK  quarter ended: timer counts UP until the referee presses start,
//          which prepares the next quarter (READY); a second press starts it
//   END    final whistle of the 4th quarter
//
// SCREENS (variable "curView")
//   1 time and score    2 penalties    3 score edit (opened by tapping a score)
//
// CONTROLS AND THE EVENT NUMBERS t.html SENDS (see onEvent)
//   Top button (up)              1  start/stop clock (and prepare next quarter after a break)
//   Bottom button (down), click  6  switch screen 1 <-> 2 (also cancels a score edit)
//   Bottom button, hold 5 s      7  reset clock to full quarter time
//   Middle button                   not used on purpose: the watch menu stays available to leave the app
//   Tap home / visitors score    2 / 3  open the edit screen for that team
//   Edit screen: arrow up / down 4 / 5  score +1 / -1
//   Edit screen: OK              8  save the score and go back
//   Penalties: 2'/5'/10' tap     10/11/12 home, 20/21/22 visitors
//   Penalties: tap a slot        30/31 home slot 1/2, 32/33 visitors slot 1/2
//                                (tapping the already selected slot again cancels its penalty)
//
// Penalty slots are independent: a duration only ever fills the selected slot.
//
// OUTPUT VALUES (set in publish, read by t.html)
//   tit  title: quarter * 10 + mode (e.g. 21 = quarter 2, RUN). Also drives the red/green indicator
//   clk  seconds to show on the big clock    scr  curView (which screen is visible)
//   hs / vs  home / visitors score           ed / et  score and team shown on the edit screen
//   h0 h1 / v0 v1  penalty seconds left, home slots 1-2 / visitors slots 1-2 (0 = free)
//   sh / sv  selected penalty slot (0 or 1) for home / visitors
//
// Custom functions are written as "var name = function() {}" because the watch software
// reserves global "function name() {}" declarations for its own callbacks.

// ---- Settings -------------------------------------------------------------------------
var QUARTERS = 4;
var QUARTER_SECONDS = 17 * 60 + 30;  // length of one quarter (set a small value to test)
var WARN_SECONDS = 10;      // short vibration every second during the last 10 seconds
var PENALTY_SECONDS = { 0: 120, 1: 300, 2: 600 };  // event offset (0/1/2) -> penalty seconds
var MAX_PENALTIES = 2;      // per team, at the same time (= number of slots)

var READY = 0, RUN = 1, STOP = 2, BREAK = 3, END = 4;  // values of "mode"

// ---- State (all reset by resetGame) -----------------------------------------------------
var mode, quarter, remaining, breakTime, curView;
// quarter: 1..4   remaining: seconds left in the quarter   breakTime: seconds since the quarter ended
var editTeam, editVal;   // score being edited on the edit screen (editTeam 0 home, 1 visitors)
var score;     // [home, visitors]
var pen;       // pen[team][slot] = seconds left, 0 = free (team 0 home, 1 visitors)
var sel;       // sel[team] = selected slot, the next duration goes there
var penLock;   // 1 after a penalty was set this second (ignores duplicate taps)

// ---- Game logic -------------------------------------------------------------------------

// Start a new game: first quarter, clock stopped, score 0-0, no penalties.
var resetGame = function() {
  mode = READY;
  quarter = 1;
  remaining = QUARTER_SECONDS;
  breakTime = 0;
  curView = 1;
  score = [0, 0];
  editTeam = 0;
  editVal = 0;
  pen = [[0, 0], [0, 0]];
  sel = [0, 0];
  penLock = 0;
};

// Put a penalty of `seconds` in the selected slot of `team` (overwrites what was there).
// Afterwards the selection moves to the other slot if that one is free, so two quick
// penalties fill both slots. penLock ignores a second call within the same second.
var addPenalty = function(team, seconds) {
  if (penLock) return;
  penLock = 1;
  var slot = sel[team];
  pen[team][slot] = seconds;
  if (pen[team][1 - slot] <= 0) sel[team] = 1 - slot;
};

// Tap on a penalty slot: select it, or cancel its penalty if it was already selected.
var selectSlot = function(team, slot) {
  if (sel[team] === slot) {
    pen[team][slot] = 0;   // second tap on the selected slot cancels it
  } else {
    sel[team] = slot;
  }
};

// Open the score edit screen for `team`, starting from its current score.
var openEdit = function(team) {
  editTeam = team;
  editVal = score[team];
  curView = 3;
};

// OK on the edit screen: store the edited score and return to the time/score screen.
var confirmEdit = function() {
  score[editTeam] = editVal;
  curView = 1;
};

// Top button. READY/STOP -> run, RUN -> stop, BREAK -> prepare the next quarter.
var startStop = function() {
  if (mode === READY || mode === STOP) {
    mode = RUN;
    playIndication('StartTimer');
  } else if (mode === RUN) {
    mode = STOP;
    playIndication('StopTimer');
  } else if (mode === BREAK) {
    // First press after the break: show the next quarter with full time, clock stopped.
    // The next press (READY) starts it.
    quarter++;
    remaining = QUARTER_SECONDS;
    breakTime = 0;
    mode = READY;
    playIndication('Confirm');
  }
};

// Back to the full quarter time, clock stopped. Score, quarter and penalties are kept.
var resetClock = function() {
  mode = READY;
  remaining = QUARTER_SECONDS;
  breakTime = 0;
  playIndication('Confirm');
};

// Quarter time reached 0: go to the break (or END after the last quarter).
// The alarm itself is played in evaluate.
var endQuarter = function() {
  breakTime = 0;
  mode = quarter >= QUARTERS ? END : BREAK;
};

// Count down all running penalties by one second (called while the clock runs).
// A short tone signals that a penalty has been served.
var tickPenalties = function() {
  for (var t = 0; t < 2; t++) {
    var p = pen[t];
    for (var i = 0; i < MAX_PENALTIES; i++) {
      if (p[i] > 0) {
        p[i]--;
        if (p[i] === 0) playIndication('Info');  // penalty served
      }
    }
  }
};

// Copy the state to the output values that t.html displays (see OUTPUT VALUES above).
var publish = function(output) {
  output.tit = quarter * 10 + mode;  // title: quarter and state
  // Clock shows quarter time left, or the break timer counting up
  output.clk = mode === BREAK ? breakTime : remaining;
  output.hs = score[0];
  output.vs = score[1];
  output.scr = curView;
  output.h0 = pen[0][0];
  output.h1 = pen[0][1];
  output.v0 = pen[1][0];
  output.v1 = pen[1][1];
  output.ed = editVal;
  output.et = editTeam;
  output.sh = sel[0];
  output.sv = sel[1];
};

// ---- Watch callbacks --------------------------------------------------------------------

// Called once when the app starts.
function onLoad(input, output) {
  resetGame();
  publish(output);
}

// Called every second. While RUN: count the quarter and penalties down, vibrate during
// the last WARN_SECONDS and sound the alarm at 0. While BREAK: count the break timer up.
function evaluate(input, output) {
  penLock = 0;
  if (mode === RUN) {
    remaining--;
    tickPenalties();
    if (remaining <= 0) {
      remaining = 0;
      endQuarter();
      playIndication('StopTimer', false, 2);  // alarm at 0 seconds (once)
    } else if (remaining <= WARN_SECONDS) {
      playIndication('Button', false, 1);    // short vibration, once per second
    }
  } else if (mode === BREAK) {
    breakTime++;
  }
  publish(output);
}

// Called when t.html sends an event (button press or tap). eventId numbers: see CONTROLS above.
function onEvent(input, output, eventId) {
  // Penalty taps (10-33) only count while the penalties screen is shown
  if (eventId >= 10 && eventId <= 33 && curView !== 2) return;
  switch (eventId) {
    case 1: startStop(); break;
    case 2: if (curView === 1) openEdit(0); break;
    case 3: if (curView === 1) openEdit(1); break;
    case 4: if (curView === 3) editVal++; break;
    case 5: if (curView === 3 && editVal > 0) editVal--; break;
    case 6: curView = curView === 2 ? 1 : (curView === 1 ? 2 : 1); break;  // bottom button, also cancels an edit
    case 7: resetClock(); break;
    case 8: if (curView === 3) confirmEdit(); break;
    case 10: case 11: case 12: addPenalty(0, PENALTY_SECONDS[eventId - 10]); break;
    case 20: case 21: case 22: addPenalty(1, PENALTY_SECONDS[eventId - 20]); break;
    case 30: case 31: selectSlot(0, eventId - 30); break;
    case 32: case 33: selectSlot(1, eventId - 32); break;
  }
  publish(output);
}

// Tells the watch which HTML template (t.html) to show.
function getUserInterface() {
  return {
    template: 't'
  };
}

// Defines the info shown at the bottom of the exercise summary info shown after the exercise.
function getSummaryOutputs(input, output) {
}
