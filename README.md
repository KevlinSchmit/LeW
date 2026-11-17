# The Sushi Counter

A full-screen, three-dimensional portfolio scene for Kevlin Schmit, reconstructed from the supplied sushi restaurant reference. Original Blender geometry, painted textures and a Three.js renderer; no characters, stock background images, or third-party 3D assets.

Download **[preview.html](preview.html)** for a ready-built, self-contained HTML view.

## View and develop

Requires Node.js 22.12+ (validated with 24.22.1).

```sh
npm ci
npm run dev -- --port 5173
```

Open the address printed by Vite. The conveyor moves continuously. Pause it with the bottom control or Space while the scene canvas has focus. **Look around** enables drag and scroll; click **Reset view**, the logo, or press Escape to return to your seat. Reduced-motion preferences start the conveyor paused. The bell, menu, tea set and printer are independent objects ready for later interaction work; their portfolio actions have deliberately not been assigned yet.

```sh
npm run build
```

`preview.html` (also generated at `dist/index.html`) is a **self-contained HTML view**. Open it directly in a browser with WebGL 2, including offline. Three.js, styles, painted textures and the complete model are embedded. No external font or CDN requests. The separate GLB in `public/models` is also available for other uses. Run `npm run preview -- --port 4173` to serve the production build.

## Models and source

- `blender/sushi-bar.blend` — native editable scene, with textures packed into the file and a matching camera and light rig.
- `blender/build_scene.py` — reproducible original geometry for the restaurant, conveyor, teapot, cup, menu, chopsticks, bell, printer, condiment jars and sushi. Every component is named and independently editable in the native scene.
- `blender/optimize_export.py` — merges the web copy by material **within** each independent assembly; the Blender source stays separated.
- `scripts/textures.py` / `blender/textures/` — deterministic original wood, blossom, seigaiha, fish, signage and paper artwork.
- `public/models/objects/` — 12 individual GLB prop files, exported at local origin.
- `public/models/sushi-bar.glb` — portable web scene. `SUSHI_roe`, `SUSHI_egg`, `SUSHI_salmon` and `SUSHI_tuna` are separate animation roots. `TEAPOT`, `TEACUP`, `MENU`, `BELL` and `RESUME` are separate scene roots.

To regenerate with Blender 4.3+ and Python 3 / Pillow:

```sh
python -m pip install Pillow
npm run models
npm run models:objects
npm run build
```

The static `.blend` is saved before web optimization. Editing the native file and running `blender --background blender/sushi-bar.blend --python-exit-code 1 --python blender/optimize_export.py` exports manual model changes. Regenerating with `npm run models` replaces those changes from the procedural source.

## Rendering

The reference composition is interpreted as actual 3D geometry: hollow celadon vessels, a wrapped bamboo handle, separately modeled rice grains and roe, curved fish fillets, clear glass cloches, a stitched cloth menu, a brass service bell and a curling printed résumé. Warm lighting, a depth-aware background blur, shadows, reflections and a restrained overlay keep the counter central. Materials, proportions and decorations are an original approximation, not a pixel-identical reproduction of the reference.

On narrow portrait screens the scene widens its field of view; landscape gives the intended composition. A WebGL 2 capable browser and hardware acceleration are recommended. The HTML contains roughly 13 MB of uncompressed model and application data.

## Validation

```sh
npm run build
npm test
```

The Playwright smoke test opens the actual standalone HTML offline, checks named 3D assemblies, verifies conveyor movement and pause, keyboard and camera controls, portrait layout, reduced motion and browser errors. It uses system Chromium at `/usr/bin/chromium`; override with `CHROMIUM_PATH` when needed. `node scripts/capture.mjs` generates the desktop screenshot in `artifacts/`.
