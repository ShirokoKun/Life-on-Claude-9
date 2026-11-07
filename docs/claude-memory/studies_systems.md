---
name: studies_systems
description: Where the standalone style studies live (PS1 subway, abstract AAA environment) and their reusable libs, separate from the locked film look
type: project
---
Style studies live in engine/studies/<name>/ (own index.html, open via npm run serve then /studies/<name>/). Shared code in engine/studies/lib/ (ps1.js: low-res + dither + vertex snap + pixel texture painter + bitmap font; cine.js: AAA post stack, fog cards, light shafts, wet surfaces). Render with tools/study_render.mjs. Docs: docs/STUDIES.md.
Why: these looks differ from the locked film LOOK in engine/src/post.js, so they must never touch the engine core.
How to apply: new style explorations go here; don't import engine/src/post.js LOOK into them, and don't change the film's locked look for them.
