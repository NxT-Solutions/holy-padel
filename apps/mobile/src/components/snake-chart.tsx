import type { HeartRateSample } from "@holy-padel/db";
import type { ReactNode } from "react";
import { useId, useState } from "react";
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Rect,
  Stop,
  // Imported as `Text` (not aliased) so the raw-text lint recognises label children.
  Text,
} from "react-native-svg";
import { View, XStack } from "tamagui";
import { Body } from "@/components/ui.tsx";
import { heartRateRuns } from "@/lib/game-activity.ts";
import type { GameSeriesStep } from "@/lib/game-series.ts";
import { colors, textAlpha } from "@/theme/colors.ts";

const CHART_HEIGHT = 176;
const PAD_X = 12;
const PAD_TOP = 16;
/** Room under the plot for the time axis. */
const PAD_BOTTOM = 22;
const PLOT_BOTTOM = CHART_HEIGHT - PAD_BOTTOM;
const ZERO_Y = (PAD_TOP + PLOT_BOTTOM) / 2;
const HALF = (PLOT_BOTTOM - PAD_TOP) / 2;
const LINE_WIDTH = 2.75;

interface Point {
  readonly x: number;
  readonly y: number;
}

interface Run {
  readonly key: string;
  readonly x1: number;
  readonly x2: number;
  readonly lead: number;
}

interface Riser {
  readonly key: string;
  readonly x: number;
  readonly from: number;
  readonly to: number;
}

interface Geometry {
  readonly xOf: (t: number) => number;
  readonly yOf: (lead: number) => number;
  readonly maxLead: number;
}

const leadColor = (lead: number): string => (lead >= 0 ? colors.accent : colors.teamB);

/** "3:07" — minutes and seconds into the game. */
function clockLabel(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${String(Math.floor(total / 60))}:${String(total % 60).padStart(2, "0")}`;
}

/** Horizontal runs (the lead held between rallies) and the risers between them. */
function runsOf(
  steps: readonly GameSeriesStep[],
  xOf: (t: number) => number,
  endX: number,
): { readonly runs: Run[]; readonly risers: Riser[] } {
  const runs: Run[] = [];
  const risers: Riser[] = [];
  steps.forEach((step, index) => {
    const next = steps[index + 1];
    const x1 = xOf(step.t);
    runs.push({
      key: `r${String(index)}`,
      x1,
      x2: next === undefined ? endX : xOf(next.t),
      lead: step.lead,
    });
    if (next !== undefined && next.lead !== step.lead) {
      risers.push({ key: `v${String(index)}`, x: xOf(next.t), from: step.lead, to: next.lead });
    }
  });
  return { runs, risers };
}

/**
 * A smooth curve through the points (Catmull-Rom as cubic Béziers), so the
 * heart rate reads as a pulse rather than a jagged polyline.
 */
function smoothPath(points: readonly Point[]): string {
  const [start] = points;
  if (start === undefined) {
    return "";
  }
  let d = `M${start.x.toFixed(1)},${start.y.toFixed(1)}`;
  for (let index = 0; index + 1 < points.length; index += 1) {
    const p1 = points[index];
    const p2 = points[index + 1];
    if (p1 !== undefined && p2 !== undefined) {
      const p0 = points[index - 1] ?? p1;
      const p3 = points[index + 2] ?? p2;
      const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
      const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
      d += ` C${c1.x.toFixed(1)},${c1.y.toFixed(1)} ${c2.x.toFixed(1)},${c2.y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
    }
  }
  return d;
}

/** Dashed guides at the deepest lead each way, labelled with the margin. */
function LeadGuides({
  geometry,
  width,
}: {
  readonly geometry: Geometry;
  readonly width: number;
}): ReactNode {
  const { yOf, maxLead } = geometry;
  return (
    <>
      {[maxLead, -maxLead].map((lead) => (
        <Line
          key={`g${String(lead)}`}
          x1={PAD_X}
          y1={yOf(lead)}
          x2={width - PAD_X}
          y2={yOf(lead)}
          stroke={textAlpha(0.1)}
          strokeWidth={1}
          strokeDasharray="3 5"
        />
      ))}
      <Text x={PAD_X} y={yOf(maxLead) - 4} fontSize={9} fontWeight="700" fill={colors.accentOnCard}>
        {`A +${String(maxLead)}`}
      </Text>
      <Text x={PAD_X} y={yOf(-maxLead) - 4} fontSize={9} fontWeight="700" fill={textAlpha(0.45)}>
        {`B +${String(maxLead)}`}
      </Text>
    </>
  );
}

/** The heart-rate curve with a soft fill, on its own bpm scale. */
function HeartRateLayer({
  samples,
  from,
  to,
  xOf,
}: {
  readonly samples: readonly HeartRateSample[];
  readonly from: number;
  readonly to: number;
  readonly xOf: (t: number) => number;
}): ReactNode {
  const gradientId = `hr-${useId().replaceAll(/[^a-zA-Z0-9]/gu, "")}`;
  const runs = heartRateRuns(samples, { from, to });
  if (runs.length === 0) {
    return null;
  }
  const bpms = runs.flat().map((sample) => sample.bpm);
  const low = Math.min(...bpms);
  const high = Math.max(...bpms);
  const min = low - 6;
  const max = high + 6;
  const yOf = (bpm: number): number =>
    PAD_TOP + (1 - (bpm - min) / Math.max(1, max - min)) * (PLOT_BOTTOM - PAD_TOP);
  return (
    <>
      <Defs>
        <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.danger} stopOpacity={0.16} />
          <Stop offset="1" stopColor={colors.danger} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      {runs.map((run) => {
        const points = run.map((sample) => ({ x: xOf(sample.t), y: yOf(sample.bpm) }));
        const curve = smoothPath(points);
        const [first] = points;
        const last = points.at(-1);
        const key = `hr${String(run[0]?.t ?? 0)}`;
        return first === undefined || last === undefined ? null : (
          <G key={key}>
            <Path
              d={`${curve} L${last.x.toFixed(1)},${PLOT_BOTTOM} L${first.x.toFixed(1)},${PLOT_BOTTOM} Z`}
              fill={`url(#${gradientId})`}
            />
            <Path
              d={curve}
              fill="none"
              stroke={colors.danger}
              strokeWidth={1.75}
              strokeOpacity={0.85}
              strokeLinecap="round"
            />
          </G>
        );
      })}
    </>
  );
}

/** The lead itself: shaded area to the zero line, step line, serve ticks, end dot. */
function LeadLayer({
  steps,
  geometry,
  endX,
}: {
  readonly steps: readonly GameSeriesStep[];
  readonly geometry: Geometry;
  readonly endX: number;
}): ReactNode {
  const { xOf, yOf } = geometry;
  const { runs, risers } = runsOf(steps, xOf, endX);
  const last = steps.at(-1);
  const lastX = last === undefined ? undefined : xOf(last.t);
  return (
    <>
      {runs.map((run) =>
        run.lead === 0 ? null : (
          <Rect
            key={`${run.key}f`}
            x={run.x1}
            y={Math.min(yOf(run.lead), ZERO_Y)}
            width={Math.max(0, run.x2 - run.x1)}
            height={Math.abs(yOf(run.lead) - ZERO_Y)}
            fill={leadColor(run.lead)}
            fillOpacity={0.14}
          />
        ),
      )}
      <Line x1={PAD_X} y1={ZERO_Y} x2={endX} y2={ZERO_Y} stroke={textAlpha(0.18)} strokeWidth={1} />
      {runs.map((run) => (
        <Line
          key={run.key}
          x1={run.x1}
          y1={yOf(run.lead)}
          x2={run.x2}
          y2={yOf(run.lead)}
          stroke={run.lead === 0 ? textAlpha(0.35) : leadColor(run.lead)}
          strokeWidth={LINE_WIDTH}
          strokeLinecap="round"
        />
      ))}
      {risers.map((riser) => (
        <Line
          key={riser.key}
          x1={riser.x}
          y1={yOf(riser.from)}
          x2={riser.x}
          y2={yOf(riser.to)}
          stroke={leadColor(riser.from === 0 ? riser.to : riser.from)}
          strokeWidth={LINE_WIDTH}
          strokeLinecap="round"
        />
      ))}
      {steps.map((step, index) =>
        step.handOut && index > 0 ? (
          <Line
            key={`h${String(index)}`}
            x1={xOf(step.t)}
            y1={ZERO_Y - 4}
            x2={xOf(step.t)}
            y2={ZERO_Y + 4}
            stroke={colors.text}
            strokeOpacity={0.55}
            strokeWidth={1.5}
            strokeLinecap="round"
          />
        ) : null,
      )}
      {last === undefined || lastX === undefined ? null : (
        <>
          <Circle
            cx={lastX}
            cy={yOf(last.lead)}
            r={9}
            fill={leadColor(last.lead)}
            fillOpacity={0.2}
          />
          <Circle cx={lastX} cy={yOf(last.lead)} r={4.5} fill={leadColor(last.lead)} />
        </>
      )}
    </>
  );
}

function LegendDot({
  color,
  label,
  square,
}: {
  readonly color: string;
  readonly label: string;
  readonly square?: boolean;
}): ReactNode {
  return (
    <XStack alignItems="center" gap={5}>
      <View
        width={square === true ? 3 : 8}
        height={8}
        borderRadius={square === true ? 1 : 4}
        backgroundColor={color}
      />
      <Body fontSize={9.5} fontWeight="700" color={textAlpha(0.5)}>
        {label}
      </Body>
    </XStack>
  );
}

/**
 * The score-race "snake": who led, by how much, rally by rally through one
 * game, over the game's real time — with the watch-tracked heart rate as a
 * smooth curve on its own scale behind it.
 */
export function SnakeChart({
  steps,
  startedAt,
  endedAt,
  heartRate,
  width: fixedWidth,
}: {
  readonly steps: readonly GameSeriesStep[];
  /** Start of the plotted window (the end of the previous game). */
  readonly startedAt: number;
  readonly endedAt: number;
  readonly heartRate?: readonly HeartRateSample[];
  readonly width?: number;
}): ReactNode {
  const [measured, setMeasured] = useState(0);
  const width = fixedWidth ?? measured;
  const span = Math.max(1, endedAt - startedAt);
  const plotWidth = Math.max(0, width - PAD_X * 2);
  const maxLead = Math.max(3, ...steps.map((step) => Math.abs(step.lead)));
  const geometry: Geometry = {
    xOf: (t) => PAD_X + Math.min(1, Math.max(0, (t - startedAt) / span)) * plotWidth,
    yOf: (lead) => ZERO_Y - (lead / maxLead) * HALF,
    maxLead,
  };
  const endX = width - PAD_X;
  const hrBpms = heartRateRuns(heartRate ?? [], { from: startedAt, to: endedAt })
    .flat()
    .map((sample) => sample.bpm);
  const hrLabel =
    hrBpms.length === 0
      ? undefined
      : `HEART RATE ${String(Math.round(Math.min(...hrBpms)))}–${String(Math.round(Math.max(...hrBpms)))}`;

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
          <LeadGuides geometry={geometry} width={width} />
          {heartRate === undefined ? null : (
            <HeartRateLayer samples={heartRate} from={startedAt} to={endedAt} xOf={geometry.xOf} />
          )}
          <LeadLayer steps={steps} geometry={geometry} endX={endX} />
          <Text x={PAD_X} y={CHART_HEIGHT - 6} fontSize={9} fontWeight="700" fill={textAlpha(0.35)}>
            0:00
          </Text>
          <Text
            x={endX}
            y={CHART_HEIGHT - 6}
            fontSize={9}
            fontWeight="700"
            fill={textAlpha(0.35)}
            textAnchor="end"
          >
            {clockLabel(endedAt - startedAt)}
          </Text>
        </Svg>
      )}
      <XStack alignItems="center" justifyContent="center" flexWrap="wrap" gap={14} marginTop={4}>
        <LegendDot color={colors.accent} label="TEAM A AHEAD" />
        <LegendDot color={colors.teamB} label="TEAM B AHEAD" />
        {steps.some((step, index) => step.handOut && index > 0) ? (
          <LegendDot color={colors.text} label="SERVE CHANGE" square={true} />
        ) : null}
        {hrLabel === undefined ? null : <LegendDot color={colors.danger} label={hrLabel} />}
      </XStack>
    </View>
  );
}
