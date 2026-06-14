// Self-test: validates the virtual-camera injection (getUserMedia override +
// captureStream + in-process route) without needing the live site.
import { chromium } from 'playwright';
import { virtualCamInit, attachVideoRoute, loadVideos, extractRoomName } from './simulate.mjs';

const assert = (cond, msg) => { if (!cond) { console.error(`  ✗ FAIL: ${msg}`); process.exitCode = 1; } else { console.log(`  ✓ ${msg}`); } };

console.log('# Extracting room name from URL');
assert(extractRoomName('https://meet.livekit.phuket-tourist.com/join/my-room') === 'my-room', '/join/<room> parsed');
assert(extractRoomName('https://h.example/room/abc-123?x=1') === 'abc-123', '/room/<room> parsed + query stripped');

console.log('\n# Loading videos');
const videos = await loadVideos('./test-clips');
const names = [...videos.keys()];
const paths = names.map((n) => `/__vcam__/${encodeURIComponent(n)}`);
assert(names.length === 1 && names[0] === 'sample-a.mp4', 'sample-a.mp4 loaded');

console.log('\n# Launching Chromium + injecting virtual camera');
const browser = await chromium.launch({
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--mute-audio'],
});
const ctx = await browser.newContext();
attachVideoRoute(ctx, videos);
await ctx.addInitScript(virtualCamInit, {
  roomName: 'selftest', token: 'FAKE_TOKEN', videoPaths: paths, pinVideo: false,
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message || e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

// A real https origin so navigator.mediaDevices exists.
await page.goto('https://example.com/', { waitUntil: 'domcontentloaded', timeout: 20000 });

console.log('\n# enumerateDevices override');
const devices = await page.evaluate(() => navigator.mediaDevices.enumerateDevices());
assert(devices.length === 3, `3 fake devices reported (got ${devices.length})`);
assert(devices.some((d) => d.kind === 'videoinput' && d.label === 'Virtual Camera'), 'virtual camera device present');

console.log('\n# getUserMedia -> virtual video track + muted audio track');
const result = await page.evaluate(async () => {
  const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  const vt = stream.getVideoTracks();
  const at = stream.getAudioTracks();
  // attach to a <video> to confirm real frames decode
  const v = document.createElement('video');
  v.srcObject = new MediaStream(vt);
  v.muted = true;
  await v.play().catch(() => {});
  const frame = await new Promise((resolve) => {
    let tries = 0;
    const t = setInterval(() => {
      tries++;
      if (v.videoWidth > 0) { clearInterval(t); resolve({ w: v.videoWidth, h: v.videoHeight }); }
      else if (tries > 40) { clearInterval(t); resolve({ w: 0, h: 0 }); }
    }, 100);
  });
  return {
    videoTracks: vt.length,
    videoReadyState: vt[0]?.readyState,
    audioTracks: at.length,
    audioEnabled: at[0]?.enabled,
    width: frame.w,
    height: frame.h,
  };
});
console.log('  result:', JSON.stringify(result));
assert(result.videoTracks === 1, `1 video track (got ${result.videoTracks})`);
assert(result.videoReadyState === 'live', 'video track is live');
assert(result.width === 640 && result.height === 480, `decoding real frames ${result.width}x${result.height}`);
assert(result.audioTracks === 1, `1 audio track (got ${result.audioTracks})`);
assert(result.audioEnabled === false, 'mic track disabled (muted)');

console.log('\n# No uncaught page errors from the injection');
assert(errors.length === 0, `no page errors${errors.length ? ' — ' + errors.slice(0, 3).join(' | ') : ''}`);

await browser.close();
console.log(process.exitCode ? '\n✗ SELF-TEST FAILED' : '\n✓ SELF-TEST PASSED');
