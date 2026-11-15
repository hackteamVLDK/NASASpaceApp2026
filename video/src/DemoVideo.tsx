/**
 * The 30-second NASA Space Apps demo (shot list: docs/submission/DEMO_VIDEO.md).
 * Captions come from docs/submission/DEMO_VIDEO.en.srt: one scene per subtitle, cut to its length.
 * Total 30 s.
 */
import { TransitionSeries } from '@remotion/transitions';
import { useVideoConfig } from 'remotion';
import { BasicCaptions } from './basic-captions.element';
import { AstraScene, EndScene, IntroScene, LandingScene, LogbookScene, RoverScene, StormScene } from './scenes';

export const DemoVideo = () => {
  const { fps } = useVideoConfig();
  return (
    <TransitionSeries name="Demo scenes">
      <TransitionSeries.Sequence name="Intro crawl" durationInFrames={3 * fps}>
        <IntroScene name="Intro crawl scene" style={{ backgroundColor: '#05070A', justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }} />
        <BasicCaptions
          name="Intro crawl captions"
          width={1500}
          combineTokensWithinMilliseconds={3000}
          style={{ position: 'absolute', bottom: 100, translate: '210px 0px' }}
          captions={[
            { text: "We're", startMs: 0, endMs: 300, timestampMs: 150, confidence: null },
            { text: " Mykhailo,", startMs: 300, endMs: 600, timestampMs: 450, confidence: null },
            { text: " Vlad", startMs: 600, endMs: 900, timestampMs: 750, confidence: null },
            { text: " and", startMs: 900, endMs: 1200, timestampMs: 1050, confidence: null },
            { text: " Pavlo,", startMs: 1200, endMs: 1500, timestampMs: 1350, confidence: null },
            { text: " team", startMs: 1500, endMs: 1800, timestampMs: 1650, confidence: null },
            { text: " hackteamVLDK.", startMs: 1800, endMs: 2100, timestampMs: 1950, confidence: null },
            { text: " This", startMs: 2100, endMs: 2400, timestampMs: 2250, confidence: null },
            { text: " is", startMs: 2400, endMs: 2700, timestampMs: 2550, confidence: null },
            { text: " ARES-KIDS.", startMs: 2700, endMs: 3000, timestampMs: 2850, confidence: null, pageBreakAfter: true },
          ]}
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Sequence name="Landing" durationInFrames={4 * fps}>
        <LandingScene name="Landing scene" style={{ backgroundColor: '#1a0f14' }} />
        <BasicCaptions
          name="Landing captions"
          width={1500}
          combineTokensWithinMilliseconds={4000}
          style={{ position: 'absolute', bottom: 100, translate: '210px 0px' }}
          captions={[
            { text: "Kids", startMs: 0, endMs: 267, timestampMs: 134, confidence: null },
            { text: " aged", startMs: 267, endMs: 533, timestampMs: 400, confidence: null },
            { text: " seven", startMs: 533, endMs: 800, timestampMs: 667, confidence: null },
            { text: " to", startMs: 800, endMs: 1067, timestampMs: 934, confidence: null },
            { text: " twelve", startMs: 1067, endMs: 1333, timestampMs: 1200, confidence: null },
            { text: " land", startMs: 1333, endMs: 1600, timestampMs: 1467, confidence: null },
            { text: " in", startMs: 1600, endMs: 1867, timestampMs: 1734, confidence: null },
            { text: " Jezero", startMs: 1867, endMs: 2133, timestampMs: 2000, confidence: null },
            { text: " Crater", startMs: 2133, endMs: 2400, timestampMs: 2267, confidence: null },
            { text: " and", startMs: 2400, endMs: 2667, timestampMs: 2534, confidence: null },
            { text: " rebuild", startMs: 2667, endMs: 2933, timestampMs: 2800, confidence: null },
            { text: " a", startMs: 2933, endMs: 3200, timestampMs: 3067, confidence: null },
            { text: " half-buried", startMs: 3200, endMs: 3467, timestampMs: 3334, confidence: null },
            { text: " Mars", startMs: 3467, endMs: 3733, timestampMs: 3600, confidence: null },
            { text: " base.", startMs: 3733, endMs: 4000, timestampMs: 3867, confidence: null, pageBreakAfter: true },
          ]}
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Sequence name="ASTRA explains" durationInFrames={5 * fps}>
        <AstraScene name="ASTRA explains scene" style={{ backgroundColor: '#1a0f14' }} />
        <BasicCaptions
          name="ASTRA explains captions"
          width={1500}
          combineTokensWithinMilliseconds={5000}
          style={{ position: 'absolute', bottom: 100, translate: '210px 0px' }}
          captions={[
            { text: "ASTRA,", startMs: 0, endMs: 385, timestampMs: 193, confidence: null },
            { text: " the", startMs: 385, endMs: 769, timestampMs: 577, confidence: null },
            { text: " station", startMs: 769, endMs: 1154, timestampMs: 962, confidence: null },
            { text: " AI,", startMs: 1154, endMs: 1538, timestampMs: 1346, confidence: null },
            { text: " explains", startMs: 1538, endMs: 1923, timestampMs: 1731, confidence: null },
            { text: " real", startMs: 1923, endMs: 2308, timestampMs: 2116, confidence: null },
            { text: " science:", startMs: 2308, endMs: 2692, timestampMs: 2500, confidence: null },
            { text: " soil", startMs: 2692, endMs: 3077, timestampMs: 2885, confidence: null },
            { text: " over", startMs: 3077, endMs: 3462, timestampMs: 3270, confidence: null },
            { text: " the", startMs: 3462, endMs: 3846, timestampMs: 3654, confidence: null },
            { text: " rooms", startMs: 3846, endMs: 4231, timestampMs: 4039, confidence: null },
            { text: " blocks", startMs: 4231, endMs: 4615, timestampMs: 4423, confidence: null },
            { text: " radiation.", startMs: 4615, endMs: 5000, timestampMs: 4808, confidence: null, pageBreakAfter: true },
          ]}
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Sequence name="Storm and mini-game" durationInFrames={5 * fps}>
        <StormScene name="Storm and mini-game scene" style={{ backgroundColor: '#1a0f14' }} />
        <BasicCaptions
          name="Storm and mini-game captions"
          width={1500}
          combineTokensWithinMilliseconds={5000}
          style={{ position: 'absolute', bottom: 100, translate: '210px 0px' }}
          captions={[
            { text: "Dust", startMs: 0, endMs: 417, timestampMs: 209, confidence: null },
            { text: " storms,", startMs: 417, endMs: 833, timestampMs: 625, confidence: null },
            { text: " freezing", startMs: 833, endMs: 1250, timestampMs: 1042, confidence: null },
            { text: " nights", startMs: 1250, endMs: 1667, timestampMs: 1459, confidence: null },
            { text: " and", startMs: 1667, endMs: 2083, timestampMs: 1875, confidence: null },
            { text: " solar", startMs: 2083, endMs: 2500, timestampMs: 2292, confidence: null },
            { text: " flares", startMs: 2500, endMs: 2917, timestampMs: 2709, confidence: null },
            { text: " become", startMs: 2917, endMs: 3333, timestampMs: 3125, confidence: null },
            { text: " nine", startMs: 3333, endMs: 3750, timestampMs: 3542, confidence: null },
            { text: " quick", startMs: 3750, endMs: 4167, timestampMs: 3959, confidence: null },
            { text: " repair", startMs: 4167, endMs: 4583, timestampMs: 4375, confidence: null },
            { text: " games.", startMs: 4583, endMs: 5000, timestampMs: 4792, confidence: null, pageBreakAfter: true },
          ]}
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Sequence name="Rover expedition" durationInFrames={5 * fps}>
        <RoverScene name="Rover expedition scene" style={{ backgroundColor: '#1a0f14' }} />
        <BasicCaptions
          name="Rover expedition captions"
          width={1500}
          combineTokensWithinMilliseconds={5000}
          style={{ position: 'absolute', bottom: 100, translate: '210px 0px' }}
          captions={[
            { text: "The", startMs: 0, endMs: 385, timestampMs: 193, confidence: null },
            { text: " Rover", startMs: 385, endMs: 769, timestampMs: 577, confidence: null },
            { text: " explores", startMs: 769, endMs: 1154, timestampMs: 962, confidence: null },
            { text: " the", startMs: 1154, endMs: 1538, timestampMs: 1346, confidence: null },
            { text: " crater", startMs: 1538, endMs: 1923, timestampMs: 1731, confidence: null },
            { text: " and", startMs: 1923, endMs: 2308, timestampMs: 2116, confidence: null },
            { text: " brings", startMs: 2308, endMs: 2692, timestampMs: 2500, confidence: null },
            { text: " back", startMs: 2692, endMs: 3077, timestampMs: 2885, confidence: null },
            { text: " parts", startMs: 3077, endMs: 3462, timestampMs: 3270, confidence: null },
            { text: " to", startMs: 3462, endMs: 3846, timestampMs: 3654, confidence: null },
            { text: " grow", startMs: 3846, endMs: 4231, timestampMs: 4039, confidence: null },
            { text: " the", startMs: 4231, endMs: 4615, timestampMs: 4423, confidence: null },
            { text: " base.", startMs: 4615, endMs: 5000, timestampMs: 4808, confidence: null, pageBreakAfter: true },
          ]}
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Sequence name="Science Logbook" durationInFrames={5 * fps}>
        <LogbookScene name="Science Logbook scene" style={{ backgroundColor: '#10233a', justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }} />
        <BasicCaptions
          name="Science Logbook captions"
          width={1500}
          combineTokensWithinMilliseconds={5000}
          style={{ position: 'absolute', bottom: 100, translate: '210px 0px' }}
          captions={[
            { text: "Each", startMs: 0, endMs: 333, timestampMs: 167, confidence: null },
            { text: " event", startMs: 333, endMs: 667, timestampMs: 500, confidence: null },
            { text: " unlocks", startMs: 667, endMs: 1000, timestampMs: 834, confidence: null },
            { text: " a", startMs: 1000, endMs: 1333, timestampMs: 1167, confidence: null },
            { text: " card", startMs: 1333, endMs: 1667, timestampMs: 1500, confidence: null },
            { text: " from", startMs: 1667, endMs: 2000, timestampMs: 1834, confidence: null },
            { text: " a", startMs: 2000, endMs: 2333, timestampMs: 2167, confidence: null },
            { text: " real", startMs: 2333, endMs: 2667, timestampMs: 2500, confidence: null },
            { text: " NASA", startMs: 2667, endMs: 3000, timestampMs: 2834, confidence: null },
            { text: " mission.", startMs: 3000, endMs: 3333, timestampMs: 3167, confidence: null },
            { text: " We", startMs: 3333, endMs: 3667, timestampMs: 3500, confidence: null },
            { text: " fact-checked", startMs: 3667, endMs: 4000, timestampMs: 3834, confidence: null },
            { text: " a", startMs: 4000, endMs: 4333, timestampMs: 4167, confidence: null },
            { text: " hundred", startMs: 4333, endMs: 4667, timestampMs: 4500, confidence: null },
            { text: " claims.", startMs: 4667, endMs: 5000, timestampMs: 4834, confidence: null, pageBreakAfter: true },
          ]}
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Sequence name="End title" durationInFrames={3 * fps}>
        <EndScene name="End title scene" style={{ backgroundColor: '#05070A', justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }} />
        <BasicCaptions
          name="End title captions"
          width={1500}
          combineTokensWithinMilliseconds={3000}
          style={{ position: 'absolute', bottom: 100, translate: '210px 0px' }}
          captions={[
            { text: "No", startMs: 0, endMs: 375, timestampMs: 188, confidence: null },
            { text: " one", startMs: 375, endMs: 750, timestampMs: 563, confidence: null },
            { text: " dies", startMs: 750, endMs: 1125, timestampMs: 938, confidence: null },
            { text: " here.", startMs: 1125, endMs: 1500, timestampMs: 1313, confidence: null },
            { text: " You", startMs: 1500, endMs: 1875, timestampMs: 1688, confidence: null },
            { text: " learn", startMs: 1875, endMs: 2250, timestampMs: 2063, confidence: null },
            { text: " why.", startMs: 2250, endMs: 2625, timestampMs: 2438, confidence: null },
            { text: " Thanks!", startMs: 2625, endMs: 3000, timestampMs: 2813, confidence: null, pageBreakAfter: true },
          ]}
        />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};
