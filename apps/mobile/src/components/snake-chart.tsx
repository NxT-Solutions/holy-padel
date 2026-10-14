import type { HeartRateSample } from "@holy-padel/db";
import type { ReactNode } from "react";
import { useState } from "react";
import Svg, { Circle, Line, Polyline, Rect } from "react-native-svg";
import { View, XStack } from "tamagui";
import { Body } from "@/components/ui.tsx";
import type { GameSeriesStep } from "@/lib/game-series.ts";
import { colors, textAlpha } from "@/theme/colors.ts";

const CHART_HEIGHT = 150;
const PAD_X = 10;
const PAD_Y = 14;

interface Segment {
  readonly key: string;
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  /** Colour of the horizontal run (sign of the lead before the step). */
  readonly horizontal: string;
  /** Colour of the vertical riser (sign of the lead after the step). */
  readonly riser: string | undefined;
}

interface HrPoint {
  readonly x: number;
  readonly y: number;
}

/** Heart-rate samples mapped onto the chart's plot area, on their own scale. */
function hrPointsOf(
  samples: readonly HeartRateSample[],
  startedAt: number,
  span: number,
  plotWidth: number,
): HrPoint[] {
  const inWindow = samples
    .filter((sample) => sample.t >= startedAt && sample.t <= startedAt + span && span > 0)
    .sort((left, right) => left.t - right.t);
  if (inWindow.length < 2) {
    return [];
  }
  const bpms = inWindow.map((sample) => sample.bpm);
  const min = Math.min(...bpms) - 4;
  const max = Math.max(...bpms) + 4;
  return inWindow.map((sample) => ({
    x: PAD_X + ((sample.t - startedAt) / span) * plotWidth,
    y: PAD_Y + (1 - (sample.bpm - min) / Math.max(1, max - min)) * (CHART_HEIGHT - PAD_Y * 2),
  }));
}

const colorFor = (lead: number): string => (lead >= 0 ? colors.accent : colors.teamB);

function buildSegments(
  steps: readonly GameSeriesStep[],
  xOf: (t: number, index: number) => number,
  yOf: (lead: number) => number,
): { readonly segments: Segment[]; readonly xs: number[] } {
  const xs: number[] = steps.map((step, index) => xOf(step.t, index));
  const segments: Segment[] = [];
  for (let index = 0; index + 1 < steps.length; index += 1) {
    const [from, to] = [steps[index], steps[index + 1]];
    const [x1, x2] = [xs[index], xs[index + 1]];
    if (from !== undefined && to !== undefined && x1 !== undefined && x2 !== undefined) {
      const y1 = yOf(from.lead);
      const y2 = yOf(to.lead);
      segments.push({
        key: `s${String(index)}`,
        x1,
        y1,
        x2,
        y2,
        horizontal: colorFor(from.lead),
        riser: y1 === y2 ? undefined : colorFor(from.lead === 0 ? to.lead : from.lead),
      });
    }
  }
  return { segments, xs };
}

/** The score-race "snake": in-game lead over time with a heart-rate overlay. */
export function SnakeChart({
  steps,
  startedAt,
  endedAt,
  heartRate,
  width: fixedWidth,
}: {
  readonly steps: readonly GameSeriesStep[];
  readonly startedAt: number;
  readonly endedAt: number;
  readonly heartRate?: readonly HeartRateSample[];
  readonly width?: number;
}): ReactNode {
  const [measured, setMeasured] = useState(0);
  const width = fixedWidth ?? measured;
  const span = endedAt - startedAt;
  const count = steps.length;
  const plotWidth = Math.max(0, width - PAD_X * 2);
  const maxLead = Math.max(3, ...steps.map((step) => Math.abs(step.lead)));
  const half = CHART_HEIGHT / 2 - PAD_Y;
  const xOf = (t: number, index: number): number => {
    let share = index / Math.max(1, count - 1);
    if (span > 0 && count > 1) {
      share = (t - startedAt) / span;
    }
    return PAD_X + share * plotWidth;
  };
  const yOf = (lead: number): number => CHART_HEIGHT / 2 - (lead / maxLead) * half;

  const { segments, xs } = buildSegments(steps, xOf, yOf);
  const [firstX] = xs;
  const [firstStep] = steps;
  const lastX = xs.at(-1);
  const lastStep = steps.at(-1);

  const hrPoints = hrPointsOf(heartRate ?? [], startedAt, span, plotWidth);

  return (
    <View
      width={fixedWidth ?? "100%"}
      onLayout={(event) => {
        if (fixedWidth === undefined) {
          setMeasured(event.nativeEvent.layout.width);
        }
      }}
    >
      {width > 0 && (
        <Svg width={width} height={CHART_HEIGHT}>
          {/* Zero axis: dead even. */}
          <Line
            x1={PAD_X}
            y1={CHART_HEIGHT / 2}
            x2={width - PAD_X}
            y2={CHART_HEIGHT / 2}
            stroke={colors.greige}
            strokeWidth={1.5}
          />
          {segments.map((segment) => (
            <Line
              key={segment.key}
              x1={segment.x1}
              y1={segment.y1}
              x2={segment.x2}
              y2={segment.y1}
              stroke={segment.horizontal}
              strokeWidth={2.5}
            />
          ))}
          {segments.map((segment) =>
            segment.riser === undefined ? null : (
              <Line
                key={`${segment.key}v`}
                x1={segment.x2}
                y1={segment.y1}
                x2={segment.x2}
                y2={segment.y2}
                stroke={segment.riser}
                strokeWidth={2.5}
              />
            ),
          )}
          {/* Hand-ins / hand-outs: the serve changed hands on this rally. */}
          {steps.map((step, index) =>
            step.handOut && count > 1 ? (
              <Rect
                key={`h${String(index)}`}
                x={xOf(step.t, index) - 2}
                y={CHART_HEIGHT / 2 - 3}
                width={4}
                height={6}
                fill={colors.text}
              />
            ) : null,
          )}
          {firstX !== undefined && firstStep !== undefined && count === 1 && (
            <Circle
              cx={firstX}
              cy={yOf(firstStep.lead)}
              r={4}
              fill={firstStep.lead >= 0 ? colors.accent : colors.teamB}
            />
          )}
          {lastX !== undefined && lastStep !== undefined && count > 1 && (
            <Circle
              cx={lastX}
              cy={yOf(lastStep.lead)}
              r={4}
              fill={lastStep.lead >= 0 ? colors.accent : colors.teamB}
            />
          )}
          {hrPoints.length >= 2 && (
            <Polyline
              points={hrPoints.map((point) => `${String(point.x)},${String(point.y)}`).join(" ")}
              fill="none"
              stroke={colors.danger}
              strokeWidth={2}
              strokeOpacity={0.85}
            />
          )}
        </Svg>
      )}
      <XStack alignItems="center" justifyContent="center" gap={14} marginTop={6}>
        <XStack alignItems="center" gap={5}>
          <View width={8} height={8} borderRadius={4} backgroundColor={colors.accent} />
          <Body fontSize={9.5} fontWeight="700" color={textAlpha(0.5)}>
            TEAM A AHEAD
          </Body>
        </XStack>
        <XStack alignItems="center" gap={5}>
          <View width={8} height={8} borderRadius={4} backgroundColor={colors.teamB} />
          <Body fontSize={9.5} fontWeight="700" color={textAlpha(0.5)}>
            TEAM B AHEAD
          </Body>
        </XStack>
        {count > 1 && steps.some((step) => step.handOut) ? (
          <XStack alignItems="center" gap={5}>
            <View width={6} height={8} borderRadius={2} backgroundColor={colors.text} />
            <Body fontSize={9.5} fontWeight="700" color={textAlpha(0.5)}>
              SERVE CHANGE
            </Body>
          </XStack>
        ) : null}
        {hrPoints.length >= 2 && (
          <XStack alignItems="center" gap={5}>
            <View width={8} height={8} borderRadius={4} backgroundColor={colors.danger} />
            <Body fontSize={9.5} fontWeight="700" color={textAlpha(0.5)}>
              HEART RATE
            </Body>
          </XStack>
        )}
      </XStack>
    </View>
  );
}
