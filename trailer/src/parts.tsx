/**
 * Building blocks of the trailer: a recorded game shot (letterboxed, with an optional push-in),
 * a caption in the band under the game, a speed badge, and the end title.
 * The game is drawn at 85% so captions sit in their own band and never cover a resource value or a button.
 */
import React from "react";
import { Video } from "@remotion/media";
import { Easing, Interactive, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

export const SCREEN = { x: 144, y: 16, scale: 0.85 } as const; // the game picture: 1632 x 918
export const BG = "#05070A";
const ORANGE = "#FF6B35";
const CYAN = "#5FE3F0";
const FONT = "'Trebuchet MS', 'Segoe UI', Arial, sans-serif";
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = Easing.bezier(0.33, 0, 0.2, 1);

type ShotProps = {
  readonly src: string;
  /** seconds into the clip where this shot starts */
  readonly trimSeconds: number;
  readonly playbackRate?: number;
  /** push-in toward this point of the 1920 x 1080 game picture */
  readonly focusX?: number;
  readonly focusY?: number;
  readonly zoomFrom?: number;
  readonly zoomTo?: number;
  /** seconds (inside this shot) over which the zoom happens */
  readonly zoomStart?: number;
  readonly zoomEnd?: number;
  /** full-bleed instead of letterboxed (the end shot) */
  readonly fullBleed?: boolean;
  /** move the picture up (negative) or down, in game pixels: the end shot lifts the base above its title */
  readonly shiftY?: number;
};

/** A recorded game shot. Zoom keeps the focus point fixed, so a HUD value or a card grows in place. */
export const GameShot: React.FC<ShotProps> = ({
  src, trimSeconds, playbackRate = 1, focusX = 960, focusY = 540, zoomFrom = 1, zoomTo = 1, zoomStart = 0, zoomEnd = 0.01, fullBleed = false, shiftY = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const outer: React.CSSProperties = fullBleed
    ? { position: "absolute", inset: 0, overflow: "hidden" }
    : { position: "absolute", left: SCREEN.x, top: SCREEN.y, width: 1920 * SCREEN.scale, height: 1080 * SCREEN.scale, overflow: "hidden", borderRadius: 10, boxShadow: `0 0 0 3px #1b2a3a` };
  return (
    <div style={outer}>
      <div style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, transformOrigin: "0 0", scale: fullBleed ? 1 : SCREEN.scale, translate: `0px ${shiftY}px` }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            transformOrigin: `${focusX}px ${focusY}px`,
            scale: interpolate(frame, [zoomStart * fps, zoomEnd * fps], [zoomFrom, zoomTo], { ...clamp, easing: ease }),
          }}
        >
          <Video
            src={staticFile(src)}
            trimBefore={Math.round(trimSeconds * fps)}
            playbackRate={playbackRate}
            muted
            style={{ width: 1920, height: 1080, imageRendering: "pixelated" }}
          />
        </div>
      </div>
    </div>
  );
};

/** One short line in the caption band under the game. */
export const Caption: React.FC<{ readonly children: React.ReactNode; readonly accent?: string }> = ({ children, accent = CYAN }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 952, height: 112, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Interactive.Div
        name="Caption text"
        style={{
          fontFamily: FONT,
          fontSize: 64,
          fontWeight: 700,
          color: "#ffffff",
          letterSpacing: 1,
          paddingLeft: 28,
          borderLeft: `8px solid ${accent}`,
          opacity: interpolate(frame, [0, 0.15 * fps], [0, 1], clamp),
          translate: interpolate(frame, [0, 0.25 * fps], ["0px 14px", "0px 0px"], { ...clamp, easing: ease }),
        }}
      >
        {children}
      </Interactive.Div>
    </div>
  );
};

/** Honest marker on a sped-up stretch of gameplay. */
export const SpeedBadge: React.FC<{ readonly text: string }> = ({ text }) => (
  <div style={{ position: "absolute", left: SCREEN.x + 1632 - 150, top: SCREEN.y + 130, padding: "6px 18px", borderRadius: 10, background: "rgba(5,7,10,0.85)", border: `2px solid ${CYAN}`, fontFamily: FONT, fontSize: 40, fontWeight: 700, color: CYAN }}>
    {text}
  </div>
);

/** The end title over the finished base. */
export const EndTitle: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fade = (from: number) => interpolate(frame, [from * fps, (from + 0.4) * fps], [0, 1], clamp);
  return (
    <>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 380, background: "linear-gradient(to bottom, rgba(5,7,10,0) 0%, rgba(5,7,10,0.88) 40%, rgba(5,7,10,1) 62%, rgba(5,7,10,1) 100%)" }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 70, display: "flex", flexDirection: "column", alignItems: "center", fontFamily: FONT }}>
        <Interactive.Div name="Game title" style={{ fontSize: 112, fontWeight: 800, color: ORANGE, letterSpacing: 4, opacity: fade(0.2), textShadow: "0 4px 0 #000" }}>
          ARES-KIDS
        </Interactive.Div>
        <Interactive.Div name="Subtitle" style={{ fontSize: 52, color: "#ffffff", marginTop: -6, opacity: fade(0.5) }}>
          The Jezero Signal
        </Interactive.Div>
        <Interactive.Div name="Team" style={{ fontSize: 46, fontWeight: 700, color: CYAN, marginTop: 22, opacity: fade(1.0) }}>
          Team VLDK
        </Interactive.Div>
        <Interactive.Div name="Event" style={{ fontSize: 38, color: "#d7dde6", marginTop: 8, opacity: fade(1.3) }}>
          NASA Space Apps Challenge • Vienna
        </Interactive.Div>
      </div>
    </>
  );
};
