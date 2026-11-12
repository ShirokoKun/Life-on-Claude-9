// node tools/eval.mjs "<js expression evaluated in the page>" [extra query]
import puppeteer from 'puppeteer-core';
const exe = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await puppeteer.launch({ executablePath: exe, headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'], defaultViewport: { width: 640, height: 360 }, protocolTimeout: 600000 });
const page = await browser.newPage();
// no HMR socket: a file saved elsewhere must not reload the page in the middle of a bake / render
await page.evaluateOnNewDocument(() => { window.WebSocket = class { constructor() { this.readyState = 3; } addEventListener() {} removeEventListener() {} send() {} close() {} }; });
page.on('pageerror', (e) => console.log('PAGEERROR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('ERR ' + m.text().slice(0, 300)); });
await page.goto('http://127.0.0.1:5319/?shot=1' + (process.argv[3] ? '&' + process.argv[3] : ''), { waitUntil: 'load' });
await page.waitForFunction('window.__ready || window.__error', { timeout: 600000, polling: 300 });
console.log(await page.evaluate(`(async()=>{ const r = await (${process.argv[2]}); return typeof r === 'string' ? r : JSON.stringify(r); })()`));
await browser.close();
