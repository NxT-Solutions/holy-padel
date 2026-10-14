import type { MatchPreset } from "@holy-padel/db";
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { Pressable, ScrollView, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { View, XStack, YStack } from "tamagui";
import { MatchSetupOptions } from "@/components/new-match-parts.tsx";
import { Body, Display } from "@/components/ui.tsx";
import type { MatchSetupState } from "@/lib/use-match-setup.ts";
import { colors, sportColor, textAlpha } from "@/theme/colors.ts";

/** The sheet chrome shared by the edit and save sheets (backdrop + rounded card). */
function SheetShell({
  onClose,
  children,
}: {
  readonly onClose: () => void;
  readonly children: ReactNode;
}): ReactNode {
  const insets = useSafeAreaInsets();
  return (
    <View position="absolute" top={0} left={0} right={0} bottom={0}>
      <View
        flex={1}
        backgroundColor={textAlpha(0.45)}
        role="button"
        aria-label="Close"
        onPress={onClose}
        testID="sheet-backdrop"
      />
      <YStack
        backgroundColor={colors.sheet}
        borderTopLeftRadius={28}
        borderTopRightRadius={28}
        paddingTop={14}
        paddingHorizontal={16}
        paddingBottom={insets.bottom + 16}
        gap={14}
        maxHeight="90%"
        boxShadow="0 -12px 40px rgba(14, 17, 22, 0.25)"
      >
        {children}
      </YStack>
    </View>
  );
}

/** The accent primary button used across the sheet footers. */
function PrimaryButton({
  label,
  ariaLabel,
  onPress,
  testID,
}: {
  readonly label: string;
  readonly ariaLabel: string;
  readonly onPress: () => void;
  readonly testID?: string;
}): ReactNode {
  return (
    <XStack
      height={58}
      backgroundColor={colors.accent}
      borderRadius={17}
      alignItems="center"
      justifyContent="center"
      pressStyle={{ opacity: 0.85 }}
      role="button"
      aria-label={ariaLabel}
      onPress={onPress}
      testID={testID}
    >
      <Display fontSize={17} letterSpacing={1.2} color={colors.onAccent}>
        {label}
      </Display>
    </XStack>
  );
}

/** A recent opponent's name chip; tapping it fills Team B. */
export function RecentOpponentChip({
  label,
  onPress,
}: {
  readonly label: string;
  readonly onPress: () => void;
}): ReactNode {
  return (
    <XStack
      alignItems="center"
      gap={6}
      backgroundColor={colors.card}
      borderWidth={1}
      borderColor={textAlpha(0.1)}
      borderRadius={999}
      paddingVertical={8}
      paddingHorizontal={13}
      pressStyle={{ opacity: 0.8 }}
      role="button"
      aria-label={`Play ${label}`}
      onPress={onPress}
    >
      <Body fontSize={12.5} fontWeight="700" color={colors.text}>
        {label}
      </Body>
    </XStack>
  );
}

/** One saved-preset chip; ink fill when it matches the setup on screen. */
function PresetChip({
  preset,
  active,
  onPress,
  onLongPress,
}: {
  readonly preset: MatchPreset;
  readonly active: boolean;
  readonly onPress: () => void;
  readonly onLongPress: () => void;
}): ReactNode {
  return (
    <Pressable
      onPress={onPress}
      // delayLongPress matches the app's other long-press affordances so the
      // Playwright `click({ delay })` and a real thumb agree.
      delayLongPress={600}
      onLongPress={onLongPress}
      role="button"
      aria-label={preset.name}
    >
      <XStack
        alignItems="center"
        gap={7}
        backgroundColor={active ? colors.text : colors.card}
        borderWidth={active ? 0 : 1}
        borderColor={textAlpha(0.1)}
        borderRadius={999}
        paddingVertical={9}
        paddingHorizontal={13}
        pressStyle={{ opacity: 0.85 }}
      >
        <View
          width={8}
          height={8}
          borderRadius={4}
          backgroundColor={sportColor(preset.setup.sport)}
        />
        <Body fontSize={12.5} fontWeight="700" color={active ? colors.screen : textAlpha(0.6)}>
          {preset.name}
        </Body>
      </XStack>
    </Pressable>
  );
}

/**
 * The horizontal preset row: one chip per saved preset, then the dashed
 * "+ Save setup" affordance. Tapping a chip fills every rule at once.
 */
export function PresetChips({
  presets,
  isActive,
  onApply,
  onDelete,
  onSave,
}: {
  readonly presets: readonly MatchPreset[];
  readonly isActive: (preset: MatchPreset) => boolean;
  readonly onApply: (preset: MatchPreset) => void;
  readonly onDelete: (preset: MatchPreset) => void;
  readonly onSave: () => void;
}): ReactNode {
  return (
    <ScrollView
      horizontal={true}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 7, paddingRight: 4 }}
      testID="preset-chips"
    >
      {presets.map((preset) => (
        <PresetChip
          key={preset.id}
          preset={preset}
          active={isActive(preset)}
          onPress={() => {
            onApply(preset);
          }}
          onLongPress={() => {
            onDelete(preset);
          }}
        />
      ))}
      <Pressable onPress={onSave} role="button" aria-label="Save setup as preset">
        <XStack
          alignItems="center"
          gap={6}
          borderRadius={999}
          borderWidth={1.5}
          borderStyle="dashed"
          borderColor={textAlpha(0.2)}
          paddingVertical={9}
          paddingHorizontal={13}
          pressStyle={{ opacity: 0.7 }}
        >
          <Body fontSize={12.5} fontWeight="800" letterSpacing={0.8} color={textAlpha(0.5)}>
            + SAVE SETUP
          </Body>
        </XStack>
      </Pressable>
    </ScrollView>
  );
}

/** The scrollable `MatchSetupOptions` body plus the sheet's two footer buttons. */
function RulesEditBody({
  state,
  teamLabels,
  onClose,
  onSaveAsPreset,
}: {
  readonly state: MatchSetupState;
  readonly teamLabels: { readonly A: string; readonly B: string } | undefined;
  readonly onClose: () => void;
  readonly onSaveAsPreset: () => void;
}): ReactNode {
  const { setup } = state;
  // `MatchSetupOptions` still clamps a squash best-of-5 down to 3 when the
  // sport changes away from squash. That guard reads the *old* sport and
  // could fight the remembered setup this sheet just restored — swallow it
  // exactly when it rides a sport switch (cleared once the commit lands).
  const switchingSport = useRef(false);
  useEffect(() => {
    switchingSport.current = false;
  });
  return (
    <>
      <ScrollView
        style={{ flexGrow: 0 }}
        contentContainerStyle={{ gap: 12, paddingBottom: 4 }}
        keyboardShouldPersistTaps="handled"
      >
        <MatchSetupOptions
          format={setup.format}
          setFormat={(format) => {
            state.update({ format });
          }}
          sport={setup.sport}
          setSport={(sport) => {
            switchingSport.current = true;
            state.setSport(sport);
          }}
          bestOf={setup.bestOf}
          setBestOf={(bestOf) => {
            if (switchingSport.current) {
              return;
            }
            state.update({ bestOf });
          }}
          thirdSet={setup.thirdSet}
          setThirdSet={(thirdSet) => {
            state.update({ thirdSet });
          }}
          deuceMode={setup.deuceMode}
          setDeuceMode={(deuceMode) => {
            state.update({ deuceMode });
          }}
          firstServe={setup.firstServe}
          setFirstServe={(firstServe) => {
            state.update({ firstServe });
          }}
          squashMode={setup.squashMode}
          setSquashMode={(squashMode) => {
            state.update({ squashMode });
          }}
          squashTarget={setup.squashTarget}
          setSquashTarget={(squashTarget) => {
            state.update({ squashTarget });
          }}
          squashTiebreak={setup.squashTiebreak}
          setSquashTiebreak={(squashTiebreak) => {
            state.update({ squashTiebreak });
          }}
          squashServeBoxes={setup.squashServeBoxes}
          setSquashServeBoxes={(squashServeBoxes) => {
            state.update({ squashServeBoxes });
          }}
          pbTarget={setup.pbTarget}
          setPbTarget={(pbTarget) => {
            state.update({ pbTarget });
          }}
          pbTiebreak={setup.pbTiebreak}
          setPbTiebreak={(pbTiebreak) => {
            state.update({ pbTiebreak });
          }}
          teamLabels={teamLabels}
        />
      </ScrollView>
      <XStack gap={10}>
        <XStack
          flex={1}
          height={52}
          backgroundColor={colors.card}
          borderWidth={1}
          borderColor={textAlpha(0.12)}
          borderRadius={17}
          alignItems="center"
          justifyContent="center"
          pressStyle={{ opacity: 0.85 }}
          role="button"
          aria-label="Save as preset"
          onPress={onSaveAsPreset}
        >
          <Body fontSize={11.5} fontWeight="800" letterSpacing={1} color={colors.text}>
            SAVE AS PRESET
          </Body>
        </XStack>
        <XStack
          flex={1}
          height={52}
          backgroundColor={colors.accent}
          borderRadius={17}
          alignItems="center"
          justifyContent="center"
          pressStyle={{ opacity: 0.85 }}
          role="button"
          aria-label="Use these rules"
          onPress={onClose}
        >
          <Display fontSize={14.5} letterSpacing={1} color={colors.onAccent}>
            USE THESE RULES
          </Display>
        </XStack>
      </XStack>
    </>
  );
}

/**
 * The rules editor sheet — the full `MatchSetupOptions` in a scrollable body,
 * with a secondary "save as preset" and the primary "use these rules".
 */
export function RulesEditSheet({
  state,
  teamLabels,
  onClose,
  onSaveAsPreset,
}: {
  readonly state: MatchSetupState;
  readonly teamLabels: { readonly A: string; readonly B: string } | undefined;
  readonly onClose: () => void;
  readonly onSaveAsPreset: () => void;
}): ReactNode {
  return (
    <SheetShell onClose={onClose}>
      <RulesEditBody
        state={state}
        teamLabels={teamLabels}
        onClose={onClose}
        onSaveAsPreset={onSaveAsPreset}
      />
    </SheetShell>
  );
}

/** The save-preset sheet: name the current setup. */
export function SavePresetSheet({
  value,
  onChange,
  onSave,
  onCancel,
}: {
  readonly value: string;
  readonly onChange: (next: string) => void;
  readonly onSave: () => void;
  readonly onCancel: () => void;
}): ReactNode {
  return (
    <SheetShell onClose={onCancel}>
      <Display fontSize={24}>SAVE PRESET</Display>
      <TextInput
        style={inputStyle()}
        value={value}
        onChangeText={onChange}
        placeholder="Preset name"
        placeholderTextColor={textAlpha(0.4)}
        autoFocus={true}
        testID="preset-name"
      />
      <PrimaryButton
        label="SAVE PRESET"
        ariaLabel="Save preset"
        onPress={onSave}
        testID="save-preset"
      />
    </SheetShell>
  );
}

/** Built per render: a module-level object would freeze the light palette. */
function inputStyle() {
  return {
    fontSize: 15,
    fontFamily: "Archivo_600SemiBold",
    color: colors.text,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: colors.input,
    borderRadius: 13,
  } as const;
}
