# Ivan's room: hero frames and how the camera finds them

Reference: `ref/mood/frames_window_reverse.webp`, split into `hero_window.png` and `hero_reverse.png`.

## What makes those frames work
- **Layers:** a soft foreground (desk edge, laptop, plant) → a mid-ground silhouette (the chair, Ivan) → a detailed, softly lit background wall. Every frame has all three.
- **The background is a story wall,** not empty paint: a door with a hoodie and headphones, a poster, a corkboard, gadgets with tiny LEDs, a wardrobe with sticky notes. Read in a second, never centre-lit.
- **Light:** one amber practical per frame side (never in the middle), the screens as the coolest and brightest thing, small coloured LED points, deep green walls that hold a soft gradient. Nothing is evenly lit.
- **Render:** soft focus on everything but the subject, gentle bloom on sources only, rich darks (navy and green, never grey).

## Our two hero frames (keyframes.json H1, H2)
| | Camera | Composition |
|---|---|---|
| **H1 · Window wall** | From the door side at desk height (x 3.95, 1.15 m), 24 mm f/2.8, centred on the window | The window centred and brightest; the desk and monitors under it; the amber lamp left (nightstand), the bookshelf and guitar right; the bed foot and rug in the soft foreground |
| **H2 · Reverse from the desk** | On the desk, left of the laptop (0.85, 4.62, 1.02), 30 mm f/2, looking south-east | The laptop and desk edge blurred in front, the chair as a silhouette, the east "story wall" behind (door with hoodie and headphones, film poster, corkboard, console with a 3D printer, NAS LEDs, game console, small lamp), the wardrobe at the left edge |

## Camera behaviour for these frames
- H1: a slow push-in (0.3 m over the shot) toward the window; focus stays on the monitors.
- H2: locked off on the desk, a focus pull from the laptop edge to the story wall as Ivan leans back (S5 "because he could").
- Cuts alternate H1 (the world outside, alone) and H2 (his world inside), with the existing close shots between.
