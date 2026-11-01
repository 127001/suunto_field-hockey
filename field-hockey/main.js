// Field hockey referee app: 4 quarters, score, time penalties.
//
// evaluate() is called once per second (+/- 5 ms) and is used as the game clock.
//
// Modes
//   READY  clock stopped, start of a quarter (shows full quarter time)
//   RUN    clock running (quarter counts down, penalties count down)
//   STOP   clock stopped during a quarter (injury, penalty corner review, ...)
//   BREAK  quarter ended: timer counts UP until the referee stops it,
//          stopping it starts the next quarter
//   END    final whistle of the 4th quarter
//
// Events sent from t.html (see onEvent)
//    1 start/stop clock        6 switch screen        7 reset clock (hold 5 s)
// Buttons: up = 1, next (middle) = 6, down held for 5 seconds = 7
//    2 edit home score   3 edit visitors score   (opens the edit screen)
//    4 edit arrow up (+1)   5 edit arrow down (-1)   8 confirm edit
//   10/11/12 home penalty 2/5/10 min   20/21/22 visitors penalty 2/5/10 min
//   30/31 select home penalty slot 1/2  32/33 select visitors penalty slot 1/2
//         (tapping the already selected slot again cancels its penalty)
//
// Penalty slots are independent: a duration only ever fills the selected slot.

var QUARTERS = 4;
var QUARTER_SECONDS = 17 * 60 + 30;
var WARN_SECONDS = 10;      // vibrate every second for the last 10 seconds
var ALARM_REPEATS = 3;      // alarm at 0 plays this many seconds in a row
var PENALTY_SECONDS = { 0: 120, 1: 300, 2: 600 };  // event offset -> seconds
var MAX_PENALTIES = 2;      // per team, at the same time

var READY = 0, RUN = 1, STOP = 2, BREAK = 3, END = 4;

// curView: 1 time and score, 2 penalties, 3 score edit
var mode, quarter, remaining, breakTime, alarmLeft, curView;
var editTeam, editVal;   // score being edited on the edit screen (0 home, 1 visitors)
var score;     // [home, visitors]
var pen;       // pen[team][slot] = seconds left, 0 = free
var sel;       // sel[team] = selected slot, the next duration goes there
var penLock;   // 1 after a penalty was set this second (ignores duplicate taps)

var resetGame = function() {
  mode = READY;
  quarter = 1;
  remaining = QUARTER_SECONDS;
  breakTime = 0;
  alarmLeft = 0;
  curView = 1;
  score = [0, 0];
  editTeam = 0;
  editVal = 0;
  pen = [[0, 0], [0, 0]];
  sel = [0, 0];
  penLock = 0;
};

// Selected slot is overwritten; afterwards selection moves to the other slot if that one is free.
var addPenalty = function(team, seconds) {
  if (penLock) return;
  penLock = 1;
  var slot = sel[team];
  pen[team][slot] = seconds;
  if (pen[team][1 - slot] <= 0) sel[team] = 1 - slot;
};

var selectSlot = function(team, slot) {
  if (sel[team] === slot) {
    pen[team][slot] = 0;   // second tap on the selected slot cancels it
  } else {
    sel[team] = slot;
  }
};

var openEdit = function(team) {
  editTeam = team;
  editVal = score[team];
  curView = 3;
};

var confirmEdit = function() {
  score[editTeam] = editVal;
  curView = 1;
};

var startStop = function() {
  if (mode === READY || mode === STOP) {
    mode = RUN;
    playIndication('StartTimer');
  } else if (mode === RUN) {
    mode = STOP;
    playIndication('StopTimer');
  } else if (mode === BREAK) {
    // Stopping the break timer starts the next quarter
    quarter++;
    remaining = QUARTER_SECONDS;
    breakTime = 0;
    mode = RUN;
    playIndication('StartTimer');
  }
};

// Back to the full quarter time, clock stopped. Score, quarter and penalties are kept.
var resetClock = function() {
  mode = READY;
  remaining = QUARTER_SECONDS;
  breakTime = 0;
  alarmLeft = 0;
  playIndication('Confirm');
};

var endQuarter = function() {
  alarmLeft = ALARM_REPEATS;
  breakTime = 0;
  mode = quarter >= QUARTERS ? END : BREAK;
};

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

var publish = function(output) {
  output.mode = mode;
  output.qtr = quarter;
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

function onLoad(input, output) {
  resetGame();
  publish(output);
}

function evaluate(input, output) {
  penLock = 0;
  if (mode === RUN) {
    remaining--;
    tickPenalties();
    if (remaining <= 0) {
      remaining = 0;
      endQuarter();
      playIndication('Interval', false, 2);  // alarm at 0 seconds
    } else if (remaining <= WARN_SECONDS) {
      playIndication('Info', false, 1);      // vibrating warning
    }
  } else if (mode === BREAK) {
    breakTime++;
    if (alarmLeft > 0) {
      alarmLeft--;
      if (alarmLeft > 0) playIndication('Interval', false, 2);
    }
  } else if (mode === END && alarmLeft > 0) {
    alarmLeft--;
    if (alarmLeft > 0) playIndication('Interval', false, 2);
  }
  publish(output);
}

function onEvent(input, output, eventId) {
  // Taps only count for the screen they belong to
  if (eventId >= 10 && eventId <= 33 && curView !== 2) return;
  switch (eventId) {
    case 1: startStop(); break;
    case 2: if (curView === 1) openEdit(0); break;
    case 3: if (curView === 1) openEdit(1); break;
    case 4: if (curView === 3) editVal++; break;
    case 5: if (curView === 3 && editVal > 0) editVal--; break;
    case 6: curView = curView === 2 ? 1 : (curView === 1 ? 2 : 1); break;  // middle button, also cancels an edit
    case 7: resetClock(); break;
    case 8: if (curView === 3) confirmEdit(); break;
    case 10: case 11: case 12: addPenalty(0, PENALTY_SECONDS[eventId - 10]); break;
    case 20: case 21: case 22: addPenalty(1, PENALTY_SECONDS[eventId - 20]); break;
    case 30: case 31: selectSlot(0, eventId - 30); break;
    case 32: case 33: selectSlot(1, eventId - 32); break;
  }
  publish(output);
}

function getUserInterface() {
  return {
    template: 't'
  };
}

// Defines the info shown at the bottom of the exercise summary info shown after the exercise.
function getSummaryOutputs(input, output) {
}
