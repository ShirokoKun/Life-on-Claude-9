// Chapter 1 screens: the laptop, the pipeline monitor, the second monitor and the phone, over the whole chapter.
// The same contract as s02: the engine calls SCREENS.laptop(g, t, keys), SCREENS.monitor(g, t), SCREENS.monitor2(g, t)
// and SCREENS.phone(g, t) every frame (t = chapter time in seconds, keys = keystroke times from the acting file).
// Everything is a pure function of t (no Math.random), so a frame renders the same every time.
// Shot windows and the moments inside them (key hits, word times, wake/dim) are read from timeline.json at load, so
// re-timing the timeline re-times the screens. Visual language: engine/src/screens.js (the intro's editor, terminal
// and Claude chat). Text a shot reads is 28 px or more (s02's rule: readable at 50-85 mm through the bloom).
//   laptop   1600 x 1000      monitor  1600 x 900      monitor2 1600 x 900      phone 720 x 1560 (portrait)
//   card     1200 x  800  (optional: the floating chat card of B02/B05, same chat state as the phone)
// Preview: node tools/screens_preview.mjs --at 3,40,45 --out renders/ch1_screens
import { C, MONO, SANS, rr, wrap, drawCode, smooth, clamp01, keysIn, drawLaptop, drawMonitor } from '../../src/screens.js';

const TL = await (await fetch(new URL('./timeline.json', import.meta.url))).json();

// ------------------------------------------------------------------ the timeline
// fallback windows (the timeline as of writing), used only if a shot id disappears from timeline.json
const DEF = Object.fromEntries(('A01 0 2.8,A02 2.8 5,A03 5 9.9,A04 9.9 16,A05 16 20.6,A06 20.6 26.6,A07 26.6 31.4,A08 31.4 34,' +
  'A09 34 37,B01 37 41.6,B02 41.6 45.6,B03 45.6 48.2,B04 48.2 52.6,B05 52.6 58,B06 58 62.8,B07 62.8 67.6,C00 67.6 69.6,' +
  'C01 69.6 72.8,C02 72.8 75.4,C03 75.4 80.6,C04 80.6 84.2,C05 84.2 88.6,C06 88.6 93,C07 93 98.2,V01 98.2 102.8,' +
  'V02 102.8 105,V03 105 111.6,V04 111.6 114.2,D01 114.2 117.8,D02 117.8 126.4,D03 126.4 137,D04 137 140.2,' +
  'D05 140.2 143.4,D06 143.4 147.4,E01 147.4 150.8,E02 150.8 154.4,E03 154.4 158,E04 158 162.4,E05 162.4 167.8,' +
  'E06 167.8 174.2,E07 174.2 176.8,E08 176.8 178.6,E09 178.6 183.4,E10 183.4 190.2,F01 190.2 194.8,F02 194.8 198.4,' +
  'F03 198.4 204.8,F04 204.8 210.4,F05 210.4 218,F06 218 221.8,F07 221.8 231.8').split(',')
  .map((s) => { const [id, a, b] = s.split(' '); return [id, { id, t0: +a, t1: +b }]; }));
const SHOT = { ...DEF, ...Object.fromEntries((TL.shots || []).map((s) => [s.id, s])) };
export const DURATION = TL.duration || 231.8;
const W0 = (id) => SHOT[id].t0, W1 = (id) => SHOT[id].t1;
const text = (s) => [s.action, s.screen, s.props, s.light].filter(Boolean).join(' ');
// the moments written into a shot's notes ("keys hit at 34.6, 35.4, 35.9 s"): decimal numbers inside the shot window.
// If the notes no longer agree with the window (re-timed), fall back to the given fractions of the shot.
function moments(id, n, fracs) {
  const s = SHOT[id], d = s.t1 - s.t0;
  const got = [...new Set((text(s).match(/\d+\.\d+/g) || []).map(Number))].filter((x) => x >= s.t0 - 0.01 && x <= s.t1 + 0.01).sort((a, b) => a - b);
  return got.length >= n ? got.slice(0, n) : fracs.map((f) => s.t0 + f * d);
}
const voAt = (prefix, fb) => { const v = (TL.vo || []).find((l) => l.text.startsWith(prefix)); return v ? [v.t0, v.t1] : fb; };
const numAfter = (id, re, fb) => { const m = re.exec(text(SHOT[id])); return m ? +m[1] : fb; };

// the times the chapter hangs on
const A08 = [W0('A08'), W1('A08')];
const YES = moments('A09', 3, [0.2, 0.47, 0.63]);                      // Y + Enter, three times
const BLEND = (() => { const m = /blend ([\d.]+)\s*-\s*([\d.]+)/.exec(SHOT.B01.light || ''); return m ? [+m[1], +m[2]] : [W0('B01') + 1, W1('B01') - 1.2]; })();
const MAIL_NIGHT = numAfter('A02', /Mail[^\d]*(\d+)/, 214), MAIL_DAY = numAfter('B03', /Mail[^\d]*(\d+)/, 412);
const SEND1 = moments('B03', 1, [0.77])[0];                             // he jabs Send
const YES_TYPE = moments('B06', 2, [0.75, 0.875]);                      // types 'yes'
const MODS = moments('C03', 4, [0.04, 0.27, 0.5, 0.73]);               // calendar, meetings, documents, research
const SPIN = moments('C07', 2, [0.27, 0.69]);                           // the clock spins to 2:58
const WAKE = moments('D02', 2, [0.02, 0.49]);                           // phone wakes, dims
const D05M = moments('D05', 2, [0.12, 0.53]);                           // briefing.py opens, slack.py opens
const STOP_TYPING = moments('E04', 1, [0.23])[0];
const ENTER = moments('E07', 1, [0.62])[0];
const PASS = moments('E08', 1, [0.11])[0];
const TILES = moments('F03', 4, [0.13, 0.33, 0.56, 0.84]);             // email, calendar, documents, reading
const HOURS = (() => { const m = /(\d+)\s*h\s*->\s*(\d+)\s*h/.exec(SHOT.E06.screen || ''); return m ? [+m[1], +m[2]] : [31, 44]; })();

// ------------------------------------------------------------------ helpers
const lerp = (a, b, u) => a + (b - a) * u;
// deterministic noise: one value per integer (mulberry32 of the integer)
function hash(i) {
  let a = (i * 2654435761 + 0x9e3779b9) >>> 0;
  a = (a + 0x6D2B79F5) | 0; let x = Math.imul(a ^ (a >>> 15), 1 | a); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
  return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
}
function reset(g) {
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.shadowBlur = 0; g.setLineDash([]);
  g.textAlign = 'left'; g.textBaseline = 'middle'; g.lineWidth = 1;
}
// characters typed by time t in [a, b]: from the keystrokes when the acting has them, else a steady rate
// (at least `rate` chars/s, faster when the text must be done by b)
function typedN(keys, a, b, t, n, rate = 12) {
  if (t <= a) return 0;
  const tot = keysIn(keys || [], a, b, 1e9);
  if (tot >= 3) return Math.min(n, Math.round(keysIn(keys, a, b, t) * n / tot));
  const r = Number.isFinite(b) ? Math.max(rate, n / Math.max(0.05, b - a)) : rate;
  return Math.min(n, Math.floor((t - a) * r));
}
const streamN = (t, a, rate, n) => Math.max(0, Math.min(n, Math.floor((t - a) * rate)));
const upto = (lines, n) => lines.join('\n').slice(0, n).split('\n');
const blink = (t) => Math.floor(t * 1.9) % 2 === 0;
// cross-fade two screens (each draw function resets its context, so B is drawn into a scratch layer first)
const scratch = {};
function layer(w, h) {
  const k = `${w}x${h}`;
  if (!scratch[k]) {
    const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });
    scratch[k] = c.getContext('2d');
  }
  return scratch[k];
}
function fade(g, t, a, b, drawA, drawB) {
  const u = smooth((t - a) / (b - a));
  if (u <= 0) return drawA(g);
  if (u >= 1) return drawB(g);
  drawA(g);
  const L = layer(g.canvas.width, g.canvas.height); drawB(L);
  g.save(); g.globalAlpha = u; g.drawImage(L.canvas, 0, 0); g.restore();
}
// files of the project, first mention wins: [[name, tAdded]]
const filesOf = (...lists) => { const seen = new Set(); return lists.flat().filter(([f]) => !seen.has(f) && seen.add(f)); };

// ------------------------------------------------------------------ the clock (story time on every screen)
// Tue 3:04 AM now; the flashback is Sunday afternoon; the montage runs Sunday evening to Tuesday 2:58 AM (C07's
// clock), then the night goes on: 3:3x (D), 4:xx (E), sunrise 6:xx (F).
const MIN = (d, h, m) => d * 1440 + h * 60 + m;      // d: 0 Sun, 1 Mon, 2 Tue
const CLOCK = [
  [W0('A01'), MIN(2, 3, 4), W1('A09'), MIN(2, 3, 6)],
  [W0('B01'), MIN(0, 14, 21), W1('B07'), MIN(0, 14, 27)],
  [W0('C00'), MIN(0, 19, 46), W1('C03'), MIN(0, 19, 58)],
  [W0('C04'), MIN(0, 20, 2), W1('C04'), MIN(1, 20, 58)],
  [W0('C05'), MIN(1, 21, 4), W1('C06'), MIN(1, 21, 10)],
  [W0('C07'), MIN(1, 21, 12), SPIN[0], MIN(1, 21, 12)],
  [SPIN[0], MIN(1, 21, 12), SPIN[1], MIN(2, 2, 58), smooth],
  [SPIN[1], MIN(2, 2, 58), W1('C07'), MIN(2, 2, 58)],
  [W0('V01'), MIN(2, 3, 12), W1('V04'), MIN(2, 3, 28)],
  [W0('D01'), MIN(2, 3, 31), W1('D06'), MIN(2, 3, 52)],
  [W0('E01'), MIN(2, 4, 2), W1('E10'), MIN(2, 4, 24)],
  [W0('F01'), MIN(2, 6, 7), DURATION, MIN(2, 6, 19)],
];
export function clockAt(t) {
  let s = CLOCK[0]; for (const c of CLOCK) if (t >= c[0]) s = c;
  const u = clamp01((t - s[0]) / Math.max(1e-6, s[2] - s[0]));
  return s[1] + (s[4] ? s[4](u) : u) * (s[3] - s[1]);
}
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed'], DAYS_LONG = ['Sunday, 9 March', 'Monday, 10 March', 'Tuesday, 11 March', 'Wednesday, 12 March'];
function hm(m, ampm = true) {
  const h = Math.floor(m / 60) % 24, mm = Math.floor(m % 60);
  return `${(h + 11) % 12 + 1}:${String(mm).padStart(2, '0')}${ampm ? (h < 12 ? ' AM' : ' PM') : ''}`;
}
const stamp = (m) => { const h = Math.floor(m / 60) % 24, mm = Math.floor(m % 60), s = Math.floor((m * 60) % 60); return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(s).padStart(2, '0')}`; };
const dayLabel = (t) => { const m = clockAt(t); return `${DAYS[Math.floor(m / 1440)]} ${hm(m)}`; };

// ------------------------------------------------------------------ words
const SUBJ = ['Re: Thursday sync', 'Invoice 4471 overdue', 'Q3 planning notes', 'Intro: Dana <> Ivan', 'lunch next week?', 'Contract v3 redlines',
  'PR #212 needs review', 'Flight change: LHR', 'Offsite agenda', 'Re: hiring loop', 'Weekly metrics', 'Can you join at 4?', 'Re: Re: budget',
  'Customer escalation', 'Design review moved', 'Your order shipped', 'Benefits enrollment', 'Re: launch checklist', 'Quick question', 'Expense report'];
const FROM = ['Maya Chen', 'Billing', 'Priya R.', 'Dana Ortiz', 'Sasha K.', 'Legal', 'GitHub', 'BA', 'Ops', 'Tom K.', 'Analytics', 'Lena', 'Finance',
  'Support', 'Calendar', 'Shop', 'HR', 'Product', 'Marco', 'Concur'];
const TODO = ['answer 61 emails', 'reschedule 3 conflicts', 'book Thursday 1:1s', 'draft the Q3 report', 'summarize 4 papers',
  'weekly metrics', "reply to Dana's intro"];
// Sarah's texts, oldest first. The last one arrives when the phone wakes in D02: she stops there.
const SARAH = [[MIN(1, 23, 48), 'you up?'], [MIN(2, 1, 12), 'ivan?'], [MIN(2, 2, 41), 'are you ok?']];
const SARAH_LAST = 'ok goodnight then';

const CODE = {
  'classify.py': ['from pipeline import claude, LABELS, VIP', '', 'def classify(mail):', '    """reply / fyi / ignore + confidence"""',
    '    label, conf = claude.label(mail, LABELS)', '    if mail.sender in VIP:', '        return "reply", max(conf, 0.95)',
    '    if mail.is_newsletter:', '        return "ignore", 0.99', '    return label, conf'],
  'draft_reply.py': ['from pipeline import classify, voice', 'from pipeline.log import log', '',
    'TONE = voice.load("ivan")   # 312 sent mails', '', 'def draft_reply(mail):', '    label, conf = classify(mail)',
    '    if label != "reply":', '        return None, conf', '    ctx = thread_history(mail, last=5)', '    text = claude.write(',
    '        to=mail.sender,', '        about=mail.summary,', '        tone=TONE, context=ctx,', '    )',
    '    log.ok(f"draft ready -> {mail.sender}")', '    return Draft(mail, text), conf'],
  'triage.py': ['import imaplib', 'from pipeline import classify', '', 'def triage(inbox):',
    '    out = {"reply": [], "fyi": [], "ignore": []}', '    for mail in inbox.unread():', '        label, conf = classify(mail)',
    '        out[label].append((mail, conf))', '    log.ok(f"{len(inbox)} sorted")', '    return out'],
  'drafter.py': ['from pipeline import triage, draft_reply', '', 'def draft_all(inbox):', '    sorted_ = triage(inbox)',
    '    drafts = [draft_reply(m) for m, _ in', '              sorted_["reply"]]', '    queue_for_review(drafts)', '    return drafts'],
  'calendar_sync.py': ['def sync(cal, inbox):', '    for inv in inbox.invites():', '        clash = cal.conflicts(inv)', '        if not clash:',
    '            cal.accept(inv)', '            continue', '        slot = cal.free_slots(near=inv.start)[0]', '        propose(inv, slot)'],
  'scheduler.py': ['def schedule(req, people):', '    busy = [cal_of(p).busy() for p in people]', '    slot = first_free(busy, req.length)',
    '    invite = Invite(req.title, slot, people)', '    send_invite(invite)', '    log.ok(f"booked {req.title} {slot}")'],
  'docs_drafter.py': ['def draft_doc(brief, sources):', '    notes = [summarize(s) for s in sources]', '    outline = claude.outline(brief, notes)',
    '    doc = claude.write(outline, tone=TONE)', '    save(doc, f"drafts/{brief.slug}.md")', '    return doc'],
  'research_digest.py': ['def digest(papers):', '    out = []', '    for p in papers:', '        s = claude.summarize(p, words=150)',
    '        out.append((p.title, s, p.url))', '    post_to(READING_LIST, out)', '    return out'],
  'modules/briefing.py': ['from modules import mail, calendar, reading', '', 'def morning_briefing(day):', '    b = Briefing(day)',
    '    b.add(mail.summary(since="18:00"))', '    b.add(calendar.today(day))', '    b.add(reading.digest(limit=3))', '    b.add(todo.open_items())',
    '    return b.render(max_words=250)'],
  'integrations/slack.py': ['import os', 'from slack_sdk import WebClient', '', 'client = WebClient(os.environ["SLACK_TOKEN"])', '',
    'def post_briefing(text, channel="#ivan"):', '    client.chat_postMessage(', '        channel=channel, text=text,', '    )',
    '    log.ok("briefing posted")', '', 'def on_mention(event):', '    reply = claude.answer(event.text)', '    client.chat_postMessage(',
    '        channel=event.channel, text=reply)'],
  'tests/test_briefing.py': ['from modules.briefing import morning_briefing', '', 'def test_briefing_has_sections(day):',
    '    b = morning_briefing(day)', '    assert "Mail" in b and "Calendar" in b', '', 'def test_briefing_is_short(day):',
    '    assert len(morning_briefing(day).split()) < 250', '', 'def test_slack_post(fake_slack):', '    post_briefing("hi")',
    '    assert fake_slack.sent == ["hi"]', '', 'def test_mention_reply(fake_slack):', '    on_mention(Event("status?"))',
    '    assert fake_slack.sent[-1]', '', 'def test_quiet_hours(day):', '    assert not post_at(day.at("03:00"))'],
};
const ALL_CODE = Object.values(CODE).flat();
const MODULE_FILES = ['calendar_sync.py', 'scheduler.py', 'docs_drafter.py', 'research_digest.py'];
const MODULE_NAMES = ['calendar', 'meetings', 'documents', 'research'];

// ------------------------------------------------------------------ the editor + terminal + Claude chat (laptop)
function menubar(g, t, label = 'Code') {
  g.fillStyle = C.bar; g.fillRect(0, 0, 1600, 26);
  g.font = `15px ${SANS}`; g.fillStyle = '#c9ccd3'; g.textBaseline = 'middle';
  if (label === 'Code') ['Code', 'File', 'Edit', 'Selection', 'View', 'Go', 'Run', 'Terminal'].forEach((s, i) => g.fillText(s, 22 + [0, 50, 90, 130, 205, 250, 285, 325][i], 13));
  else g.fillText(label, 22, 13);
  g.textAlign = 'right'; g.fillText(dayLabel(t), 1580, 13); g.textAlign = 'left';
}
// the chat column, laid out from the bottom up like a real chat. msgs: [who, text, streaming]
function chatColumn(g, t, msgs, { x0, x1, top, bottom, size, lh, youW, claudeW, pad = 15 }) {
  const font = `${size}px ${SANS}`, mono = `${Math.round(size * 0.82)}px ${MONO}`;
  const blocks = msgs.filter((m) => m[1] !== undefined).map(([who, txt, streaming]) => {
    g.font = font; const ls = wrap(g, txt, who === 'you' ? youW : claudeW);
    return { who, ls, streaming, h: ls.length * lh + (who === 'you' ? pad * 2 : 6) };
  });
  let y = bottom;
  g.save(); g.beginPath(); g.rect(x0 - 20, top, x1 - x0 + 40, bottom - top); g.clip();
  for (let i = blocks.length - 1; i >= 0 && y > top; i--) {
    const b = blocks[i]; y -= b.h + Math.round(lh * 0.6);
    if (y < top && i < blocks.length - 1) break;            // older messages only when whole (no half bubbles)
    if (b.who === 'you') {
      g.font = font; const w = Math.max(...b.ls.map((l) => g.measureText(l).width)) + pad * 2;
      g.fillStyle = C.bubble; rr(g, x1 - w, y, w, b.h, Math.round(size * 0.55)); g.fill();
      g.fillStyle = C.ink; b.ls.forEach((l, k) => g.fillText(l, x1 - w + pad, y + pad + lh * (k + 0.5)));
    } else {
      b.ls.forEach((l, k) => {
        const code = /^ {4}/.test(l), i0 = l.indexOf('✓'), yy = y + lh * (k + 0.5);
        g.font = code ? mono : font; g.fillStyle = code ? '#3a5a8c' : C.ink;
        const head = i0 >= 0 ? l.slice(0, i0) : l;
        g.fillText(head, x0, yy);
        if (i0 >= 0) { g.fillStyle = '#2f8a55'; g.fillText(l.slice(i0), x0 + g.measureText(head).width, yy); }
      });
      if (b.streaming) { g.fillStyle = C.claude; g.beginPath(); g.arc(x0 + 8, y + b.h + lh * 0.25, size * 0.2 + Math.sin(t * 8), 0, 7); g.fill(); }
    }
  }
  g.restore();
}
function chatPanel(g, t, msgs, reply, replyCaret) {
  g.fillStyle = C.chat; g.fillRect(990, 26, 610, 974);
  g.fillStyle = '#e8e4d8'; g.fillRect(990, 26, 610, 48);
  g.fillStyle = C.claude; g.beginPath(); g.arc(1020, 50, 11, 0, 7); g.fill();
  g.font = `600 22px ${SANS}`; g.fillStyle = C.ink; g.fillText('Claude', 1042, 51);
  chatColumn(g, t, msgs, { x0: 1018, x1: 1580, top: 80, bottom: 900, size: 28, lh: 38, youW: 440, claudeW: 545 });
  g.fillStyle = '#ffffff'; rr(g, 1010, 912, 570, 68, 14); g.fill();
  g.strokeStyle = '#d6d2c6'; g.lineWidth = 1.5; g.stroke();
  g.font = `26px ${SANS}`;
  if (reply) {
    g.save(); g.beginPath(); g.rect(1020, 912, 550, 68); g.clip();
    const w = g.measureText(reply).width, x = 1030 - Math.max(0, w - 520);
    g.fillStyle = C.ink; g.fillText(reply, x, 947);
    if (replyCaret) g.fillRect(x + w + 2, 932, 2, 30);
    g.restore();
  } else { g.fillStyle = '#9a978f'; g.fillText('Reply to Claude...', 1030, 947); }
}
// o: { files: [[name, tAdded]], active, tabs, code: lines, scroll (lines, fractional) | undefined = follow the end,
//      caret, term: [[text, colour]], termCaret, termBig, chat: [[who, text, streaming]], reply, replyCaret }
function ide(g, t, o) {
  reset(g);
  g.fillStyle = C.ed; g.fillRect(0, 0, 1600, 1000);
  menubar(g, t);
  // explorer
  g.fillStyle = C.side; g.fillRect(0, 26, 200, 614);
  g.font = `12px ${SANS}`; g.fillStyle = C.grey; g.fillText('EXPLORER  ·  inbox-agent', 14, 46);
  g.font = `15px ${SANS}`;
  const files = (o.files || []).filter(([, ta]) => t >= ta).slice(-21);
  files.forEach(([f, ta], i) => {
    const active = f === o.active, isNew = t - ta < 1.2 && ta > -1e8;
    if (active) { g.fillStyle = '#232838'; g.fillRect(0, 62 + i * 26, 200, 26); }
    g.fillStyle = isNew ? C.ok : active ? '#ffffff' : '#a9adb7';
    g.fillText((f.endsWith('/') ? '▸ ' : '  ') + f, 14, 75 + i * 26);
  });
  // tabs
  const termTop = o.termBig ? 540 : 640;
  g.fillStyle = C.bar; g.fillRect(200, 26, 790, 36);
  g.font = `15px ${SANS}`;
  (o.tabs || []).slice(-5).forEach((s, i) => {
    const on = s === o.active;
    g.fillStyle = on ? C.ed : C.bar; g.fillRect(200 + i * 158, 26, 156, 36);
    g.fillStyle = on ? '#ffffff' : C.grey; g.fillText(s.replace(/^.*\//, ''), 212 + i * 158, 44);
  });
  // editor
  const LH = 30, top = 86, maxLines = Math.floor((termTop - top - 6) / LH);
  const lines = o.code || [''];
  g.font = `22px ${MONO}`; const cw = g.measureText('M').width;
  g.save(); g.beginPath(); g.rect(200, 62, 790, termTop - 62); g.clip();
  if (o.scroll === undefined) {
    const first = Math.max(0, lines.length - maxLines);
    for (let i = first; i < lines.length; i++) {
      const y = top + (i - first) * LH;
      g.fillStyle = C.gutter; g.textAlign = 'right'; g.fillText(String(i + 1), 250, y); g.textAlign = 'left';
      drawCode(g, lines[i], 268, y, cw);
    }
    const last = lines[lines.length - 1] || '';
    if (o.caret === 'solid' || (o.caret && blink(t))) { g.fillStyle = '#e6e6e6'; g.fillRect(268 + last.length * cw + 1, top + (lines.length - 1 - first) * LH - 12, 2, 25); }
  } else {
    // free scroll through a long buffer (lines wrap around): Claude writing faster than anyone reads
    const s0 = Math.floor(o.scroll), fr = o.scroll - s0;
    for (let k = -1; k <= maxLines + 1; k++) {
      const i = s0 + k, y = top + (k - fr) * LH;
      g.fillStyle = C.gutter; g.textAlign = 'right'; g.fillText(String(i + 1), 250, y); g.textAlign = 'left';
      drawCode(g, lines[((i % lines.length) + lines.length) % lines.length], 268, y, cw);
    }
  }
  g.restore();
  // terminal
  g.fillStyle = C.term; g.fillRect(0, termTop, 990, 1000 - termTop);
  g.font = `12px ${SANS}`; g.fillStyle = C.grey;
  ['TERMINAL', 'PROBLEMS', 'OUTPUT'].forEach((s, i) => g.fillText(s, 14 + i * 84, termTop + 14));
  const TS = o.termBig ? 28 : 20, TLH = o.termBig ? 40 : 27;
  g.font = `${TS}px ${MONO}`;
  const tl = (o.term || []).slice();
  const room = Math.floor((1000 - termTop - 50) / TLH) - (o.termCaret ? 1 : 0);
  tl.slice(-room).forEach(([s, c], i) => { g.fillStyle = c || C.txt; g.fillText(s, 18, termTop + 46 + i * TLH); });
  if (o.termCaret) {
    const y = termTop + 46 + Math.min(tl.length, room) * TLH;
    g.fillStyle = C.ok; g.fillText('$ ' + (o.termCmd || ''), 18, y);
    const w = g.measureText('$ ' + (o.termCmd || '')).width;
    if (o.termCaret === 'solid' || blink(t)) { g.fillStyle = '#e6e6e6'; g.fillRect(22 + w, y - TS * 0.55, TS * 0.55, TS * 1.1); }
  }
  // Claude chat
  chatPanel(g, t, o.chat || [], o.reply, o.replyCaret);
}

// files of the project as the intro left it (the intro adds these between 0.4 and 25 s)
const PROJECT = ['triage.py', 'classify.py', 'drafter.py', 'review.py', 'calendar_sync.py', 'config.yaml', 'prompts/', 'auto_send.py',
  'smtp_client.py', 'confidence.py', 'tests/test_auto_send.py', 'deploy.sh'].map((f) => [f, -1e9]);
const EARLY = ['triage.py', 'classify.py', 'drafter.py', 'review.py', 'config.yaml', 'prompts/'].map((f) => [f, -1e9]);   // Sunday's project
const BRIEF_FILES = ['modules/briefing.py', 'integrations/slack.py', 'tests/test_briefing.py'].map((f) => [f, -1e9]);
const LATER = (extra = []) => filesOf(PROJECT, MODULE_FILES.map((x) => [x, -1e9]), extra);
const INTRO_TERM_TAIL = [['$ pytest tests/test_auto_send.py -q', C.ok], ['7 passed in 0.41s', C.ok], ['$ ./deploy.sh --auto-send', C.ok],
  ['deploying auto_send ............ done', C.txt], ['auto-send is LIVE  (threshold 0.90)', C.ok],
  ['03:07:12  sent  re: Thursday sync -> maya@', C.txt], ['03:07:14  sent  re: invoice 4471 -> billing@', C.txt]];

// A08: hands off the keys; Claude writes classify.py, then draft_reply.py, by itself
function laptopA08(g, t) {
  const [a] = A08, u = t - a;
  const t2 = a + 0.95;                                      // "Writing draft_reply.py..."
  const say = 'On it.\nWriting classify.py...' + (u >= 0.7 ? ' done ✓' : '') + (u >= 0.95 ? '\nWriting draft_reply.py...' : '');
  const shown = u < 0.7 ? say.slice(0, streamN(t, a, 45, say.length)) : u < 0.95 ? say : say.slice(0, 'On it.\nWriting classify.py... done ✓'.length + streamN(t, t2, 45, 99));
  const file = t < t2 ? 'classify.py' : 'draft_reply.py';
  const src = CODE[file], n = streamN(t, t < t2 ? a - 0.8 : t2, t < t2 ? 210 : 270, src.join('\n').length);
  ide(g, t, {
    files: [...PROJECT, ['draft_reply.py', t2]], active: file, tabs: ['triage.py', 'auto_send.py', 'classify.py', ...(t >= t2 ? ['draft_reply.py'] : [])],
    code: upto(src, Math.max(1, n)), caret: 'solid',
    term: INTRO_TERM_TAIL, termCaret: true,
    chat: [['claude', 'Good. I will watch the first few sends with you.'], ['you', 'now make classify + the drafter smarter. go'], ['claude', shown, true]],
  });
}
// A09: three yeses, faster each time. Claude Code's permission prompts, big, in the lower half of the screen
// (the macro sees the bottom of the screen, soft, at the top of its frame)
const PROMPTS = [['Apply 3 changes?', '✓ applied'], ['Add tests?', '✓ 12 tests added'], ['Deploy?', '✓ deployed · live']];
function laptopA09(g, t) {
  reset(g);
  g.fillStyle = C.term; g.fillRect(0, 0, 1600, 1000);
  menubar(g, t, 'Terminal — claude — inbox-agent');
  g.font = `600 30px ${MONO}`; g.fillStyle = C.claude; g.fillText('✻ Claude', 60, 80);
  g.font = `28px ${MONO}`; g.fillStyle = C.grey; g.fillText('~/inbox-agent', 260, 80);
  const diff = [['● Update classify.py', '+48 −12'], ['● Write  draft_reply.py', '+71'], ['● Update config.yaml', '+3 −1']];
  diff.forEach(([f, d], i) => {
    g.font = `28px ${MONO}`; g.fillStyle = C.txt; g.fillText(f, 60, 150 + i * 46);
    g.fillStyle = C.ok; g.fillText(d, 640, 150 + i * 46);
  });
  // prompt i appears after the Enter of prompt i-1; the newest sits lowest
  const ENTER_LAG = 0.14;
  const shown = PROMPTS.map((p, i) => ({ p, at: i === 0 ? -1e9 : YES[i - 1] + ENTER_LAG, y: YES[i] })).filter((s) => t >= s.at);
  const LH = 112, base = 880;
  shown.forEach((s, k) => {
    const y = base - (shown.length - 1 - k) * LH;
    const answered = t >= s.y, done = t >= s.y + ENTER_LAG;
    const current = k === shown.length - 1 && !done;
    if (current) { g.strokeStyle = C.claude; g.lineWidth = 3; rr(g, 40, y - 48, 1520, 96, 14); g.stroke(); }
    g.font = `600 54px ${MONO}`; g.fillStyle = current ? '#ffffff' : '#8a8f99';
    const q = `${s.p[0]} (y/n) `; g.fillText(q, 70, y);
    const qw = g.measureText(q).width;
    if (answered) { g.fillStyle = current ? '#ffffff' : '#b8bcc6'; g.fillText('y', 70 + qw, y); }
    else if (blink(t)) { g.fillStyle = '#e6e6e6'; g.fillRect(74 + qw, y - 28, 30, 56); }
    if (done) { g.font = `600 40px ${SANS}`; g.fillStyle = C.ok; g.fillText(s.p[1], 140 + qw, y + 2); }
  });
}
// the day: the inbox he's drowning in (s02 mail(), bigger, with the 412 badge)
function dayMail(g, t) {
  reset(g);
  g.fillStyle = C.ed; g.fillRect(0, 0, 1600, 1000); menubar(g, t, 'Mail');
  g.fillStyle = '#12141b'; g.fillRect(0, 26, 260, 974);
  const arrived = Math.floor(Math.max(0, t - W0('B01')) / 2.6);
  const unread = MAIL_DAY;                                     // the badge reads 412 all afternoon (B03 reads it)
  g.font = `600 24px ${SANS}`; g.fillStyle = '#e9ecf2'; g.fillText('Inbox', 24, 72);
  g.fillStyle = '#e06c75'; rr(g, 158, 54, 84, 36, 18); g.fill(); g.fillStyle = '#fff'; g.font = `700 22px ${SANS}`; g.textAlign = 'center'; g.fillText(String(unread), 200, 73); g.textAlign = 'left';
  g.font = `20px ${SANS}`; g.fillStyle = '#9aa0ad';
  ['Flagged', 'Drafts', 'Sent', 'Archive', 'Newsletters', 'Receipts'].forEach((s, i) => g.fillText(s, 24, 128 + i * 40));
  // new mail arrives at the top every 2.6 s: the list slides down one row to make room
  const slide = smooth((t - W0('B01') - arrived * 2.6) / 0.4);
  g.save(); g.beginPath(); g.rect(260, 26, 1340, 974); g.clip();
  for (let k = 0; k < 14; k++) {
    const idx = (k - arrived + 400) % SUBJ.length;
    const y = 30 + (k - 1 + slide) * 76;
    const isNew = k < 4;
    g.globalAlpha = k === 0 ? slide : 1;
    g.fillStyle = k % 2 ? '#171a23' : '#151821'; g.fillRect(260, y, 1340, 74);
    if (isNew) { g.fillStyle = '#61afef'; g.beginPath(); g.arc(288, y + 37, 7, 0, 7); g.fill(); }
    g.font = `${isNew ? 600 : 400} 24px ${SANS}`; g.fillStyle = isNew ? '#ffffff' : '#c9ccd3';
    g.fillText(FROM[idx], 312, y + 25); g.fillText(SUBJ[idx], 560, y + 25);
    g.font = `19px ${SANS}`; g.fillStyle = '#7d8392';
    g.fillText('Hi Ivan, quick one: could you take a look and reply by end of day…', 560, y + 54);
    g.fillText(`${1 + (idx % 2)}:${String(59 - ((idx * 7) % 59)).padStart(2, '0')} PM`, 1490, y + 25);
    g.globalAlpha = 1;
  }
  g.restore();
}
// B07 - C02: the first module, Claude writing it with him
function laptopB7(g, t, keys) {
  const a = W0('B07'), cOn = W0('C01');
  const sayB = "Great! Let's start with triage.py. It reads your inbox and sorts every email into reply, fyi or ignore. Nothing sends without you.";
  const msgs = [['you', 'yes'], ['claude', sayB.slice(0, streamN(t, a + 0.2, 45, sayB.length)), t < a + 0.2 + sayB.length / 45]];
  const term = [['$ python triage.py --dry-run', C.ok]];
  if (t >= cOn) {
    const r = [['412 emails -> 61 reply · 230 fyi · 121 ignore', C.txt, 0.3], ['$ python drafter.py', C.ok, 0.9], ['61 drafts ready for review ✓', C.ok, 1.5],
      ['$ python review.py --batch 20', C.ok, 2.1], ['[20/20] approved', C.ok, 2.6]];
    for (const [s, c, d] of r) if (t >= cOn + d) term.push([s, c]);
    msgs.push(['you', 'IT WORKS. 61 drafts that sound like me']);
    const say2 = 'It does. Review them in batches; you approve every one.';
    msgs.push(['claude', say2.slice(0, streamN(t, cOn + 1.0, 40, say2.length))]);
  }
  const file = t < cOn ? 'triage.py' : 'drafter.py', src = CODE[file];
  const n = t < cOn ? typedN(keys, a + 0.8, Infinity, t, src.join('\n').length, 30) : 1e9;
  ide(g, t, {
    files: [['triage.py', a], ['classify.py', a], ['drafter.py', cOn - 1], ['review.py', cOn - 1], ['config.yaml', a], ['prompts/', a]],
    active: file, tabs: ['triage.py', ...(t >= cOn ? ['drafter.py'] : [])], code: upto(src, n), caret: t < cOn ? 'solid' : true,
    term, termCaret: true, chat: msgs,
  });
}
// C03: module after module, one per word
function laptopC3(g, t) {
  const done = MODS.filter((m) => t >= m).length;
  const say = ['What else can it do?'];
  const lines = MODULE_FILES.slice(0, done).map((f, i) => `Writing ${f}...` + (i < done - 1 || t >= MODS[i] + 0.8 ? ' done ✓' : ''));
  const file = done ? MODULE_FILES[done - 1] : 'drafter.py', src = CODE[file];
  const n = done ? streamN(t, MODS[done - 1], 160, 999) : 999;
  ide(g, t, {
    files: filesOf(EARLY, MODULE_FILES.map((f, i) => [f, MODS[i]])),
    active: file, tabs: ['triage.py', 'drafter.py', ...MODULE_FILES.slice(0, done)], code: upto(src, n), caret: 'solid',
    term: [['412 emails -> 61 reply · 230 fyi · 121 ignore', C.txt], ['61 drafts ready for review ✓', C.ok], ['[20/20] approved', C.ok],
      ...MODULE_FILES.slice(0, done).map((f, i) => [`$ python ${f} --check   ok`, t >= MODS[i] + 0.8 ? C.ok : C.txt])],
    termCaret: true,
    chat: [['you', say[0]], ['claude', 'Quite a lot. One module at a time:'], ...(lines.length ? [['claude', lines.join('\n'), t < MODS[done - 1] + 0.8]] : [])],
  });
}
// C04: the time-lapse. Code flickers: a different file and place every 1/8 s, the explorer keeps growing
function laptopC4(g, t) {
  const k = Math.floor(t * 8), files = Object.keys(CODE);
  const f = files[Math.floor(hash(k) * files.length)], src = CODE[f];
  const cut = 1 + Math.floor(hash(k + 7) * src.length);
  const grown = Math.floor(clamp01((t - W0('C04')) / (W1('C04') - W0('C04'))) * 14);
  const extra = ['mail/rules.yaml', 'calendar/prefs.yaml', 'docs/templates/', 'reading/feeds.txt', 'prompts/tone.md', 'scheduler/tz.py', 'tests/test_calendar.py',
    'tests/test_docs.py', 'tests/test_digest.py', 'notify.py', 'dashboard.py', 'cron.yaml', 'secrets.env', 'README.md'].slice(0, grown).map((x) => [x, -1e9]);
  ide(g, t, {
    files: filesOf(EARLY, MODULE_FILES.map((x) => [x, -1e9]), extra), active: f, tabs: [f, ...MODULE_FILES.slice(0, 3)],
    code: src.slice(0, cut), caret: 'solid',
    term: Array.from({ length: 10 }, (_, i) => [ALL_CODE[Math.floor(hash(k * 13 + i) * ALL_CODE.length)].trim() || 'ok', hash(k + i) > 0.7 ? C.ok : C.txt]),
    chat: [['you', ['next', 'and this?', 'faster', 'yes', 'go'][k % 5]], ['claude', `Writing ${f}... done ✓`]],
  });
}
// C05: TODO.md (s02 todo()): items check themselves off just ahead of the focus rack down the list
const TODO_Y = (i) => 200 + i * 50;
const TODO_AT = (() => {
  const s = SHOT.C05, f = Array.isArray(s.focus) && Array.isArray(s.focus[0]) ? s.focus.map(([tt, p]) => [tt, +(/,(\d+)/.exec(String(p)) || [0, NaN])[1]]).filter(([, y]) => y > 0) : [];
  const at = TODO.map((_, i) => {
    if (f.length < 2) return lerp(s.t0 + 0.3, s.t1 - 0.9, i / (TODO.length - 1));
    const y = TODO_Y(i) - 25;                               // the tick lands just before the focus arrives
    if (y <= f[0][1]) return f[0][0];
    for (let k = 1; k < f.length; k++) if (y <= f[k][1]) return lerp(f[k - 1][0], f[k][0], (y - f[k - 1][1]) / (f[k][1] - f[k - 1][1]));
    return f[f.length - 1][0];
  });
  let prev = s.t0 + 0.05;
  return at.map((x) => (prev = Math.min(s.t1 - 0.5, Math.max(x, prev + 0.25))));
})();
function todo(g, t, allOpen = false) {
  reset(g);
  g.fillStyle = C.ed; g.fillRect(0, 0, 1600, 1000); menubar(g, t);
  g.fillStyle = C.bar; g.fillRect(0, 26, 1600, 36); g.font = `15px ${SANS}`; g.fillStyle = '#ffffff'; g.fillText('TODO.md', 24, 44);
  g.font = `600 40px ${SANS}`; g.fillStyle = '#e9ecf2'; g.fillText('# TODO', 150, 126);
  TODO.forEach((s, i) => {
    const y = TODO_Y(i), done = !allOpen && t >= TODO_AT[i], pop = done ? smooth((t - TODO_AT[i]) / 0.18) : 0;
    g.strokeStyle = done ? '#7fd3a0' : '#7d8392'; g.lineWidth = 3; g.strokeRect(150, y - 17, 34, 34);
    if (done) { g.fillStyle = '#7fd3a0'; g.font = `700 32px ${SANS}`; g.fillText('✓', 153, y + 1); }
    g.font = `34px ${MONO}`; g.fillStyle = done ? '#5c6370' : '#d7dae0'; g.fillText(s, 214, y);
    if (done) { g.fillStyle = '#5c6370'; g.fillRect(214, y - 1, g.measureText(s).width * pop, 3); }
  });
  const end = TODO_AT[TODO_AT.length - 1] + 0.3;
  if (!allOpen && t >= end) { g.globalAlpha = smooth((t - end) / 0.25); g.font = `600 36px ${SANS}`; g.fillStyle = '#7fd3a0'; g.fillText('nothing left.', 214, TODO_Y(TODO.length) + 30); g.globalAlpha = 1; }
}
// D: the second night. The auto-sends scroll in the terminal; he asks for one more module, then slack
const BRIEF_ASK = 'one more. a morning briefing, then slack. then i sleep';
function laptopD(g, t, keys) {
  const a = W0('D01'), d4 = W0('D04'), d5 = W0('D05');
  const sends = sentLog(t);
  const msgs = [['you', 'calendar, docs and reading are all live. what next?'],
    ['claude', 'A morning briefing would tie them together: mail, meetings and reading in one summary, posted to Slack at 7.']];
  let reply = '', file = 'research_digest.py', tabs = [...MODULE_FILES], code = CODE['research_digest.py'];
  if (t < d5) reply = BRIEF_ASK.slice(0, typedN(keys, d4, d5 - 0.2, t, BRIEF_ASK.length, 12));
  else {
    msgs.push(['you', BRIEF_ASK]);
    const s = 'Writing modules/briefing.py...' + (t >= D05M[1] ? ' done ✓\nWriting integrations/slack.py...' : '') + (t >= D05M[1] + 0.9 ? '\nProceed? (y/n)' : '');
    msgs.push(['claude', s.slice(0, streamN(t, D05M[0], 60, s.length)), true]);
    file = t >= D05M[1] ? 'integrations/slack.py' : t >= D05M[0] ? 'modules/briefing.py' : file;
    tabs = [...MODULE_FILES.slice(2), ...(t >= D05M[0] ? ['modules/briefing.py'] : []), ...(t >= D05M[1] ? ['integrations/slack.py'] : [])];
    code = upto(CODE[file], t >= D05M[0] ? streamN(t, t >= D05M[1] ? D05M[1] : D05M[0], 160, 999) : 999);
  }
  if (t < d5) code = upto(code, 120 + typedN(keys, a, d4, t, 99, 4));
  ide(g, t, {
    files: LATER([['modules/briefing.py', D05M[0]], ['integrations/slack.py', D05M[1]]]),
    active: file, tabs, code, caret: true,
    term: sends.slice(-11).map(([m, s]) => [`${stamp(m)}  sent  ${s}`, C.txt]), termCaret: true,
    chat: msgs, reply, replyCaret: t < d5,
  });
}
// E: 4 AM. Claude writes the tests faster than he can read; he stops typing; then pytest, Enter, 42 passed
const E_ASK = 'and keep the slack posts quiet before 7, and';
function laptopE(g, t) {
  const e5 = W0('E05'), e6 = W0('E06');
  const src = CODE['tests/test_briefing.py'].concat(CODE['integrations/slack.py'], CODE['modules/briefing.py']);
  // scroll position: slow, then accelerating through E05 (too fast to read), easing to a stop in E06
  const scroll = rush(t, 0.35, 16) - W0('E01') * 0.35;
  const s = 'Writing tests/test_briefing.py... ' + (t >= e6 ? 'done ✓\n42 tests. Run them when you are ready.' : '');
  ide(g, t, {
    files: LATER(BRIEF_FILES),
    active: 'tests/test_briefing.py', tabs: ['modules/briefing.py', 'integrations/slack.py', 'tests/test_briefing.py'],
    code: src, scroll,
    term: sentLog(t).slice(-11).map(([m, x]) => [`${stamp(m)}  sent  ${x}`, C.txt]), termCaret: true,
    chat: [['you', 'y'], ['claude', 'Done. slack.py posts the briefing at 7:00 and answers @mentions.'], ['you', 'tests too'], ['claude', s, t < e6]],
    reply: E_ASK.slice(0, typedN(null, W0('E01') + 0.5, Infinity, Math.min(t, STOP_TYPING), E_ASK.length, 2.5)), replyCaret: t < STOP_TYPING,
  });
}
const DOTS = '..........................................';
function laptopTests(g, t) {
  const run = t >= ENTER;
  const term = [['$ git add -A && git commit -qm "briefing + slack"', C.ok], ['$ pytest tests/ -q', C.ok]];
  const big = [];
  if (run) {
    const n = Math.floor(clamp01((t - ENTER - 0.08) / Math.max(0.2, PASS - ENTER - 0.1)) * DOTS.length);
    big.push([DOTS.slice(0, n).padEnd(DOTS.length) + (n >= DOTS.length ? ' [100%]' : `  [${Math.floor(n * 100 / DOTS.length)}%]`), n >= DOTS.length ? C.ok : C.txt]);
  }
  ide(g, t, {
    files: LATER(BRIEF_FILES),
    active: 'tests/test_briefing.py', tabs: ['modules/briefing.py', 'integrations/slack.py', 'tests/test_briefing.py'],
    code: CODE['tests/test_briefing.py'], caret: false, termBig: true,
    term: run ? [term[1], ...big] : [term[0]], termCaret: !run, termCmd: run ? '' : 'pytest tests/ -q',
    chat: [['claude', 'Done. slack.py posts the briefing at 7:00 and answers @mentions.'], ['you', 'tests too'],
      ['claude', 'Writing tests/test_briefing.py... done ✓\n42 tests. Run them when you are ready.'],
      ...(t >= PASS + 0.5 ? [['claude', 'All 42 pass. The briefing is live. ✓'.slice(0, streamN(t, PASS + 0.5, 45, 99))]] : [])],
  });
  if (t >= PASS) {
    // the hit: '42 passed' on the result line (lap:400,850), then the green floods the screen and, in E09, warms
    const flood = smooth((t - PASS) / 0.35);
    const warm = smooth((t - W0('E09')) / (W1('E09') - W0('E09')));
    const decay = t < W0('E09') ? 1 : lerp(1, 0.32, warm);
    const col = [lerp(70, 255, warm * 0.8), lerp(235, 214, warm), lerp(140, 120, warm)].map(Math.round);
    g.save(); g.globalCompositeOperation = 'screen';
    g.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${0.55 * flood * decay})`; g.fillRect(0, 0, 1600, 1000);
    g.restore();
    g.fillStyle = `rgba(10,40,22,${0.85})`; rr(g, 20, 800, 950, 100, 16); g.fill();
    g.font = `700 60px ${MONO}`; g.fillStyle = '#b6ffd0'; g.fillText('✓ 42 passed', 50, 851);
    g.font = `34px ${MONO}`; g.fillStyle = '#9df2bd'; g.fillText('in 3.12s', 520, 853);
  }
}
// F: sunrise. Everything runs; nothing needs him
function laptopF(g, t) {
  ide(g, t, {
    files: LATER(BRIEF_FILES),
    active: 'modules/briefing.py', tabs: ['modules/briefing.py', 'integrations/slack.py'], code: CODE['modules/briefing.py'], caret: true,
    term: [['✓ 42 passed in 3.12s', C.ok], ...sentLog(t).slice(-6).map(([m, s]) => [`${stamp(m)}  sent  ${s}`, C.txt]), ['06:00:00  briefing posted -> #ivan', C.ok]],
    termCaret: true,
    chat: [['claude', 'All four modules are running. Your inbox is at zero, the calendar is clear, and the briefing goes out at 7.'],
      ['claude', 'What would you like to do next?']],
  });
}

// ------------------------------------------------------------------ the monitor: pipeline and dashboards
function monBar(g, t, label) {
  g.fillStyle = '#0d0f15'; g.fillRect(0, 0, 1600, 900);
  g.fillStyle = '#151924'; g.fillRect(0, 0, 1600, 44);
  g.font = `18px ${SANS}`; g.fillStyle = '#b8bcc6'; g.fillText(label, 20, 22);
  g.textAlign = 'right'; g.fillText(hm(clockAt(t)), 1580, 22); g.textAlign = 'left';
}
// the day: a calendar with no room in it (s02 calendar())
function calendarDay(g, t) {
  reset(g); monBar(g, t, 'Calendar · Week 11');
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  days.forEach((d, i) => { g.font = `600 24px ${SANS}`; g.fillStyle = '#9aa0ad'; g.fillText(d, 140 + i * 290, 76); });
  const cols = ['#3d6fd8', '#2e9e6b', '#b5603a', '#8e5bd1', '#c4a23a'];
  for (let i = 0; i < 5; i++) for (let h = 0; h < 15; h++) {
    const r = (i * 31 + h * 17) % 7; if (r > 4) continue;
    const y = 100 + h * 52, x = 110 + i * 290, xo = r === 3 ? 120 : 0;
    g.fillStyle = cols[r] + 'cc'; rr(g, x + xo, y, r === 3 ? 150 : 270, 47, 6); g.fill();
    g.font = `18px ${SANS}`; g.fillStyle = '#fff'; g.fillText(SUBJ[(i * 7 + h) % SUBJ.length].slice(0, r === 3 ? 11 : 22), x + 10 + xo, y + 24);
    if ((i + h) % 9 === 0) { g.fillStyle = '#e06c75'; g.fillRect(x - 7, y, 5, 47); }
  }
  g.fillStyle = '#5a1f25'; rr(g, 1240, 8, 200, 30, 15); g.fill(); g.font = `600 17px ${SANS}`; g.fillStyle = '#ffb3b8'; g.fillText('3 conflicts', 1262, 23);
}
// B07 - C02: the first pipeline. In C01 the cards tick green one after the other (the floating cards do the same)
const PIPE = [['INBOX', `${MAIL_DAY} unread`], ['SORT', 'reply · fyi · ignore'], ['DRAFT', 'in your voice'], ['YOU', 'review + approve']];
function pipeline4(g, t) {
  reset(g); monBar(g, t, 'pipeline.local  /  inbox-agent');
  const c1 = W0('C01'), tick = PIPE.map((_, i) => c1 + 0.35 + i * 0.6);
  g.font = `600 40px ${SANS}`; g.fillStyle = '#e9ecf2'; g.fillText('Email automation', 60, 110);
  const all = t >= tick[3] + 0.3;
  const pill = all ? ['WORKING', '#1f6f43', '#9df2bd'] : t >= W0('C00') ? ['FIRST RUN', '#5a4a1c', '#f2d38a'] : ['BUILDING', '#2a2f3d', '#aeb4c2'];
  g.font = `600 22px ${SANS}`; const pw = g.measureText(pill[0]).width + 36;
  g.fillStyle = pill[1]; rr(g, 440, 90, pw, 42, 21); g.fill(); g.fillStyle = pill[2]; g.fillText(pill[0], 458, 112);
  const nx = (i) => 60 + i * 385, ny = 240, nw = 320, nh = 230;
  for (let i = 0; i < 3; i++) {
    const x0 = nx(i) + nw, x1 = nx(i + 1), y = ny + nh / 2;
    g.strokeStyle = '#3c4a66'; g.lineWidth = 4; g.beginPath(); g.moveTo(x0, y); g.lineTo(x1 - 10, y); g.stroke();
    g.fillStyle = '#3c4a66'; g.beginPath(); g.moveTo(x1, y); g.lineTo(x1 - 16, y - 10); g.lineTo(x1 - 16, y + 10); g.fill();
    if (t >= tick[i]) for (let k = 0; k < 3; k++) {
      const u = (t * 0.7 + k / 3 + i * 0.2) % 1;
      g.globalAlpha = smooth(u * 6) * smooth((1 - u) * 6); g.fillStyle = '#9cc4ff'; g.fillRect(x0 + u * (x1 - x0 - 20) - 8, y - 7, 16, 14); g.globalAlpha = 1;
    }
  }
  // the loop back, YOU -> INBOX
  g.strokeStyle = all ? '#7fd3a0' : '#2a2f3d'; g.lineWidth = 3; g.setLineDash([10, 10]);
  g.beginPath(); g.moveTo(nx(3) + nw / 2, ny + nh); g.lineTo(nx(3) + nw / 2, ny + nh + 70); g.lineTo(nx(0) + nw / 2, ny + nh + 70); g.lineTo(nx(0) + nw / 2, ny + nh + 8); g.stroke(); g.setLineDash([]);
  PIPE.forEach(([name, sub], i) => {
    const x = nx(i), on = t >= tick[i], pop = on ? smooth((t - tick[i]) / 0.25) : 0;
    g.fillStyle = on ? `rgb(${22 + 8 * pop},${32 + 30 * pop},${30 + 12 * pop})` : '#161b27'; rr(g, x, ny, nw, nh, 18); g.fill();
    g.strokeStyle = on ? '#7fd3a0' : t >= W0('C00') ? '#e5c07b' : '#3a3f4d'; g.lineWidth = on ? 4 : 2; g.stroke();
    g.font = `700 40px ${SANS}`; g.fillStyle = '#e9ecf2'; g.fillText(name, x + 28, ny + 52);
    g.font = `24px ${SANS}`; g.fillStyle = '#9aa0ad'; g.fillText(sub, x + 28, ny + 100);
    g.font = `700 60px ${SANS}`; g.fillStyle = on ? '#9df2bd' : '#4b5263';
    g.fillText(on ? '✓' : '…', x + 28, ny + 170);
    if (on) { g.font = `600 28px ${MONO}`; g.fillStyle = '#9df2bd'; g.fillText(['412', '61 reply', '61 drafts', '20 / 20'][i], x + 92, ny + 172); }
  });
  g.font = `24px ${MONO}`; g.fillStyle = '#7d8392';
  g.fillText(all ? 'run 1 · 412 emails in 3.8 s · 61 drafts waiting for review' : 'waiting for first run', 60, 820);
}
// C03 - V: the modules light one by one (s02 modules()); counters race through the C04 time-lapse
function modules(g, t) {
  reset(g); monBar(g, t, 'pipeline.local  /  modules');
  g.font = `600 36px ${SANS}`; g.fillStyle = '#e9ecf2'; g.fillText('inbox-agent · modules', 40, 96);
  const M = [['email', 'replies drafted', W0('C01')], ...MODULE_NAMES.map((n, i) => [n, ['conflicts resolved', 'meetings booked', 'docs drafted', 'papers summarized'][i], MODS[i]])];
  const c4 = W0('C04'), c4e = W1('C04');
  // counter time: 2/s, x20 inside the time-lapse
  const ct = (on) => { const seg = (x0, x1) => Math.max(0, Math.min(t, x1) - Math.max(on, x0)); return 2 * seg(-1e9, c4) + 40 * seg(c4, c4e) + 2 * seg(c4e, 1e9); };
  M.forEach(([name, what, on], i) => {
    const row = Math.floor(i / 3), x = (row ? 297 : 40) + (i % 3) * 515, y = 140 + row * 375;   // 3 + 2, the second row centred
    const live = t >= on, pop = live ? smooth((t - on) / 0.35) : 0;
    g.fillStyle = live ? `rgb(24,${50 + 40 * pop},${36 + 20 * pop})` : '#141822'; rr(g, x, y, 490, 345, 20); g.fill();
    g.strokeStyle = live ? '#7fd3a0' : '#2a2f3d'; g.lineWidth = live ? 4 : 2; g.stroke();
    if (live && t - on < 0.6) { g.save(); g.shadowColor = '#7fd3a0'; g.shadowBlur = 40 * (1 - (t - on) / 0.6); g.stroke(); g.restore(); }
    g.font = `700 46px ${SANS}`; g.fillStyle = live ? '#e9ecf2' : '#5b6070'; g.fillText(name, x + 30, y + 58);
    g.font = `600 76px ${MONO}`; g.fillStyle = live ? '#9df2bd' : '#3a3f4d';
    g.fillText(live ? String(Math.floor(12 + ct(on) * (i + 2))) : '—', x + 30, y + 170);
    g.font = `26px ${SANS}`; g.fillStyle = '#9aa0ad'; g.fillText(live ? what : 'not built yet', x + 30, y + 250);
    g.fillText(live ? 'running' : '', x + 30, y + 296);
  });
}
// D: the auto-replies. Twelve fire through D02 while her text sits unanswered on the bed
const D2S = (() => { const a = W0('D02') + 0.5, b = W1('D02') - 0.7; return Array.from({ length: 12 }, (_, i) => a + (b - a) * (i + 0.25 * (hash(i + 99) - 0.5)) / 11); })();
function sendTimes(t) {
  // a few before D02, the twelve, then one every ~2.4 s through the rest of the night
  const pre = [W0('D01') + 0.6, W0('D01') + 2.1];
  const out = [...pre, ...D2S];
  for (let x = W1('D02') + 1.2; x < DURATION && x <= t; x += 2.4 + hash(Math.floor(x)) * 0.8) out.push(x);
  return out.filter((x) => x <= t);
}
function sentLog(t) {
  if (t < W0('D01')) return [];
  return sendTimes(t).map((x, i) => [clockAt(x), `${SUBJ[(i * 7 + 3) % SUBJ.length].toLowerCase()} -> ${FROM[(i * 5 + 1) % FROM.length].split(' ')[0].toLowerCase()}@`]);
}
function sentFlurry(g, t) {
  reset(g); monBar(g, t, 'pipeline.local  /  auto-replies');
  const ts = sendTimes(t);
  g.font = `600 38px ${SANS}`; g.fillStyle = '#e9ecf2'; g.fillText('Auto-replies', 40, 96);
  g.fillStyle = '#1f6f43'; rr(g, 300, 76, 210, 40, 20); g.fill(); g.font = `600 20px ${SANS}`; g.fillStyle = '#9df2bd'; g.fillText('AUTO-SEND LIVE', 318, 97);
  g.textAlign = 'right'; g.font = `600 30px ${MONO}`; g.fillStyle = '#9df2bd'; g.fillText(`${1172 + ts.length} sent tonight`, 1560, 96); g.textAlign = 'left';
  // the newest send drops in at the top and pushes the list down one row
  const rows = ts.slice(-13).reverse(), RH = 58, top = 150;
  const s = rows.length ? smooth((t - rows[0]) / 0.25) : 1;
  g.save(); g.beginPath(); g.rect(0, top - 4, 1600, RH * 12 + 4); g.clip();
  rows.forEach((x, k) => {
    const i = ts.length - 1 - k, age = t - x, y = top + (k - 1 + s) * RH;
    const flash = Math.max(0, 1 - age / 0.7);
    g.globalAlpha = k === 0 ? s : Math.max(0.3, 1 - k * 0.035);
    g.fillStyle = flash > 0 ? `rgba(30,${90 + 70 * flash},${60 + 30 * flash},1)` : (k % 2 ? '#131722' : '#11141d'); rr(g, 40, y, 1520, RH - 6, 10); g.fill();
    g.fillStyle = '#1f6f43'; rr(g, 56, y + 8, 140, RH - 22, 18); g.fill();
    g.font = `700 26px ${SANS}`; g.fillStyle = '#b6ffd0'; g.fillText('Sent ✓', 74, y + RH / 2 - 3);
    g.font = `28px ${SANS}`; g.fillStyle = '#e9ecf2'; g.fillText(`re: ${SUBJ[(i * 7 + 3) % SUBJ.length]}`, 224, y + RH / 2 - 3);
    g.fillStyle = '#9aa0ad'; g.fillText(`→ ${FROM[(i * 5 + 1) % FROM.length]}`, 900, y + RH / 2 - 3);
    g.font = `24px ${MONO}`; g.fillStyle = '#7d8392'; g.textAlign = 'right'; g.fillText(stamp(clockAt(x)), 1540, y + RH / 2 - 3); g.textAlign = 'left';
    g.globalAlpha = 1;
  });
  g.restore();
}
// E / F: the dashboard. E01-E05 stats + log; E06 the 'hours saved' counter; F the four tiles
const STATS = [['emails answered', '#7fd3a0'], ['meetings moved', '#e5c07b'], ['docs drafted', '#7fb2ff'], ['hours saved', '#ff9e7a']];
function hoursAt(t) {
  const a = W0('E06') + 0.4, b = W1('E06') - 1.0;
  if (t < W0('E06')) return HOURS[0] - 1 + clamp01((t - W0('E01')) / (W0('E06') - W0('E01')));
  return HOURS[0] + (HOURS[1] - HOURS[0]) * smooth(clamp01((t - a) / (b - a)));
}
// scroll positions (lines) as integrals of the speed, so a speed-up never jumps: steady, then E05 accelerates
// (v grows linearly to `peak` lines/s), then eases back after E05
function rush(t, base, peak) {
  const a = W0('E05'), b = W1('E05'), d = b - a, k = peak / d;
  let p = t * base;
  if (t > a) p += 0.5 * k * Math.min(t - a, d) ** 2;
  if (t > b) p += peak * (1 - Math.exp(-(t - b) * 1.5)) / 1.5;
  return p;
}
function dashLog(g, t, x, y, w, h, pos) {
  g.fillStyle = '#0a0c11'; rr(g, x, y, w, h, 14); g.fill();
  g.save(); g.beginPath(); g.rect(x, y + 6, w, h - 12); g.clip();
  g.font = `22px ${MONO}`;
  const LH = 32, msgs = ['classified 12 msgs', 'draft ready -> review', 'calendar conflict resolved', 'summary written: q3.pdf', 'auto-sent 3 replies', 'meeting booked: Thu 2pm'];
  const base = Math.floor(pos), fr = pos - base, n = Math.floor(h / LH);
  for (let r = 0; r <= n; r++) {
    const i = base - n + r, yy = y + 26 + (r - fr) * LH;
    const ok = hash(i) > 0.35;
    g.fillStyle = '#7d8392'; g.fillText(stamp(clockAt(W0('E01')) + i / 30), x + 20, yy);
    g.fillStyle = ok ? '#7fd3a0' : '#9aa0ad'; g.fillText(ok ? 'OK' : 'INFO', x + 160, yy);
    g.fillStyle = '#b8bcc6'; g.fillText(msgs[Math.floor(hash(i + 5) * msgs.length)], x + 240, yy);
  }
  g.restore();
}
function dashboard(g, t) {
  reset(g); monBar(g, t, 'pipeline.local  /  dashboard');
  const pos = rush(t, 1.2, 18);
  if (t < W0('E06')) {
    const vals = [1284 + Math.floor((t - W0('E01')) * 0.8), 14 + Math.floor((t - W0('E01')) / 9), 9, Math.floor(hoursAt(t))];
    STATS.forEach(([name, col], i) => {
      const x = 40 + i * 385;
      g.fillStyle = '#151924'; rr(g, x, 70, 365, 170, 16); g.fill();
      g.font = `26px ${SANS}`; g.fillStyle = '#9aa0ad'; g.fillText(name, x + 24, 108);
      g.font = `700 70px ${SANS}`; g.fillStyle = col; g.fillText(i === 3 ? `${vals[i]}h` : vals[i].toLocaleString('en-US'), x + 24, 186);
    });
    dashLog(g, t, 40, 270, 1520, 590, pos);
    return;
  }
  // E06 and after: the counter, big, at the centre of the screen (the focus mark mon:800,450)
  const h = Math.floor(hoursAt(t)), dh = h - HOURS[0];
  g.fillStyle = '#121722'; rr(g, 300, 150, 1000, 600, 28); g.fill();
  g.font = `600 44px ${SANS}`; g.fillStyle = '#9aa0ad'; g.textAlign = 'center'; g.fillText('hours saved this week', 800, 232);
  g.font = `700 260px ${MONO}`; g.fillStyle = '#e9ecf2'; g.fillText(`${h}h`, 800, 440);
  g.font = `36px ${SANS}`; g.fillStyle = dh > 0 ? '#ff9e7a' : '#7d8392'; g.fillText(dh > 0 ? `+${dh}h tonight` : 'tonight', 800, 600);
  g.textAlign = 'left';
  // a thin climbing line under it
  g.strokeStyle = '#ff9e7a'; g.lineWidth = 4; g.beginPath();
  for (let i = 0; i <= 40; i++) { const x = 360 + i * 22, v = (i / 40) ** 1.6 * (0.5 + 0.5 * clamp01(dh / Math.max(1, HOURS[1] - HOURS[0]))); g.lineTo(x, 715 - v * 60 - hash(i) * 6); }
  g.stroke();
  g.font = `26px ${MONO}`; g.fillStyle = '#7d8392'; g.textAlign = 'center';
  g.fillText(`${1284 + Math.floor((t - W0('E01')) * 0.8)} emails answered · 5 modules running`, 800, 818); g.textAlign = 'left';
  if (t >= PASS) {
    g.globalAlpha = smooth((t - PASS) / 0.3); g.fillStyle = '#123524'; rr(g, 1060, 66, 500, 66, 14); g.fill();
    g.font = `600 28px ${SANS}`; g.fillStyle = '#b6ffd0'; g.fillText('✓ briefing · 42 tests passed', 1084, 100); g.globalAlpha = 1;
  }
}
const TILE = [['email', 'inbox 0 · 61 replied'], ['calendar', '12 events placed'], ['documents', '3 drafts ready'], ['reading', '9 papers summarized']];
function tiles(g, t) {
  reset(g); monBar(g, t, 'pipeline.local  /  systems');
  g.font = `600 40px ${SANS}`; g.fillStyle = '#e9ecf2'; g.fillText('Systems', 55, 120);
  const w = 350, gap = 30, x0 = 800 - (4 * w + 3 * gap) / 2, y = 270, h = 330;
  TILE.forEach(([name, metric], i) => {
    const x = x0 + i * (w + gap), on = t >= TILES[i], pop = on ? smooth((t - TILES[i]) / 0.3) : 0;
    g.fillStyle = on ? `rgb(${20 + 4 * pop},${30 + 34 * pop},${30 + 12 * pop})` : '#141822'; rr(g, x, y, w, h, 22); g.fill();
    g.strokeStyle = on ? '#7fd3a0' : '#3a3f4d'; g.lineWidth = on ? 5 : 2; g.stroke();
    if (on && t - TILES[i] < 0.7) { g.save(); g.shadowColor = '#9df2bd'; g.shadowBlur = 50 * (1 - (t - TILES[i]) / 0.7); g.stroke(); g.restore(); }
    g.font = `700 50px ${SANS}`; g.fillStyle = on ? '#ffffff' : '#7d8392'; g.fillText(name, x + 30, y + 70);
    // the tick ring
    const cx = x + 70, cy = y + 175;
    g.strokeStyle = on ? '#9df2bd' : '#4b5263'; g.lineWidth = 6; g.beginPath(); g.arc(cx, cy, 36, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (on ? 1 : 0.25 + 0.1 * Math.sin(t * 3 + i))); g.stroke();
    if (on) { g.font = `700 40px ${SANS}`; g.fillStyle = '#9df2bd'; g.textAlign = 'center'; g.fillText('✓', cx, cy + 2); g.textAlign = 'left'; }
    g.font = `600 32px ${SANS}`; g.fillStyle = on ? '#9df2bd' : '#7d8392'; g.fillText(on ? 'running' : 'checking…', x + 130, cy);
    g.font = `26px ${SANS}`; g.fillStyle = on ? '#d6efe0' : '#5b6070'; g.fillText(metric, x + 30, y + 285);
  });
  const all = TILES[3] + 0.5;
  if (t >= all) {
    g.globalAlpha = smooth((t - all) / 0.3);
    g.fillStyle = '#1f6f43'; rr(g, 800 - 260, 660, 520, 76, 38); g.fill();
    g.font = `700 38px ${SANS}`; g.fillStyle = '#b6ffd0'; g.textAlign = 'center'; g.fillText('all systems running', 800, 699); g.textAlign = 'left';
    g.globalAlpha = 1;
  }
}

// ------------------------------------------------------------------ monitor 2: quiet code and logs
function mon2(g, t, o = {}) {
  reset(g);
  g.fillStyle = '#12141b'; g.fillRect(0, 0, 1600, 900);
  g.fillStyle = '#151924'; g.fillRect(0, 0, 1600, 44);
  const tabs = o.tabs || ['pipeline.py', 'auto_send.py', 'calendar_sync.py'], active = o.active || tabs[tabs.length - 1];
  g.font = `22px ${SANS}`;
  let x = 0;
  tabs.forEach((s) => {
    const on = s === active, isNew = o.newAt && o.newAt[s] !== undefined && t - o.newAt[s] < 0.6;
    const w = g.measureText(s).width + 48, open = isNew ? smooth((t - o.newAt[s]) / 0.25) : 1;
    g.fillStyle = on ? '#1b1f2a' : '#151924'; g.fillRect(x, 0, w * open, 44);
    if (on) { g.fillStyle = C.claude; g.fillRect(x, 41, w * open, 3); }
    g.globalAlpha = open; g.fillStyle = on ? '#ffffff' : '#8a8f99'; g.fillText(s, x + 24, 23); g.globalAlpha = 1;
    x += w * open + 2;
  });
  const codeH = o.prompt ? 600 : 856;
  // code: scrolls slowly (a line every ~1.4 s); the new files stream in instead
  g.fillStyle = '#1b1f2a'; g.fillRect(0, 44, 1040, codeH);
  g.save(); g.beginPath(); g.rect(0, 44, 1040, codeH); g.clip();
  g.font = `${o.code ? 28 : 24}px ${MONO}`; const cw = g.measureText('M').width, LH = o.code ? 42 : 36;   // D05's insert reads the new file
  if (o.code) {
    o.code.forEach((l, i) => { g.fillStyle = '#4b5263'; g.textAlign = 'right'; g.fillText(String(i + 1), 64, 80 + i * LH); g.textAlign = 'left'; drawCode(g, l, 86, 80 + i * LH, cw); });
    const last = o.code[o.code.length - 1] || ''; if (blink(t)) { g.fillStyle = '#e6e6e6'; g.fillRect(87 + last.length * cw, 80 + (o.code.length - 1) * LH - 13, 2, 26); }
  } else {
    const pos = o.pos !== undefined ? o.pos : t * 0.7, base = Math.floor(pos), fr = pos - base;
    for (let k = -1; k < codeH / LH + 1; k++) {
      const i = base + k, y = 80 + (k - fr) * LH, l = ALL_CODE[((i % ALL_CODE.length) + ALL_CODE.length) % ALL_CODE.length];
      g.fillStyle = '#4b5263'; g.textAlign = 'right'; g.fillText(String(i + 1), 64, y); g.textAlign = 'left';
      g.globalAlpha = 0.8; drawCode(g, l, 86, y, cw); g.globalAlpha = 1;
    }
  }
  g.restore();
  // log tail on the right (the baked monitor2 image's log)
  g.fillStyle = '#0a0c11'; g.fillRect(1050, 44, 550, 856);
  g.font = `20px ${MONO}`;
  const lpos = (o.pos !== undefined ? o.pos : t * 0.7) * 1.3, base = Math.floor(lpos), fr = lpos - base, LL = 30;
  const msgs = ['classified 12 msgs', 'draft ready -> review', 'calendar conflict resolved', 'tests passed (41)', 'retry: rate limited', 'new module scaffolded', 'summary written'];
  for (let r = 0; r <= 28; r++) {
    const i = base - 28 + r, y = 70 + (r - fr) * LL; if (y < 56) continue;
    const lv = hash(i * 3) > 0.8 ? 'WARN' : hash(i * 3) > 0.45 ? 'OK' : 'INFO';
    g.fillStyle = '#5c6370'; g.fillText(stamp(clockAt(t) - (28 - r) * 0.12), 1066, y);
    g.fillStyle = lv === 'OK' ? '#7fd3a0' : lv === 'WARN' ? '#e5c07b' : '#8a8f99'; g.fillText(lv, 1176, y);
    g.fillStyle = '#9aa0ad'; g.fillText(msgs[Math.floor(hash(i + 11) * msgs.length)], 1240, y);
  }
  // the prompt pane (D05)
  if (o.prompt) {
    g.fillStyle = C.term; g.fillRect(0, 644, 1040, 256);
    g.font = `600 22px ${MONO}`; g.fillStyle = C.claude; g.fillText('✻ Claude', 26, 676);
    g.font = `30px ${MONO}`; o.prompt.forEach(([s, c], i) => { g.fillStyle = c; g.fillText(s, 26, 726 + i * 50); });
  }
}
function mon2Day(g, t) {
  reset(g);
  g.fillStyle = '#1b1f2a'; g.fillRect(0, 0, 1600, 900);
  g.fillStyle = '#151924'; g.fillRect(0, 0, 1600, 44); g.font = `22px ${SANS}`; g.fillStyle = '#ffffff'; g.fillText('TODO.md', 24, 23);
  g.font = `600 44px ${SANS}`; g.fillStyle = '#e9ecf2'; g.fillText('# this week', 120, 130);
  TODO.concat(['call the bank', 'renew passport']).forEach((s, i) => {
    const y = 210 + i * 64;
    g.strokeStyle = '#7d8392'; g.lineWidth = 3; g.strokeRect(120, y - 18, 36, 36);
    g.font = `36px ${MONO}`; g.fillStyle = '#d7dae0'; g.fillText(s, 186, y);
  });
}
function mon2D(g, t) {
  // D05: modules/briefing.py opens, then integrations/slack.py; Claude asks, he answers y
  const [b, s] = D05M, yAt = Math.min(W1('D05') - 0.35, s + 0.95);
  const tabs = ['auto_send.py', 'research_digest.py', ...(t >= b ? ['modules/briefing.py'] : []), ...(t >= s ? ['integrations/slack.py'] : [])];
  const file = t >= s ? 'integrations/slack.py' : t >= b ? 'modules/briefing.py' : null;
  const prompt = [];
  if (t >= b) prompt.push([`Create modules/briefing.py  ✓`, t >= s ? '#7fd3a0' : C.txt]);
  if (t >= s + 0.35) prompt.push(['Create integrations/slack.py?', '#ffffff'], [`Proceed? (y/n) ${t >= yAt ? 'y' : blink(t) ? '▌' : ''}`, t >= yAt ? C.ok : '#ffffff']);
  mon2(g, t, {
    tabs, active: file || 'research_digest.py', newAt: { 'modules/briefing.py': b, 'integrations/slack.py': s },
    code: file ? upto(CODE[file], Math.max(1, streamN(t, file === 'modules/briefing.py' ? b + 0.1 : s + 0.1, 170, 999))) : CODE['research_digest.py'],
    prompt: prompt.length ? prompt : [['Write the morning briefing module?', '#ffffff'], ['(working)', C.grey]],
  });
}

// ------------------------------------------------------------------ the phone (720 x 1560, portrait)
const PW = 720, PH = 1560;
// lock screen as the baked texture draws it: date, big time, notification cards
function lock(g, t, cards) {
  reset(g);
  const gr = g.createLinearGradient(0, 0, 0, PH); gr.addColorStop(0, '#141838'); gr.addColorStop(0.45, '#1d1e36'); gr.addColorStop(1, '#2e2629');
  g.fillStyle = gr; g.fillRect(0, 0, PW, PH);
  const m = clockAt(t);
  g.textAlign = 'center'; g.fillStyle = '#e9ecf2';
  g.font = `40px ${SANS}`; g.fillText(DAYS_LONG[Math.floor(m / 1440)], PW / 2, 186);
  g.font = `700 190px ${SANS}`; g.fillText(hm(m, false), PW / 2, 340);
  g.textAlign = 'left';
  let y = 560;
  for (const c of cards) {
    // a new card drops in from above the stack while the stack moves down to make room
    const a = c.in === undefined ? 1 : smooth((t - c.in) / 0.3), dy = (a - 1) * 172;
    g.globalAlpha = a;
    g.fillStyle = c.hot ? 'rgba(92,98,122,0.92)' : 'rgba(64,66,84,0.9)'; rr(g, 32, y + dy, PW - 64, 150, 32); g.fill();
    g.font = `700 36px ${SANS}`; g.fillStyle = '#ffffff'; g.fillText(c.who, 70, y + dy + 48);
    g.font = `30px ${SANS}`; g.fillStyle = '#c4c7d2'; g.textAlign = 'right'; g.fillText(c.when, PW - 70, y + dy + 48); g.textAlign = 'left';
    g.font = `38px ${SANS}`; g.fillStyle = '#eef0f5'; g.fillText(c.text, 70, y + dy + 104);
    g.globalAlpha = 1;
    y += 172 * a;
  }
  g.fillStyle = '#ffffff'; rr(g, PW / 2 - 85, PH - 44, 170, 10, 5); g.fill();
}
// the Claude app in the afternoon: his message, Send, the reply streaming, 'yes'
const MSG = ['i have like 400 unread emails. every single one wants a reply.', " i'm fucking drowning here!"];
const REPLY = ["That sounds genuinely exhausting - and you're definitely not alone!", ' I can write a script that sorts your inbox and drafts the replies for you.',
  ' You just review and approve. Want me to build one?'];
const MSG_W = [voAt('i have like', [41.8, 45.4]), voAt("i'm fucking", [45.7, 47.2])];
const REPLY_W = [voAt('That sounds genuinely', [48.6, 51.8]), voAt('I can write a script', [52.7, 57.8]), voAt('You just review', [58.1, 61.6])];
const YES_SENT = YES_TYPE[1] + 0.15;
function chatState(t) {
  const msgs = []; let draft = '', pressed = 0;
  const full = MSG.join('');
  if (t < SEND1) draft = MSG[0].slice(0, typedN(null, MSG_W[0][0], MSG_W[0][1], t, MSG[0].length)) + (t >= MSG_W[1][0] ? MSG[1].slice(0, typedN(null, MSG_W[1][0], MSG_W[1][1], t, MSG[1].length)) : '');
  else msgs.push(['you', full]);
  pressed = Math.max(0, 1 - Math.abs(t - SEND1) / 0.15) + Math.max(0, 1 - Math.abs(t - YES_SENT) / 0.15);
  if (t >= SEND1 + 0.3) {
    let r = '';
    REPLY.forEach((s, i) => { const [a, b] = REPLY_W[i]; if (t >= a) r += s.slice(0, Math.min(s.length, Math.ceil((t - a) / (b - a) * s.length))); });
    msgs.push(['claude', r.trimStart(), t < REPLY_W[2][1]]);
  }
  if (t >= YES_TYPE[0] && t < YES_SENT) draft = 'yes'.slice(0, typedN(null, YES_TYPE[0], YES_TYPE[1], t, 3));
  if (t >= YES_SENT) { msgs.push(['you', 'yes']); const s = "Great! Let's start with your inbox."; if (t >= YES_SENT + 0.5) msgs.push(['claude', s.slice(0, streamN(t, YES_SENT + 0.5, 35, s.length)), t < YES_SENT + 0.5 + s.length / 35]); }
  return { msgs, draft, pressed: Math.min(1, pressed) };
}
function phoneChat(g, t) {
  reset(g);
  const { msgs, draft, pressed } = chatState(t);
  g.fillStyle = C.chat; g.fillRect(0, 0, PW, PH);
  // status bar
  g.font = `600 30px ${SANS}`; g.fillStyle = C.ink; g.fillText(hm(clockAt(t), false), 54, 40);
  g.fillRect(PW - 110, 28, 52, 24); g.fillStyle = C.chat; g.fillRect(PW - 106, 32, 14, 16); g.fillStyle = C.ink; g.fillRect(PW - 56, 35, 4, 10);
  for (let i = 0; i < 4; i++) g.fillRect(PW - 190 + i * 14, 50 - i * 7, 9, 6 + i * 7);
  // header: back to Mail with its red badge; Claude
  g.fillStyle = '#e8e4d8'; g.fillRect(0, 70, PW, 110);
  g.font = `44px ${SANS}`; g.fillStyle = '#4a6fa5'; g.fillText('‹', 26, 124);
  g.font = `30px ${SANS}`; g.fillText('Mail', 58, 126);
  g.fillStyle = '#e0453a'; rr(g, 130, 104, 96, 44, 22); g.fill();
  g.font = `700 28px ${SANS}`; g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.fillText(String(MAIL_DAY), 178, 127);
  g.fillStyle = C.claude; g.beginPath(); g.arc(PW / 2 + 70, 125, 13, 0, 7); g.fill();
  g.font = `600 34px ${SANS}`; g.fillStyle = C.ink; g.textAlign = 'left'; g.fillText('Claude', PW / 2 + 92, 127);
  // greeting on an empty chat
  if (!msgs.length) {
    g.textAlign = 'center'; g.fillStyle = C.claude; g.font = `64px ${SANS}`; g.fillText('✻', PW / 2, 620);
    g.font = `48px Georgia, "Times New Roman", serif`; g.fillStyle = C.ink; g.fillText('Good afternoon, Ivan', PW / 2, 710); g.textAlign = 'left';
  }
  chatColumn(g, t, msgs, { x0: 40, x1: PW - 32, top: 190, bottom: 1340, size: 38, lh: 50, youW: 470, claudeW: 630, pad: 22 });
  // input bar
  g.fillStyle = '#ffffff'; rr(g, 28, 1360, PW - 56, 120, 30); g.fill(); g.strokeStyle = '#d6d2c6'; g.lineWidth = 2; g.stroke();
  g.save(); g.beginPath(); g.rect(40, 1360, PW - 180, 120); g.clip();
  g.font = `36px ${SANS}`;
  if (draft) {
    const ls = wrap(g, draft, PW - 200), last = ls.slice(-2);
    last.forEach((l, k) => { g.fillStyle = C.ink; g.fillText(l, 56, 1420 - (last.length - 1) * 23 + k * 46); });
    const w = g.measureText(last[last.length - 1]).width; g.fillRect(58 + w, 1420 + (last.length - 1) * 23 - 20, 3, 40);
  } else { g.fillStyle = '#9a978f'; g.fillText('Reply to Claude...', 56, 1420); }
  g.restore();
  const sx = PW - 92, sy = 1420, r = 38 * (1 - 0.12 * pressed);
  g.fillStyle = draft || pressed ? (pressed ? '#b85c3e' : C.claude) : '#d9d4c7'; g.beginPath(); g.arc(sx, sy, r, 0, 7); g.fill();
  g.strokeStyle = '#ffffff'; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(sx, sy + 16); g.lineTo(sx, sy - 16); g.moveTo(sx - 13, sy - 4); g.lineTo(sx, sy - 17); g.lineTo(sx + 13, sy - 4); g.stroke(); g.lineCap = 'butt';
  g.fillStyle = C.ink; rr(g, PW / 2 - 85, PH - 44, 170, 10, 5); g.fill();
}
// how lit the phone is, 0 (off) .. 1: for the engine's duvet glow and the buzz (D02)
export function phoneGlow(t) {
  const a2 = W1('A02');
  if (t < a2 + 1.0) return 1;
  if (t < a2 + 1.6) return 1 - smooth((t - a2 - 1.0) / 0.6);
  if (t >= W0('B01') && t < W0('B07')) return t < BLEND[0] ? 0 : 1;
  if (t >= WAKE[0] && t < WAKE[1] + 1.2) {
    if (t < WAKE[1]) return smooth((t - WAKE[0]) / 0.12);
    if (t < WAKE[1] + 0.9) return lerp(1, 0.35, smooth((t - WAKE[1]) / 0.3));
    return 0.35 * (1 - smooth((t - WAKE[1] - 0.9) / 0.3));
  }
  return 0;
}
export const phoneBuzz = (t) => (t >= WAKE[0] && t < WAKE[0] + 0.4 ? 1 : 0);   // 0.4 s buzz when her text lands
function phone(g, t) {
  reset(g);
  const lit = phoneGlow(t);
  if (lit <= 0.001) { g.fillStyle = '#000000'; g.fillRect(0, 0, PW, PH); return; }
  if (t >= W0('B01') && t < W0('B07')) phoneChat(g, t);
  else {
    const fmt = (m) => hm(m);
    const night = SARAH.map(([m, s]) => ({ who: 'Sarah', when: fmt(m), text: s }));
    if (t < W0('B01')) lock(g, t, [...night, { who: 'Mail', when: 'now', text: `${MAIL_NIGHT} new messages` }]);
    else lock(g, t, [{ who: 'Sarah', when: 'now', text: SARAH_LAST, hot: true, in: WAKE[0] + 0.05 }, ...night.slice().reverse()]);
  }
  if (lit < 1) { g.fillStyle = `rgba(0,0,0,${1 - lit})`; g.fillRect(0, 0, PW, PH); }
}

// ------------------------------------------------------------------ optional: the floating chat card (B02, B05)
// 1200 x 800, the same conversation as the phone, only the latest exchange, with the pipeline sketch under the offer
function card(g, t) {
  reset(g);
  const { msgs, draft } = chatState(t);
  g.fillStyle = C.chat; g.fillRect(0, 0, 1200, 800);
  g.fillStyle = '#e8e4d8'; g.fillRect(0, 0, 1200, 84);
  g.fillStyle = C.claude; g.beginPath(); g.arc(50, 42, 16, 0, 7); g.fill();
  g.font = `600 36px ${SANS}`; g.fillStyle = C.ink; g.fillText('Claude', 80, 44);
  const last = msgs.slice(draft ? -1 : -2);
  const sketch = msgs.some((m) => m[0] === 'claude') && t >= REPLY_W[1][0] + 1.2 && t < YES_SENT;
  if (draft) last.push(['you', draft + '▌']);
  chatColumn(g, t, last, { x0: 50, x1: 1150, top: 100, bottom: sketch ? 600 : 770, size: 44, lh: 58, youW: 760, claudeW: 1080, pad: 24 });
  if (sketch) {
    const steps = ['inbox', 'sort', 'draft', 'you'], a = smooth((t - REPLY_W[1][0] - 1.2) / 0.4);
    g.globalAlpha = a;
    steps.forEach((s, i) => {
      const x = 60 + i * 280, on = t >= REPLY_W[1][0] + 1.2 + i * 0.35;
      g.fillStyle = on ? '#ffffff' : '#ebe7dc'; rr(g, x, 640, 220, 110, 18); g.fill(); g.strokeStyle = i === 3 ? C.claude : '#cfc9ba'; g.lineWidth = 3; g.stroke();
      g.font = `600 42px ${SANS}`; g.fillStyle = C.ink; g.textAlign = 'center'; g.fillText(s, x + 110, 696); g.textAlign = 'left';
      if (i < 3) { g.fillStyle = '#9a978f'; g.font = `44px ${SANS}`; g.fillText('→', x + 232, 694); }
    });
    g.globalAlpha = 1;
  }
}

// ------------------------------------------------------------------ the contract
const lapEndA09 = (g) => laptopA09(g, W1('A09') - 0.01);
export const SCREENS = {
  laptop(g, t, keys = []) {
    reset(g);
    if (t < A08[0]) return drawLaptop(g, t, keys);                       // A01-A07: the intro's screens, unchanged
    if (t < W0('A09')) return laptopA08(g, t);
    if (t < W0('B01')) return laptopA09(g, t);
    if (t < W0('B02')) return fade(g, t, BLEND[0], BLEND[1], (x) => lapEndA09(x), (x) => dayMail(x, t));
    if (t < W0('B07')) return dayMail(g, t);
    if (t < W0('C03')) return laptopB7(g, t, keys);
    if (t < W0('C04')) return laptopC3(g, t);
    if (t < W0('C05')) return laptopC4(g, t);
    if (t < W0('D01')) return todo(g, t);
    if (t < W0('E01')) return laptopD(g, t, keys);
    if (t < W0('E07')) return laptopE(g, t);
    if (t < W0('F01')) return laptopTests(g, t);
    return laptopF(g, t);
  },
  monitor(g, t) {
    reset(g);
    if (t < W0('B01')) return drawMonitor(g, t);                          // A: the intro's pipeline (auto-send goes live)
    if (t < W0('B02')) return fade(g, t, BLEND[0], BLEND[1], (x) => drawMonitor(x, W1('A09')), (x) => calendarDay(x, t));
    if (t < W0('B07')) return calendarDay(g, t);
    if (t < W0('C03')) return pipeline4(g, t);
    if (t < W0('D01')) return modules(g, t);
    if (t < W0('E01')) return sentFlurry(g, t);
    if (t < W0('F01')) return dashboard(g, t);
    return tiles(g, t);
  },
  monitor2(g, t) {
    reset(g);
    if (t < W0('B01')) return mon2(g, t);
    if (t < W0('B02')) return fade(g, t, BLEND[0], BLEND[1], (x) => mon2(x, W1('A09') - 0.01), (x) => mon2Day(x, t));
    if (t < W0('B07')) return mon2Day(g, t);
    if (t >= W0('D05') && t < W0('E01')) return mon2D(g, t);
    if (t >= W0('C04') && t < W1('C04')) return mon2(g, t, { pos: t * 0.7 + (t - W0('C04')) * 9 });
    if (t >= W0('E01')) return mon2(g, t, { pos: rush(t, 0.7, 10), tabs: ['modules/briefing.py', 'integrations/slack.py', 'tests/test_briefing.py'] });
    return mon2(g, t);
  },
  phone(g, t) { return phone(g, t); },
  card(g, t) { return card(g, t); },
};
export const SIZES = { laptop: [1600, 1000], monitor: [1600, 900], monitor2: [1600, 900], phone: [720, 1560], card: [1200, 800] };
