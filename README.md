# suunto_field-hockey

SuuntoPlus app for field hockey referees. The app lives in [`field-hockey/`](field-hockey/) and is built and tested with the SuuntoPlus Editor extension for VS Code.

## Version 0.1

- 4 quarters of 17:30, counting down
- Break timer between quarters that counts up; the first press of the top button prepares the next quarter, the second starts it
- Short vibration every second for the last 10 seconds of a quarter, a single alarm at 0:00
- Score for home and visitors
- Time penalties of 2, 5 or 10 minutes, two slots per team, counting down with the game clock

## Screens

1. **Time and score**: quarter, state, game clock and both scores. A green triangle next to the top button means the clock is stopped (press to start), a red square means it is running (press to stop)
2. **Penalties**: two independent slots per team
3. **Score edit**: opened by tapping a score

## Before you start

**Touch must be enabled on the watch.** Scores and penalties can only be set by tapping the screen. Suunto watches can disable touch during an exercise, and then the taps do nothing. In the watch settings, set the touch screen to always on, or on during exercise, before you start the workout.

## Controls

| Control | Action |
|---|---|
| Top button | Start / pause the clock. After a quarter ends: first press prepares the next quarter (full time, stopped), second press starts it |
| Bottom button, short press | Switch between time/score and penalties; cancels a score edit |
| Middle button | Not used by the app, so the watch menu stays available to leave the app |
| Bottom button, hold 5 s | Reset the clock of the current quarter to 17:30 (score and penalties are kept) |
| Tap a score | Open the score edit screen |
| Edit screen arrows / OK | Change the score / save it and go back |
| Penalties: tap a slot | Select the slot; tap the selected slot again to cancel its penalty |
| Penalties: 2' / 5' / 10' | Put that penalty in the selected slot |

Start the workout on the watch before the match. Pause the game clock with the top button, not by pausing the exercise.

## Files

- `field-hockey/main.js`: game clock, score, penalties and alerts
- `field-hockey/t.html`: the three screens
- `field-hockey/manifest.json`: app definition, outputs and images
