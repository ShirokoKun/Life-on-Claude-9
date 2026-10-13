# World bible: Ivan's apartment

Scope: **the intro chapter** ("It's 3 AM…" up to "…doesn't know what he's supposed to do now").
The set is built once and dressed in **states**, so later chapters reuse it.

Tags: **[S]** stated in the script (section in brackets) · **[I]** inferred by us (reason given) · **[F]** planted now, pays off in a later chapter.

## 1. The world

| Question | Answer | Source |
|---|---|---|
| Where | A US East Coast city, in a mid-rise apartment building | [S] "the whole Eastern seaboard" (The Spread); "his city" |
| Floor | About the 6th–8th floor. He looks down on a parking lot and out to a far horizon. | [S] "before her car has left the parking lot" (Building Faster); "He goes to the window. Darkness in every direction" (The End) |
| Who | Software engineer, well paid but not yet rich. Lives alone; has a girlfriend who doesn't live with him. | [S] Building Faster, Small Miracles |
| When | Present day, about two days into the binge | [S] "It started two days ago" |
| Intro time span | 3 AM, then 4 AM, then sunrise (one continuous night) | [S] |
| Mood of the room in the intro | Lived-in and slipping. Not filthy, but two days of neglect sitting on a normal guy's tidy-ish flat. | [I] Later chapters have him stop showering and eating; the intro is the *start* of the slide. |

## 2. The arc of the room across the film (why we build in states)

| State | Chapter | Room |
|---|---|---|
| `intro_3am` / `intro_4am` / `intro_sunrise` | Intro | Ordinary flat, desk clutter growing, laptop only |
| `loop_decay` | Building Faster → The Loop | Dishes, unopened mail, a mic on the desk, more screens |
| `optimized` | Small Miracles → The Spread | **Immaculate**: cleaning robot, smart thermostat at 68.5°, dimmed "cortisol" lighting, hum in the walls |
| `blackout` / `flash` | The End | No power, radio, window blows in |

We build **only the intro states now**, but we model the slots (thermostat, shelf, outlets, window panes) so later states drop in.

## 3. Prop list: intro chapter

### Hero zone (desk), at the highest detail
| Prop | Tag | Detail that sells it |
|---|---|---|
| Desk | [S] "on his desk" | Wood or laminate. Coffee rings, a charger cable over the edge, a cheap mouse pad. |
| Laptop | [S] | Screen shows a **terminal, a Claude chat and a sprawl of Python files** [S]. Keys worn shiny on WASD/space. Fingerprints on the lid. |
| Glass of water, full, poured 6 h ago | [S] the key image of the intro | **Tiny air bubbles clinging inside the glass** (what really happens to water left out), a faint dust film on top, the water line exactly full. It must read as *untouched*. |
| Coffee mugs ×3–4, staggered levels | [I] "hands shake from too much coffee" | One empty with a dried ring, one half-full cold with a skin, one fresh-ish. A count of mugs = how long he's been there. |
| Lunch remains | [I] "hasn't eaten since lunch" | A takeaway container or wrapper pushed aside, unfinished. The only food in the room, and it's 14 h old. |
| Phone | [S] girlfriend "stopped texting" | Face up. The lock screen shows her messages **trailing off** with timestamps that get further apart, then stop. |
| Notebook + pen | [I] he is designing a system | A hand-drawn pipeline: `parse → classify → draft → review`, with "review and approve" underlined [S]. |
| Office chair that reclines | [S] "leans back in his chair" | Mesh/high-back (storyboard 05). A hoodie or sweater thrown over the back. |
| Desk lamp | [I] | **Off.** He's working by screen light alone, which is the storyboard's look. |
| Clock | [I] the time motif: 3 AM, 4 AM, sunrise, "time has become slippery" | A cheap analog wall clock in the desk sightline, so we can *show* 3:00 → 4:00 → ~6:10 without dialogue. The laptop menu bar shows the same time. |

### Living space (seen in wide shots), mid detail
| Prop | Tag | Note |
|---|---|---|
| Bean bag, long floor lamp, drawer with books | [S] floor plan | The lamp stays off at night. |
| A book with a bookmark stuck early | [F] "tries to read a book but can't focus" (Building Faster) | |
| Bostrom's *Superintelligence* on the shelf | [F] "He's read Nick Bostrom" (The Loop) | We design our own cover, not the real one. |
| Small battery radio on a shelf | [F] "according to his battery-powered radio" (The End) | Chekhov's radio. |
| Framed photo of Ivan and his girlfriend | [I][F] her arc runs through the whole script | |
| Plain wall thermostat | [F] "exactly 68.5 degrees" | Dumb in the intro; becomes the smart unit in `optimized`. |
| Large window / glass balcony door | [S] floor plan + The End | Big panes, because they explode later. City view outside. |
| Dining table + 2 chairs | [S] floor plan | Unused: mail and a laptop bag dumped on it. |
| Kitchen | [S] floor plan | Coffee maker with an inch left in the pot [I]. Sink with mugs. Fridge mostly empty [I]. |

### Glimpsed through doors, low detail
Bedroom (bed **made and unslept**, which says "he hasn't slept" [I]), bedside lamp, both toilets (the floor plan shows a shower in one; *The Spread* mentions a bath, so the other gets a tub [F]), shoe rack, main door.

### Outside the window
A night city of mid-rises with lit windows (interior-mapping shader, as in the reference), a **parking lot directly below** [S], streetlights, and an open horizon line [S, The End]. At sunrise: a sky gradient with sun hitting the upper floors first.

## 4. Light sources (everything is motivated)

| Source | 3 AM | 4 AM | Sunrise |
|---|---|---|---|
| Laptop screen (key) | Cold blue-white, the only key light | Same; brightness up and the room darker by contrast | Washed out by daylight |
| City spill through the window | Sodium/LED mix, low | Lower (fewer lit windows) | Off |
| Phone | Brief notification flashes | — | — |
| Appliance LEDs (router, charger, coffee maker clock) | Tiny points of colour | Same | Invisible |
| Sky / sun | — | Faint blue hour starts | **Warm, low-angle sun across the desk** |

**Orientation proposal:** the right-hand window on the floor plan faces **east**, so sunrise rakes across the desk and the dining zone. This matches storyboard 04's warm sunrise panel.

## 5. Ivan in the intro (variant of the character sheet)

- Base: the character sheet (round glasses, side part, white crew-neck over a collared shirt, dark trousers).
- Intro wear: sweater sleeves pushed up, collar half out, **hair un-parted and finger-raked**, two days of stubble, dark under-eyes, **bloodshot sclera**, socks without shoes.
- Glasses: smudged lenses with **the laptop screen reflected in them**. That's the hero detail of the face shots (storyboard 04, panel 3).
- Body language: hunched, shoulders forward, typing hard and fast. At 4 AM a slight hand tremor. At sunrise he leans back, slack.
