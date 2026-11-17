import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { readFileSync } from 'node:fs';
// The downloadable HTML contains the model too: no CDN, server or network needed.
const sceneId = '\0virtual:sushi-model';
export default defineConfig({
  plugins: [
    {
      name: 'inline-blender-scene',
      resolveId(id) { if (id === 'virtual:sushi-model') return sceneId; },
      load(id) {
        if (id === sceneId) {
          const file = new URL('./public/models/sushi-bar.glb', import.meta.url);
          this.addWatchFile(file.pathname);
          const data = readFileSync(file);
          return `export default ${JSON.stringify('data:model/gltf-binary;base64,' + data.toString('base64'))}`;
        }
      },
    },
    viteSingleFile(),
  ],
  build: { target: 'es2022', assetsInlineLimit: 100_000_000, chunkSizeWarningLimit: 30000 },
});
