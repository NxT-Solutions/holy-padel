import type { RosterEntry } from "@holy-padel/db";
import type { TeamId } from "@holy-padel/scoring";
import type { ReactNode } from "react";
import { useState } from "react";
import { ScrollView, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { View, XStack, YStack } from "tamagui";
import { Check, Search } from "@/components/icons.tsx";
import { NewPlayerRow } from "@/components/new-player-row.tsx";
import { Avatar, Body, Display } from "@/components/ui.tsx";
import { colors, textAlpha } from "@/theme/colors.ts";

function RosterRow({
  entry,
  picked,
  team,
  onToggle,
}: {
  readonly entry: RosterEntry;
  readonly picked: boolean;
  readonly team: TeamId;
  readonly onToggle: (id: string) => void;
}): ReactNode {
  const opponentPick = picked && team === "B";
  return (
    <XStack
      alignItems="center"
      gap={12}
      backgroundColor={colors.card}
      borderWidth={2}
      borderColor={picked ? colors.accent : "transparent"}
      borderRadius={15}
      paddingVertical={11}
      paddingHorizontal={14}
      pressStyle={{ opacity: 0.85 }}
      role="button"
      onPress={() => {
        onToggle(entry.id);
      }}
    >
      <Avatar
        letter={entry.name.charAt(0)}
        size={36}
        background={opponentPick ? colors.teamBlue : colors.ink}
        color={opponentPick ? colors.white : colors.accent}
      />
      <YStack flex={1}>
        <Body fontSize={15} fontWeight="700">
          {entry.name}
        </Body>
        <Body fontSize={10.5} fontWeight="600" color={textAlpha(0.4)}>
          {`${String(entry.matchesWithOwner)} ${entry.matchesWithOwner === 1 ? "match" : "matches"} with you`}
        </Body>
      </YStack>
      {picked ? (
        <View
          width={24}
          height={24}
          borderRadius={12}
          backgroundColor={colors.accent}
          alignItems="center"
          justifyContent="center"
        >
          <Check size={12} color={colors.text} />
        </View>
      ) : (
        <View
          width={24}
          height={24}
          borderRadius={12}
          borderWidth={1.5}
          borderColor={textAlpha(0.2)}
        />
      )}
    </XStack>
  );
}

/** The design's "pick players" bottom sheet, laid over the match setup screen. */
export function PickerSheet({
  team,
  stepLabel,
  roster,
  selected,
  taken,
  onToggle,
  onCreate,
  onDone,
}: {
  readonly team: TeamId;
  readonly stepLabel: string;
  readonly roster: readonly RosterEntry[];
  readonly selected: readonly string[];
  readonly taken: readonly string[];
  readonly onToggle: (id: string) => void;
  readonly onCreate: (name: string) => void;
  readonly onDone: () => void;
}): ReactNode {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const visible = roster.filter(
    (entry) =>
      !taken.includes(entry.id) &&
      (query === "" || entry.name.toLowerCase().includes(query.toLowerCase())),
  );

  return (
    <View position="absolute" top={0} left={0} right={0} bottom={0}>
      <View
        testID="picker-backdrop"
        role="button"
        aria-label="Close"
        flex={1}
        backgroundColor={textAlpha(0.45)}
        onPress={onDone}
      />
      <YStack
        backgroundColor={colors.sheet}
        borderTopLeftRadius={28}
        borderTopRightRadius={28}
        paddingTop={14}
        paddingHorizontal={16}
        paddingBottom={insets.bottom + 16}
        gap={12}
        maxHeight="88%"
        boxShadow="0 -12px 40px rgba(14, 17, 22, 0.25)"
      >
        <View
          alignSelf="center"
          width={40}
          height={5}
          borderRadius={999}
          backgroundColor={textAlpha(0.15)}
        />
        <XStack alignItems="center" justifyContent="space-between">
          <Display fontSize={21}>{`PICK TEAM ${team}`}</Display>
          <Body fontSize={11} fontWeight="800" letterSpacing={1.2} color={textAlpha(0.45)}>
            {stepLabel}
          </Body>
        </XStack>
        <XStack
          alignItems="center"
          gap={9}
          backgroundColor={colors.input}
          borderRadius={13}
          paddingVertical={11}
          paddingHorizontal={14}
        >
          <Search size={14} color={textAlpha(0.4)} />
          <TextInput
            style={{
              flex: 1,
              fontSize: 14,
              fontFamily: "Archivo_600SemiBold",
              color: colors.text,
              padding: 0,
            }}
            placeholder="Search players…"
            placeholderTextColor={textAlpha(0.35)}
            value={query}
            onChangeText={setQuery}
          />
        </XStack>
        <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 7 }}>
          {visible.map((entry) => (
            <RosterRow
              key={entry.id}
              entry={entry}
              picked={selected.includes(entry.id)}
              team={team}
              onToggle={onToggle}
            />
          ))}
          <NewPlayerRow
            onCreate={onCreate}
            onCreated={() => {
              setQuery("");
            }}
          />
        </ScrollView>
        <XStack
          height={56}
          backgroundColor={colors.accent}
          borderRadius={16}
          alignItems="center"
          justifyContent="center"
          pressStyle={{ opacity: 0.85 }}
          role="button"
          onPress={onDone}
        >
          <Display fontSize={18} letterSpacing={1.4} color={colors.text}>
            DONE
          </Display>
        </XStack>
      </YStack>
    </View>
  );
}
