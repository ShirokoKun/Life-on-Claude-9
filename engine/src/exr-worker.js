// Decodes one OpenEXR lightmap off the main thread with three's own EXRLoader.parse (see exr.js).
// Workers ignore the page's import map, so EXRLoader's bare 'three' import is pointed at the vendored build.
const base = new URL('../vendor/three/', import.meta.url).href;
const ready = (async () => {
  const src = (await (await fetch(base + 'examples/jsm/loaders/EXRLoader.js')).text())
    .replace("from 'three'", `from '${base}build/three.module.js'`)
    .replace("from '../libs/fflate.module.js'", `from '${base}examples/jsm/libs/fflate.module.js'`);
  return (await import(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })))).EXRLoader;
})();

self.onmessage = async ({ data: { url } }) => {
  try {
    const EXRLoader = await ready;
    const buf = await (await fetch(url)).arrayBuffer();
    const { width, height, data, format, type, colorSpace } = new EXRLoader().parse(buf);
    self.postMessage({ width, height, data, format, type, colorSpace }, [data.buffer]);
  } catch (e) {
    self.postMessage({ error: String(e && e.message || e) });
  }
};
