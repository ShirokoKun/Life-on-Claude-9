// The headless Chromium the render tools share. It keeps one browser profile per GPU mode in studio/.local/,
// so the compiled shaders survive between runs: a warm start is ready in ~13 s with a ~2 s first frame, against
// ~35 s and ~17 s from a fresh profile (GTX 1650 laptop). A second run while the profile is busy (two capture
// loops side by side) falls back to a fresh profile.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const GPU_ARGS = ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=default', '--force_high_performance_gpu'];   // two-GPU laptops: the discrete one
export const SOFT_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

export async function openPage({ gpu, w, h, headless = true, args = gpu ? GPU_ARGS : SOFT_ARGS }) {
  const viewport = { width: w, height: h };
  const dir = path.join(ROOT, 'studio', '.local', `chromium-${gpu ? 'gpu' : 'soft'}`);
  try {
    fs.mkdirSync(dir, { recursive: true });
    const ctx = await chromium.launchPersistentContext(dir, { args, headless, viewport });
    const page = ctx.pages()[0] || await ctx.newPage();
    return { page, close: () => ctx.close() };
  } catch (e) {
    console.log(`shader cache busy or unavailable (${e.message.split('\n')[0]}); using a fresh profile`);
    const browser = await chromium.launch({ args, headless });
    return { page: await browser.newPage({ viewport }), close: () => browser.close() };
  }
}
