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

The core skill is lateral speed. Climb rate scales with how fast you are moving
sideways (up to +50%), and walls, hedges and laser lines drop with a single gap
deliberately placed on the far side of the screen from where you are. Hesitating
costs altitude; committing early and crossing at full speed is the whole game.

Stickers are lives. Each one patches exactly one prick, and a patch stays visible
on the balloon skin. Run out and the next sharp thing pops you.

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

## Toward a level designer

The pieces a designer would need are already separated: levels are data, sprites
are a registry keyed by name, and the runtime prefers fetched JSON over the baked
copy. A designer can be a page that produces the JSON above and either writes it
into `levels/` or hands it to `Game.start(levelObject)` directly for a live preview.

## Progress

Unlocked levels, best scores and your balloon choice are stored in `localStorage`
under `skyward.save.v1`. Reset from the level select screen.
