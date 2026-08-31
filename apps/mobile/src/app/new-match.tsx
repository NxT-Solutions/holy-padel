import type { MatchDraft, TeamPlayers } from "@holy-padel/db";
import {
  clearMatchDraft,
  createMatch,
  getOwner,
  listMatches,
  listRoster,
  loadMatchDefaults,
  loadMatchDraft,
  resolveNewMatchDefaults,
} from "@holy-padel/db";
import type {
  DeuceMode,
  MatchConfig,
  PbTiebreak,
  SquashServeBoxes,
  SquashTiebreak,
  TeamId,
  ThirdSetMode,
} from "@holy-padel/scoring";
import { router } from "expo-router";
import type { ReactNode } from "react";
import { useMemo, useRef, useState } from "react";
import { ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { View, XStack, YStack } from "tamagui";
import { ArrowRight } from "@/components/icons.tsx";
import { ModalHeader } from "@/components/modal-header.tsx";
import {
  MatchPickerSheet,
  MatchSetupOptions,
  matchSubtitle,
  PlayerRow,
  TeamCard,
} from "@/components/new-match-parts.tsx";
import { Body, Display } from "@/components/ui.tsx";
import { useDbMutation, useDbQuery } from "@/db/provider.tsx";
import { goBack, newMatchId } from "@/lib/navigation.ts";
import { useMatchDraftPersistence } from "@/lib/use-match-draft.ts";
import { colors, textAlpha } from "@/theme/colors.ts";

export default function NewMatchScreen(): ReactNode {
  const insets = useSafeAreaInsets();
  const mutate = useDbMutation();
  const owner = useDbQuery(getOwner);
  const roster = useDbQuery(listRoster);
  const ownerId = owner === undefined ? "nico" : owner.id;

  const draft = useDbQuery(loadMatchDraft);
  const savedDefaults = useDbQuery(loadMatchDefaults);
  const lastMatch = useDbQuery(listMatches)?.[0];
  const c = lastMatch?.config;

  // Precedence: the in-progress draft, then the player's saved defaults,
  // then the last match's config, then the built-in fallbacks.
  const d = resolveNewMatchDefaults({
    ...(draft === undefined ? {} : { draft }),
    ...(savedDefaults === undefined ? {} : { saved: savedDefaults }),
    ...(c === undefined ? {} : { lastConfig: c }),
  });
  const [format, setFormat] = useState<"singles" | "doubles">(d.format);
  const [partner, setPartner] = useState<string | undefined>(undefined);
  const [teamA1, setTeamA1] = useState<string>(ownerId);
  const [teamB, setTeamB] = useState<readonly string[]>([]);
  const [picking, setPicking] = useState<TeamId | undefined>(undefined);
  const [bestOf, setBestOf] = useState<1 | 3 | 5>(d.bestOf);
  const [thirdSet, setThirdSet] = useState<ThirdSetMode>(d.thirdSet);
  const [deuceMode, setDeuceMode] = useState<DeuceMode>(d.deuceMode);
  const [firstServe, setFirstServe] = useState<TeamId | "undecided">(d.firstServe);
  const [sport, setSport] = useState<"padel" | "squash" | "pickleball">(d.sport);
  const [squashMode, setSquashMode] = useState<"par" | "hiho">(d.squashMode);
  const [squashTarget, setSquashTarget] = useState<number>(d.squashTarget);
  const [squashTiebreak, setSquashTiebreak] = useState<SquashTiebreak>(d.squashTiebreak);
  const [squashServeBoxes, setSquashServeBoxes] = useState<SquashServeBoxes>(d.squashServeBoxes);
  const [pbTarget, setPbTarget] = useState<number>(d.pbTarget);
  const [pbTiebreak, setPbTiebreak] = useState<PbTiebreak>(d.pbTiebreak);

  // The full setup (settings AND picked players) persists on every change so
  // leaving the screen and coming back restores the work in progress.
  const setupDraft = useMemo<MatchDraft>(
    () => ({
      format,
      bestOf,
      thirdSet,
      deuceMode,
      firstServe,
      sport,
      squashMode,
      squashTarget,
      squashTiebreak,
      squashServeBoxes,
      pbTarget,
      pbTiebreak,
      teamA1,
      ...(partner === undefined ? {} : { partner }),
      teamB,
    }),
    [
      format,
      bestOf,
      thirdSet,
      deuceMode,
      firstServe,
      sport,
      squashMode,
      squashTarget,
      squashTiebreak,
      squashServeBoxes,
      pbTarget,
      pbTiebreak,
      teamA1,
      partner,
      teamB,
    ],
  );
  useMatchDraftPersistence(setupDraft);

  const nameOf = (id: string | undefined): string =>
    id === undefined ? "" : (roster.find((entry) => entry.id === id)?.name ?? owner?.name ?? "");

  const ready =
    format === "singles" ? teamB.length > 0 : partner !== undefined && teamB.length === 2;
  const partnerSelection = partner === undefined ? [] : [partner];

  const started = useRef(false);
  const startMatch = (): void => {
    // Snapshot into consts: narrowing state inside the mutate closure won't
    // survive, and element access resets after intervening calls.
    const [opponent1, opponent2] = teamB;
    const partnerId = partner;
    let players: TeamPlayers;
    if (format === "singles") {
      if (opponent1 === undefined) {
        return;
      }
      players = { A: [teamA1, teamA1], B: [opponent1, opponent1] };
    } else {
      if (partnerId === undefined || opponent1 === undefined || opponent2 === undefined) {
        return;
      }
      players = { A: [ownerId, partnerId], B: [opponent1, opponent2] };
    }
    if (started.current) {
      return;
    }
    started.current = true;
    const id = newMatchId();
    /** A team's preferred box, from the saved player preference (default right). */
    const boxFor = (playerId: string): "right" | "left" =>
      roster.find((entry) => entry.id === playerId)?.side ?? "right";
    mutate((driver) => {
      const isFirstServePending = firstServe === "undecided";
      const firstServeId = isFirstServePending ? "A" : firstServe;
      const config = buildConfig({
        sport,
        bestOf,
        thirdSet,
        deuceMode,
        squashMode,
        squashTarget,
        squashTiebreak,
        squashServeBoxes,
        pbType: format,
        pbTarget,
        pbTiebreak,
        firstServe: firstServeId,
        firstServePending: isFirstServePending,
        resolveServeBox: boxFor,
        teamA1,
        opponent1,
      });
      createMatch(driver, {
        id,
        config,
        players,
        ...(owner?.club === undefined ? {} : { location: owner.club }),
        startedAt: Date.now(),
      });
      clearMatchDraft(driver);
    });
    router.replace(`/live/${id}`);
  };

  const togglePick = (id: string): void => {
    if (picking === "A") {
      if (format === "singles") {
        setTeamA1(id);
        setPicking(undefined);
      } else {
        setPartner((current) => (current === id ? undefined : id));
      }
    } else {
      setTeamB((current) =>
        current.includes(id)
          ? current.filter((memberId) => memberId !== id)
          : [...current, id].slice(format === "singles" ? -1 : -2),
      );
    }
  };

  return (
    <View flex={1} backgroundColor={colors.screen}>
      {/* Fixed top bar — the icon back button always offers a way out. */}
      <YStack paddingTop={insets.top + 12} paddingHorizontal={16} paddingBottom={6} gap={4}>
        <ModalHeader title="NEW MATCH" onClose={goBack} label="Cancel" titleSize={30} />
        <Body fontSize={12.5} fontWeight="600" color={textAlpha(0.45)} marginLeft={52}>
          {matchSubtitle(format, sport)}
        </Body>
      </YStack>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: 20,
          gap: 14,
        }}
      >
        <TeamCard
          team="A"
          onPress={() => {
            setPicking("A");
          }}
        >
          <PlayerRow
            name={format === "singles" ? nameOf(teamA1) : (owner?.name ?? "Nico")}
            teamColor="ink"
          />
          {format === "doubles" && <PlayerRow name={nameOf(partner)} teamColor="ink" />}
        </TeamCard>

        <TeamCard
          team="B"
          onPress={() => {
            setPicking("B");
          }}
        >
          <PlayerRow name={nameOf(teamB[0])} teamColor="blue" />
          {format === "doubles" && <PlayerRow name={nameOf(teamB[1])} teamColor="blue" />}
        </TeamCard>

        <MatchSetupOptions
          format={format}
          setFormat={(value) => {
            setFormat(value);
            setPicking(undefined);
          }}
          sport={sport}
          setSport={setSport}
          bestOf={bestOf}
          setBestOf={setBestOf}
          thirdSet={thirdSet}
          setThirdSet={setThirdSet}
          deuceMode={deuceMode}
          setDeuceMode={setDeuceMode}
          firstServe={firstServe}
          setFirstServe={setFirstServe}
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
      </ScrollView>

      <YStack
        gap={8}
        paddingHorizontal={16}
        paddingTop={10}
        paddingBottom={insets.bottom + 12}
        backgroundColor={colors.screen}
      >
        <XStack
          height={62}
          backgroundColor={colors.lime}
          borderRadius={18}
          alignItems="center"
          justifyContent="center"
          gap={10}
          opacity={ready ? 1 : 0.5}
          boxShadow="0 6px 18px rgba(198, 241, 53, 0.45)"
          pressStyle={{ opacity: 0.85 }}
          role="button"
          aria-label="Start match"
          onPress={startMatch}
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

      {picking === undefined ? null : (
        <MatchPickerSheet
          picking={picking}
          format={format}
          roster={roster}
          teamA1={teamA1}
          teamB={teamB}
          ownerId={ownerId}
          partnerSelection={partnerSelection}
          togglePick={togglePick}
          mutate={mutate}
          setPicking={setPicking}
        />
      )}
    </View>
  );
}

interface ConfigInput {
  readonly sport: "padel" | "squash" | "pickleball";
  readonly bestOf: 1 | 3 | 5;
  readonly thirdSet: ThirdSetMode;
  readonly deuceMode: DeuceMode;
  readonly squashMode: "par" | "hiho";
  readonly squashTarget: number;
  readonly squashTiebreak: SquashTiebreak;
  readonly squashServeBoxes: SquashServeBoxes;
  readonly pbType: "singles" | "doubles";
  readonly pbTarget: number;
  readonly pbTiebreak: PbTiebreak;
  readonly firstServe: TeamId;
  readonly firstServePending: boolean;
  /** Resolves a team lead player's saved serve-box preference. */
  readonly resolveServeBox: (playerId: string) => "right" | "left";
  readonly teamA1: string;
  readonly opponent1: string | undefined;
}

/** Build the sport-specific MatchConfig from the picker state. */
function buildConfig(input: ConfigInput): MatchConfig {
  const serveBoxes =
    input.opponent1 === undefined
      ? {}
      : {
          squashServeBoxA: input.resolveServeBox(input.teamA1),
          squashServeBoxB: input.resolveServeBox(input.opponent1),
        };
  if (input.sport === "squash") {
    return {
      sport: "squash",
      bestOf: input.bestOf,
      deuceMode: "advantage",
      thirdSet: "fullSet",
      squashMode: input.squashMode,
      squashTarget: input.squashTarget,
      squashTiebreak: input.squashTiebreak,
      squashServeBoxes: input.squashServeBoxes,
      ...serveBoxes,
      firstServe: input.firstServe,
      firstServePending: input.firstServePending,
      firstServeOriginallyUndecided: input.firstServePending,
    };
  }
  if (input.sport === "pickleball") {
    return {
      sport: "pickleball",
      bestOf: input.bestOf === 5 ? 3 : input.bestOf,
      deuceMode: "advantage",
      thirdSet: "superTieBreak",
      pbType: input.pbType,
      pbTarget: input.pbTarget,
      pbTiebreak: input.pbTiebreak,
      firstServe: input.firstServe,
      firstServePending: input.firstServePending,
      firstServeOriginallyUndecided: input.firstServePending,
    };
  }
  return {
    sport: "padel",
    bestOf: input.bestOf === 5 ? 3 : input.bestOf,
    deuceMode: input.deuceMode,
    thirdSet: input.thirdSet,
    firstServe: input.firstServe,
    firstServePending: input.firstServePending,
    firstServeOriginallyUndecided: input.firstServePending,
  };
}
