# The Sushi Counter

A full-screen, three-dimensional portfolio scene for Kevlin Schmit, reconstructed from the supplied sushi restaurant reference. Original Blender restaurant geometry, painted textures, a Three.js renderer and a procedural sushi chef; no stock background images or third-party 3D assets.

Download **[preview.html](preview.html)** for a ready-built, self-contained HTML view.

## View and develop

Requires Node.js 22.12+ (validated with 24.22.1).

```sh
npm ci
npm run dev -- --port 5173
```

Open the address printed by Vite. The conveyor moves continuously. Pause it with the bottom control or Space while the scene canvas has focus. **Look around** enables drag and scroll; click **Reset view**, the logo, or press Escape to return to your seat. Reduced-motion preferences start the conveyor paused. The stacked plates sit on a service ledge behind the conveyor. Click their visible 3D surfaces or the **Plate collection** button to toggle selection; the canvas emits `plate-stack-select` with `{ selected }` for later portfolio navigation. The bell, menu, tea set and POS terminal are independent objects ready for later interaction work; their portfolio actions have deliberately not been assigned yet.

```sh
npm run build
```

`preview.html` (also generated at `dist/index.html`) is a **self-contained HTML view**. Open it directly in a browser with WebGL 2, including offline. Three.js, styles, painted textures and the complete model are embedded. No external font or CDN requests. The separate GLB in `public/models` is also available for other uses. Run `npm run preview -- --port 4173` to serve the production build.

## Models and source

- `blender/sushi-bar.blend` — native editable scene, with textures packed into the file and a matching camera and light rig.
- `blender/build_scene.py` — reproducible original geometry for the restaurant, conveyor, teapot, cup, menu, chopsticks, bell, POS terminal, condiment jars and sushi. Every component is named and independently editable in the native scene.
- `blender/optimize_export.py` — merges the web copy by material **within** each independent assembly; the Blender source stays separated.
- `scripts/textures.py` / `blender/textures/` — deterministic original wood, blossom, seigaiha, fish, signage and paper artwork.
- `public/models/objects/` — 13 individual GLB assets, exported at local origin.
- `public/models/sushi-bar.glb` — portable Blender scene. `SUSHI_roe`, `SUSHI_egg`, `SUSHI_salmon` and `SUSHI_tuna` are separate animation roots. `TEAPOT`, `TEACUP`, `MENU`, `BELL` and `POS` are separate scene roots. The embedded legacy blue `CHEF` is removed at load time and replaced by `src/characters/sushi-chef.js`.
- `src/characters/sushi-chef.js` — scene adapter for the procedural Three.js chef, including placement and embedded texture loading. No Blender regeneration or external image requests are needed to edit this character.

To regenerate with Blender 4.3+ and Python 3 / Pillow:

```sh
python -m pip install Pillow
npm run models
npm run models:objects
npm run build
```

The static `.blend` is saved before web optimization. Editing the native file and running `blender --background blender/sushi-bar.blend --python-exit-code 1 --python blender/optimize_export.py` exports manual model changes. Regenerating with `npm run models` replaces those changes from the procedural source.

## Rendering

The supplied reference informs the **painted game-asset style**, rather than replacing the sushi-counter composition. All scene and prop GLBs are regenerated from the editable Blender source. The models use restrained polygon counts; seeded, original 128–512px textures provide fish muscle ribbons, rice grains, layered omelet, nori fibers, wood grain, worn metal, and wraparound flowering branches with patterned borders on the celadon tea set. A few modeled rice grains and roe preserve silhouettes without modeling every painted detail.

The counter extends toward the bottom of the view. The menu is a smaller stitched book. The right-hand prop is now an ivory wedge-shaped POS terminal with a tilted illustrated LCD, tactile keypad, side card slot and ventilation; there is no receipt or paper strip. Its individual asset is `public/models/objects/pos-terminal.glb`.

The original seated camera is restored (38° vertical field of view, position 0 / 8 / 17.2); the scene is not scaled down. Lighting follows the restaurant reference through contrast: a local amber spotlight from the left, a warm central pool across the menu and sushi, small tungsten pools on the rear wall, and subdued neutral-warm fill. The ceiling and unlit parts of the room remain dark; lit wood and ceramic surfaces carry warm highlights instead of a uniform yellow tint. All background lanterns, shades, ribs and hanging stems are removed from the generated model. Moving sushi and belt tiles refresh both shadow maps on every rendered moving frame, preventing the previous twelve-frame shadow lag; paused scenes retain cached shadows. Stronger near-black contours and authored ink trim support the illustrative finish. A restrained 10% saturation boost keeps the painted palette rich. An orange-brown display grade reduces the yellow-green cast after tone mapping while preserving each pixel’s luminance, so the approved light positions, strengths and shadow contrast stay unchanged. Negative color channels are clamped before tone mapping. Both rear plate columns sit on a raised service ledge; mustard yellow joins the ceramic and lacquer colors. The sauce dish and chopstick dish are rebuilt with planar cut corners, visible chamfers and sloping inset basins rather than rounded box rims. Glass vessels use a thicker green-edged finish; PET sushi covers have separate thin-shell transparency, rolled lips and narrow painted glints. Food stays sharp through the covers. The oak counter has a clear protective varnish over the painted grain, with low-roughness clearcoat and a wood-only environment containing small warm rectangular emitters. Analytic rectangular lamp reflections follow the camera direction and retain firm edges without broad softbox blur or changing the approved lighting of the other props. Depth-of-field and broad cinematic softbox reflections are removed. The native `.blend` packs the same authored textures; web-specific ink, color grading and transparency tuning live in `src/main.js` and `src/materials.js`.

On narrow portrait screens the scene widens its field of view; landscape gives the intended composition. A WebGL 2 capable browser and hardware acceleration are recommended. The standalone HTML is approximately 9 MB uncompressed, down from approximately 26 MB. The rendered scene including loop assemblies has approximately 111,000 vertices, down from approximately 418,000.

The scene uses the reference-reconstructed chef with squared shoulders, the 寿司 chest marking, and matching front and rear fabric detail. The model is built in `src/characters/createChefModel.ts` from profiles in `chef-shape.ts`. The two texture crops under `src/characters/textures` are embedded in the standalone build.

The chef stands closer to the viewer at `(0, 1.412, -4.1)`, behind the conveyor, on a dark wood riser. The raised desktop pose puts the chin at the top edge of the original seated camera. Run `npm run build` to generate the updated offline preview.
