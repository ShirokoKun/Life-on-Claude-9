// Live screens: the laptop (editor, terminal, Claude chat) and the monitor (the email pipeline) are
// drawn every frame into canvas textures, deterministic in t, so what is on screen follows the story
// and the text appears under Ivan's fingers (keystroke times come from the Blender performance,
// assets/acting.json).
//   laptop  1600 x 1000 px  = 0.288 x 0.180 m
//   monitor 1600 x  900 px  = 0.596 x 0.336 m
// screenPoint(which, px, py) returns the world position of a pixel, for focus pulls that read line by line.
// Other scenes pass their own draw functions: createScreens(root, acting, { laptop(g, t, keys), monitor(g, t) }).
import * as THREE from 'three';

export const MONO = '"DejaVu Sans Mono", "JetBrains Mono", Consolas, Menlo, monospace';   // Consolas before Menlo: a Mac with the transfer fonts draws what Windows draws
export const SANS = 'Inter, "DejaVu Sans", "Segoe UI", Helvetica, Arial, sans-serif';
export const C = {
  bar: '#0f1117', ed: '#161922', side: '#12141b', gutter: '#4b5263', txt: '#d7dae0', kw: '#c678dd', str: '#98c379',
  com: '#5c6370', fn: '#61afef', num: '#d19a66', term: '#0b0c10', ok: '#8fdc9a', warn: '#e5c07b', chat: '#f0eee6',
  bubble: '#e4e0d4', ink: '#2b2a27', claude: '#d97757', blue: '#7fb2ff', grey: '#8a8f99',
};

// ------------------------------------------------------------------ the story on the laptop
const BASE_CODE = [
  'import smtplib',
  'from pipeline import triage, draft_reply, queue_for_review',
  'from pipeline.log import log',
  '',
  'THRESHOLD = 0.90   # under this, Ivan reads it first',
  '',
];
// typed during the editor windows, three characters per keystroke (autocomplete does the rest)
const TYPED_CODE = [
  'def auto_send(draft, conf):',
  '    if conf < THRESHOLD:',
  '        return queue_for_review(draft)',
  '    msg = draft.render(signature="Ivan")',
  '    smtp.send_message(msg)',
  '    log.ok(f"sent {msg.id} -> {msg.to}")',
  '    return msg',
  '',
  'def run(inbox):',
  '    for m in triage(inbox)["reply"]:',
  '        draft, conf = draft_reply(m)',
  '        auto_send(draft, conf)',
  '',
  'def test_low_confidence_waits():',
  '    assert auto_send(fake(0.4), 0.4) is None',
].join('\n');
const CHAT_HISTORY = [
  ['you', 'triage works. 214 emails in 3.8 s'],
  ['claude', 'Nice. 61 of them need a reply. I can draft those in your tone and queue them for review.'],
  ['you', 'the drafter works. can we do calendar next?'],
  ['claude', "Yes. Here's a calendar_sync module: it reads your invites, finds conflicts, and proposes new times. You approve each change, same as the emails."],
  ['you', 'no. keep going.'],
];
const ASK = 'can it send on its own when it is sure?';
const ANSWER = 'It can. Add a confidence gate: anything under 0.90 stays in your review queue, everything above sends itself and gets logged. ' +
  'Start with replies only, and keep the threshold high for the first week.\n\n' +
  '    if conf >= THRESHOLD:\n        smtp.send_message(msg)\n\n' +
  'I wrote two tests for it below. Run them before you turn it on.';
const FILES0 = ['triage.py', 'classify.py', 'drafter.py', 'review.py', 'calendar_sync.py', 'config.yaml', 'prompts/'];
const FILES_LATER = [[0.4, 'auto_send.py'], [10.0, 'smtp_client.py'], [16.4, 'confidence.py'], [22.4, 'tests/test_auto_send.py'], [25.0, 'deploy.sh']];
const TERM = [
  [0.0, '$ python review.py --batch 20', C.ok],
  [0.0, '[20/20] approved   [0] edited   [0] rejected', C.warn],
  [0.0, '$ python calendar_sync.py --dry-run', C.ok],
  [0.0, '3 conflicts found -> proposing new slots', C.txt],
  [25.05, '$ pytest tests/test_auto_send.py -q', C.ok],
  [25.6, '.......                                         [100%]', C.ok],
  [25.9, '7 passed in 0.41s', C.ok],
];
const DEPLOY = './deploy.sh --auto-send';

// ------------------------------------------------------------------ helpers (shared with other scenes)
export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const smooth = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
export function keysIn(keys, t0, t1, t) { let n = 0; for (const k of keys) if (k >= t0 && k < t1 && k <= t) n++; return n; }

const KW = /^(def|return|if|for|in|import|from|is|None|assert|not|and|or|True|False)\b/;
export function drawCode(g, line, x, y, cw) {
  // a small tokenizer: keywords, strings, comments, calls, numbers
  let i = 0;
  while (i < line.length) {
    const rest = line.slice(i);
    let m, col = C.txt, tok;
    if (rest[0] === '#') { tok = rest; col = C.com; }
    else if ((m = /^(f?"[^"]*"?)/.exec(rest))) { tok = m[1]; col = C.str; }
    else if ((m = KW.exec(rest))) { tok = m[1]; col = C.kw; }
    else if ((m = /^([A-Za-z_]\w*)(?=\()/.exec(rest))) { tok = m[1]; col = C.fn; }
    else if ((m = /^(\d+\.?\d*)/.exec(rest))) { tok = m[1]; col = C.num; }
    else if ((m = /^([A-Za-z_]\w*|\s+|.)/.exec(rest))) { tok = m[1]; }
    g.fillStyle = col; g.fillText(tok, x + i * cw, y); i += tok.length;
  }
}
export function wrap(g, text, maxW) {
  const out = [];
  for (const para of text.split('\n')) {
    if (/^ {4}/.test(para) || para === '') { out.push(para); continue; }
    let cur = '';
    for (const w of para.split(' ')) {
      const tryS = cur ? cur + ' ' + w : w;
      if (g.measureText(tryS).width > maxW && cur) { out.push(cur); cur = w; } else cur = tryS;
    }
    out.push(cur);
  }
  return out;
}
export function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }

// ------------------------------------------------------------------ laptop
export function drawLaptop(g, t, keys) {
  const W = 1600, H = 1000;
  g.fillStyle = C.ed; g.fillRect(0, 0, W, H);
  // menu bar
  g.fillStyle = C.bar; g.fillRect(0, 0, W, 26);
  g.font = `15px ${SANS}`; g.fillStyle = '#c9ccd3'; g.textBaseline = 'middle';
  ['Code', 'File', 'Edit', 'Selection', 'View', 'Go', 'Run', 'Terminal'].forEach((s, i) => g.fillText(s, 22 + [0, 50, 90, 130, 205, 250, 285, 325][i], 13));
  g.fillText(`Tue 3:0${t < 18 ? 4 : t < 33 ? 5 : 6} AM`, 1430, 13);

  // explorer: the sprawl grows
  const files = FILES0.concat(FILES_LATER.filter(([ta]) => t >= ta).map(([, f]) => f));
  g.fillStyle = C.side; g.fillRect(0, 26, 200, 614);
  g.font = `12px ${SANS}`; g.fillStyle = C.grey; g.fillText('EXPLORER  ·  inbox-agent', 14, 46);
  g.font = `15px ${SANS}`;
  files.forEach((f, i) => {
    const isNew = FILES_LATER.find(([ta, n]) => n === f && t - ta < 1.2);
    const active = f === (t >= 22.4 && t < 25.0 ? 'tests/test_auto_send.py' : 'auto_send.py');
    if (active) { g.fillStyle = '#232838'; g.fillRect(0, 62 + i * 26, 200, 26); }
    g.fillStyle = isNew ? C.ok : active ? '#ffffff' : '#a9adb7';
    g.fillText((f.endsWith('/') ? '▸ ' : '  ') + f, 14, 75 + i * 26);
  });

  // tabs
  g.fillStyle = C.bar; g.fillRect(200, 26, 790, 34);
  const tabs = ['triage.py', 'drafter.py', 'auto_send.py', ...(t >= 22.4 ? ['test_auto_send.py'] : [])];
  g.font = `14px ${SANS}`;
  tabs.forEach((s, i) => {
    const on = s === (t >= 22.4 && t < 25.0 ? 'test_auto_send.py' : 'auto_send.py');
    g.fillStyle = on ? C.ed : C.bar; g.fillRect(200 + i * 150, 26, 148, 34);
    g.fillStyle = on ? '#ffffff' : C.grey; g.fillText(s, 214 + i * 150, 43);
  });

  // editor: typed code; each keystroke adds its share so the function is finished when he runs the tests
  const edWins = [[0.4, 5.6], [6.2, 9.4], [10.0, 13.2], [16.4, 19.4], [22.4, 25.0]];
  let typed = 0, total = 0; for (const [a, b] of edWins) { typed += keysIn(keys, a, b, t); total += keysIn(keys, a, b, 1e9); }
  const nChars = Math.min(TYPED_CODE.length, Math.round(typed * TYPED_CODE.length / Math.max(1, total)));
  const lines = BASE_CODE.concat(TYPED_CODE.slice(0, nChars).split('\n'));
  const LH = 25, top = 82, maxLines = 21;
  const first = Math.max(0, lines.length - maxLines);
  g.font = `18px ${MONO}`; const cw = g.measureText('M').width;
  for (let i = first; i < lines.length; i++) {
    const y = top + (i - first) * LH;
    g.fillStyle = C.gutter; g.textAlign = 'right'; g.fillText(String(i + 1), 246, y); g.textAlign = 'left';
    drawCode(g, lines[i], 266, y, cw);
  }
  // caret: solid while typing, blinking otherwise
  const inWin = edWins.some(([a, b]) => t >= a && t < b);
  const last = lines[lines.length - 1];
  if (inWin || Math.floor(t * 1.9) % 2 === 0) {
    g.fillStyle = '#e6e6e6'; g.fillRect(266 + last.length * cw + 1, top + (lines.length - 1 - first) * LH - 11, 2, 22);
  }
  // terminal
  g.fillStyle = C.term; g.fillRect(0, 640, 990, 360);
  g.font = `12px ${SANS}`; g.fillStyle = C.grey;
  ['TERMINAL', 'PROBLEMS', 'OUTPUT'].forEach((s, i) => g.fillText(s, 14 + i * 84, 654));
  g.font = `17px ${MONO}`;
  const tl = TERM.filter(([ta]) => t >= ta).map(([, s, c]) => [s, c]);
  const dk = keysIn(keys, 30.2, 31.3, t), dkAll = Math.max(1, keysIn(keys, 30.2, 31.3, 1e9));
  if (t >= 30.0) tl.push(['$ ' + DEPLOY.slice(0, Math.round(dk * DEPLOY.length / dkAll)), C.ok]);
  if (t >= 31.25) tl.push(['deploying auto_send ............ done', C.txt], ['auto-send is LIVE  (threshold 0.90)', C.ok]);
  if (t >= 32.6) tl.push(['03:07:12  sent  re: Thursday sync -> maya@', C.txt]);
  if (t >= 34.4) tl.push(['03:07:14  sent  re: invoice 4471 -> billing@', C.txt]);
  const tfirst = Math.max(0, tl.length - 12);
  tl.slice(tfirst).forEach(([s, c], i) => { g.fillStyle = c; g.fillText(s, 16, 686 + i * 24); });
  if (t < 30.0 || t >= 31.25) {
    const y = 686 + Math.min(tl.length, 12) * 24;
    g.fillStyle = C.ok; g.fillText('$', 16, y);
    if (Math.floor(t * 1.9) % 2 === 0) { g.fillStyle = '#e6e6e6'; g.fillRect(36, y - 10, 10, 20); }
  }

  // Claude chat
  g.fillStyle = C.chat; g.fillRect(990, 26, 610, 974);
  g.fillStyle = '#e8e4d8'; g.fillRect(990, 26, 610, 44);
  g.fillStyle = C.claude; g.beginPath(); g.arc(1018, 48, 10, 0, 7); g.fill();
  g.font = `600 18px ${SANS}`; g.fillStyle = C.ink; g.fillText('Claude', 1038, 49);
  g.font = `16px ${SANS}`;
  const msgs = CHAT_HISTORY.slice();
  const askKeys = keysIn(keys, 13.8, 15.2, t);
  const askTyped = ASK.slice(0, Math.round(askKeys * ASK.length / Math.max(1, keysIn(keys, 13.8, 15.2, 1e9))));
  if (t >= 15.25) msgs.push(['you', ASK]);
  // Claude streams about 38 characters a second after the question is sent
  if (t >= 15.6) msgs.push(['claude', ANSWER.slice(0, Math.floor((t - 15.6) * 38)), t - 15.6 < ANSWER.length / 38]);
  if (t >= 26.1) msgs.push(['you', '7 passed. turning it on.']);
  if (t >= 26.9) msgs.push(['claude', 'Good. I will watch the first few sends with you.'.slice(0, Math.floor((t - 26.9) * 40))]);
  // lay out from the bottom up, like a real chat
  const blocks = msgs.map(([who, text, streaming]) => {
    const maxW = who === 'you' ? 400 : 540;
    g.font = (who === 'claude' && /^ {4}/.test(text)) ? `15px ${MONO}` : `16px ${SANS}`;
    const ls = wrap(g, text, maxW);
    return { who, ls, streaming, h: ls.length * 23 + (who === 'you' ? 26 : 18) };
  });
  let y = 900;
  for (let i = blocks.length - 1; i >= 0 && y > 80; i--) {
    const b = blocks[i]; y -= b.h + 14;
    if (b.who === 'you') {
      const w = Math.max(...b.ls.map((l) => g.measureText(l).width)) + 30;
      g.fillStyle = C.bubble; rr(g, 1580 - w, y, w, b.h, 14); g.fill();
      g.fillStyle = C.ink; g.font = `16px ${SANS}`;
      b.ls.forEach((l, k) => g.fillText(l, 1580 - w + 15, y + 24 + k * 23));
    } else {
      b.ls.forEach((l, k) => {
        const code = /^ {4}/.test(l);
        g.font = code ? `15px ${MONO}` : `16px ${SANS}`; g.fillStyle = code ? '#3a5a8c' : C.ink;
        g.fillText(l, 1026, y + 18 + k * 23);
      });
      if (b.streaming) { g.fillStyle = C.claude; g.beginPath(); g.arc(1032, y + b.h + 2, 5 + Math.sin(t * 8), 0, 7); g.fill(); }
    }
  }
  // reply box
  g.fillStyle = '#ffffff'; rr(g, 1010, 920, 570, 56, 12); g.fill();
  g.strokeStyle = '#d6d2c6'; g.lineWidth = 1.5; g.stroke();
  g.font = `16px ${SANS}`;
  if (askTyped && t < 15.25) { g.fillStyle = C.ink; g.fillText(askTyped, 1028, 949); g.fillRect(1030 + g.measureText(askTyped).width, 938, 2, 22); }
  else { g.fillStyle = '#9a978f'; g.fillText('Reply to Claude...', 1028, 949); }
}

// ------------------------------------------------------------------ monitor: the pipeline
const NODES = [
  { id: 'inbox', name: 'INBOX', sub: 'imap · ivan@' },
  { id: 'classify', name: 'CLASSIFY', sub: 'reply / fyi / spam' },
  { id: 'draft', name: 'DRAFT', sub: 'Claude · tone: ivan' },
  { id: 'review', name: 'REVIEW', sub: '' },
  { id: 'send', name: 'SEND', sub: '' },
];
const SUBJECTS = ['re: Thursday sync', 'invoice 4471', 'Q3 planning notes', 'intro: Dana <> Ivan', 'lunch next week?', 'contract v3 redlines',
  'dentist reminder', 'PR #212 review', 'flight change', 'offsite agenda', 're: hiring loop', 'newsletter: weekly'];
const CONF = [0.97, 0.93, 0.71, 0.95, 0.88, 0.64, 0.99, 0.82, 0.91, 0.77, 0.69, 0.58];
const SENT_AT = [31.6, 32.6, 33.5, 34.4, 35.1, 35.7, 36.3];

export function drawMonitor(g, t) {
  const W = 1600, H = 900;
  g.fillStyle = '#0d0f15'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#151924'; g.fillRect(0, 0, W, 40);
  g.font = `16px ${SANS}`; g.textBaseline = 'middle'; g.fillStyle = '#b8bcc6';
  g.fillText('pipeline.local  /  email-automation', 18, 20);
  g.fillText(`3:0${t < 18 ? 4 : t < 33 ? 5 : 6} AM`, 1500, 20);

  const live = t >= 31.25;                    // auto-send deployed
  const gate = t >= 25.9;                     // tests passed: the confidence gate is ready
  // title + status
  g.font = `600 30px ${SANS}`; g.fillStyle = '#e9ecf2'; g.fillText('Email automation', 40, 82);
  const pill = live ? ['AUTO-SEND LIVE', '#1f6f43', '#9df2bd'] : gate ? ['GATE READY · tests 7/7', '#5a4a1c', '#f2d38a'] : ['MANUAL REVIEW', '#2a2f3d', '#aeb4c2'];
  g.font = `600 15px ${SANS}`; const pw = g.measureText(pill[0]).width + 28;
  g.fillStyle = pill[1]; rr(g, 330, 66, pw, 32, 16); g.fill(); g.fillStyle = pill[2]; g.fillText(pill[0], 344, 83);

  // the graph
  const nx = (i) => 60 + i * 304, ny = 150, nw = 236, nh = 128;
  const state = (id) => {
    if (id === 'review') return live ? 'auto' : gate ? 'ready' : 'manual';
    if (id === 'send') return live ? 'auto' : 'off';
    return 'run';
  };
  const col = { run: '#7fd3a0', auto: '#7fd3a0', manual: '#e5c07b', ready: '#e5c07b', off: '#5b6070' };
  // edges with traffic: emails flow left to right; the last edge only once auto-send is live
  for (let i = 0; i < 4; i++) {
    const x0 = nx(i) + nw, x1 = nx(i + 1), y = ny + nh / 2;
    const active = i < 3 || live;
    g.strokeStyle = active ? '#3c4a66' : '#262a35'; g.lineWidth = 3; g.setLineDash(active ? [] : [6, 8]);
    g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke(); g.setLineDash([]);
    if (!active) continue;
    const rate = i === 3 ? 0 : 1.25 - i * 0.25;
    for (let k = 0; k < 4 && rate; k++) {
      const u = ((t * rate * 0.55 + k / 4 + i * 0.13) % 1);
      g.fillStyle = '#9cc4ff'; g.globalAlpha = smooth(u * 6) * smooth((1 - u) * 6);
      g.fillRect(x0 + u * (x1 - x0) - 9, y - 6, 18, 12); g.globalAlpha = 1;
    }
  }
  // the first automatic emails crossing REVIEW -> SEND
  for (const ts of SENT_AT) {
    const u = (t - (ts - 0.45)) / 0.45;
    if (u < 0 || u > 1) continue;
    const x0 = nx(3) + nw, x1 = nx(4);
    g.fillStyle = '#b6ffd0'; g.shadowColor = '#7fd3a0'; g.shadowBlur = 18;
    g.fillRect(x0 + smooth(u) * (x1 - x0) - 11, ny + nh / 2 - 8, 22, 16); g.shadowBlur = 0;
  }
  const sent = SENT_AT.filter((s) => t >= s).length;
  const queued = 58 + Math.floor(Math.min(t, 31.25) / 3.1) - (live ? Math.min(sent, 6) : 0);
  NODES.forEach((n, i) => {
    const s = state(n.id), x = nx(i);
    const flash = n.id === 'send' ? Math.max(0, 1 - Math.abs(t - 31.6) / 0.6) : 0;
    g.fillStyle = flash ? `rgba(40,110,70,${0.5 + flash * 0.5})` : '#161b27'; rr(g, x, ny, nw, nh, 14); g.fill();
    g.strokeStyle = col[s]; g.lineWidth = s === 'off' ? 1.5 : 2.5; g.stroke();
    g.fillStyle = col[s]; g.beginPath(); g.arc(x + 22, ny + 28, 6, 0, 7); g.fill();
    g.font = `700 20px ${SANS}`; g.fillStyle = '#e9ecf2'; g.fillText(n.name, x + 38, ny + 29);
    g.font = `14px ${MONO}`; g.fillStyle = '#9aa0ad';
    const sub = n.id === 'review' ? (live ? 'auto ≥ 0.90' : gate ? 'gate ≥ 0.90 ready' : 'waiting on Ivan')
      : n.id === 'send' ? (live ? 'auto · smtp' : 'manual') : n.sub;
    g.fillText(sub, x + 20, ny + 62);
    g.font = `600 26px ${MONO}`; g.fillStyle = col[s];
    const big = String({ inbox: 214 + Math.floor(t / 2.7), classify: 214 + Math.floor(Math.max(0, t - 1) / 2.7), draft: 61 + Math.floor(t / 3.1),
      review: queued, send: sent }[n.id]);
    g.fillText(big, x + 20, ny + 100);
    const bw = g.measureText(big).width;
    g.font = `13px ${SANS}`; g.fillStyle = '#7d8392';
    g.fillText({ inbox: 'fetched', classify: 'labelled', draft: 'drafted', review: 'in queue', send: 'sent on its own' }[n.id], x + 30 + bw, ny + 102);
  });

  // review queue with confidence, left
  g.fillStyle = '#121620'; rr(g, 40, 320, 740, 520, 14); g.fill();
  g.font = `600 16px ${SANS}`; g.fillStyle = '#b8bcc6'; g.fillText('review queue', 64, 350);
  g.font = `16px ${MONO}`;
  for (let k = 0; k < 11; k++) {
    const idx = (k + sent) % SUBJECTS.length;
    const conf = CONF[idx];
    const y = 392 + k * 40;
    const goes = live && conf >= 0.9;
    g.fillStyle = goes ? '#7fd3a0' : '#c9ccd3'; g.fillText(SUBJECTS[idx], 64, y);
    g.fillStyle = '#232a38'; g.fillRect(470, y - 6, 200, 12);
    g.fillStyle = conf >= 0.9 ? '#7fd3a0' : '#e5c07b'; g.fillRect(470, y - 6, 200 * conf, 12);
    g.fillStyle = '#9aa0ad'; g.fillText(conf.toFixed(2), 690, y);
    if (gate) { g.strokeStyle = '#e5c07b88'; g.lineWidth = 1; g.beginPath(); g.moveTo(470 + 180, y - 10); g.lineTo(470 + 180, y + 10); g.stroke(); }
  }
  // live log, right
  g.fillStyle = '#0a0c11'; rr(g, 820, 320, 740, 520, 14); g.fill();
  g.font = `15px ${MONO}`;
  const log = [];
  for (let k = 0; k < 40; k++) {
    const tk = k * 0.9 - 6;
    if (tk > t) break;
    const sec = 30 + Math.floor(tk * 1.2);
    const ts = `03:0${4 + Math.floor((sec + 240) / 60) % 4}:${String((sec + 600) % 60).padStart(2, '0')}`;
    log.push([ts, k % 5 === 3 ? 'INFO' : 'OK', ['classified 12 msgs', 'draft ready -> review queue', 'summary written: q3-planning.pdf', 'calendar conflict resolved'][k % 4]]);
  }
  if (gate) log.push(['03:05:41', 'OK', 'tests passed (7) · gate ready']);
  if (live) log.push(['03:05:58', 'OK', 'auto-send ENABLED by ivan']);
  SENT_AT.forEach((s, i) => { if (t >= s) log.push([`03:06:${String(2 + i * 3).padStart(2, '0')}`, 'SENT', `${SUBJECTS[[0, 1, 7, 3, 9, 4, 8][i]]}  (auto)`]); });
  log.slice(-19).forEach(([ts, lv, msg], i) => {
    const y = 350 + i * 25;
    g.fillStyle = '#7d8392'; g.fillText(ts, 844, y);
    g.fillStyle = lv === 'SENT' ? '#9df2bd' : lv === 'OK' ? '#7fd3a0' : '#9aa0ad'; g.fillText(lv.padEnd(5), 954, y);
    g.fillStyle = lv === 'SENT' ? '#e9ecf2' : '#b8bcc6'; g.fillText(msg, 1014, y);
  });

  // the moment: the first email it sent on its own
  const pop = smooth((t - 31.6) / 0.35);
  if (pop > 0) {
    const x = 1060, y = 70 - (1 - pop) * 30;
    g.globalAlpha = pop;
    g.fillStyle = '#123524'; rr(g, x, y, 500, 92, 14); g.fill();
    g.strokeStyle = '#7fd3a0'; g.lineWidth = 2; g.stroke();
    g.font = `700 21px ${SANS}`; g.fillStyle = '#b6ffd0'; g.fillText('✓  Sent automatically', x + 22, y + 32);
    g.font = `16px ${SANS}`; g.fillStyle = '#d6efe0'; g.fillText('re: Thursday sync  →  maya@  ·  conf 0.97', x + 22, y + 64);
    g.globalAlpha = 1;
  }
}

// ------------------------------------------------------------------ setup
export async function createScreens(root, actingURL = 'assets/acting.json', custom = {}) {
  const laptop = custom.laptop || drawLaptop, monitor = custom.monitor || drawMonitor;
  let keys = [];
  try { keys = (await (await fetch(actingURL)).json()).keys.map((k) => k[0]); } catch (e) { console.warn('no acting.json', e); }
  try { await Promise.all([document.fonts.load(`18px ${MONO}`), document.fonts.load(`16px ${SANS}`), document.fonts.load(`600 16px ${SANS}`)]); } catch (e) { /* fall back */ }
  const make = (w, h) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const tex = new THREE.CanvasTexture(c);
    tex.flipY = false; tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter;
    return { c, g: c.getContext('2d'), tex };
  };
  const lap = make(1600, 1000), mon = make(1600, 900);
  const meshes = {};
  root.traverse((o) => {
    if (!o.isMesh || Array.isArray(o.material)) return;
    if (o.material.name === 'Laptop Screen' || /^Laptop_Screen/.test(o.name)) { meshes.lap = o; o.material.emissiveMap = lap.tex; o.material.needsUpdate = true; }
    if (o.material.name === 'Monitor Screen' || /^Monitor_Screen/.test(o.name)) { meshes.mon = o; o.material.emissiveMap = mon.tex; o.material.needsUpdate = true; }
  });
  // a scene may drive more screens (Ch 1: the second monitor and the phone); without them nothing changes here
  const extra = {};
  if (custom.monitor2 || custom.phone) {
    const want = { mon2: [custom.monitor2, /^Monitor2_Screen/, 1600, 900], phone: [custom.phone, /^Phone_Screen/, 720, 1560] };
    for (const [k, [draw, re, w, h]] of Object.entries(want)) {
      if (!draw) continue;
      root.traverse((o) => {
        if (extra[k] || !o.isMesh || Array.isArray(o.material) || !re.test(o.name)) return;
        const cv = make(w, h);
        o.material = o.material.clone(); o.material.emissiveMap = cv.tex; o.material.emissive.set(0xffffff); o.material.needsUpdate = true;
        meshes[k] = o; extra[k] = { draw, ...cv, w, h };
      });
    }
  }
  let lastT = -1;
  function update(t) {
    if (t === lastT) return; lastT = t;
    laptop(lap.g, t, keys); lap.tex.needsUpdate = true;
    monitor(mon.g, t); mon.tex.needsUpdate = true;
    for (const x of Object.values(extra)) { x.draw(x.g, t, keys); x.tex.needsUpdate = true; }
  }
  // world position of a pixel: bilinear over the plane's four UV corners
  const corners = {};
  for (const [k, m] of Object.entries(meshes)) {
    const pos = m.geometry.attributes.position, uv = m.geometry.attributes.uv;
    const want = [[0, 0], [1, 0], [0, 1], [1, 1]];
    corners[k] = want.map(([u, v]) => {
      let best = 0, bd = 1e9;
      for (let i = 0; i < uv.count; i++) { const d = (uv.getX(i) - u) ** 2 + (uv.getY(i) - v) ** 2; if (d < bd) { bd = d; best = i; } }
      return new THREE.Vector3().fromBufferAttribute(pos, best);
    });
  }
  function screenPoint(which, px, py) {
    const m = meshes[which]; if (!m) return null;
    const [W, H] = which === 'lap' ? [1600, 1000] : extra[which] ? [extra[which].w, extra[which].h] : [1600, 900];
    const u = px / W, v = py / H, [a, b, c, d] = corners[which];
    const top = a.clone().lerp(b, u), bot = c.clone().lerp(d, u);
    m.updateWorldMatrix(true, false);
    return top.lerp(bot, v).applyMatrix4(m.matrixWorld);
  }
  return { update, screenPoint, canvases: { lap: lap.c, mon: mon.c } };
}
