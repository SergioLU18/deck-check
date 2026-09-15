import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // pdf-lib and fontkit make a ~1.1 MB chunk, loaded only when a deck list
    // is exported (see DeckListExport). The main bundle stays small.
    chunkSizeWarningLimit: 1200,
  },
});
