import type { CourtSide } from "@holy-padel/db";
import type { ReactNode } from "react";
import { useState } from "react";
import { TextInput } from "react-native";
import { XStack, YStack } from "tamagui";
import { Body, Display, Overline } from "@/components/ui.tsx";
import { colors, textAlpha } from "@/theme/colors.ts";

const SIDES: readonly CourtSide[] = ["left", "right"];

const inputStyle = {
  fontSize: 17,
  fontFamily: "Archivo_700Bold",
  color: colors.text,
  paddingVertical: 12,
  paddingHorizontal: 14,
} as const;

/**
 * The name/club/side form shared by the owner's edit-profile screen and the
 * per-player edit screen. Owns its text state; reports a trimmed save.
 */
export function EditPlayerForm({
  initialName,
  initialClub = "",
  initialSide,
  onSave,
}: {
  readonly initialName: string;
  readonly initialClub?: string;
  readonly initialSide: CourtSide;
  readonly onSave: (name: string, club: string, side: CourtSide) => void;
}): ReactNode {
  const [name, setName] = useState(initialName);
  const [club, setClub] = useState(initialClub);
  const [side, setSide] = useState<CourtSide>(initialSide);

  return (
    <>
      <YStack gap={14}>
        <Field label="NAME">
          <TextInput
            style={inputStyle}
            value={name}
            onChangeText={setName}
            placeholder="Player name"
            placeholderTextColor={textAlpha(0.4)}
            autoCapitalize="words"
            testID="edit-name"
          />
        </Field>
        <Field label="CLUB">
          <TextInput
            style={inputStyle}
            value={club}
            onChangeText={setClub}
            placeholder="Club (optional)"
            placeholderTextColor={textAlpha(0.4)}
            testID="edit-club"
          />
        </Field>

        <YStack gap={7}>
          <Overline color={textAlpha(0.45)}>PREFERRED SIDE</Overline>
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
                  backgroundColor={selected ? colors.accent : colors.toggle}
                  borderWidth={1}
                  borderColor={selected ? colors.accent : textAlpha(0.12)}
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
                    color={selected ? colors.onAccent : textAlpha(0.55)}
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
        backgroundColor={colors.accent}
        alignItems="center"
        justifyContent="center"
        pressStyle={{ opacity: 0.9 }}
        opacity={name.trim() === "" ? 0.5 : 1}
        role="button"
        aria-label="Save profile"
        onPress={() => {
          if (name.trim() !== "") {
            onSave(name.trim(), club.trim(), side);
          }
        }}
        testID="save-profile"
      >
        <Display fontSize={16} color={colors.onAccent} letterSpacing={1}>
          SAVE
        </Display>
      </XStack>
    </>
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
      <Overline color={textAlpha(0.45)}>{label}</Overline>
      <YStack
        backgroundColor={colors.card}
        borderRadius={16}
        borderWidth={1}
        borderColor={textAlpha(0.08)}
      >
        {children}
      </YStack>
    </YStack>
  );
}
