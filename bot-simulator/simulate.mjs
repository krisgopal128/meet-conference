import { pathToFileURL } from 'node:url';
/**
 * meet-bot-simulator — simulate meeting participants on a Meet Conference room.
 *
 * Each "bot" is a real headless Chromium tab that joins as a guest, publishing a
 * looping VIDEO FILE as its camera feed (virtual camera) and a muted (disabled)
 * silent audio track as its mic. Bots ramp up, hold, then ramp down on a schedule.
 *
 * Join path (matches the app's guest / external-link flow):
 *   POST {origin}/api/token/guest { roomName, name }   (CSRF-exempt, no auth)
 *   -> sessionStorage["token_<room>"] = token
 *   -> navigate to {origin}/room/<room>                 (public route)
 *   -> RoomPage connects to LiveKit (wss://<host>/livekit)
 *
 * The virtual camera is injected by overriding navigator.mediaDevices.getUserMedia
 * so the camera track comes from captureStream() of a <video> playing a local file.
 * The file is served in-process via a Playwright route (no real network call, so the
 * HTTPS page never hits a mixed-content block).
 *
 * Server constraint: /token/guest is rate-limited to 30 tokens/min (tokenLimiter).
 * Token requests are therefore paced >= 2.2s apart; ramp-up may slip if you ask for
 * many bots in a short window — that slip is logged.
 *
 * USAGE
 *   node simulate.mjs --url <meeting-link> --videos <folder> [options]
 *
 *   --url           Meeting link, e.g. https://meet.livekit.phuket-tourist.com/join/my-room
 *   --videos        Folder containing the video files (.mp4/.webm/...) to use as camera feeds
 *   -n,--participants <n>   Number of bots (default 5)
 *   --ramp-up <sec>         Time to reach full concurrency (default 60)
 *   --hold <sec>            Time to hold at peak once everyone has joined (default 120)
 *   --ramp-down <sec>       Time to drain everyone out (default 60)
 *   --prefix <name>         Participant name prefix (default "Bot" -> Bot-1, Bot-2, ...)
 *   --pin-video             Give each bot a single video (round-robin) instead of cycling the set
 *   --headed                Show browser windows (default: headless)
 *   -h,--help               Show this help
 *
 * SETUP (once)
 *   cd bot-simulator && npm install && npm run install-browser
 *
 * EXAMPLE
 *   node simulate.mjs \
 *     --url https://meet.livekit.phuket-tourist.com/join/standup \
 *     --videos ./clips \
 *     -n 12 --ramp-up 90 --hold 300 --ramp-down 60 --prefix Tester
 */

import { chromium } from 'playwright';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';

const VIDEO_EXTS = new Set(['.mp4', '.webm', '.ogg', '.ogv', '.mov', '.m4v', '.mkv']);
// Server tokenLimiter = 30/min. Stay safely under it across all bots (shared source IP).
const TOKEN_MIN_SPACING_MS = 2200;

const MIME = {
  '.mp4': 'video/mp4', '.m4v': 'video/mp4',
  '.webm': 'video/webm', '.ogg': 'video/ogg', '.ogv': 'video/ogg',
  '.mov': 'video/quicktime', '.mkv': 'video/x-matroska',
};

// ─── small helpers ───────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ts = () => new Date().toISOString().slice(11, 19);
function log(...a) { console.log(`[${ts()}]`, ...a); }
function fatal(msg) { console.error(`\n✗ ${msg}\n`); process.exit(1); }

// ─── args ────────────────────────────────────────────────────
function parseArgs(argv) {
  const o = {
    url: null, videos: null, participants: 5,
    rampUp: 60, hold: 120, rampDown: 60,
    prefix: 'Bot', pinVideo: false, headless: true, help: false,
  };
  const need = (val, flag) => {
    if (val === undefined) fatal(`Missing value for ${flag}`);
    return val;
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '--url': o.url = need(argv[++i], a); break;
      case '--videos': case '--video-folder': o.videos = need(argv[++i], a); break;
      case '-n': case '--participants': o.participants = parseInt(need(argv[++i], a), 10); break;
      case '--ramp-up': o.rampUp = parseFloat(need(argv[++i], a)); break;
      case '--hold': o.hold = parseFloat(need(argv[++i], a)); break;
      case '--ramp-down': o.rampDown = parseFloat(need(argv[++i], a)); break;
      case '--prefix': case '--name-prefix': o.prefix = need(argv[++i], a); break;
      case '--pin-video': o.pinVideo = true; break;
      case '--headed': o.headless = false; break;
      case '--headless': o.headless = true; break;
      case '-h': case '--help': o.help = true; break;
      default:
        if (a.startsWith('--')) fatal(`Unknown option: ${a} (try --help)`);
    }
  }
  return o;
}

// ─── video loading ───────────────────────────────────────────
async function loadVideos(folder) {
  const st = await stat(folder).catch(() => null);
  if (!st || !st.isDirectory()) fatal(`Videos folder not found or not a directory: ${folder}`);
  const entries = await readdir(folder, { withFileTypes: true });
  const files = entries
    .filter((e) => e.isFile() && VIDEO_EXTS.has(extname(e.name).toLowerCase()))
    .map((e) => e.name)
    .sort();
  if (!files.length) fatal(`No video files (.mp4/.webm/...) found in ${folder}`);
  const map = new Map();
  for (const f of files) map.set(f, await readFile(join(folder, f)));
  return map;
}

// ─── room name + origin ──────────────────────────────────────
function extractRoomName(urlStr) {
  const u = new URL(urlStr);
  const m = u.pathname.match(/(?:^|\/)(?:join|room)\/([^/?#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

// ─── token minting (CSRF-exempt guest endpoint) ───────────────
async function mintGuestToken(origin, roomName, name) {
  const endpoint = `${origin}/api/token/guest`;
  const body = JSON.stringify({ roomName, name, role: 'attendee' });
  let attempt = 0;
  for (;;) {
    attempt++;
    let res;
    try {
      res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
      });
    } catch (e) {
      throw new Error(`network error reaching ${endpoint}: ${e.message}`);
    }
    if (res.status === 429) {
      const retryAfter = res.headers.get('retry-after');
      const wait = retryAfter
        ? Math.min(30000, parseInt(retryAfter, 10) * 1000 || 3000)
        : Math.min(30000, 2000 * 2 ** Math.min(attempt, 4));
      log(`token 429 (rate limited) for ${name} — retrying in ${Math.round(wait / 1000)}s`);
      await sleep(wait);
      continue;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(`${res.status} ${data.error || res.statusText}`);
      err.status = res.status;
      err.payload = data;
      throw err;
    }
    return data; // { token, identity, inLobby, role, ... }
  }
}

let lastTokenAt = 0;
async function pacedMint(origin, roomName, name) {
  const gap = Date.now() - lastTokenAt;
  if (gap < TOKEN_MIN_SPACING_MS) await sleep(TOKEN_MIN_SPACING_MS - gap);
  const data = await mintGuestToken(origin, roomName, name);
  lastTokenAt = Date.now();
  return data;
}

// ─── per-context video route (in-process, range-aware) ───────
function attachVideoRoute(context, videoBuffers) {
  context.route('**/__vcam__/*', async (route) => {
    const req = route.request();
    let pathname;
    try { pathname = new URL(req.url()).pathname; } catch { pathname = req.url(); }
    const seg = pathname.split('/__vcam__/')[1] || '';
    const name = decodeURIComponent(seg);
    const file = videoBuffers.get(name);
    if (!file) { await route.fulfill({ status: 404, body: 'not found' }); return; }
    const ct = MIME[extname(name).toLowerCase()] || 'application/octet-stream';
    const headers = req.headers();
    const range = headers['range'];
    if (range) {
      const m = /bytes=(\d*)-(\d*)/.exec(range);
      const total = file.length;
      let start = m && m[1] ? parseInt(m[1], 10) : 0;
      let end = m && m[2] ? parseInt(m[2], 10) : total - 1;
      if (Number.isNaN(start)) start = 0;
      if (Number.isNaN(end) || end >= total) end = total - 1;
      await route.fulfill({
        status: 206,
        headers: {
          'content-type': ct,
          'content-range': `bytes ${start}-${end}/${total}`,
          'content-length': String(end - start + 1),
          'accept-ranges': 'bytes',
          'cache-control': 'no-cache',
        },
        body: file.subarray(start, end + 1),
      });
    } else {
      await route.fulfill({
        status: 200,
        headers: {
          'content-type': ct,
          'content-length': String(file.length),
          'accept-ranges': 'bytes',
          'cache-control': 'no-cache',
        },
        body: file,
      });
    }
  });
}

// ─── page-side injection (serialized by Playwright; self-contained) ──
// Runs in the browser. Receives opts only — no Node closures.
function virtualCamInit(opts) {
  const ROOM = opts.roomName;
  // 1) Hand RoomPage its token via sessionStorage (guest / external-link flow).
  try {
    if (ROOM && opts.token) {
      sessionStorage.setItem('token_' + ROOM, opts.token);
      sessionStorage.setItem('role_' + ROOM, 'attendee');
    }
  } catch (e) { /* opaque origin on about:blank — ignore */ }

  // 2) Detect LiveKit signaling connect via the /livekit WebSocket.
  (function () {
    try {
      const Native = window.WebSocket;
      function Patched(url, protocols) {
        const ws = protocols !== undefined ? new Native(url, protocols) : new Native(url);
        if (typeof url === 'string' && /\/livekit/.test(url)) {
          window.__vcam = window.__vcam || {};
          ws.addEventListener('open', function () { window.__vcam.open = Date.now(); });
          ws.addEventListener('close', function () { window.__vcam.closed = Date.now(); });
          ws.addEventListener('error', function () { window.__vcam.error = Date.now(); });
        }
        return ws;
      }
      Patched.prototype = Native.prototype;
      Patched.CONNECTING = 0; Patched.OPEN = 1; Patched.CLOSING = 2; Patched.CLOSED = 3;
      Object.defineProperty(window, 'WebSocket', { value: Patched, writable: true, configurable: true });
    } catch (e) {}
  })();

  // 3) Virtual camera (video file -> captureStream) + muted silent mic.
  (function () {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
    const PATHS = opts.videoPaths && opts.videoPaths.length ? opts.videoPaths : null;
    let vcam = null;
    let idx = 0;

    function buildVcam() {
      if (!PATHS) return null;
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.setAttribute('playsinline', '');
      video.setAttribute('webkit-playsinline', '');
      video.style.cssText = 'position:fixed;left:-9999px;top:0;width:2px;height:2px;opacity:0;pointer-events:none;';
      const load = function () {
        video.src = PATHS[idx % PATHS.length];
        const p = video.play();
        if (p && p.catch) p.catch(function () {});
      };
      if (!opts.pinVideo && PATHS.length > 1) {
        video.loop = false;
        video.addEventListener('ended', function () { idx = (idx + 1) % PATHS.length; load(); });
      } else {
        video.loop = true;
      }
      load();
      document.documentElement.appendChild(video);
      return {
        track: function () {
          try {
            const s = video.captureStream ? video.captureStream() : video.mozCaptureStream();
            const t = s && s.getVideoTracks ? s.getVideoTracks()[0] : null;
            return t || null;
          } catch (e) { return null; }
        },
      };
    }

    function silentAudioTrack() {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        const ctx = new AC();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        gain.gain.value = 0;
        const dest = ctx.createMediaStreamDestination();
        osc.connect(gain); gain.connect(dest);
        osc.start();
        const t = dest.stream.getAudioTracks()[0];
        if (t) t.enabled = false; // muted mic
        return t;
      } catch (e) { return null; }
    }

    const realGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = function (constraints) {
      const wantVideo = constraints && constraints.video;
      const wantAudio = constraints && constraints.audio;
      return new Promise(function (resolve, reject) {
        function finish(videoTrack) {
          const out = new MediaStream();
          if (videoTrack) out.addTrack(videoTrack);
          if (wantAudio) {
            const at = silentAudioTrack();
            if (at) out.addTrack(at);
          }
          if (!out.getTracks().length) {
            // Nothing synthesized (e.g. no video folder) — fall back to the real call.
            realGetUserMedia(constraints).then(resolve, reject);
            return;
          }
          resolve(out);
        }
        if (wantVideo) {
          if (!vcam) vcam = buildVcam();
          let tries = 0;
          (function poll() {
            const t = vcam ? vcam.track() : null;
            if (t) { finish(t); return; }
            if (++tries > 60) { // ~6s
              reject(new Error('virtual camera produced no video track'));
              return;
            }
            setTimeout(poll, 100);
          })();
        } else {
          finish(null);
        }
      });
    };

    // Pretend devices exist so the app's device picker doesn't break.
    if (navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices = function () {
        return Promise.resolve([
          { kind: 'videoinput', deviceId: 'vcam0', label: 'Virtual Camera', groupId: 'g1' },
          { kind: 'audioinput', deviceId: 'amic0', label: 'Virtual Mic', groupId: 'g2' },
          { kind: 'audiooutput', deviceId: 'aout0', label: 'Default', groupId: 'g3' },
        ]);
      };
    }
  })();
}

// ─── wait for LiveKit signaling connection ───────────────────
async function waitForConnect(page, roomName, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const s = await page.evaluate(() => ({
      path: location.pathname,
      open: !!(window.__vcam && window.__vcam.open),
    })).catch(() => null);
    if (s) {
      if (!s.path.startsWith('/room/')) {
        throw new Error(`left /room (now at ${s.path}) — token rejected or room unavailable`);
      }
      if (s.open) return true;
    }
    await sleep(500);
  }
  throw new Error('timed out waiting for LiveKit signaling connection');
}

// ─── launch one bot ──────────────────────────────────────────
async function launchBot(browser, cfg) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent: 'MeetBotSimulator/1.0 (+virtual-camera)',
  });
  attachVideoRoute(context, cfg.videoBuffers);
  await context.addInitScript(virtualCamInit, {
    roomName: cfg.roomName,
    token: cfg.token,
    videoPaths: cfg.videoPaths,
    pinVideo: cfg.pinVideo,
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => log(`  ! ${cfg.name} page error: ${e.message}`));
  await page.goto(`${cfg.origin}/room/${cfg.roomName}`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await waitForConnect(page, cfg.roomName, 30000);
  return { context, page, name: cfg.name };
}

// ─── main ────────────────────────────────────────────────────
async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) { console.log(HELP); process.exit(0); }
  if (!opts.url || !opts.videos) { console.log(HELP); fatal('--url and --videos are required'); }
  const N = opts.participants;
  if (!Number.isFinite(N) || N < 1) fatal('--participants must be a positive number');

  const origin = new URL(opts.url).origin;
  const roomName = extractRoomName(opts.url);
  if (!roomName) fatal(`Could not read a room name from the URL (expected .../join/<room> or .../room/<room>): ${opts.url}`);

  const videoBuffers = await loadVideos(opts.videos);
  const videoNames = [...videoBuffers.keys()];
  const videoPaths = videoNames.map((n) => `/__vcam__/${encodeURIComponent(n)}`);
  log(`Loaded ${videoNames.length} video(s): ${videoNames.join(', ')}`);

  log(`Launching Chromium (headless=${opts.headless}) …`);
  const browser = await chromium.launch({
    headless: opts.headless,
    args: [
      '--autoplay-policy=no-user-gesture-required',
      '--use-fake-ui-for-media-stream',
      '--mute-audio',
      '--disable-dev-shm-usage',
    ],
  });

  const active = new Set();
  let shuttingDown = false;
  const cleanup = async (sig) => {
    if (shuttingDown) return;
    shuttingDown = true;
    log(`\n${sig} received — disconnecting ${active.size} bot(s) …`);
    await Promise.allSettled([...active].map((b) => b.context.close().catch(() => {})));
    await browser.close().catch(() => {});
    process.exit(0);
  };
  process.on('SIGINT', () => cleanup('SIGINT'));
  process.on('SIGTERM', () => cleanup('SIGTERM'));

  // Probe the room up front so we fail fast with a clear message.
  log(`Probing room "${roomName}" at ${origin} …`);
  const probe = await mintGuestToken(origin, roomName, `${opts.prefix}-probe`).catch((e) => {
    const detail = e.payload && e.payload.error ? e.payload.error : e.message;
    return { __error: detail };
  });
  lastTokenAt = Date.now();
  if (probe.__error) {
    await browser.close().catch(() => {});
    fatal(`Room probe failed: ${probe.__error}\n  Make sure the meeting exists and the link is correct.`);
  }
  if (probe.inLobby) {
    log('⚠️  This room has a WAITING ROOM enabled. Bots will land in the lobby and cannot publish');
    log('    until a moderator admits them. Disable the waiting room on the meeting for a clean run.');
  }
  log(`Probe OK — room reachable${probe.inLobby ? ' (lobby mode ON)' : ''}.`);

  const rampUpMs = opts.rampUp * 1000;
  const holdMs = opts.hold * 1000;
  const rampDownMs = opts.rampDown * 1000;
  const minJoinWindow = (N - 1) * TOKEN_MIN_SPACING_MS;
  if (minJoinWindow > rampUpMs) {
    log(`⚠️  ${N} bots need >= ${Math.ceil(minJoinWindow / 1000)}s to join (30 tokens/min server limit);`);
    log(`    requested ramp-up is ${opts.rampUp}s — actual ramp-up will slip. Raise --ramp-up to match.`);
  }

  log(`Starting: ${N} bots | ramp-up ${opts.rampUp}s | hold ${opts.hold}s | ramp-down ${opts.rampDown}s`);
  log(`Site: ${origin}  Room: ${roomName}  Camera: ${opts.pinVideo ? 'pinned (round-robin)' : 'cycling set'}`);

  // Schedule (target) join times, evenly spread across ramp-up.
  const schedule = [];
  for (let i = 0; i < N; i++) {
    schedule.push({
      i, name: `${opts.prefix}-${i + 1}`,
      joinAt: N > 1 ? (i * rampUpMs) / (N - 1) : 0,
      handle: null,
    });
  }

  // ── Phase A: ramp-up (join bots, paced by token limit) ──
  const startTs = Date.now();
  for (const bot of schedule) {
    const due = startTs + bot.joinAt;
    if (Date.now() < due) await sleep(due - Date.now());
    if (shuttingDown) break;

    const data = await pacedMint(origin, roomName, bot.name).catch((e) => {
      log(`✗ ${bot.name}: token failed — ${e.message}`);
      return null;
    });
    if (!data) continue;
    if (data.inLobby) { log(`↷ ${bot.name}: sent to lobby (waiting room) — no publish`); continue; }

    bot.handle = await launchBot(browser, {
      origin, roomName, name: bot.name, token: data.token,
      videoBuffers, videoPaths, pinVideo: opts.pinVideo,
    }).catch((e) => { log(`✗ ${bot.name}: join failed — ${e.message}`); return null; });
    if (!bot.handle) continue;

    active.add(bot.handle);
    log(`✓ ${bot.name} joined  (+${((Date.now() - startTs) / 1000).toFixed(1)}s)  active=${active.size}`);
  }

  const joined = schedule.filter((b) => b.handle);
  if (!joined.length) {
    log('No bots connected — aborting.');
    await cleanup('DONE');
    return;
  }
  log(`Ramp-up complete: ${joined.length}/${N} bots connected. Holding for ${opts.hold}s …`);

  // ── Phase B: hold + ramp-down (FIFO staggered leaves) ──
  const leaveTimers = [];
  for (const bot of joined) {
    const offset = joined.length > 1 ? (bot.i * rampDownMs) / (N - 1) : 0;
    const leaveDelay = holdMs + offset;
    const t = setTimeout(() => {
      active.delete(bot.handle);
      bot.handle.context.close().catch(() => {});
      log(`✗ ${bot.name} left   (+${((Date.now() - startTs) / 1000).toFixed(1)}s)  active=${active.size}`);
    }, leaveDelay);
    leaveTimers.push(t);
  }

  const endBy = Date.now() + holdMs + rampDownMs + 5000;
  while (active.size > 0 && Date.now() < endBy && !shuttingDown) await sleep(1000);

  log(`Simulation finished. ${joined.length} bot(s) cycled through the room.`);
  await cleanup('DONE');
}

const HELP = `meet-bot-simulator — virtual-camera participant bots for Meet Conference

USAGE
  node simulate.mjs --url <meeting-link> --videos <folder> [options]

OPTIONS
  --url <link>            Meeting link, e.g. https://meet.livekit.phuket-tourist.com/join/my-room
  --videos <folder>       Folder of video files (.mp4/.webm/...) used as each bot's camera feed
  -n, --participants <n>  Number of bots                              (default 5)
  --ramp-up <sec>         Seconds to reach full concurrency           (default 60)
  --hold <sec>            Seconds to hold at peak                     (default 120)
  --ramp-down <sec>       Seconds to drain out                        (default 60)
  --prefix <name>         Participant name prefix                     (default "Bot")
  --pin-video             One video per bot (round-robin) instead of cycling the whole set
  --headed                Show browser windows                        (default headless)
  -h, --help              Show this help

NOTES
  • Bots join as guests via POST /api/token/guest (no password; a name is auto-generated).
  • Server limits guest tokens to 30/min — joins are paced to stay under it; large -n with a
    short --ramp-up will slip (logged). Raise --ramp-up to match (~2.2s per bot).
  • The mic is always published MUTED (a disabled silent track). The camera plays your file(s).
  • If the room has a waiting room enabled, bots stall in the lobby — disable it for the meeting.
  • Setup once:  npm install  &&  npm run install-browser
`;

export { virtualCamInit, attachVideoRoute, extractRoomName, loadVideos };

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
