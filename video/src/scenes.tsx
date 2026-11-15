/**
 * The seven scenes of the 30-second Space Apps demo (docs/submission/DEMO_VIDEO.md).
 * Every picture is the game's own art from assets/incoming; every line of game text is copied
 * from content/data/strings.en.json. A scene that later gets a screen recording can swap its
 * picture for a <Video> without changing the timeline.
 */
import React from "react";
import {
  Easing,
  Img,
  Interactive,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const ORANGE = "#FF6B35";
const CYAN = "#5FE3F0";
const MONO = "'Courier New', Courier, monospace";
const SANS = "Arial, Helvetica, sans-serif";
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const pixel: React.CSSProperties = { imageRendering: "pixelated" };

/** The whole base in cutaway (1024 x 1536), drawn 1920 wide: 2880 tall. */
const BASE_H = 2880;

// ---------------------------------------------------------------- 1. intro crawl

const TypedLine: React.FC<{ readonly text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const shown = Math.floor(interpolate(frame, [0.2 * fps, 1.6 * fps], [0, text.length], clamp));
  return (
    <Interactive.Div
      name="Crawl line"
      style={{ fontFamily: MONO, fontSize: 96, fontWeight: 700, color: ORANGE, letterSpacing: 2 }}
    >
      {text.slice(0, shown)}
    </Interactive.Div>
  );
};

const IntroInner = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <>
      <TypedLine text="YEAR 2042. MISSION ASTRA." />
      <Interactive.Div
        name="Game title"
        style={{
          marginTop: 40,
          fontFamily: SANS,
          fontSize: 56,
          color: "#ffffff",
          opacity: interpolate(frame, [1.7 * fps, 2.3 * fps], [0, 1], clamp),
        }}
      >
        ASTRA
      </Interactive.Div>
    </>
  );
};

export const IntroScene = Interactive.create({
  Component: IntroInner,
  layout: "absolute-fill",
  schema: { ...Interactive.backgroundSchema },
});

// ---------------------------------------------------------------- 2. landing: the camera goes underground

const LandingInner = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <>
      <Img
        src={staticFile("style.anchor.png")}
        style={{
          ...pixel,
          position: "absolute",
          width: 1920,
          height: BASE_H,
          translate: interpolate(frame, [0, 4 * fps], ["0px 0px", "0px -1000px"], {
            ...clamp,
            easing: Easing.bezier(0.45, 0, 0.55, 1),
          }),
        }}
      />
      <Interactive.Div
        name="Place label"
        style={{
          position: "absolute",
          left: 100,
          top: 100,
          fontFamily: MONO,
          fontSize: 48,
          color: "#ffffff",
          textShadow: "0 3px 0 #000",
          opacity: interpolate(frame, [0, 0.5 * fps], [0, 1], clamp),
        }}
      >
        JEZERO CRATER, MARS
      </Interactive.Div>
    </>
  );
};

export const LandingScene = Interactive.create({
  Component: LandingInner,
  layout: "absolute-fill",
  schema: { ...Interactive.backgroundSchema },
});

// ---------------------------------------------------------------- 3. ASTRA explains the soil roof

const AstraInner = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <>
      <Img
        src={staticFile("style.anchor.png")}
        style={{
          ...pixel,
          position: "absolute",
          width: 1920,
          height: BASE_H,
          translate: "0px -1000px",
          scale: interpolate(frame, [0, 5 * fps], [1, 1.08], clamp),
        }}
      />
      <Interactive.Div
        name="ASTRA panel"
        style={{
          position: "absolute",
          left: 100,
          top: 120,
          width: 760,
          padding: 32,
          background: "rgba(5, 12, 24, 0.88)",
          border: `3px solid ${CYAN}`,
          borderRadius: 18,
          translate: interpolate(frame, [0, 0.5 * fps], ["-900px 0px", "0px 0px"], {
            ...clamp,
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          {/* first cell of the ASTRA avatar sheet (3 x 3 cells of 418 px) */}
          <div style={{ width: 150, height: 150, overflow: "hidden", position: "relative", flexShrink: 0 }}>
            <Img src={staticFile("astra.avatar.png")} style={{ ...pixel, position: "absolute", width: 450, height: 450, left: 0, top: 0 }} />
          </div>
          <div style={{ fontFamily: MONO, fontSize: 32, color: CYAN }}>ASTRA 6.7 // STATION AI</div>
        </div>
        <div style={{ marginTop: 24, fontFamily: SANS, fontSize: 46, lineHeight: 1.25, color: "#ffffff" }}>
          The soil above us blocks most of it.
        </div>
      </Interactive.Div>
    </>
  );
};

export const AstraScene = Interactive.create({
  Component: AstraInner,
  layout: "absolute-fill",
  schema: { ...Interactive.backgroundSchema },
});

// ---------------------------------------------------------------- 4. dust storm, then the Static Wipe mini-game

/** One cell (768 x 512) of the mini-game sheet: 0 = dusty panel, 1 = clean panel. */
const PanelCell: React.FC<{ readonly cell: 0 | 1; readonly style?: React.CSSProperties }> = ({ cell, style }) => (
  <div style={{ position: "absolute", left: 360, top: 180, width: 1200, height: 800, overflow: "hidden", ...style }}>
    <Img
      src={staticFile("minigame.drone-repair.png")}
      style={{ ...pixel, position: "absolute", width: 2400, height: 1600, left: cell === 0 ? 0 : -1200, top: 0 }}
    />
  </div>
);

const StormInner = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const toGame = interpolate(frame, [1.8 * fps, 2.2 * fps], [0, 1], clamp);
  return (
    <>
      <Img src={staticFile("style.anchor.png")} style={{ ...pixel, position: "absolute", width: 1920, height: BASE_H, translate: "0px -200px" }} />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "#8a3a12",
          opacity: interpolate(frame, [0, 1.2 * fps], [0, 0.72], clamp),
        }}
      />
      <Interactive.Div
        name="Storm label"
        style={{ position: "absolute", left: 100, top: 100, fontFamily: MONO, fontSize: 96, fontWeight: 700, color: "#ffffff", opacity: 1 - toGame }}
      >
        DUST STORM!
      </Interactive.Div>
      <div style={{ position: "absolute", inset: 0, background: "#2a120a", opacity: toGame }}>
        <PanelCell cell={0} />
        <PanelCell cell={1} style={{ opacity: interpolate(frame, [3 * fps, 4 * fps], [0, 1], clamp) }} />
        <Interactive.Div
          name="Mini-game label"
          style={{ position: "absolute", left: 100, top: 60, fontFamily: MONO, fontSize: 48, color: "#ffffff" }}
        >
          MINI-GAME: SOLAR PANEL STATIC WIPE
        </Interactive.Div>
      </div>
    </>
  );
};

export const StormScene = Interactive.create({
  Component: StormInner,
  layout: "absolute-fill",
  schema: { ...Interactive.backgroundSchema },
});

// ---------------------------------------------------------------- 5. the Rover expedition and its radio log

const RadioLine: React.FC<{ readonly at: number; readonly children: React.ReactNode }> = ({ at, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ marginTop: 16, fontFamily: MONO, fontSize: 40, color: "#d8ffe0", opacity: interpolate(frame, [at * fps, (at + 0.3) * fps], [0, 1], clamp) }}>
      {children}
    </div>
  );
};

const RoverInner = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <>
      <Img
        src={staticFile("surface.garage.png")}
        style={{ ...pixel, position: "absolute", width: 1920, height: 1440, top: -180, scale: interpolate(frame, [0, 5 * fps], [1, 1.1], clamp) }}
      />
      <Interactive.Div
        name="Radio log"
        style={{ position: "absolute", left: 100, bottom: 330, width: 1720, padding: 28, background: "rgba(4, 20, 10, 0.86)", border: "3px solid #4be37a", borderRadius: 16 }}
      >
        <div style={{ fontFamily: MONO, fontSize: 32, color: "#4be37a" }}>RADIO // EXPEDITION 1: CRASHED WEATHER PROBE BREEZE-7</div>
        <RadioLine at={0.3}>Rover rolling! Destination: weather probe Breeze-7, 3 kilometers east.</RadioLine>
        <RadioLine at={1.8}>Found it! Breeze-7 is half buried in dust. Digging it out.</RadioLine>
        <RadioLine at={3.3}>Heading home. Put the kettle on, ASTRA!</RadioLine>
      </Interactive.Div>
    </>
  );
};

export const RoverScene = Interactive.create({
  Component: RoverInner,
  layout: "absolute-fill",
  schema: { ...Interactive.backgroundSchema },
});

// ---------------------------------------------------------------- 6. a Science Logbook card from a real mission

const LogbookInner = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <>
      <Interactive.Div
        name="Logbook card"
        style={{
          width: 1200,
          padding: 48,
          background: "#f6efe2",
          borderRadius: 24,
          border: `6px solid ${ORANGE}`,
          scale: interpolate(frame, [0, 0.6 * fps], [0.85, 1], { ...clamp, easing: Easing.spring({ damping: 200 }), output: "perceptual-scale" }),
        }}
      >
        <div style={{ fontFamily: MONO, fontSize: 32, color: "#8a4a1a" }}>SCIENCE LOGBOOK // NEW CARD</div>
        <div style={{ marginTop: 16, fontFamily: SANS, fontSize: 84, fontWeight: 700, color: "#1d1d1d" }}>Air From Mars</div>
        <div style={{ marginTop: 16, fontFamily: SANS, fontSize: 44, lineHeight: 1.3, color: "#1d1d1d" }}>
          NASA&apos;s MOXIE made 122 grams of oxygen from Mars&apos;s carbon dioxide air. That&apos;s about what a small dog breathes in 10 hours.
        </div>
        <div style={{ marginTop: 24, fontFamily: MONO, fontSize: 32, color: "#555" }}>Source: Perseverance (MOXIE), NASA/JPL</div>
      </Interactive.Div>
      <Interactive.Div
        name="Facts strip"
        style={{ marginTop: 40, fontFamily: MONO, fontSize: 44, color: "#ffffff", opacity: interpolate(frame, [1.5 * fps, 2 * fps], [0, 1], clamp) }}
      >
        58 SCIENCE CARDS · 100 CLAIMS FACT-CHECKED
      </Interactive.Div>
    </>
  );
};

export const LogbookScene = Interactive.create({
  Component: LogbookInner,
  layout: "absolute-fill",
  schema: { ...Interactive.backgroundSchema },
});

// ---------------------------------------------------------------- 7. end title

const EndInner = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <>
      <Interactive.Div
        name="End title"
        style={{ fontFamily: SANS, fontSize: 110, fontWeight: 700, color: ORANGE, opacity: interpolate(frame, [0, 0.4 * fps], [0, 1], clamp) }}
      >
        ASTRA
      </Interactive.Div>
      <Interactive.Div name="Event and team" style={{ marginTop: 40, fontFamily: MONO, fontSize: 40, color: CYAN }}>
        NASA Space Apps Challenge 2026 · team hackteamVLDK
      </Interactive.Div>
      <Interactive.Div name="Repository link" style={{ marginTop: 16, fontFamily: MONO, fontSize: 36, color: "#cccccc" }}>
        github.com/hackteamVLDK/NASASpaceApp2026
      </Interactive.Div>
    </>
  );
};

export const EndScene = Interactive.create({
  Component: EndInner,
  layout: "absolute-fill",
  schema: { ...Interactive.backgroundSchema },
});
