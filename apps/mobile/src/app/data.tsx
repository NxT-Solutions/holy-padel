import type { BackupData } from "@holy-padel/db";
import {
  countMatches,
  databaseSizeBytes,
  deleteMatch,
  exportBackup,
  importBackup,
  listMatches,
  parseBackup,
} from "@holy-padel/db";
import { File, Paths } from "expo-file-system";
import { shareAsync, isAvailableAsync as sharingAvailable } from "expo-sharing";
import type { ReactNode } from "react";
import { useState } from "react";
import { Alert, Platform, Share, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { XStack, YStack } from "tamagui";
import { ConfirmSheet } from "@/components/confirm-sheet.tsx";
import { ModalHeader } from "@/components/modal-header.tsx";
import { Body, Card, Display, Overline } from "@/components/ui.tsx";
import { useDbMutation, useDbQuery } from "@/db/provider.tsx";
import { megabytesLabel } from "@/lib/format.ts";
import { goBack } from "@/lib/navigation.ts";
import { colors, textAlpha, whiteAlpha } from "@/theme/colors.ts";

/**
 * Local data controls — everything lives in on-device SQLite, so this is where
 * you back it up or wipe it. Export produces a JSON backup (matches, point
 * ledgers, players, settings); Import restores one, replacing what's here.
 * Reached from the "ON THIS PHONE" card on Profile.
 */

function backupFileName(exportedAt: number): string {
  const date = new Date(exportedAt);
  const pad = (value: number): string => String(value).padStart(2, "0");
  return `holy-padel-backup-${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}.json`;
}

export default function DataScreen(): ReactNode {
  const insets = useSafeAreaInsets();
  const mutate = useDbMutation();
  const count = useDbQuery(countMatches);
  const sizeBytes = useDbQuery(databaseSizeBytes);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  /** A parsed backup awaiting the themed "replace everything" confirmation. */
  const [pendingBackup, setPendingBackup] = useState<BackupData | undefined>(undefined);
  const [confirmingDeleteAll, setConfirmingDeleteAll] = useState(false);

  const exportAll = (): void => {
    mutate((driver) => {
      const backup = exportBackup(driver);
      const json = JSON.stringify(backup);
      const fileName = backupFileName(backup.exportedAt);
      void (async () => {
        try {
          if (Platform.OS === "web" || !(await sharingAvailable())) {
            await Share.share({ message: json });
            return;
          }
          // Native: write the backup to the cache dir and hand the real file
          // to the share sheet (AirDrop, Drive, mail — a .json attachment).
          const file = new File(Paths.cache, fileName);
          file.write(json);
          await shareAsync(file.uri, {
            mimeType: "application/json",
            dialogTitle: "Export Holy Padel backup",
          });
        } catch {
          await Share.share({ message: json });
        }
      })();
    });
  };

  const importAll = (): void => {
    if (Platform.OS !== "web") {
      // Native: let the user pick the exported .json from their files.
      void (async () => {
        try {
          const result = await File.pickFileAsync({
            mimeTypes: ["application/json", "text/plain"],
          });
          if (!result.canceled) {
            restore(await result.result.text());
          }
        } catch {
          // Picker unavailable — fall back to the paste area.
          setImportOpen(true);
        }
      })();
      return;
    }
    setImportOpen((open) => !open);
  };

  const restore = (raw: string): void => {
    let backup: BackupData;
    try {
      backup = parseBackup(JSON.parse(raw));
    } catch (error) {
      Alert.alert(
        "Import failed",
        error instanceof Error ? error.message : "That doesn't look like a Holy Padel backup.",
      );
      return;
    }
    setPendingBackup(backup);
  };

  const restoreConfirmed = (): void => {
    if (pendingBackup === undefined) {
      return;
    }
    const n = pendingBackup.matches.length;
    mutate((driver) => {
      importBackup(driver, pendingBackup);
    });
    setImportOpen(false);
    setImportText("");
    setPendingBackup(undefined);
    Alert.alert("Backup restored", `${String(n)} matches are back on this phone.`);
  };

  const deleteAllConfirmed = (): void => {
    mutate((driver) => {
      for (const match of listMatches(driver)) {
        deleteMatch(driver, match.id);
      }
    });
    setConfirmingDeleteAll(false);
    goBack();
  };

  return (
    <YStack
      flex={1}
      backgroundColor={colors.screen}
      paddingTop={insets.top + 14}
      paddingBottom={insets.bottom + 16}
      paddingHorizontal={20}
      gap={18}
    >
      <ModalHeader title="YOUR DATA" onClose={goBack} label="Close" />

      <YStack
        backgroundColor={colors.ink}
        borderRadius={20}
        paddingVertical={18}
        paddingHorizontal={18}
        gap={4}
      >
        <Overline color={colors.accent}>ON THIS PHONE</Overline>
        <Display fontSize={30} color={colors.white}>
          {`${String(count)} matches`}
        </Display>
        <Body fontSize={12} fontWeight="600" color={whiteAlpha(0.5)}>
          {`SQLite · ${megabytesLabel(sizeBytes)} · never leaves your device`}
        </Body>
      </YStack>

      <YStack gap={10}>
        <Card
          borderRadius={16}
          paddingVertical={16}
          paddingHorizontal={18}
          pressStyle={{ opacity: 0.85 }}
          role="button"
          aria-label="Export backup"
          onPress={exportAll}
          testID="export-data"
        >
          <Body fontSize={15} fontWeight="800" color={colors.text}>
            Export backup
          </Body>
          <Body fontSize={12} fontWeight="600" color={textAlpha(0.45)} marginTop={2}>
            Full JSON backup — matches, points, players and settings
          </Body>
        </Card>

        <Card
          borderRadius={16}
          paddingVertical={16}
          paddingHorizontal={18}
          pressStyle={{ opacity: 0.85 }}
          role="button"
          aria-label="Import backup"
          onPress={importAll}
          testID="import-data"
        >
          <Body fontSize={15} fontWeight="800" color={colors.text}>
            Import backup
          </Body>
          <Body fontSize={12} fontWeight="600" color={textAlpha(0.45)} marginTop={2}>
            {Platform.OS === "web"
              ? "Paste an exported backup to restore it"
              : "Pick an exported backup file to restore it"}
          </Body>
        </Card>

        {importOpen ? (
          <YStack gap={9} testID="import-sheet">
            <TextInput
              style={{
                fontSize: 11,
                fontFamily: "Archivo_600SemiBold",
                color: colors.text,
                padding: 12,
                backgroundColor: colors.card,
                borderRadius: 13,
                borderWidth: 1,
                borderColor: textAlpha(0.1),
                minHeight: 110,
                textAlignVertical: "top",
              }}
              value={importText}
              onChangeText={setImportText}
              placeholder="Paste the backup JSON here…"
              placeholderTextColor={textAlpha(0.4)}
              multiline={true}
              autoCapitalize="none"
              autoCorrect={false}
              testID="import-input"
            />
            <XStack gap={9}>
              <XStack
                flex={1}
                height={48}
                backgroundColor={colors.ink}
                borderRadius={14}
                alignItems="center"
                justifyContent="center"
                opacity={importText.trim() === "" ? 0.4 : 1}
                pressStyle={{ opacity: 0.85 }}
                role="button"
                onPress={() => {
                  if (importText.trim() !== "") {
                    restore(importText.trim());
                  }
                }}
                testID="import-restore"
              >
                <Display fontSize={14} letterSpacing={1.2} color={colors.accent}>
                  RESTORE
                </Display>
              </XStack>
              <XStack
                width={92}
                height={48}
                borderWidth={1}
                borderColor={textAlpha(0.16)}
                borderRadius={14}
                alignItems="center"
                justifyContent="center"
                pressStyle={{ opacity: 0.7 }}
                role="button"
                onPress={() => {
                  setImportText("");
                  setImportOpen(false);
                }}
              >
                <Body fontSize={12} fontWeight="800" color={textAlpha(0.55)}>
                  Cancel
                </Body>
              </XStack>
            </XStack>
          </YStack>
        ) : null}

        <Card
          borderRadius={16}
          paddingVertical={16}
          paddingHorizontal={18}
          pressStyle={{ opacity: 0.85 }}
          role="button"
          aria-label="Delete all matches"
          onPress={() => {
            setConfirmingDeleteAll(true);
          }}
          testID="delete-all-data"
        >
          <Body fontSize={15} fontWeight="800" color={colors.danger}>
            Delete all matches
          </Body>
          <Body fontSize={12} fontWeight="600" color={textAlpha(0.45)} marginTop={2}>
            Wipe every match from this phone
          </Body>
        </Card>
      </YStack>

      {pendingBackup === undefined ? null : (
        <ConfirmSheet
          title="Restore backup?"
          message={`Replaces everything on this phone with the backup's ${String(
            pendingBackup.matches.length,
          )} matches. This can't be undone.`}
          confirmLabel="RESTORE"
          onConfirm={restoreConfirmed}
          onCancel={() => {
            setPendingBackup(undefined);
          }}
        />
      )}

      {confirmingDeleteAll ? (
        <ConfirmSheet
          title="Delete all matches?"
          message="Removes every match and its points from this phone. This can't be undone."
          confirmLabel="DELETE ALL"
          onConfirm={deleteAllConfirmed}
          onCancel={() => {
            setConfirmingDeleteAll(false);
          }}
        />
      ) : null}
    </YStack>
  );
}
