# suunto_field-hockey

SuuntoPlus app for field hockey referees. The app lives in [`field-hockey/`](field-hockey/) and is built and tested with the SuuntoPlus Editor extension for VS Code.

## Version 0.1

- 4 quarters of 17:30, counting down
- Break timer between quarters that counts up; stopping it starts the next quarter
- 10 second vibrating warning at the end of a quarter, alarm at 0:00
- Score for home and visitors
- Time penalties of 2, 5 or 10 minutes, two slots per team, counting down with the game clock

## Screens

1. **Time and score**: quarter, state, game clock and both scores
2. **Penalties**: two independent slots per team
3. **Score edit**: opened by tapping a score

## Controls

| Control | Action |
|---|---|
| Top button | Start / pause the clock (also starts the next quarter during a break) |
| Middle button | Switch between time/score and penalties; cancels a score edit |
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
