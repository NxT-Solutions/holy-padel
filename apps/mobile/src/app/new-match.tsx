import { createMatch, createPlayer, getOwner, listRoster } from "@holy-padel/db";
import type { DeuceMode, TeamId, ThirdSetMode } from "@holy-padel/scoring";
import { router } from "expo-router";
import type { ReactNode } from "react";
import { useState } from "react";
import { ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { View, XStack, YStack } from "tamagui";
import { ArrowRight } from "@/components/icons.tsx";
import { PickerSheet } from "@/components/picker-sheet.tsx";
import { SegmentedRow } from "@/components/segmented-row.tsx";
import { Avatar, Body, Card, Display, Pill } from "@/components/ui.tsx";
import { useDbMutation, useDbQuery } from "@/db/provider.tsx";
import { colors, inkAlpha } from "@/theme/colors.ts";

function PlayerRow({
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
        color={teamColor === "blue" ? colors.white : colors.lime}
      />
      <Body fontSize={15.5} fontWeight="700" color={empty ? inkAlpha(0.35) : colors.ink}>
        {displayName}
      </Body>
    </XStack>
  );
}

function TeamCard({
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
        backgroundColor={teamA ? colors.lime : colors.teamBlue}
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

export default function NewMatchScreen(): ReactNode {
  const insets = useSafeAreaInsets();
  const mutate = useDbMutation();
  const owner = useDbQuery(getOwner);
  const roster = useDbQuery(listRoster);
  const ownerId = owner?.id ?? "nico";

  const [partner, setPartner] = useState<string | undefined>(undefined);
  const [teamB, setTeamB] = useState<readonly string[]>([]);
  const [picking, setPicking] = useState<TeamId | undefined>(undefined);
  const [bestOf, setBestOf] = useState<1 | 3>(3);
  const [thirdSet, setThirdSet] = useState<ThirdSetMode>("superTieBreak");
  const [deuceMode, setDeuceMode] = useState<DeuceMode>("advantage");
  const [firstServe, setFirstServe] = useState<TeamId>("A");

  const nameOf = (id: string | undefined): string =>
    id === undefined ? "" : (roster.find((entry) => entry.id === id)?.name ?? owner?.name ?? "");

  const ready = partner !== undefined && teamB.length === 2;
  const partnerSelection = partner === undefined ? [] : [partner];

  const startMatch = (): void => {
    if (partner === undefined || teamB[0] === undefined || teamB[1] === undefined) {
      return;
    }
    const id = `match-${String(Date.now())}`;
    const players = {
      A: [ownerId, partner] as const,
      B: [teamB[0], teamB[1]] as const,
    };
    mutate((driver) => {
      createMatch(driver, {
        id,
        config: { bestOf, deuceMode, thirdSet, firstServe },
        players,
        location: owner?.club ?? "Club Padel Norte",
        startedAt: Date.now(),
      });
    });
    router.replace(`/live/${id}`);
  };

  const togglePick = (id: string): void => {
    if (picking === "A") {
      setPartner((current) => (current === id ? undefined : id));
    } else {
      setTeamB((current) =>
        current.includes(id)
          ? current.filter((memberId) => memberId !== id)
          : [...current, id].slice(-2),
      );
    }
  };

  return (
    <View flex={1} backgroundColor={colors.cream}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + 24,
          gap: 14,
        }}
      >
        <YStack>
          <Display fontSize={34}>NEW MATCH</Display>
          <Body fontSize={12.5} fontWeight="600" color={inkAlpha(0.45)} marginTop={2}>
            Doubles · FIP scoring
          </Body>
        </YStack>

        <TeamCard
          team="A"
          onPress={() => {
            setPicking("A");
          }}
        >
          <PlayerRow name={owner?.name ?? "Nico"} teamColor="ink" />
          <PlayerRow name={nameOf(partner)} teamColor="ink" />
        </TeamCard>

        <TeamCard
          team="B"
          onPress={() => {
            setPicking("B");
          }}
        >
          <PlayerRow name={nameOf(teamB[0])} teamColor="blue" />
          <PlayerRow name={nameOf(teamB[1])} teamColor="blue" />
        </TeamCard>

        <Card borderRadius={20} padding={16} gap={13}>
          <SegmentedRow
            label="Sets"
            options={[
              { value: 1, label: "1" },
              { value: 3, label: "3" },
            ]}
            value={bestOf}
            onChange={setBestOf}
          />
          <SegmentedRow
            label="Third set"
            options={[
              { value: "fullSet", label: "Full set" },
              { value: "superTieBreak", label: "Super TB" },
            ]}
            value={thirdSet}
            onChange={setThirdSet}
          />
          <SegmentedRow
            label="At deuce"
            options={[
              { value: "advantage", label: "Advantage" },
              { value: "goldenPoint", label: "Golden pt" },
            ]}
            value={deuceMode}
            onChange={setDeuceMode}
          />
          <SegmentedRow
            label="First serve"
            options={[
              { value: "A", label: "Team A" },
              { value: "B", label: "Team B" },
            ]}
            value={firstServe}
            onChange={setFirstServe}
          />
        </Card>

        <YStack gap={8} marginTop="auto">
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
            onPress={startMatch}
          >
            <Display fontSize={21} letterSpacing={1.5} color={colors.ink}>
              START MATCH
            </Display>
            <ArrowRight size={18} color={colors.ink} />
          </XStack>
          <Body textAlign="center" fontSize={11} fontWeight="600" color={inkAlpha(0.45)}>
            Watches join automatically when the match starts
          </Body>
        </YStack>
      </ScrollView>

      {picking === undefined ? null : (
        <PickerSheet
          team={picking}
          stepLabel={picking === "A" ? "1 OF 2" : "2 OF 2"}
          roster={roster}
          selected={picking === "A" ? partnerSelection : teamB}
          taken={picking === "A" ? teamB : partnerSelection}
          onToggle={togglePick}
          onCreate={(name) => {
            const id = `player-${String(Date.now())}`;
            mutate((driver) => {
              createPlayer(driver, { id, name, createdAt: Date.now() });
            });
          }}
          onDone={() => {
            setPicking(undefined);
          }}
        />
      )}
    </View>
  );
}
