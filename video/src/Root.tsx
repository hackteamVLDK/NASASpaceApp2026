import { Composition, Folder } from "remotion";
import { DemoVideo } from "./DemoVideo";
import { AstraScene, EndScene, IntroScene, LandingScene, LogbookScene, RoverScene, StormScene } from "./scenes";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="SpaceAppsDemo"
        component={DemoVideo}
        durationInFrames={900}
        fps={30}
        width={1920}
        height={1080}
      />
      <Folder name="Scenes">
        <Composition id="Intro" component={IntroScene} durationInFrames={90} fps={30} width={1920} height={1080} defaultProps={{ style: { backgroundColor: "#05070A", justifyContent: "center", alignItems: "center", flexDirection: "column" } }} />
        <Composition id="Landing" component={LandingScene} durationInFrames={120} fps={30} width={1920} height={1080} defaultProps={{ style: { backgroundColor: "#1a0f14" } }} />
        <Composition id="Astra" component={AstraScene} durationInFrames={150} fps={30} width={1920} height={1080} defaultProps={{ style: { backgroundColor: "#1a0f14" } }} />
        <Composition id="Storm" component={StormScene} durationInFrames={150} fps={30} width={1920} height={1080} defaultProps={{ style: { backgroundColor: "#1a0f14" } }} />
        <Composition id="Rover" component={RoverScene} durationInFrames={150} fps={30} width={1920} height={1080} defaultProps={{ style: { backgroundColor: "#1a0f14" } }} />
        <Composition id="Logbook" component={LogbookScene} durationInFrames={150} fps={30} width={1920} height={1080} defaultProps={{ style: { backgroundColor: "#10233a", justifyContent: "center", alignItems: "center", flexDirection: "column" } }} />
        <Composition id="End" component={EndScene} durationInFrames={90} fps={30} width={1920} height={1080} defaultProps={{ style: { backgroundColor: "#05070A", justifyContent: "center", alignItems: "center", flexDirection: "column" } }} />
      </Folder>
    </>
  );
};
