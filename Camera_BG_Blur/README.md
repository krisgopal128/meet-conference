# Realtime Background Blur (HTML + JS)

Realtime webcam background blur that runs **100% on-device** in the browser.
No video ever leaves the user's machine — the segmentation model is downloaded
once from a CDN and runs locally via WebAssembly/WebGL.

![pipeline](https://img.shields.io/badge/processing-on--device-7c5cff)

## Quick start

This app uses camera APIs (`getUserMedia`) and a CDN script, so it must be
served over **http(s)://** or **localhost** — opening `index.html` directly via
`file://` will **not** work (browsers block the camera on `file://`).

Pick any one of these:

```bash
# Python (already installed almost everywhere)
python3 -m http.server 8000

# Node (no install if you have npx)
npx --yes serve .

# PHP
php -S localhost:8000
```

Then open <http://localhost:8000> and click **Start camera**.

## How it works

```
webcam (hidden <video>)
        │
        ▼
MediaPipe Selfie Segmentation  ──►  person mask (256×256)
        │
        ▼
┌───────────────────────────────────────────────┐
│  bgCanvas      blurred video / image / color  │
│  personCanvas  sharp video × mask (person)    │
│           └──────────► output <canvas>        │
└───────────────────────────────────────────────┘
```

Per frame:

1. **Background layer** — render the chosen background to an offscreen canvas
   (blurred video, an uploaded image, a solid color, or sharp passthrough).
   - **For blur mode (anti-halo + anti-shadow):** the person is first *knocked out* of a copy of the frame (`destination-out`), so only true background colours get blurred into the person's former region. This prevents the colored fringe/halo. The blurred knockout is then **stacked 8×** so the fill converges to fully opaque — without this, low blur values (< 30 px) leave a semi-transparent band along the subject's edge that shows up as a dark shadow once the sharp person is drawn on top.
   - The blur uses the GPU-accelerated `ctx.filter = 'blur(Npx)'`.
2. **Person layer** — draw the sharp video frame, then keep only the person
   pixels using the mask with `globalCompositeOperation = 'destination-in'`.
   An optional **edge feather** blurs the mask for a clean cutout.
   - The mask is **temporally smoothed** (per-frame EMA) and **spatially pinned
     to background near the frame borders** via a smooth edge vignette. Together
     these stop the background (especially the scene edges) from briefly turning
     sharp when the subject moves — the model can mis-classify border pixels for
     several consecutive frames during motion, which the vignette suppresses
     outright. Both are done with pure GPU canvas compositing at the model's
     native 256×256 (no per-frame `getImageData`, which was stalling the WebGL
     inference pipeline and freezing the camera).
3. **Composite** — draw the background, then the person, onto the visible canvas.

## Features

- Blur background with adjustable intensity (0–40px)
- Edge feathering for clean subject edges
- Alternative backgrounds: **uploaded image**, **solid color**, or **none**
- Mirror toggle
- Live FPS readout
- Effect on/off switch

## Performance notes

- The model (Selfie Segmentation, 256×256 input) runs at ~33 ms / frame on a
  typical laptop CPU. The render loop is **capped at 30 FPS** to keep CPU/GPU
  usage predictable and consistent across devices.
- The compositing path uses only canvas draw + `ctx.filter` (GPU-accelerated in
  Chromium/Firefox/Safari), so the per-frame overhead beyond inference is small.
- For best results sit within ~2 m of the camera (the model's sweet spot).

---

## License research (the important part)

You asked specifically for an **MIT-licensed** background-blur that is **fast
and best-in-performance**. Here is the honest summary of what exists today:

| Option | License | Speed | Quality | Notes |
|---|---|---|---|---|
| **MediaPipe Selfie Segmentation** (this app) | **Apache-2.0** | Excellent (~33 ms) | Very good for webcam | Powers **Google Meet** blur. Best-in-class for this use case. |
| MediaPipe `SelfieMulticlass` | Apache-2.0 | Slower (~70–217 ms) | Segment hair/skin/clothes | Overkill for plain blur. |
| TF.js `body-segmentation` (wraps MediaPipe) | Apache-2.0 | Good | Same models | Convenience wrapper around the same model. |
| TensorFlow BodyPix | Apache-2.0 | Moderate | Lower than SelfieSeg | Older; superseded by Selfie Segmentation. |
| Transformers.js + RMBG-1.4 / U2Net | Various (RMBG = AGPL/CC-BY-NC; code MIT) | Slow (~1–3 s) | High on photos | Too slow for realtime webcam; some models are non-commercial. |

### Conclusion

**There is no high-quality, strictly-MIT-licensed person-segmentation model
that is fast enough for realtime webcam blur.** The fast, high-quality models
are all **Apache-2.0**. Apache-2.0 is a permissive license functionally
equivalent to MIT for practical purposes:

- Commercial use — allowed
- Modification — allowed
- Distribution / re-licensing into a proprietary product — allowed
- Patent grant — Apache-2.0 actually gives you *more* protection than MIT

The only obligations are to **retain the license/copyright notice** and **state
any significant changes**. So **MediaPipe Selfie Segmentation (Apache-2.0)** is
the correct, safe, best-performing choice, and is what this project uses.

### Where to put the notices

If you ship this, keep the Apache-2.0 notices for:

1. **The MediaPipe runtime** — `@mediapipe/selfie_segmentation` (the CDN script
   loaded in `index.html`). See
   <https://github.com/google-ai-edge/mediapipe/blob/master/LICENSE>
2. **The model weights** — `selfie_segmentation_landscape.tflite` /
   `selfie_segmentation_general.tflite`, loaded automatically via `locateFile`.
   Model weights are released under Apache-2.0 too
   (<https://kaggle.com/models/mediapipe/selfie-segmentation>).

This project's own source files are released under the **MIT License** — see
`LICENSE`. The combined app is fine to use commercially; just keep the
MediaPipe/Apache notices alongside as required.

## Browser support

- Chrome / Edge / Brave (desktop & Android) — fully supported
- Firefox — supported
- Safari 14+ / iOS Safari — supported (`getUserMedia` + `ctx.filter` blur)

## File structure

```
.
├── index.html        # markup, UI controls, loads MediaPipe from CDN
├── css/style.css     # styling (dark glass UI)
├── js/app.js         # camera, segmentation loop, compositing
└── README.md
```

## Troubleshooting

- **Black screen / nothing happens** — make sure you opened it via
  `http://localhost:8000`, **not** by double-clicking the file. Camera is
  blocked on `file://`.
- **"Camera permission denied"** — allow the camera in the browser's site
  permissions and reload.
- **Low FPS** — close other heavy tabs, lower the blur value, or reduce the
  camera resolution in your OS settings.
- **Flickering edges** — increase the **Edge feather** slider slightly.
