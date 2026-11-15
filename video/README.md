# ARES-KIDS demo video (30 s)

A Remotion cut of the 30-second shot list in [docs/submission/DEMO_VIDEO.md](../docs/submission/DEMO_VIDEO.md),
with captions generated from `docs/submission/DEMO_VIDEO.en.srt`. Pictures come from `assets/incoming/`
(set as the public folder in `remotion.config.ts`).

```bash
npm install
npx remotion studio                     # preview; composition "SpaceAppsDemo"
npx remotion render SpaceAppsDemo out/demo.mp4 --codec=h264
```

The 40-second gameplay trailer with real game recordings is in [../trailer/](../trailer/README.md).
