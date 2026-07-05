import type { CourtSide } from "@holy-padel/db";
import { getOwner, updatePlayer } from "@holy-padel/db";
import { Redirect } from "expo-router";
import type { ReactNode } from "react";
import { useState } from "react";
import { TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { XStack, YStack } from "tamagui";
import { ModalHeader } from "@/components/modal-header.tsx";
import { Body, Display, Overline } from "@/components/ui.tsx";
import { useDbMutation, useDbQuery } from "@/db/provider.tsx";
import { goBack } from "@/lib/navigation.ts";
import { colors, inkAlpha } from "@/theme/colors.ts";

const SIDES: readonly CourtSide[] = ["left", "right"];

const inputStyle = {
  fontSize: 17,
  fontFamily: "Archivo_700Bold",
  color: colors.ink,
  paddingVertical: 12,
  paddingHorizontal: 14,
} as const;

/** Edit the owner's profile — name, club, and preferred court side. */
export default function EditProfileScreen(): ReactNode {
  const insets = useSafeAreaInsets();
  const mutate = useDbMutation();
  const owner = useDbQuery((driver) => getOwner(driver));

  const [name, setName] = useState(owner?.name ?? "");
  const [club, setClub] = useState(owner?.club ?? "");
  const [side, setSide] = useState<CourtSide>(owner?.side ?? "left");

  if (owner === undefined) {
    return <Redirect href="/" />;
  }

  const save = (): void => {
    const trimmed = name.trim();
    if (trimmed === "") {
      return;
    }
    mutate((driver) => {
      updatePlayer(driver, owner.id, { name: trimmed, club: club.trim(), side });
    });
    goBack();
  };

  return (
    <YStack
      flex={1}
      backgroundColor={colors.cream}
      paddingTop={insets.top + 14}
      paddingBottom={insets.bottom + 16}
      paddingHorizontal={20}
      gap={20}
    >
      <ModalHeader title="EDIT PROFILE" onClose={goBack} label="Cancel" />

      <YStack gap={14}>
        <Field label="NAME">
          <TextInput
            style={inputStyle}
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor={inkAlpha(0.4)}
            autoCapitalize="words"
            testID="edit-name"
          />
        </Field>
        <Field label="CLUB">
          <TextInput
            style={inputStyle}
            value={club}
            onChangeText={setClub}
            placeholder="Your club (optional)"
            placeholderTextColor={inkAlpha(0.4)}
            testID="edit-club"
          />
        </Field>

        <YStack gap={7}>
          <Overline color={inkAlpha(0.45)}>PREFERRED SIDE</Overline>
          <XStack gap={10}>
            {SIDES.map((option) => {
              const selected = side === option;
              return (
                <XStack
                  key={option}
                  flex={1}
                  height={52}
                  borderRadius={16}
                  alignItems="center"
                  justifyContent="center"
                  backgroundColor={selected ? colors.ink : colors.white}
                  borderWidth={1}
                  borderColor={selected ? colors.ink : inkAlpha(0.12)}
                  pressStyle={{ opacity: 0.85 }}
                  role="button"
                  aria-label={`Play ${option} side`}
                  onPress={() => {
                    setSide(option);
                  }}
                  testID={`side-${option}`}
                >
                  <Body
                    fontSize={13}
                    fontWeight="800"
                    letterSpacing={1.4}
                    color={selected ? colors.white : inkAlpha(0.6)}
                  >
                    {option.toUpperCase()}
                  </Body>
                </XStack>
              );
            })}
          </XStack>
        </YStack>
      </YStack>

      <XStack flex={1} />

      <XStack
        height={58}
        borderRadius={18}
        backgroundColor={colors.lime}
        alignItems="center"
        justifyContent="center"
        pressStyle={{ opacity: 0.9 }}
        opacity={name.trim() === "" ? 0.5 : 1}
        role="button"
        aria-label="Save profile"
        onPress={save}
        testID="save-profile"
      >
        <Display fontSize={16} color={colors.ink} letterSpacing={1}>
          SAVE
        </Display>
      </XStack>
    </YStack>
  );
}

function Field({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <YStack gap={7}>
      <Overline color={inkAlpha(0.45)}>{label}</Overline>
      <YStack
        backgroundColor={colors.white}
        borderRadius={16}
        borderWidth={1}
        borderColor={inkAlpha(0.08)}
      >
        {children}
      </YStack>
    </YStack>
  );
}
