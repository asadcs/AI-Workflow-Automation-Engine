import { defineConfig } from "@trigger.dev/sdk/v3";

export default defineConfig({
  project: process.env.TRIGGER_PROJECT_REF ?? "proj_aximheelfymzbpyevahq",
  dirs: ["src/trigger"],
  maxDuration: 900, // 15 minutes max per run
});
