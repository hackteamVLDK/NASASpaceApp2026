/**
 * ASTRA gameplay trailer, 40 s. Every picture is a screen recording of the game (capture/capture.mjs);
 * cut points come from the event marks in public/clips/*.marks.json. Sound: the game's own music bed,
 * its sound effects from each clip (offset by when the clip's audio began), and three Kokoro voice lines.
 *
 *   0:00 alarm              Power Emergency in the dust storm
 *   0:04 decision           Dilemma "The Dust Storm": Top Up -> Power +41, HP -10 (HUD zoom)
 *   0:15 mini-game          Solar Panel Static Wipe (swipes at 4x, marked) -> power back (HUD zoom)
 *   0:24 features           a drone order, the Rover's crater map and launch, a Science Logbook card
 *   0:34 end title          the finished base
 */
import { Audio } from "@remotion/media";
import { AbsoluteFill, interpolate, Sequence, staticFile, Track, useVideoConfig } from "remotion";
import { BG, Caption, EndTitle, GameShot, SpeedBadge } from "./parts";

/** Seconds: the music bed ducks under each voice line. */
const VOICE = [[0.4, 3.7], [4.4, 7.9], [15.4, 18.1]];

export const Trailer = () => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      <Track name="Shots">
        <Sequence name="Alarm" from={0} durationInFrames={4 * fps}>
          <GameShot src="clips/alarm.mp4" trimSeconds={2.0} focusX={960} focusY={150} zoomFrom={1} zoomTo={1.12} zoomStart={0.3} zoomEnd={3.8} />
          <Audio name="Alarm sounds" src={staticFile("clips/alarm.wav")} trimBefore={Math.round(1.31 * fps)} volume={0.9} />
        </Sequence>
        <Sequence name="Decision" from={4 * fps} durationInFrames={11 * fps}>
          <GameShot src="clips/decision.mp4" trimSeconds={3.3} focusX={930} focusY={48} zoomFrom={1} zoomTo={1.7} zoomStart={6.4} zoomEnd={7.2} />
          <Audio name="Decision sounds" src={staticFile("clips/decision.wav")} trimBefore={Math.round(2.69 * fps)} volume={0.9} />
        </Sequence>
        <Sequence name="Mini-game opens" from={15 * fps} durationInFrames={2.4 * fps}>
          <GameShot src="clips/wipe.mp4" trimSeconds={3.2} focusX={960} focusY={500} zoomFrom={1} zoomTo={1.25} zoomStart={0.6} zoomEnd={2.2} />
          <Audio name="Mini-game open sounds" src={staticFile("clips/wipe.wav")} trimBefore={Math.round(2.57 * fps)} volume={0.9} />
        </Sequence>
        <Sequence name="Mini-game swipes (4x)" from={17.4 * fps} durationInFrames={4.4 * fps}>
          <GameShot src="clips/wipe.mp4" trimSeconds={5.6} playbackRate={4} focusX={960} focusY={500} zoomFrom={1.25} zoomTo={1.25} />
          <SpeedBadge text="4×" />
        </Sequence>
        <Sequence name="Mini-game win and result" from={21.8 * fps} durationInFrames={2.6 * fps}>
          <GameShot src="clips/wipe.mp4" trimSeconds={23.2} focusX={470} focusY={48} zoomFrom={1} zoomTo={2.1} zoomStart={1.0} zoomEnd={1.6} />
          <Audio name="Win sounds" src={staticFile("clips/wipe.wav")} trimBefore={Math.round(22.57 * fps)} volume={0.9} />
        </Sequence>
        <Sequence name="Drone order" from={24.4 * fps} durationInFrames={3.3 * fps}>
          <GameShot src="clips/build.mp4" trimSeconds={1.8} focusX={1150} focusY={420} zoomFrom={1.6} zoomTo={2.0} zoomStart={0} zoomEnd={3.3} />
          <Audio name="Drone order sounds" src={staticFile("clips/build.wav")} trimBefore={Math.round(1.25 * fps)} volume={0.9} />
        </Sequence>
        <Sequence name="Crater map" from={27.7 * fps} durationInFrames={1.7 * fps}>
          <GameShot src="clips/rover.mp4" trimSeconds={2.3} focusX={960} focusY={470} zoomFrom={1.05} zoomTo={1.15} zoomStart={0} zoomEnd={1.7} />
          <Audio name="Map sounds" src={staticFile("clips/rover.wav")} trimBefore={Math.round(1.84 * fps)} volume={0.9} />
        </Sequence>
        <Sequence name="Rover launch" from={29.4 * fps} durationInFrames={1.8 * fps}>
          <GameShot src="clips/rover.mp4" trimSeconds={5.0} focusX={1500} focusY={300} zoomFrom={1.4} zoomTo={1.5} zoomStart={0} zoomEnd={1.8} />
          <Audio name="Rover sounds" src={staticFile("clips/rover.wav")} trimBefore={Math.round(4.54 * fps)} volume={0.9} />
        </Sequence>
        <Sequence name="Science Logbook" from={31.2 * fps} durationInFrames={2.8 * fps}>
          <GameShot src="clips/logbook.mp4" trimSeconds={3.0} focusX={960} focusY={540} zoomFrom={1.15} zoomTo={1.3} zoomStart={0} zoomEnd={2.8} />
          <Audio name="Logbook sounds" src={staticFile("clips/logbook.wav")} trimBefore={Math.round(2.59 * fps)} volume={0.9} />
        </Sequence>
        <Sequence name="End" from={34 * fps} durationInFrames={6 * fps}>
          <GameShot src="clips/end.mp4" trimSeconds={0.6} fullBleed shiftY={-150} focusX={960} focusY={500} zoomFrom={1} zoomTo={1.06} zoomStart={0} zoomEnd={6} />
          <EndTitle />
        </Sequence>
      </Track>

      <Track name="Captions">
        <Sequence name="Caption: keep alive" from={0.2 * fps} durationInFrames={3.7 * fps}><Caption accent="#ff4d4d">Keep the outpost alive.</Caption></Sequence>
        <Sequence name="Caption: storm" from={4.2 * fps} durationInFrames={2.7 * fps}><Caption>A dust storm is coming.</Caption></Sequence>
        <Sequence name="Caption: choose" from={7.0 * fps} durationInFrames={2.9 * fps}><Caption>You choose how to prepare.</Caption></Sequence>
        <Sequence name="Caption: result" from={10.2 * fps} durationInFrames={4.7 * fps}><Caption accent="#ffb000">Power up. Health down.</Caption></Sequence>
        <Sequence name="Caption: wipe" from={15.1 * fps} durationInFrames={6.6 * fps}><Caption>Wipe the dust off the panels.</Caption></Sequence>
        <Sequence name="Caption: power back" from={22.2 * fps} durationInFrames={2.1 * fps}><Caption accent="#43e060">Power back online.</Caption></Sequence>
        <Sequence name="Caption: drones" from={24.5 * fps} durationInFrames={3.1 * fps}><Caption>Send drones to build rooms.</Caption></Sequence>
        <Sequence name="Caption: rover" from={27.8 * fps} durationInFrames={3.3 * fps}><Caption>Explore the crater by rover.</Caption></Sequence>
        <Sequence name="Caption: science" from={31.3 * fps} durationInFrames={2.6 * fps}><Caption>Learn real NASA science.</Caption></Sequence>
      </Track>

      <Track name="Voice">
        <Audio name="Voice: mission" src={staticFile("vo/line1.wav")} from={0.4 * fps} volume={1} />
        <Audio name="Voice: storm" src={staticFile("vo/line2.wav")} from={4.4 * fps} volume={1} />
        <Audio name="Voice: panels" src={staticFile("vo/line3.wav")} from={15.4 * fps} volume={1} />
      </Track>

      <Track name="Music">
        <Audio
          name="Game music (base day)"
          src={staticFile("clips/music.wav")}
          durationInFrames={40 * fps}
          volume={(f) => {
            const t = f / fps;
            const duck = VOICE.some(([a, b]) => t > a - 0.2 && t < b + 0.3) ? 0.32 : 1;
            const fade = interpolate(t, [0, 0.6, 38.4, 40], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            return 0.42 * duck * fade;
          }}
        />
      </Track>
    </AbsoluteFill>
  );
};
