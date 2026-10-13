# Look bible

## The target, in one line
Clean, stylized-realistic CGI (Ramanujan-film characters, OpenKnight staging) lit like the
*Birdcage* still: warm practicals glowing against deep teal night, haze, halation, a lived-in mess.

## What the *Birdcage* still does (and how we copy it)
| Trait | What it is | Our implementation |
|---|---|---|
| Warm key practical | Desk lamp pooling amber on the desk and figure | `Desk_Lamp` spot (2700 K) in `lighting.apply`, on in 3am/4am |
| Cool screen light | Monitors and laptop throw white-cyan onto the face | Laptop area light + both screens emissive |
| Teal-blue ambient | Shadows never go black; they sit in deep blue-green | Night sky gradient, city spill panels, mist pass tinted teal in the compositor |
| Halation | Highlights bleed red-orange into the dark around them | Second low-threshold, wide, orange-tinted bloom in `film_look` |
| Glow + streaks | Soft bloom on every source, slight horizontal streak | Bloom + 2-streak anamorphic glare (from the OpenKnight analysis) |
| Atmosphere | Air is visible: haze, floating dust catching light | Room volume scatter (density ~0.01) + 650 dust motes near the desk |
| Foreground framing | Big leaves out of focus frame the subject | Monstera by the east window and a small one by the desk; shoot through them |
| Grain | Fine, even film grain | `tools/post_grain.py` (deterministic per frame) |
| Mess with order | Lots of objects, but grouped where the person lives | Clutter concentrated on and around the desk, thinning with distance |

## From "5 Ways to Create Better Environments" (applied, not copied)
1. **Reference on screen while building.** Every gate compares against `reference/`.
2. **Composition and lighting first.**
   - Each story shot is a fixed camera in `set_intro.py` (`SHOTS`).
   - We judge the 2D frame, not the 3D scene.
   - Tools in use: thirds (Ivan's head on the upper third in `face`), leading lines (desk edge and cables into the laptop), framing (plants, shelf edge, doorframes).
3. **Model separately from scene building.** Props are generator functions in `blender/lib/props_*.py`; set dressing just places them.
4. **Simple shapes with good materials.** Most props are boxes, lathes and tubes; the procedural materials and lighting do the work.
5. **Simple camera moves.** Two keyframes, a slow push or drift, plus a little handheld noise. See `blender/lib/controls.py`.

## Character look (Ivan)
- **Proportions:** sheet first: tall, thin, long face, high cheekbones, strong straight nose, visible ears.
- **Skin:** warm, subsurface scattering, crease darkening (AO), redness on cheeks, nose and ears, fine pores. Never waxy white.
- **Hair:** short back and sides, longer top swept back and across from a left part, lift at the front, in clumps rather than a helmet.
- **Glasses:** thin round dark frames, clear lenses that reflect the screens.
- **Clothes:**
  - boxy off-white knit crew-neck with a ribbed hem and cuffs;
  - white shirt collar showing in the neckline;
  - dark pleated wide trousers;
  - brown leather derbies.
