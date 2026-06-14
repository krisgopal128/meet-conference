"use strict";

/* ------------------------------------------------------------------ *
 * Realtime Background Blur
 * - Webcam capture via getUserMedia
 * - Person segmentation via MediaPipe Selfie Segmentation (Apache-2.0)
 * - Compositing on <canvas> with GPU-accelerated ctx.filter blur
 *
 * Pipeline per frame:
 *   1. Render the chosen BACKGROUND to `bgCanvas`
 *      (blurred video / image / solid color / sharp passthrough).
 *   2. Render a sharp PERSON cutout to `personCanvas` using the
 *      segmentation mask with `destination-in` (mask = person).
 *   3. Composite bg + person onto the visible output canvas.
 * ------------------------------------------------------------------ */

const CDN_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation";

const dom = {
  video: document.getElementById("video"),
  output: document.getElementById("output"),
  overlay: document.getElementById("overlay"),
  statusText: document.getElementById("statusText"),
  spinner: document.getElementById("spinner"),
  fpsBadge: document.getElementById("fpsBadge"),
  startBtn: document.getElementById("startBtn"),
  effectEnabled: document.getElementById("effectEnabled"),
  mode: document.getElementById("mode"),
  blurAmount: document.getElementById("blurAmount"),
  blurVal: document.getElementById("blurVal"),
  bgUpload: document.getElementById("bgUpload"),
  bgColor: document.getElementById("bgColor"),
  feather: document.getElementById("feather"),
  featherVal: document.getElementById("featherVal"),
  mirror: document.getElementById("mirror"),
  controls: document.getElementById("controls"),
  micFill: document.getElementById("micFill"),
  micLabel: document.getElementById("micLabel"),
  micMeter: document.getElementById("micMeter"),
};

const ctx = dom.output.getContext("2d");

// Offscreen working canvases (created once, reused every frame).
const bgCanvas = document.createElement("canvas");
const bgCtx = bgCanvas.getContext("2d");
const personCanvas = document.createElement("canvas");
const personCtx = personCanvas.getContext("2d");
// Frame with the person cut out, used to build a halo-free blurred background.
const knockoutCanvas = document.createElement("canvas");
const kCtx = knockoutCanvas.getContext("2d");
// Blurred knockout (background colours only); stacked onto the bg to make it
// fully opaque so there is no dark edge/shadow at low blur values.
const blurCanvas = document.createElement("canvas");
const bCtx = blurCanvas.getContext("2d");

// User-selected background image (HTMLImageElement) when in "image" mode.
let bgImage = null;

const state = {
  running: false,
  effectOn: true,
  mode: "blur",
  blur: 14,
  feather: 3,
  bgColor: "#1e1e2e",
  mirror: true,
  width: 1280,
  height: 720,
  // FPS bookkeeping
  lastFrame: performance.now(),
  fpsEMA: 0,
  // Microphone level (0..1), smoothed for the meter
  micLevel: 0,
  micActive: false,
};

let selfieSegmentation = null;
let stream = null;

// Web Audio objects for the voice-level meter.
let audioCtx = null;
let micStream = null;
let analyser = null;
let micSamples = null;

/* ----------------------- UI wiring ----------------------- */

function applyModeVisibility() {
  dom.controls.dataset.mode = state.mode;
}

dom.mode.addEventListener("change", () => {
  state.mode = dom.mode.value;
  applyModeVisibility();
});

dom.effectEnabled.addEventListener("change", () => {
  state.effectOn = dom.effectEnabled.checked;
});

dom.blurAmount.addEventListener("input", () => {
  state.blur = +dom.blurAmount.value;
  dom.blurVal.textContent = state.blur;
});

dom.feather.addEventListener("input", () => {
  state.feather = +dom.feather.value;
  dom.featherVal.textContent = state.feather;
});

dom.bgColor.addEventListener("input", () => {
  state.bgColor = dom.bgColor.value;
});

dom.bgUpload.addEventListener("change", (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const img = new Image();
  img.onload = () => {
    bgImage = img;
  };
  img.src = URL.createObjectURL(file);
});

dom.mirror.addEventListener("change", () => {
  state.mirror = dom.mirror.checked;
  dom.output.classList.toggle("mirror", state.mirror);
});

dom.startBtn.addEventListener("click", toggleCamera);

applyModeVisibility();
dom.output.classList.toggle("mirror", state.mirror);

/* ----------------------- Camera + model ----------------------- */

function setStatus(text, busy = false) {
  dom.statusText.textContent = text;
  dom.spinner.classList.toggle("hidden", !busy);
  dom.overlay.classList.remove("hidden");
}

function hideOverlay() {
  dom.overlay.classList.add("hidden");
}

/* ----------------------- Voice level meter ----------------------- */

async function startMic() {
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    const Ctx = window.AudioContext || window.webkitAudioContext;
    audioCtx = new Ctx();
    if (audioCtx.state === "suspended") await audioCtx.resume();
    const source = audioCtx.createMediaStreamSource(micStream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.75;
    source.connect(analyser);
    micSamples = new Uint8Array(analyser.fftSize);
    state.micActive = true;
    if (dom.micLabel) dom.micLabel.textContent = "MIC";
    if (dom.micMeter) dom.micMeter.classList.add("is-active");
  } catch (err) {
    // Mic denied/unavailable — keep the camera working, meter stays idle.
    state.micActive = false;
    if (dom.micLabel) dom.micLabel.textContent = "MIC OFF";
    if (dom.micMeter) dom.micMeter.classList.remove("is-active");
    console.warn("Microphone unavailable:", err);
  }
}

function stopMic() {
  state.micActive = false;
  state.micLevel = 0;
  if (micStream) {
    micStream.getTracks().forEach((t) => t.stop());
    micStream = null;
  }
  if (audioCtx) {
    audioCtx.close();
    audioCtx = null;
  }
  analyser = null;
  micSamples = null;
  if (dom.micFill) dom.micFill.style.width = "0%";
  if (dom.micLabel) dom.micLabel.textContent = "MIC";
  if (dom.micMeter) dom.micMeter.classList.remove("is-active");
}

function updateMicMeter() {
  if (!analyser || !micSamples || !dom.micFill) {
    return;
  }
  analyser.getByteTimeDomainData(micSamples);
  // RMS of the waveform (centred around 128).
  let sumSq = 0;
  for (let i = 0; i < micSamples.length; i++) {
    const v = (micSamples[i] - 128) / 128;
    sumSq += v * v;
  }
  const rms = Math.sqrt(sumSq / micSamples.length);
  // Scale into a perceptual 0..1 range.
  const target = Math.min(1, rms * 3.2);
  // Fast attack, slow release — feels like a real VU meter.
  const k = target > state.micLevel ? 0.6 : 0.08;
  state.micLevel += (target - state.micLevel) * k;
  dom.micFill.style.width = (state.micLevel * 100).toFixed(1) + "%";
}

async function toggleCamera() {
  if (state.running) {
    await stopCamera();
  } else {
    await startCamera();
  }
}

async function startCamera() {
  try {
    setStatus("Requesting camera…", true);

    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
      audio: false,
    });
    dom.video.srcObject = stream;
    await dom.video.play();

    const track = stream.getVideoTracks()[0];
    const settings = track.getSettings();
    state.width = settings.width || dom.video.videoWidth || 1280;
    state.height = settings.height || dom.video.videoHeight || 720;

    sizeCanvases(state.width, state.height);

    setStatus("Loading segmentation model…", true);

    if (!selfieSegmentation) {
      selfieSegmentation = new SelfieSegmentation({
        locateFile: (file) => `${CDN_BASE}/${file}`,
      });
      selfieSegmentation.setOptions({ modelSelection: 1, selfieMode: false });
      selfieSegmentation.onResults(onResults);
    }

    hideOverlay();
    state.running = true;
    dom.startBtn.textContent = "Stop camera";
    dom.startBtn.classList.add("btn--danger");
    dom.startBtn.classList.remove("btn--primary");

    // Clear any stale mask history from a previous session.
    resetMaskSmoother();

    // Kick off the microphone for the voice-level meter (non-blocking; a
    // denial here does not affect the camera).
    startMic();

    requestAnimationFrame(loop);
  } catch (err) {
    console.error(err);
    setStatus(
      err && err.name === "NotAllowedError"
        ? "Camera permission denied."
        : "Could not access camera: " + (err && err.message ? err.message : err),
      false
    );
  }
}

async function stopCamera() {
  state.running = false;
  stopMic();
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
  dom.video.srcObject = null;
  ctx.clearRect(0, 0, dom.output.width, dom.output.height);
  dom.startBtn.textContent = "Start camera";
  dom.startBtn.classList.remove("btn--danger");
  dom.startBtn.classList.add("btn--primary");
  setStatus("Camera stopped. Click \"Start camera\" to resume.", false);
  dom.fpsBadge.textContent = "-- FPS";
}

function sizeCanvases(w, h) {
  for (const c of [dom.output, bgCanvas, personCanvas, knockoutCanvas, blurCanvas]) {
    c.width = w;
    c.height = h;
  }
}

/* ----------------------- Render loop ----------------------- */

const MAX_FPS = 30;
const FRAME_INTERVAL = 1000 / MAX_FPS;
let lastProcess = 0;

async function loop(now) {
  if (!state.running) return;

  // Everything is wrapped so a single bad frame can NEVER kill the loop
  // (which would freeze the camera). requestAnimationFrame is in `finally`
  // so the next frame is always scheduled.
  try {
    // The voice meter updates every frame (cheap) so it stays smooth even
    // though segmentation is throttled to 30 FPS.
    updateMicMeter();

    // Throttle inference to a hard 30 FPS cap.
    if (now - lastProcess >= FRAME_INTERVAL) {
      lastProcess = now;
      if (dom.video.readyState >= 2) {
        // `send` resolves after onResults has been called with the result.
        try {
          await selfieSegmentation.send({ image: dom.video });
        } catch (err) {
          console.warn("Frame skipped:", err);
        }
      }
    }
  } catch (err) {
    console.warn("loop error (ignored):", err);
  } finally {
    requestAnimationFrame(loop);
  }
}

/* ----------- Mask stabilization (anti-flicker + stable edges) ----------- *
 * Two layers of defence stop the background (especially the scene edges) from
 * briefly turning sharp when the subject moves:
 *
 *  (1) Temporal — a per-frame exponential blend (EMA) damps jitter.
 *  (2) Spatial  — a smooth "edge vignette" forces the mask to 0 near the frame
 *      borders, so edge pixels are ALWAYS background (this is what kills the
 *      edge-unblur, since the model can keep mis-classifying the borders for
 *      several consecutive frames during fast motion).
 *
 * IMPORTANT: this whole stage uses ONLY canvas draw/composite ops (drawImage,
 * "lighter", "destination-in") and NEVER calls getImageData/putImageData. A
 * per-frame GPU->CPU readback here was stalling MediaPipe's WebGL pipeline and
 * freezing the camera on start. Everything runs at the model's native mask
 * resolution (256x256) -> cheap.
 */
let maskStable = null; // EMA accumulator (canvas)
let maskStableCtx = null;
let maskWork = null; // scratch canvas (returned each frame)
let maskWorkCtx = null;
let vignette = null; // precomputed border-suppression alpha mask
let vignetteCtx = null;
let maskW = 0;
let maskH = 0;
let maskInit = false;
const MASK_EMA = 0.5; // weight of the new frame in the temporal blend
const MASK_EDGE_MARGIN = 0.08; // fraction of each side forced toward background

function resetMaskSmoother() {
  maskStable = null;
  maskStableCtx = null;
  maskWork = null;
  maskWorkCtx = null;
  vignette = null;
  vignetteCtx = null;
  maskW = 0;
  maskH = 0;
  maskInit = false;
}

function stabilizeMask(rawMask) {
  const mw = rawMask.width;
  const mh = rawMask.height;
  if (!maskStable || maskW !== mw || maskH !== mh) {
    // (Re)allocate the working canvases at the mask's native size.
    maskStable = document.createElement("canvas");
    maskStable.width = mw;
    maskStable.height = mh;
    maskStableCtx = maskStable.getContext("2d");

    maskWork = document.createElement("canvas");
    maskWork.width = mw;
    maskWork.height = mh;
    maskWorkCtx = maskWork.getContext("2d");

    // Build the border-suppression vignette with pure canvas ops (no readback):
    // a white canvas whose alpha is 0 at the edges and 1 in the interior.
    vignette = document.createElement("canvas");
    vignette.width = mw;
    vignette.height = mh;
    vignetteCtx = vignette.getContext("2d");
    const m = MASK_EDGE_MARGIN;
    const hg = vignetteCtx.createLinearGradient(0, 0, mw, 0);
    hg.addColorStop(0, "rgba(255,255,255,0)");
    hg.addColorStop(m, "rgba(255,255,255,1)");
    hg.addColorStop(1 - m, "rgba(255,255,255,1)");
    hg.addColorStop(1, "rgba(255,255,255,0)");
    vignetteCtx.fillStyle = hg;
    vignetteCtx.fillRect(0, 0, mw, mh);
    vignetteCtx.globalCompositeOperation = "destination-in";
    const vg = vignetteCtx.createLinearGradient(0, 0, 0, mh);
    vg.addColorStop(0, "rgba(255,255,255,0)");
    vg.addColorStop(m, "rgba(255,255,255,1)");
    vg.addColorStop(1 - m, "rgba(255,255,255,1)");
    vg.addColorStop(1, "rgba(255,255,255,0)");
    vignetteCtx.fillStyle = vg;
    vignetteCtx.fillRect(0, 0, mw, mh);
    vignetteCtx.globalCompositeOperation = "source-over";

    maskW = mw;
    maskH = mh;
    maskInit = false;
  }

  // (1) Temporal EMA: stable = (1-a)*stable + a*new, done with additive
  //     ("lighter") compositing so the alpha math is exact (no source-over
  //     alpha loss). Result is built in maskWork, then committed to maskStable.
  if (!maskInit) {
    maskStableCtx.clearRect(0, 0, mw, mh);
    maskStableCtx.drawImage(rawMask, 0, 0, mw, mh);
    maskInit = true;
  } else {
    maskWorkCtx.clearRect(0, 0, mw, mh);
    maskWorkCtx.globalCompositeOperation = "lighter";
    maskWorkCtx.globalAlpha = 1 - MASK_EMA;
    maskWorkCtx.drawImage(maskStable, 0, 0, mw, mh);
    maskWorkCtx.globalAlpha = MASK_EMA;
    maskWorkCtx.drawImage(rawMask, 0, 0, mw, mh);
    maskWorkCtx.globalAlpha = 1;
    maskWorkCtx.globalCompositeOperation = "source-over";

    maskStableCtx.clearRect(0, 0, mw, mh);
    maskStableCtx.drawImage(maskWork, 0, 0, mw, mh);
  }

  // (2) Apply the border vignette via destination-in (multiplies the mask's
  //     alpha by the vignette's alpha), forcing edge pixels to background.
  //     This is the output canvas we hand back.
  maskWorkCtx.clearRect(0, 0, mw, mh);
  maskWorkCtx.drawImage(maskStable, 0, 0, mw, mh);
  maskWorkCtx.globalCompositeOperation = "destination-in";
  maskWorkCtx.drawImage(vignette, 0, 0, mw, mh);
  maskWorkCtx.globalCompositeOperation = "source-over";
  return maskWork;
}

function onResults(results) {
  const w = dom.output.width;
  const h = dom.output.height;
  const source = results.image;

  // ----- FPS (exponential moving average) -----
  const now = performance.now();
  const dt = now - state.lastFrame;
  state.lastFrame = now;
  if (dt > 0) {
    const instFps = 1000 / dt;
    state.fpsEMA = state.fpsEMA === 0 ? instFps : state.fpsEMA * 0.9 + instFps * 0.1;
    dom.fpsBadge.textContent = Math.round(state.fpsEMA) + " FPS";
  }

  // Effect off -> just show the raw camera frame.
  if (!state.effectOn) {
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(source, 0, 0, w, h);
    return;
  }

  // ----- 1. Background layer -----
  const mask = stabilizeMask(results.segmentationMask);
  renderBackground(bgCtx, source, mask, w, h);

  // ----- 2. Sharp person cutout (mask = person) -----
  personCtx.save();
  personCtx.clearRect(0, 0, w, h);
  personCtx.drawImage(source, 0, 0, w, h);
  personCtx.globalCompositeOperation = "destination-in";
  if (state.feather > 0) {
    personCtx.filter = `blur(${state.feather}px)`;
  }
  personCtx.drawImage(mask, 0, 0, w, h);
  personCtx.filter = "none";
  personCtx.restore();

  // ----- 3. Composite to visible canvas -----
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(bgCanvas, 0, 0);
  ctx.drawImage(personCanvas, 0, 0);
}

function renderBackground(c, source, mask, w, h) {
  c.clearRect(0, 0, w, h);

  switch (state.mode) {
    case "blur": {
      // --- Anti-halo + anti-shadow blur ---
      // (1) Knock the person OUT of a copy of the frame so their colours
      //     cannot bleed into the background while blurring (prevents halo).
      kCtx.save();
      kCtx.clearRect(0, 0, w, h);
      kCtx.globalCompositeOperation = "source-over";
      kCtx.drawImage(source, 0, 0, w, h);
      kCtx.globalCompositeOperation = "destination-out";
      kCtx.drawImage(mask, 0, 0, w, h); // erase person -> transparent hole
      kCtx.restore();

      // (2) Blur the knockout. The person's former region becomes a fill of
      //     smeared *background* colours, but it is still semi-transparent
      //     (especially at low blur values).
      bCtx.save();
      bCtx.clearRect(0, 0, w, h);
      bCtx.filter = `blur(${state.blur}px)`;
      bCtx.drawImage(knockoutCanvas, 0, 0, w, h);
      bCtx.filter = "none";
      bCtx.restore();

      // (3) Stack the blurred layer until it is fully opaque. A single blur
      //     leaves a semi-transparent band along the person's edge and at the
      //     frame border; once the sharp person is drawn on top, that band
      //     reads as a dark shadow (most visible below ~30px blur). Stacking
      //     converges every pixel to opaque background colour, so the feathered
      //     person edge always blends over solid background -> no halo, no
      //     shadow, at any blur setting.
      c.save();
      c.clearRect(0, 0, w, h);
      for (let i = 0; i < 8; i++) {
        c.drawImage(blurCanvas, 0, 0, w, h);
      }
      c.restore();
      break;
    }
    case "image": {
      if (bgImage) {
        drawCover(c, bgImage, w, h);
      } else {
        // Fallback while no image selected yet.
        c.fillStyle = state.bgColor;
        c.fillRect(0, 0, w, h);
      }
      break;
    }
    case "color": {
      c.fillStyle = state.bgColor;
      c.fillRect(0, 0, w, h);
      break;
    }
    case "none":
    default: {
      // Sharp passthrough background (effect effectively disabled for bg).
      c.drawImage(source, 0, 0, w, h);
      break;
    }
  }
}

/** Draw an image into the canvas using "cover" sizing. */
function drawCover(c, img, w, h) {
  const iw = img.naturalWidth || img.videoWidth || img.width;
  const ih = img.naturalHeight || img.videoHeight || img.height;
  if (!iw || !ih) return;
  const scale = Math.max(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  c.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}
