## 09 / Design cameras and a short shot sequence

Make a purposeful shot list: an establishing view, a medium view that explains the action, and selected closeups that reveal worthwhile detail. Choose only the shots needed to tell the story. Avoid multiple nearly identical angles.

Match focal length and camera height to the intended perspective. Keep focus on the subject and use depth of field sparingly enough to preserve context. Provide comfortable editorial handles and let shots breathe; do not default to tiny one-second fragments.

For motion, use a controlled dolly, orbit, push-in, or restrained handheld treatment. Ease camera starts and stops. Keep motion readable, check wall and object intersections, and avoid random shaking. Show a low-cost camera animatic before final lighting renders. Do not change scene layout to conceal a camera mistake.



## 10 / Plan animation before rendering it

Ask which action serves the scene: no object animation, controlled levitation, a vortex or other stylized effect, or an action I describe. Translate the choice into visible beats with timing: anticipation, onset, development, peak, release, and settle.

Prefer editable keyframes and procedural controls for art-directed motion. Use rigid bodies, cloth, fluid, or particle simulation when their physical behavior is needed and the cost is justified. Describe the actual technique accurately: keyed trajectories, shape-key deformation, and noise-driven volumes are not automatically physics simulations.

Test one representative object or a two-to-four-second section first. Approve timing and movement with a lightweight preview before expensive materials, volumes, or final samples. Review the entire motion, not just an attractive still frame. Keep frame rate fixed; do not change it later without discussing timing and audio consequences.

### Levitation / reusable movement rules

Start from the approved resting layout. Fix clearances in that layout rather than sliding objects sideways unexpectedly as they lift. Keep structural elements and heavy anchors grounded unless the story explicitly requires them to move.

Animate each prop as a complete hierarchy. Give objects staggered starts, varied lift heights, independent tilt, angular motion, and gentle drift. Avoid making everything rise together, remain perfectly upright, or rotate as a single rigid group. Preserve enough coherence that the motion still feels driven by one event.

Build anticipation, lift, float, release, fall, impact, and settle as clear phases. Match position and velocity at transitions so an object does not jump or stop abruptly. Ease rotation through descent instead of suddenly snapping back to its resting orientation. Inspect curves for unwanted overshoot and unintended extra bounces.

Respect support relationships: an object on a stack should lift clear before the support moves and should land only after its support is ready. Give collisions, bounce height, damping, and settling behavior appropriate to the material and intended style. A ball should finish bouncing; a grounded book or large piece of furniture should stay grounded if specified.

Check object-to-object and room clearance across the full timeline, with closer or subframe inspection at fast or tight passes. Simple bounding-box checks are only screening; verify the visible mesh where collisions are plausible. Show early, middle, and late poses plus a real-time motion preview.

### Vortex / reusable effect-building rules

Start with a short, readable flow test in the available space. Define the center, radius, height, rotation direction, buildup, and decay. Give objects independent phase, angular speed, radius, vertical motion, and turbulence. Avoid perfectly circular identical orbits, rigid-group rotation, teleporting loops, and sudden resets.

Layer the effect by scale: a few readable hero objects, medium tumbling debris, smaller fragments, fine luminous particles, and sparse streaks. Vary density and speed through space. Keep foreground, middle distance, and background distinct through perspective, occlusion, blur, and restrained atmosphere.

For an object joining the flow, smoothly blend from its existing trajectory into the new motion. Carry its velocity into the transition. Do not make it accelerate dramatically and then freeze when it reaches the effect. For release or a gravity drop, plan the exit trajectory, landing, and settle rather than merely turning the effect off.

Use editable deformation for controlled paper curls, peeling corners, and flutter when that meets the shot. Preserve attachment points and UVs. Add a cloth or fluid solve only when a visible requirement calls for it. Keep loose fabric from intersecting or projecting through furniture. Simulated elements need appropriate scale, collision settings, time steps, preroll, stable seeds where available, and a saved cache.

Keep the main environment readable. Preserve physical occlusion and contact, use genuine shutter motion blur where supported, and integrate restrained interactive lighting. Thin streaks should not become thick neon tubes unless requested. Glow and fog must not conceal broken trajectories. Compare chronological frames and moving previews, then fix the largest mismatch before adding more particles.



## Optional liquid-glass finishing
Create localized clear refractive streams spiraling with the vortex. Keep most of the image stable. Use a soft animated stream mask and smooth displacement; add a smaller difference between RGB displacement strengths for prism edges. Avoid separated copies of objects. Respect foreground occlusion and ramp the effect in only after the vortex forms. Slow the stream animation with any time-stop beat. Test on a short existing render before applying to the cut. This is a compositing direction, not a bundled Fusion preset.
