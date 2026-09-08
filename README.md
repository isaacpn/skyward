# Skyward

A single-page HTML5 game. You are a balloon climbing through the atmosphere while
everything up there tries to pop you. All graphics are SVG generated at run time,
all sound is synthesised with the Web Audio API, and there are no external assets
or dependencies.

Open `index.html` in a browser. That is the whole game.

## Playing

| Action | Keys |
| --- | --- |
| Steer left / right | Arrow keys, `A` / `D`, or drag anywhere on touch |
| Nudge up / down | Up / Down arrows, `W` / `S` |
| Pause | `Esc` or `P` |
| Mute | `M` |

On touch, drag anywhere: the balloon steers toward your finger, so you can hold
it low on the screen and still aim. The game pauses itself when the tab is
hidden or loses focus, so a phone call does not cost you a run.

The core skill is lateral speed. Climb rate scales with how fast you are moving
sideways (up to +50%), and walls, hedges and laser lines drop with a single gap
deliberately placed on the far side of the screen from where you are. Hesitating
costs altitude; committing early and crossing at full speed is the whole game.

Stickers are lives. Each one patches exactly one prick, and a patch stays visible
on the balloon skin. Run out and the next sharp thing pops you.

## The play field adapts to the screen

There is no fixed canvas. `Layout.apply()` reshapes the world to whatever
viewport it lands in, and everything downstream reads scale factors instead of
hard numbers.

| Viewport | Field | Notes |
| --- | --- | --- |
| Desktop, at least 901px wide and 5:4 or wider | 800 x 600, framed | the field the levels were tuned on |
| Phone portrait, 375 x 812 | 481 x 1002, full bleed | narrow world keeps sprites thumb-sized |
| Phone landscape, 812 x 375 | 800 x 533, full bleed | short world, so hazard density is eased |
| Tablet, small windows | in between | aspect follows the screen |

- `kx` scales horizontal speeds, wind, drift and barrier gaps, so crossing the
  screen takes the same time on every field.
- `ky` scales fall speeds, so a hazard takes the same time to reach you.
- `k` (`kx^0.45`) scales sprites, deliberately blunted: a strictly proportional
  balloon would be 16px across on a phone.
- `Game.computeEase()` compares balloon area against field area and thins the
  spawn rate when a field is more crowded than the 800 x 600 baseline. A short
  landscape phone gets about 13% fewer hazards; nothing ever gets denser than
  baseline.

Rotating the phone calls `Game.reflow()`, which rescales the live game in place
(entities, barrier gaps, bolt columns, the player) rather than restarting, so a
run survives an orientation change.

## Levels

Each level is its own JSON file in `levels/`, listed in `levels/index.json`.

When the page is served over HTTP, levels are fetched at run time, so dropping a
new JSON file in and adding it to `index.json` puts it in the game on reload.
Opened straight from disk, `file://` blocks `fetch`, so the same JSON is baked
into `index.html` by the build step below.

### Level schema

```jsonc
{
  "id": 3,                       // unique, also the key used for best scores
  "name": "Breezy Ridge",
  "subtitle": "The air has opinions",
  "hint": "Shown on the briefing, the pause screen and after a pop.",
  "targetAltitude": 1000,        // metres to clear the level
  "climb": 55,                   // base climb, m/s, +50% at full lateral speed
  "scroll": 105,                 // world scroll speed, px/s (everything falls at this + its own speed)
  "startStickers": 3,            // lives, before the balloon type bonus
  "wind": { "base": 20, "gust": 70, "period": 7 },   // px/s^2-ish, sinusoidal gust over `period` seconds

  "theme": {
    "sky": ["#57b6ea", "#dceffb"],   // top and bottom of the sky gradient
    "light": "day",                  // day | dusk | storm | night (tints the cloud bands)
    "sun": true,                     // sun disc; night draws a moon instead
    "particles": "leaves",           // none | rain | snow | leaves | pollen | dust | stars
    "cloudBands": 4,                 // parallax cloud layers
    "flash": false                   // lightning lights the whole screen
  },

  "spawners": [
    {
      "sprite": "bird",        // any key in the sprite registry, see below
      "from": 0.2,             // start at 20% of the climb (default 0)
      "to": 1.0,               // stop at 100% (default 1)
      "every": 2.3,            // seconds between spawns
      "jitter": 0.7,           // +/- randomness on that interval
      "count": 3,              // spawn a cluster
      "spread": 70,            // px between cluster members
      "props": {
        "speed": 34,           // extra fall speed on top of `scroll`
        "drift": 40,           // constant horizontal drift, px/s
        "sway": { "amp": 26, "freq": 0.6 },   // sine weave
        "chase": 55,           // px/s of horizontal tracking toward the player
        "push": 70,            // force applied by soft hazards and gusts
        "lift": 55,            // free altitude per second, updrafts only
        "gap": 190,            // opening width, barriers only
        "style": "hedge",      // hedge | string | hail | ice | thorn | laser
        "width": 30,           // bolt column width
        "warn": 0.9,           // bolt telegraph, seconds
        "strike": 0.3,         // bolt lethal window, seconds
        "damage": 1,           // 0 makes any hazard harmless
        "scale": 1
      }
    }
  ]
}
```

### Sprites

Defined in `src/20-sprites.js`. Each entry is pure SVG markup plus the numbers the
simulation needs, so adding a hazard is one entry, no engine changes.

| kind | behaviour | sprites |
| --- | --- | --- |
| `hazard` | costs a sticker on contact | `bird` `twig` `kite` `hail` `icicle` `burr` `spark` `meteor` `shard` `drone` `orb` |
| `soft` | shoves you, never punctures | `leaf` |
| `barrier` | full-width band with one gap | `barrier` (six styles) |
| `bolt` | telegraphed column, then a lethal strike | `bolt` |
| `zone` | continuous force while overlapping | `gust`, `updraft` |
| `pickup` | +1 sticker, or points at full stickers | `sticker` |
| `decor` | no effect | `cloud` |

`drone` and `orb` set `tracks`, meaning they steer toward the player via `chase`.

## Build

`index.html` is generated. Sources live in `src/`, in load order:

- `src/shell.html` - markup, CSS, all screens
- `src/10-core.js` - helpers, audio, save data, balloon catalogue and SVG
- `src/20-sprites.js` - the sprite registry
- `src/30-game.js` - simulation: physics, spawning, collisions, scoring
- `src/40-ui.js` - level loading, screens, input, main loop
- `src/90-tail.html` - sprite animation CSS, closing tags

Rebuild after editing anything in `src/` or `levels/`:

```bash
bash tools/build.sh
```

That concatenates the sources and splices every `levels/*.json` file into the
`EMBEDDED_LEVELS` array so the page still works from `file://`.

## Testing levels

`tools/test-levels.js` plays every level with an avoidance bot and reports
whether it is completable, how much damage it takes and whether anything threw.
Open the game, paste the file into the console, then:

```js
await SkywardTest.run()                        // all levels, current viewport
await SkywardTest.run({from: 8, to: 12, runs: 3})
```

It also lints each level: unknown sprite names, unknown barrier styles (which
otherwise fall back silently to the laser look), barriers with no gap, and
missing theme or altitude fields.

Resize the window between runs to test a field shape. What a healthy ladder
looks like: the bot clears levels 1-5 every time taking no damage, and drops to
roughly half its runs by level 12 with four or five hits. If a mid-ladder level
kills it every time, that level is leaning on undodgeable density rather than
on skill.

## Toward a level designer

The pieces a designer would need are already separated: levels are data, sprites
are a registry keyed by name, and the runtime prefers fetched JSON over the baked
copy. A designer can be a page that produces the JSON above and either writes it
into `levels/` or hands it to `Game.start(levelObject)` directly for a live preview.

## Progress

Unlocked levels, best scores and your balloon choice are stored in `localStorage`
under `skyward.save.v1`. Reset from the level select screen.
