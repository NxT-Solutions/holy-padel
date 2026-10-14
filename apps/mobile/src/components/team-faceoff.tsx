import type { TeamId } from "@holy-padel/scoring";
import type { ReactNode } from "react";
import { XStack, YStack } from "tamagui";
import { Avatar, Body, Card, Display, Pill } from "@/components/ui.tsx";
import { colors, textAlpha } from "@/theme/colors.ts";

/** One player disc + name; an empty slot keeps the picker's "Pick a player". */
function FaceoffPlayer({
  name,
  team,
}: {
  readonly name: string;
  readonly team: TeamId;
}): ReactNode {
  const empty = name === "";
  const teamA = team === "A";
  const displayName = empty ? "Pick a player" : name;
  return (
    <YStack alignItems="center" gap={6}>
      <Avatar
        letter={empty ? "?" : name.charAt(0)}
        size={44}
        background={teamA ? colors.ink : colors.teamB}
        color={teamA ? colors.accent : colors.white}
      />
      <Body
        fontSize={14}
        fontWeight="700"
        numberOfLines={1}
        color={empty ? textAlpha(0.35) : colors.text}
      >
        {displayName}
      </Body>
    </YStack>
  );
}

/** One side of the face-off — its team pill over the stacked player discs. */
function FaceoffSide({
  team,
  names,
  onPress,
}: {
  readonly team: TeamId;
  readonly names: readonly string[];
  readonly onPress: () => void;
}): ReactNode {
  const teamA = team === "A";
  return (
    <YStack
      flex={1}
      backgroundColor={colors.row}
      borderRadius={16}
      paddingVertical={14}
      paddingHorizontal={10}
      gap={12}
      pressStyle={{ opacity: 0.92 }}
      role="button"
      onPress={onPress}
    >
      <Pill
        alignSelf="center"
        backgroundColor={teamA ? colors.accent : colors.teamB}
        paddingVertical={4}
        paddingHorizontal={10}
      >
        <Body
          fontSize={10}
          fontWeight="800"
          letterSpacing={1.5}
          color={teamA ? colors.onAccent : colors.white}
        >
          {`TEAM ${team}`}
        </Body>
      </Pill>
      <YStack gap={12}>
        {names.map((name, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: the two slots are positional by design
          <FaceoffPlayer key={index} name={name} team={team} />
        ))}
      </YStack>
    </YStack>
  );
}

/** "VS" between the two sides, vertically centred. */
function Versus(): ReactNode {
  return (
    <YStack justifyContent="center" paddingHorizontal={8}>
      <Display fontSize={16} color={textAlpha(0.35)}>
        VS
      </Display>
    </YStack>
  );
}

/**
 * The New Match face-off: the two teams side by side inside one card, each
 * side a pressable opening its player picker. Singles shows one disc per side;
 * doubles stacks two.
 */
export function TeamFaceoff({
  format,
  teamANames,
  teamBNames,
  onPickTeamA,
  onPickTeamB,
}: {
  readonly format: "singles" | "doubles";
  readonly teamANames: readonly string[];
  readonly teamBNames: readonly string[];
  readonly onPickTeamA: () => void;
  readonly onPickTeamB: () => void;
}): ReactNode {
  const one = (names: readonly string[]): readonly string[] =>
    format === "singles" ? [names[0] ?? ""] : names;
  return (
    <Card borderRadius={20} padding={14}>
      <XStack alignItems="stretch" gap={4}>
        <FaceoffSide team="A" names={one(teamANames)} onPress={onPickTeamA} />
        <Versus />
        <FaceoffSide team="B" names={one(teamBNames)} onPress={onPickTeamB} />
      </XStack>
    </Card>
  );
}
