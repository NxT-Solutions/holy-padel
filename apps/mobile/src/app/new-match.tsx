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
import { View, YStack } from "tamagui";
import { ModalHeader } from "@/components/modal-header.tsx";
import {
  MatchNoteInput,
  MatchPickerSheet,
  MatchSetupOptions,
  matchSubtitle,
  PlayerRow,
  StartMatchButton,
  TeamCard,
} from "@/components/new-match-parts.tsx";
import { Body } from "@/components/ui.tsx";
import { useDbMutation, useDbQuery } from "@/db/provider.tsx";
import { buildConfig } from "@/lib/match-config-builder.ts";
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
  const [partner, setPartner] = useState<string | undefined>(draft?.partner);
  const [teamA1, setTeamA1] = useState<string>(draft?.teamA1 ?? ownerId);
  const [teamB, setTeamB] = useState<readonly string[]>(draft?.teamB ?? []);
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
  // The note only comes from a resumable draft — saved defaults don't carry it.
  const [note, setNote] = useState<string>(draft?.note ?? "");

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
      ...(note.trim() === "" ? {} : { note: note.trim() }),
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
      note,
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
      // One player per team — the second slot stays empty.
      players = { A: [teamA1, undefined], B: [opponent1, undefined] };
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
        ...(note.trim() === "" ? {} : { note: note.trim() }),
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

        <MatchNoteInput value={note} onChange={setNote} />
      </ScrollView>

      <StartMatchButton ready={ready} onStart={startMatch} bottomInset={insets.bottom} />

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
