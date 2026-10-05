import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// @ts-ignore Node middleware is shared with the production preview.
import {environmentFeed} from "./scripts/environment-feed.mjs";

// @ts-ignore Shared Node middleware.
import {imageryFeed} from "./scripts/imagery-feed.mjs";

export default defineConfig({
  plugins: [react(), {name:"environment-feed",configureServer(server){const feed=environmentFeed("public"),imagery=imageryFeed("public");server.middlewares.use((req,res,next)=>{imagery(req,res).then((handled:boolean)=>handled||feed(req,res)).then((handled:boolean)=>{if(!handled)next();}).catch(next);});}}],
  server: { port: 5178, host: "127.0.0.1", strictPort: true },
  preview: { port: 4178, host: "127.0.0.1", strictPort: true },
  build: { target: "es2020", chunkSizeWarningLimit: 4000 },
});
