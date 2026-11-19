# The Sushi Counter

A full-screen, three-dimensional portfolio scene for Kevlin Schmit, reconstructed from the supplied sushi restaurant reference. Original Blender restaurant geometry, painted textures, a Three.js renderer and a procedural sushi chef; no stock background images or third-party 3D assets.

Download **[preview.html](preview.html)** for a ready-built, self-contained HTML view.

## View and develop

Requires Node.js 22.12+ (validated with 24.22.1).

```sh
npm ci
npm run dev -- --port 5173
```

Open the address printed by Vite. The conveyor moves continuously. Pause it with the bottom control or Space while the scene canvas has focus. From the seat, the camera turns by a few degrees with the mouse and eases back to center when it leaves the scene. Reduced-motion settings suppress this movement. **Look around** enables drag and scroll; click **Reset view**, the logo, or press Escape to return to your seat. **360° view** opens a cutaway of the entire counter. Drag or use the left and right arrow keys to orbit, scroll to zoom, and choose **Back to seat** to return. Reduced-motion preferences start the conveyor paused and disable the automatic orbit. Click the left plate stack or its **Experience** hover label to approach the service ledge. Hover the top five plates to slide them out, then click one to read it face-on. Lower plates gently tilt once when clicked. The background also closes either Experience view. With the scene focused, E opens the stack, the arrow keys move between plates, and Enter selects one. Back or Escape returns one level at a time. Click the tabletop menu to reopen it. Click outside the open book to close it and return to the seat.

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

## Menu handwriting reference

The [approved alphabet sheet](docs/menu-handwriting-reference.png) is the source for the lettering on **Start Exploring** and **Back to Explore**. Its detached, mixed-case letters retain the hand-drawn proportions, uneven baselines, and variation in stroke weight.

Reuse the traced contours in [`src/menu-lettering.js`](src/menu-lettering.js) by calling `drawMenuInk(ctx, text, x, y, scale)` with a Canvas 2D context. `menuInkWidth(text)` measures the lettering in its unscaled units. The current set covers the menu actions and the object-hover labels. Trace additional letters from the saved sheet as new copy needs them.

## Rendering

The supplied reference informs the **painted game-asset style**, rather than replacing the sushi-counter composition. All scene and prop GLBs are regenerated from the editable Blender source. The models use restrained polygon counts; seeded, original 128–512px textures provide fish muscle ribbons, rice grains, layered omelet, nori fibers, wood grain, worn metal, and wraparound flowering branches with patterned borders on the celadon tea set. A few modeled rice grains and roe preserve silhouettes without modeling every painted detail.

The counter extends toward the bottom of the view. The menu is a smaller stitched book. The right-hand POS terminal is built in `src/counter-terminal.js`. Its silver-gray wedge housing has a charcoal base, a printer lid, a recessed chip slot, and a side swipe guide. `src/counter-terminal-paint.js` generates the LCD, keypad legends, shallow key relief and plastic finish. The live terminal inherits the seating and Resume hover target of the original Blender prop.

The original seated camera is restored (38° vertical field of view, position 0 / 8 / 17.2); the scene is not scaled down. Lighting follows the restaurant reference through contrast: a local amber spotlight from the left, a warm central pool across the menu and sushi, small tungsten pools on the rear wall, and subdued neutral-warm fill. The ceiling and unlit parts of the room remain dark; lit wood and ceramic surfaces carry warm highlights instead of a uniform yellow tint. The Three.js backdrop replaces the original shoji and curtains with limewash, timber wainscoting, vertical Japanese menu slips, framed seafood prints and warm string bulbs. The poster and pennant art is bundled under `src/izakaya-assets`. The scene uses a local subset of [Yuji Boku](https://github.com/Kinutafontfactory/Yuji) for the brush lettering, with the SIL Open Font License alongside it. The textured wall finishes, menu strips and type are assembled locally without external requests. Moving sushi and belt tiles refresh both shadow maps on every rendered moving frame, preventing the previous twelve-frame shadow lag; paused scenes retain cached shadows. Stronger near-black contours and authored ink trim support the illustrative finish. A restrained 10% saturation boost keeps the painted palette rich. An orange-brown display grade reduces the yellow-green cast after tone mapping while preserving each pixel’s luminance, so the approved light positions, strengths and shadow contrast stay unchanged. Negative color channels are clamped before tone mapping. Both rear plate columns sit on a raised service ledge; mustard yellow joins the ceramic and lacquer colors. The sauce dish and chopstick dish are rebuilt with planar cut corners, visible chamfers and sloping inset basins rather than rounded box rims. Glass vessels use a thicker green-edged finish; PET sushi covers have separate thin-shell transparency, rolled lips and narrow painted glints. Food stays sharp through the covers. The oak counter has a clear protective varnish over the painted grain, with low-roughness clearcoat and a wood-only environment containing small warm rectangular emitters. Analytic rectangular lamp reflections follow the camera direction and retain firm edges without broad softbox blur or changing the approved lighting of the other props. Depth-of-field and broad cinematic softbox reflections are removed. The native `.blend` packs the same authored textures; web-specific ink, color grading and transparency tuning live in `src/main.js` and `src/materials.js`.

On narrow portrait screens the scene widens its field of view; landscape gives the intended composition. A WebGL 2 capable browser and hardware acceleration are recommended. The standalone HTML is approximately 9 MB uncompressed, down from approximately 26 MB. The rendered scene including loop assemblies has approximately 111,000 vertices, down from approximately 418,000.

The scene uses the reference-reconstructed chef with squared shoulders, the 寿司 chest marking, and matching front and rear fabric detail. The model is built in `src/characters/createChefModel.ts` from profiles in `chef-shape.ts`. The two texture crops under `src/characters/textures` are embedded in the standalone build.

Two extended straight runs and curved returns share a continuous path, with forty covered plates moving at the speed of the slats. The returns sit beyond the edges of the fixed seated view and remain accessible in the 360° view. Nineteen kinds of sushi circulate, including fifteen procedural servings with tapered low-poly forms, painted ingredient textures and thin ink contours. The servings share the original plates and clear covers. A black-lidded wasabi jar and a short soy dispenser sit on the right. A warm ivory music player sits just forward and to the right of the POS terminal, with its headphone lead running off the right side of the view. The fixed seated camera looks onto the enlarged upper-body assembly behind the conveyor. The desktop framing puts the chin at the top edge and the sash at belt height. At the rear prep table, the chef shapes a nigiri below the customer’s sightline. The animation mixer drives the forearms, wrists and five individually articulated digits per hand. A second clip lowers the hips over planted feet to retrieve a salmon board, grips a knife, separates three portions and stows the board. A third clip picks up a small folded cloth, wipes the prep surface four times and returns it to its corner. Another clip rolls one cuff and brushes the sash with both hands. Work starts with the clothing adjustment, then cleaning, nigiri and slicing. Subsequent sets shuffle, and the scene motion button pauses the conveyor and the chef together. The complete character remains available from the procedural factory. Run `npm run build` to generate the updated offline preview.

## Tea story

Click the teapot or press T with focus on the scene to begin. The teacup starts empty, then fills as the camera approaches. Both the paper's **Back to Explore** button and the area outside the paper dismiss the story. Escape also dismisses it. The teapot and camera return to the positions they held before the interaction, and the cup is ready for another pour.

Font 1 is the [menu handwriting](docs/menu-handwriting-reference.png) used for the floating line and the exit button. Font 2 is the [Editors Letter specimen](docs/tea-handwriting-reference.png) supplied with the tea revision. The bundled OpenType file at [`src/fonts/tea-story-specimen.otf`](src/fonts/tea-story-specimen.otf) traces the specimen for the paper's selectable text and uses lighter contours to match Font 1's stroke weight. The paper stock is generated in `src/tea-paper.js`. The story copy lives in `index.html`.

Click the POS terminal to print and read the Resume receipt. Click a plate on the front conveyor to bring it to your seat, lift the cover, and open a scrollable illustration of that serving. Each paper closes via **Back to Explore**, a click outside the page, or Escape. Leaving the sushi paper plays the chopstick animation, adds the empty plate to the stack by the teapot, and restores the tabletop props. The conveyor replenishes its empty slot once the slot is out of view.

The stack and conveyor use the same turned porcelain profiles with patterned rim transfers. The low, tapered PET lid is a separately movable cover with molded edge rolls and angle-dependent reflections.
