import type { CourtSide, PlayerDeleteMode } from "@holy-padel/db";
import { countPlayerMatches, deletePlayer, getPlayer, updatePlayer } from "@holy-padel/db";
import { Redirect, useLocalSearchParams } from "expo-router";
import type { ReactNode } from "react";
import { useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { View, XStack, YStack } from "tamagui";
import { EditPlayerForm } from "@/components/edit-player-form.tsx";
import { ModalHeader } from "@/components/modal-header.tsx";
import { Body, Display } from "@/components/ui.tsx";
import { useDbMutation, useDbQuery } from "@/db/provider.tsx";
import { goBack } from "@/lib/navigation.ts";
import { colors, textAlpha, whiteAlpha } from "@/theme/colors.ts";

/**
 * Edit another player's profile — or delete them, choosing whether their
 * matches go too ("delete profile, keep matches" re-points their match slots
 * at a hidden "Former player" placeholder so the history survives).
 */
export default function EditPlayerScreen(): ReactNode {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const mutate = useDbMutation();
  const player = useDbQuery((driver) => getPlayer(driver, id));
  const matchCount = useDbQuery((driver) => countPlayerMatches(driver, id));
  const [confirming, setConfirming] = useState(false);

  if (player === undefined) {
    return <Redirect href="/" />;
  }
  if (player.isOwner) {
    // The owner edits — and cannot be deleted — via /edit-profile.
    return <Redirect href="/edit-profile" />;
  }

  const save = (name: string, club: string, side: CourtSide): void => {
    mutate((driver) => {
      updatePlayer(driver, id, { name, club, side });
    });
    goBack();
  };

  const remove = (mode: PlayerDeleteMode): void => {
    mutate((driver) => {
      deletePlayer(driver, id, mode);
    });
    goBack();
  };

  const matchWord = matchCount === 1 ? "match" : "matches";

  return (
    <YStack
      flex={1}
      backgroundColor={colors.screen}
      paddingTop={insets.top + 14}
      paddingBottom={insets.bottom + 16}
      paddingHorizontal={20}
      gap={20}
    >
      <ModalHeader title="EDIT PLAYER" onClose={goBack} label="Cancel" />

      <EditPlayerForm
        initialName={player.name}
        initialClub={player.club ?? ""}
        initialSide={player.side ?? "left"}
        onSave={save}
      />

      <XStack
        height={54}
        borderRadius={18}
        backgroundColor={colors.card}
        borderWidth={1}
        borderColor={textAlpha(0.08)}
        alignItems="center"
        justifyContent="center"
        pressStyle={{ opacity: 0.85 }}
        role="button"
        aria-label="Delete player"
        onPress={() => {
          setConfirming(true);
        }}
        testID="delete-player"
      >
        <Body fontSize={13} fontWeight="800" letterSpacing={1.2} color={colors.danger}>
          DELETE PLAYER
        </Body>
      </XStack>

      {confirming ? (
        <View position="absolute" top={0} left={0} right={0} bottom={0}>
          <View
            flex={1}
            backgroundColor={textAlpha(0.45)}
            role="button"
            aria-label="Cancel delete"
            onPress={() => {
              setConfirming(false);
            }}
          />
          <YStack
            backgroundColor={colors.sheet}
            borderTopLeftRadius={28}
            borderTopRightRadius={28}
            paddingTop={14}
            paddingHorizontal={16}
            paddingBottom={insets.bottom + 16}
            gap={10}
            boxShadow="0 -12px 40px rgba(14, 17, 22, 0.25)"
          >
            <View
              alignSelf="center"
              width={40}
              height={5}
              borderRadius={999}
              backgroundColor={textAlpha(0.15)}
            />
            <Display fontSize={20}>{`DELETE ${player.name.toUpperCase()}?`}</Display>
            <Body fontSize={12.5} fontWeight="600" color={textAlpha(0.45)}>
              {matchCount === 0
                ? "This removes the profile from this phone."
                : `${player.name} is in ${String(matchCount)} ${matchWord} on this phone.`}
            </Body>
            {matchCount > 0 ? (
              <>
                <XStack
                  height={54}
                  borderRadius={16}
                  backgroundColor={colors.card}
                  alignItems="center"
                  justifyContent="center"
                  pressStyle={{ opacity: 0.85 }}
                  role="button"
                  onPress={() => {
                    remove("keepMatches");
                  }}
                  testID="delete-keep-matches"
                >
                  <Body fontSize={13.5} fontWeight="800" color={colors.danger}>
                    Delete profile, keep matches
                  </Body>
                </XStack>
                <XStack
                  height={54}
                  borderRadius={16}
                  backgroundColor={colors.danger}
                  alignItems="center"
                  justifyContent="center"
                  pressStyle={{ opacity: 0.85 }}
                  role="button"
                  onPress={() => {
                    remove("withMatches");
                  }}
                  testID="delete-with-matches"
                >
                  <Body fontSize={13.5} fontWeight="800" color={colors.white}>
                    {`Delete profile + ${String(matchCount)} ${matchWord}`}
                  </Body>
                </XStack>
              </>
            ) : (
              <XStack
                height={54}
                borderRadius={16}
                backgroundColor={colors.danger}
                alignItems="center"
                justifyContent="center"
                pressStyle={{ opacity: 0.85 }}
                role="button"
                onPress={() => {
                  remove("withMatches");
                }}
                testID="delete-player-confirm"
              >
                <Body fontSize={13.5} fontWeight="800" color={colors.white}>
                  Delete player
                </Body>
              </XStack>
            )}
            <XStack
              height={50}
              alignItems="center"
              justifyContent="center"
              pressStyle={{ opacity: 0.7 }}
              role="button"
              onPress={() => {
                setConfirming(false);
              }}
            >
              <Body fontSize={12} fontWeight="800" letterSpacing={1.2} color={whiteAlpha(0.5)}>
                CANCEL
              </Body>
            </XStack>
          </YStack>
        </View>
      ) : null}
    </YStack>
  );
}
