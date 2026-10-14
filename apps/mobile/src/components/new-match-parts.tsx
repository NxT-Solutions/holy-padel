import type { RosterEntry, SqlDriver } from "@holy-padel/db";
import { createPlayer } from "@holy-padel/db";
import type {
  DeuceMode,
  PbTiebreak,
  SquashServeBoxes,
  SquashTiebreak,
  TeamId,
  ThirdSetMode,
} from "@holy-padel/scoring";
import type { ReactNode } from "react";
import { TextInput } from "react-native";
import { XStack, YStack } from "tamagui";
import { ArrowRight } from "@/components/icons.tsx";
import { PickerSheet } from "@/components/picker-sheet.tsx";
import { SegmentedRow } from "@/components/segmented-row.tsx";
import { Avatar, Body, Card, Display, Overline, Pill } from "@/components/ui.tsx";
import { colors, textAlpha } from "@/theme/colors.ts";

export function PlayerRow({
  name,
  teamColor,
}: {
  readonly name: string;
  readonly teamColor: "ink" | "blue";
}): ReactNode {
  const empty = name === "";
  const displayName = empty ? "Pick a player" : name;
  return (
    <XStack
      alignItems="center"
      gap={11}
      backgroundColor={colors.row}
      borderRadius={13}
      paddingVertical={10}
      paddingHorizontal={13}
    >
      <Avatar
        letter={empty ? "?" : name.charAt(0)}
        size={34}
        background={teamColor === "blue" ? colors.teamBlue : colors.ink}
        color={teamColor === "blue" ? colors.white : colors.accent}
      />
      <Body fontSize={15.5} fontWeight="700" color={empty ? textAlpha(0.35) : colors.text}>
        {displayName}
      </Body>
    </XStack>
  );
}

export function TeamCard({
  team,
  children,
  onPress,
}: {
  readonly team: TeamId;
  readonly children: ReactNode;
  readonly onPress: () => void;
}): ReactNode {
  const teamA = team === "A";
  return (
    <Card
      borderRadius={20}
      padding={16}
      gap={10}
      pressStyle={{ opacity: 0.92 }}
      role="button"
      onPress={onPress}
    >
      <Pill
        alignSelf="flex-start"
        backgroundColor={teamA ? colors.accent : colors.teamBlue}
        paddingVertical={4}
        paddingHorizontal={10}
      >
        <Body
          fontSize={10}
          fontWeight="800"
          letterSpacing={1.5}
          color={teamA ? colors.ink : colors.white}
        >
          {`TEAM ${team}`}
        </Body>
      </Pill>
      {children}
    </Card>
  );
}

/** "Singles · FIP scoring" style subtitle under the header. */
export function matchSubtitle(
  format: "singles" | "doubles",
  sport: "padel" | "squash" | "pickleball",
): string {
  const shape = format === "singles" ? "Singles" : "Doubles";
  if (sport === "squash") {
    return `${shape} · Squash scoring`;
  }
  if (sport === "pickleball") {
    return `${shape} · Pickleball scoring`;
  }
  return `${shape} · FIP scoring`;
}

/** The per-sport format options shown below the sport picker. */
export function SportOptions({
  sport,
  bestOf,
  setBestOf,
  thirdSet,
  setThirdSet,
  deuceMode,
  setDeuceMode,
  squashMode,
  setSquashMode,
  squashTarget,
  setSquashTarget,
  squashTiebreak,
  setSquashTiebreak,
  squashServeBoxes,
  setSquashServeBoxes,
  pbTarget,
  setPbTarget,
  pbTiebreak,
  setPbTiebreak,
}: {
  readonly sport: "padel" | "squash" | "pickleball";
  readonly bestOf: 1 | 3 | 5;
  readonly setBestOf: (value: 1 | 3 | 5) => void;
  readonly thirdSet: ThirdSetMode;
  readonly setThirdSet: (value: ThirdSetMode) => void;
  readonly deuceMode: DeuceMode;
  readonly setDeuceMode: (value: DeuceMode) => void;
  readonly squashMode: "par" | "hiho";
  readonly setSquashMode: (value: "par" | "hiho") => void;
  readonly squashTarget: number;
  readonly setSquashTarget: (value: number) => void;
  readonly squashTiebreak: SquashTiebreak;
  readonly setSquashTiebreak: (value: SquashTiebreak) => void;
  readonly squashServeBoxes: SquashServeBoxes;
  readonly setSquashServeBoxes: (value: SquashServeBoxes) => void;
  readonly pbTarget: number;
  readonly setPbTarget: (value: number) => void;
  readonly pbTiebreak: PbTiebreak;
  readonly setPbTiebreak: (value: PbTiebreak) => void;
}): ReactNode {
  const changeSquashMode = (value: "par" | "hiho"): void => {
    setSquashMode(value);
    if (value === "par" && squashTiebreak === "choice") {
      setSquashTiebreak("winByTwo");
    }
  };
  if (sport === "squash") {
    return (
      <>
        <SegmentedRow
          label="Mode"
          options={[
            { value: "par", label: "PAR" },
            { value: "hiho", label: "HIHO" },
          ]}
          value={squashMode}
          onChange={changeSquashMode}
        />
        <SegmentedRow
          label="Target"
          options={[
            { value: 9, label: "9" },
            { value: 11, label: "11" },
            { value: 15, label: "15" },
          ]}
          value={squashTarget}
          onChange={setSquashTarget}
        />
        <SegmentedRow
          label="Tiebreak"
          options={
            squashMode === "hiho"
              ? [
                  { value: "winByTwo" as const, label: "Win by 2" },
                  { value: "choice" as const, label: `Ask at ${String(squashTarget - 1)}` },
                ]
              : [{ value: "winByTwo" as const, label: "Win by 2" }]
          }
          value={squashTiebreak === "choice" ? "choice" : "winByTwo"}
          onChange={setSquashTiebreak}
        />
        <SegmentedRow
          label="First serve box"
          options={[
            { value: "right", label: "Right" },
            { value: "left", label: "Left" },
            { value: "player", label: "Auto" },
          ]}
          value={squashServeBoxes}
          onChange={setSquashServeBoxes}
        />
        <Body fontSize={11.5} fontWeight="600" color={textAlpha(0.45)}>
          {squashServeBoxes === "player"
            ? "Each hand starts from the serving team's saved preferred side (Profile — default right), then boxes alternate every point."
            : `Each hand starts from the ${squashServeBoxes} box, then boxes alternate every point.`}
        </Body>
        <SegmentedRow
          label="Games"
          options={[
            { value: 1, label: "1" },
            { value: 3, label: "3" },
            { value: 5, label: "5" },
          ]}
          value={bestOf}
          onChange={setBestOf}
        />
      </>
    );
  }
  if (sport === "pickleball") {
    return (
      <>
        <SegmentedRow
          label="Target"
          options={[
            { value: 11, label: "11" },
            { value: 15, label: "15" },
            { value: 21, label: "21" },
          ]}
          value={pbTarget}
          onChange={setPbTarget}
        />
        <SegmentedRow
          label="Tiebreak"
          options={[
            { value: "winByTwo", label: "Win by 2" },
            { value: "winByOne", label: "Win by 1" },
          ]}
          value={pbTiebreak}
          onChange={setPbTiebreak}
        />
        <SegmentedRow
          label="Games"
          options={[
            { value: 1, label: "1" },
            { value: 3, label: "3" },
          ]}
          value={bestOf === 5 ? 3 : bestOf}
          onChange={setBestOf}
        />
      </>
    );
  }
  return (
    <>
      <SegmentedRow
        label="Sets"
        options={[
          { value: 1, label: "1" },
          { value: 3, label: "3" },
        ]}
        value={bestOf === 5 ? 3 : bestOf}
        onChange={setBestOf}
      />
      {bestOf === 3 && (
        <SegmentedRow
          label="Last set"
          options={[
            { value: "fullSet", label: "Full set" },
            { value: "superTieBreak", label: "Super TB" },
          ]}
          value={thirdSet}
          onChange={setThirdSet}
        />
      )}
      <SegmentedRow
        label="At deuce"
        options={[
          { value: "advantage", label: "Advantage" },
          { value: "goldenPoint", label: "Golden pt" },
        ]}
        value={deuceMode}
        onChange={setDeuceMode}
      />
    </>
  );
}

export function MatchPickerSheet({
  picking,
  format,
  roster,
  teamA1,
  teamB,
  ownerId,
  partnerSelection,
  togglePick,
  mutate,
  setPicking,
}: {
  picking: TeamId;
  format: "singles" | "doubles";
  roster: readonly RosterEntry[];
  teamA1: string;
  teamB: readonly string[];
  ownerId: string;
  partnerSelection: readonly string[];
  togglePick: (id: string) => void;
  mutate: (fn: (driver: SqlDriver) => void) => void;
  setPicking: (team: TeamId | undefined) => void;
}) {
  const isSingles = format === "singles";
  const isTeamA = picking === "A";

  let stepLabel = "";
  if (isSingles) {
    stepLabel = isTeamA ? "PLAYER A" : "PLAYER B";
  } else {
    stepLabel = isTeamA ? "1 OF 2" : "2 OF 2";
  }

  let selected: readonly string[] = [];
  if (isTeamA) {
    selected = isSingles ? [teamA1] : partnerSelection;
  } else {
    selected = isSingles ? teamB.slice(0, 1) : teamB;
  }

  let taken: readonly string[] = [];
  if (isTeamA) {
    taken = isSingles ? teamB.slice(0, 1) : [ownerId, ...teamB];
  } else {
    taken = isSingles ? [teamA1] : [ownerId, ...partnerSelection];
  }

  return (
    <PickerSheet
      team={picking}
      stepLabel={stepLabel}
      roster={roster}
      selected={selected}
      taken={taken}
      onToggle={togglePick}
      onCreate={(name) => {
        const id = `player-${String(Date.now())}`;
        mutate((driver: SqlDriver) => {
          createPlayer(driver, { id, name, createdAt: Date.now() });
        });
      }}
      onDone={() => setPicking(undefined)}
    />
  );
}

/** The optional pre-match note input, shown on the setup screen. */
export function MatchNoteInput({
  value,
  onChange,
}: {
  readonly value: string;
  readonly onChange: (next: string) => void;
}): ReactNode {
  return (
    <Card borderRadius={20} padding={16} gap={10}>
      <Overline color={textAlpha(0.45)}>NOTE · OPTIONAL</Overline>
      <TextInput
        style={noteInputStyle}
        value={value}
        onChangeText={onChange}
        placeholder="e.g. league night, new racket…"
        placeholderTextColor={textAlpha(0.4)}
        multiline={true}
        testID="match-note"
      />
    </Card>
  );
}

const noteInputStyle = {
  fontSize: 14,
  fontFamily: "Archivo_600SemiBold",
  color: colors.text,
  paddingVertical: 10,
  paddingHorizontal: 13,
  backgroundColor: colors.row,
  borderRadius: 13,
  minHeight: 44,
  textAlignVertical: "top",
} as const;

/** The accent START MATCH action plus the watch hint beneath it. */
export function StartMatchButton({
  ready,
  onStart,
  bottomInset,
}: {
  readonly ready: boolean;
  readonly onStart: () => void;
  readonly bottomInset: number;
}): ReactNode {
  return (
    <YStack
      gap={8}
      paddingHorizontal={16}
      paddingTop={10}
      paddingBottom={bottomInset + 12}
      backgroundColor={colors.screen}
    >
      <XStack
        height={62}
        backgroundColor={colors.accent}
        borderRadius={18}
        alignItems="center"
        justifyContent="center"
        gap={10}
        opacity={ready ? 1 : 0.5}
        boxShadow="0 6px 18px rgba(255, 107, 53, 0.45)"
        pressStyle={{ opacity: 0.85 }}
        role="button"
        aria-label="Start match"
        onPress={onStart}
      >
        <Display fontSize={21} letterSpacing={1.5} color={colors.text}>
          START MATCH
        </Display>
        <ArrowRight size={18} color={colors.text} />
      </XStack>
      <Body textAlign="center" fontSize={11} fontWeight="600" color={textAlpha(0.45)}>
        Watches join automatically when the match starts
      </Body>
    </YStack>
  );
}

/** The format/sport/scoring options card shared by match setup and defaults. */
export function MatchSetupOptions({
  format,
  setFormat,
  sport,
  setSport,
  bestOf,
  setBestOf,
  thirdSet,
  setThirdSet,
  deuceMode,
  setDeuceMode,
  firstServe,
  setFirstServe,
  squashMode,
  setSquashMode,
  squashTarget,
  setSquashTarget,
  squashTiebreak,
  setSquashTiebreak,
  squashServeBoxes,
  setSquashServeBoxes,
  pbTarget,
  setPbTarget,
  pbTiebreak,
  setPbTiebreak,
  teamLabels,
}: {
  readonly format: "singles" | "doubles";
  readonly setFormat: (value: "singles" | "doubles") => void;
  readonly sport: "padel" | "squash" | "pickleball";
  readonly setSport: (value: "padel" | "squash" | "pickleball") => void;
  readonly bestOf: 1 | 3 | 5;
  readonly setBestOf: (value: 1 | 3 | 5) => void;
  readonly thirdSet: ThirdSetMode;
  readonly setThirdSet: (value: ThirdSetMode) => void;
  readonly deuceMode: DeuceMode;
  readonly setDeuceMode: (value: DeuceMode) => void;
  readonly firstServe: TeamId | "undecided";
  readonly setFirstServe: (value: TeamId | "undecided") => void;
  readonly squashMode: "par" | "hiho";
  readonly setSquashMode: (value: "par" | "hiho") => void;
  readonly squashTarget: number;
  readonly setSquashTarget: (value: number) => void;
  readonly squashTiebreak: SquashTiebreak;
  readonly setSquashTiebreak: (value: SquashTiebreak) => void;
  readonly squashServeBoxes: SquashServeBoxes;
  readonly setSquashServeBoxes: (value: SquashServeBoxes) => void;
  readonly pbTarget: number;
  readonly setPbTarget: (value: number) => void;
  readonly pbTiebreak: PbTiebreak;
  readonly setPbTiebreak: (value: PbTiebreak) => void;
  readonly teamLabels?: { readonly A: string; readonly B: string } | undefined;
}): ReactNode {
  const teamLabel = (team: TeamId): string => teamLabels?.[team] ?? `Team ${team}`;
  return (
    <Card borderRadius={20} padding={16} gap={13}>
      <SegmentedRow
        label="Format"
        options={[
          { value: "singles", label: "Singles" },
          { value: "doubles", label: "Doubles" },
        ]}
        value={format}
        onChange={setFormat}
      />
      <SegmentedRow
        label="Sport"
        options={[
          { value: "padel", label: "Padel" },
          { value: "squash", label: "Squash" },
          { value: "pickleball", label: "Pickleball" },
        ]}
        value={sport}
        onChange={(val) => {
          setSport(val);
          // Padel and pickleball don't offer best-of-5 — drop a stale
          // squash 5 rather than silently coercing at start time.
          if (val !== "squash" && bestOf === 5) {
            setBestOf(3);
          }
        }}
      />

      <SportOptions
        sport={sport}
        bestOf={bestOf}
        setBestOf={setBestOf}
        thirdSet={thirdSet}
        setThirdSet={setThirdSet}
        deuceMode={deuceMode}
        setDeuceMode={setDeuceMode}
        squashMode={squashMode}
        setSquashMode={setSquashMode}
        squashTarget={squashTarget}
        setSquashTarget={setSquashTarget}
        squashTiebreak={squashTiebreak}
        setSquashTiebreak={setSquashTiebreak}
        squashServeBoxes={squashServeBoxes}
        setSquashServeBoxes={setSquashServeBoxes}
        pbTarget={pbTarget}
        setPbTarget={setPbTarget}
        pbTiebreak={pbTiebreak}
        setPbTiebreak={setPbTiebreak}
      />

      <SegmentedRow
        label="First serve"
        options={[
          { value: "undecided", label: "Undecided" },
          { value: "A", label: teamLabel("A") },
          { value: "B", label: teamLabel("B") },
        ]}
        value={firstServe}
        onChange={setFirstServe}
      />
    </Card>
  );
}
