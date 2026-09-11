import {
  computePointsTotals,
  computeProfileStats,
  countMatches,
  createPlayer,
  databaseSizeBytes,
  getOwner,
  listMatches,
  listRoster,
  loadMatchDefaults,
  resolveNewMatchDefaults,
} from "@holy-padel/db";
import { router, useFocusEffect } from "expo-router";
import type { ReactNode } from "react";
import { useCallback, useState } from "react";
import { Platform, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { View, XStack, YStack } from "tamagui";
import { ChevronRight, Heart } from "@/components/icons.tsx";
import { NewPlayerRow } from "@/components/new-player-row.tsx";
import { RecordBar } from "@/components/record-bar.tsx";
import { SegmentedRow } from "@/components/segmented-row.tsx";
import { StatTile } from "@/components/stat-tile.tsx";
import { Avatar, Body, Card, Display, Overline, Pill, ResultBadge } from "@/components/ui.tsx";
import { useDbMutation, useDbQuery } from "@/db/provider.tsx";
import {
  getHealthStatus,
  type HealthStatus,
  requestHealthAuthorization,
} from "@/health/health-log.ts";
import { durationLabel, megabytesLabel } from "@/lib/format.ts";
import { colors, limeAlpha, textAlpha, whiteAlpha } from "@/theme/colors.ts";
import { loadThemeSetting, useSetThemeSetting } from "@/theme/theme.tsx";

const HEALTH_PLATFORM = Platform.OS === "android" ? "Health Connect" : "Apple Health";

/**
 * Opt-in prompt to connect the platform health store. Rendered only when the
 * status is actionable ("undetermined", or "denied" with a softer Settings
 * hint); "granted" and "unavailable" render nothing. Connecting never gates
 * anything else on the screen — it's purely additive.
 */
function HealthBanner(): ReactNode {
  const [status, setStatus] = useState<HealthStatus>("unavailable");
  const [busy, setBusy] = useState(false);
  const [stalled, setStalled] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void getHealthStatus().then((next) => {
        if (active) {
          setStatus(next);
        }
      });
      return () => {
        active = false;
      };
    }, []),
  );

  if (status === "granted" || status === "unavailable") {
    return null;
  }

  const denied = status === "denied";

  const connect = (): void => {
    if (busy) {
      return;
    }
    setBusy(true);
    void requestHealthAuthorization()
      .then(() => getHealthStatus())
      .then((next) => {
        setStatus(next);
        setStalled(next !== "granted");
      })
      .finally(() => {
        setBusy(false);
      });
  };

  return (
    <Card
      flexDirection="row"
      alignItems="center"
      gap={13}
      borderRadius={18}
      paddingVertical={14}
      paddingHorizontal={16}
    >
      <View
        width={40}
        height={40}
        borderRadius={20}
        backgroundColor={limeAlpha(0.22)}
        alignItems="center"
        justifyContent="center"
      >
        <Heart size={19} color={colors.limeOnCard} strokeWidth={2.4} />
      </View>
      <YStack flex={1} gap={2}>
        <Body fontSize={14.5} fontWeight="800">
          {`Connect ${HEALTH_PLATFORM}`}
        </Body>
        <Body fontSize={11.5} fontWeight="600" color={textAlpha(0.45)}>
          {denied
            ? "Re-enable workout access in Settings — optional"
            : "Save your matches as workouts — optional"}
        </Body>
        {stalled && !denied ? (
          <Body fontSize={10.5} fontWeight="600" color={textAlpha(0.4)}>
            No prompt appeared? Open Health Connect, allow Holy Padel to write workouts, then try
            again.
          </Body>
        ) : null}
      </YStack>
      {denied ? null : (
        <Pill
          backgroundColor={colors.tileInk}
          paddingVertical={9}
          paddingHorizontal={15}
          pressStyle={{ opacity: 0.7 }}
          opacity={busy ? 0.6 : 1}
          role="button"
          onPress={connect}
        >
          <Body fontSize={11} fontWeight="800" letterSpacing={1.2} color={colors.lime}>
            CONNECT
          </Body>
        </Pill>
      )}
    </Card>
  );
}

export default function ProfileScreen(): ReactNode {
  const insets = useSafeAreaInsets();
  const mutate = useDbMutation();
  const owner = useDbQuery(getOwner);
  const ownerId = owner?.id ?? "nico";
  const stats = useDbQuery((driver) => computeProfileStats(driver, ownerId));
  const matchCount = useDbQuery(countMatches);
  const sizeBytes = useDbQuery(databaseSizeBytes);
  const themeSetting = useDbQuery(loadThemeSetting);
  const setThemeSetting = useSetThemeSetting();
  const roster = useDbQuery(listRoster);
  const points = useDbQuery((driver) => computePointsTotals(driver, ownerId));
  const savedDefaults = useDbQuery(loadMatchDefaults);
  const lastConfig = useDbQuery(listMatches)?.[0]?.config;
  const players = roster.filter((entry) => !entry.isOwner);

  const winRate = `${String(stats.winRatePercent)}%`;
  const sideLabel = owner?.side === undefined ? "" : ` · plays ${owner.side} side`;

  // The summary under the MATCH DEFAULTS row mirrors what the new-match
  // screen will prefill: saved defaults if set, else the last match's setup.
  const effective = resolveNewMatchDefaults({
    ...(savedDefaults === undefined ? {} : { saved: savedDefaults }),
    ...(lastConfig === undefined ? {} : { lastConfig }),
  });
  const sportLabel = effective.sport.charAt(0).toUpperCase() + effective.sport.slice(1);
  const defaultsSummary = `${sportLabel} · ${
    effective.format === "singles" ? "Singles" : "Doubles"
  } · best of ${String(effective.bestOf)}`;

  return (
    <ScrollView
      style={{ backgroundColor: colors.screen }}
      contentContainerStyle={{
        paddingTop: insets.top + 12,
        paddingHorizontal: 16,
        paddingBottom: insets.bottom + 90,
        gap: 12,
      }}
    >
      <XStack alignItems="center" gap={14}>
        <Avatar letter={owner?.name.charAt(0) ?? "N"} size={54} />
        <YStack flex={1}>
          <Display fontSize={30}>{(owner?.name ?? "").toUpperCase()}</Display>
          <Body fontSize={12} fontWeight="600" color={textAlpha(0.45)}>
            {`${owner?.club ?? ""}${sideLabel}`}
          </Body>
        </YStack>
        <Pill
          borderWidth={1}
          borderColor={textAlpha(0.16)}
          paddingVertical={8}
          paddingHorizontal={13}
          pressStyle={{ opacity: 0.6 }}
          role="button"
          aria-label="Edit profile"
          onPress={() => {
            router.navigate("/edit-profile");
          }}
        >
          <Body fontSize={11} fontWeight="800" letterSpacing={1.2} color={textAlpha(0.55)}>
            EDIT
          </Body>
        </Pill>
      </XStack>

      <HealthBanner />

      <XStack gap={8}>
        <StatTile value={String(stats.played)} label="PLAYED" variant="ink" />
        <StatTile
          value={`${String(stats.record.won)}–${String(stats.record.lost)}`}
          label="RECORD"
          variant="lime"
        />
        <StatTile value={winRate} label="WIN RATE" variant="white" />
      </XStack>

      <Card
        paddingVertical={13}
        paddingHorizontal={17}
        flexDirection="row"
        alignItems="center"
        justifyContent="space-between"
      >
        <Overline>FORM · LAST 5</Overline>
        <XStack gap={6}>
          {stats.form.map((won, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: the strip is positional by design
            <ResultBadge key={index} won={won} size={25} />
          ))}
        </XStack>
      </Card>

      <XStack gap={8}>
        <StatTile
          value={
            stats.streak === undefined
              ? "—"
              : `${stats.streak.kind === "won" ? "W" : "L"}${String(stats.streak.count)}`
          }
          label="STREAK"
          variant="ink"
        />
        <StatTile value={String(stats.bestWinStreak)} label="BEST W RUN" variant="ink" />
        <StatTile
          value={durationLabel(stats.totalDurationMs)}
          label="TIME PLAYED"
          variant="white"
        />
      </XStack>

      <Card borderRadius={20} paddingVertical={15} paddingHorizontal={17} gap={11}>
        <Overline>WITH PARTNER</Overline>
        {stats.partners.length === 0 ? (
          <Body fontSize={12.5} fontWeight="600" color={textAlpha(0.4)}>
            No finished matches yet.
          </Body>
        ) : (
          stats.partners.map((partner) => (
            <XStack
              key={partner.playerId}
              alignItems="center"
              gap={12}
              pressStyle={{ opacity: 0.75 }}
              role="button"
              onPress={() => {
                router.push(`/player/${partner.playerId}`);
              }}
              testID={`partner-${partner.playerId}`}
            >
              <Avatar letter={partner.name.charAt(0)} size={30} />
              <Body flex={1} fontSize={14.5} fontWeight="700">
                {partner.name}
              </Body>
              <RecordBar won={partner.won} lost={partner.lost} />
              <Display fontSize={15} width={36} textAlign="right">
                {`${String(partner.won)}–${String(partner.lost)}`}
              </Display>
              <ChevronRight size={13} color={textAlpha(0.3)} />
            </XStack>
          ))
        )}
      </Card>

      <Card borderRadius={20} paddingVertical={15} paddingHorizontal={17} gap={11}>
        <Overline>HEAD-TO-HEAD</Overline>
        {stats.headToHead.length === 0 ? (
          <Body fontSize={12.5} fontWeight="600" color={textAlpha(0.4)}>
            No finished matches yet.
          </Body>
        ) : (
          stats.headToHead.map((record) => (
            <XStack key={record.label} alignItems="center" justifyContent="space-between">
              <Body fontSize={14.5} fontWeight="700">
                {`vs ${record.label}`}
              </Body>
              <Display fontSize={15}>{`${String(record.won)}–${String(record.lost)}`}</Display>
            </XStack>
          ))
        )}
      </Card>

      <Card borderRadius={20} paddingVertical={15} paddingHorizontal={17} gap={11}>
        <XStack alignItems="center" justifyContent="space-between">
          <Overline>POINTS · LIFETIME</Overline>
          <Body fontSize={10} fontWeight="800" letterSpacing={1.2} color={textAlpha(0.4)}>
            {`${String(points.for + points.against)} RALLIES`}
          </Body>
        </XStack>
        <XStack alignItems="center" gap={12}>
          <Body fontSize={14.5} fontWeight="700">
            For
          </Body>
          <RecordBar won={points.for} lost={points.against} />
          <Display fontSize={15} width={90} textAlign="right">
            {`${String(points.for)}–${String(points.against)}`}
          </Display>
        </XStack>
        {(
          [
            ["Padel", points.bySport.padel],
            ["Squash", points.bySport.squash],
            ["Pickleball", points.bySport.pickleball],
          ] as const
        )
          .filter(([, totals]) => totals.for + totals.against > 0)
          .map(([label, totals]) => (
            <XStack key={label} alignItems="center" justifyContent="space-between">
              <Body fontSize={13} fontWeight="700" color={textAlpha(0.55)}>
                {label}
              </Body>
              <Display fontSize={14}>{`${String(totals.for)}–${String(totals.against)}`}</Display>
            </XStack>
          ))}
      </Card>

      <Card borderRadius={20} paddingVertical={15} paddingHorizontal={17} gap={11}>
        <Overline>PLAYERS</Overline>
        {players.map((entry) => (
          <XStack
            key={entry.id}
            alignItems="center"
            gap={12}
            pressStyle={{ opacity: 0.75 }}
            role="button"
            onPress={() => {
              router.push(`/player/${entry.id}`);
            }}
            testID={`player-${entry.id}`}
          >
            <Avatar letter={entry.name.charAt(0)} size={30} />
            <YStack flex={1}>
              <Body fontSize={14.5} fontWeight="700">
                {entry.name}
              </Body>
              <Body fontSize={10.5} fontWeight="600" color={textAlpha(0.4)}>
                {`${String(entry.matchesWithOwner)} ${
                  entry.matchesWithOwner === 1 ? "match" : "matches"
                } with you`}
              </Body>
            </YStack>
            <ChevronRight size={13} color={textAlpha(0.3)} />
          </XStack>
        ))}
        <NewPlayerRow
          onCreate={(name) => {
            const id = `player-${String(Date.now())}`;
            mutate((driver) => {
              createPlayer(driver, { id, name, createdAt: Date.now() });
            });
            router.push(`/player/${id}`);
          }}
        />
      </Card>

      <Card borderRadius={20} paddingVertical={15} paddingHorizontal={17} gap={11}>
        <Overline>BY SPORT</Overline>
        {(
          [
            ["Padel", stats.recordsBySport.padel],
            ["Squash", stats.recordsBySport.squash],
            ["Pickleball", stats.recordsBySport.pickleball],
          ] as const
        )
          .filter(([, record]) => record.won + record.lost > 0)
          .map(([label, record]) => (
            <XStack key={label} alignItems="center" justifyContent="space-between">
              <Body fontSize={14.5} fontWeight="700">
                {label}
              </Body>
              <XStack alignItems="center" gap={12}>
                <RecordBar won={record.won} lost={record.lost} />
                <Display fontSize={15} width={36} textAlign="right">
                  {`${String(record.won)}–${String(record.lost)}`}
                </Display>
              </XStack>
            </XStack>
          ))}
        {stats.recordsBySport.padel.won +
          stats.recordsBySport.padel.lost +
          stats.recordsBySport.squash.won +
          stats.recordsBySport.squash.lost +
          stats.recordsBySport.pickleball.won +
          stats.recordsBySport.pickleball.lost ===
        0 ? (
          <Body fontSize={12.5} fontWeight="600" color={textAlpha(0.4)}>
            No finished matches yet.
          </Body>
        ) : null}
      </Card>

      <Card borderRadius={20} padding={16} gap={13}>
        <Overline color={textAlpha(0.45)}>APPEARANCE</Overline>
        <SegmentedRow
          label="Theme"
          options={[
            { value: "system", label: "System" },
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
          ]}
          value={themeSetting ?? "system"}
          onChange={setThemeSetting}
        />
      </Card>

      <XStack
        backgroundColor={colors.tileInk}
        borderRadius={18}
        paddingVertical={13}
        paddingHorizontal={17}
        alignItems="center"
        justifyContent="space-between"
        gap={10}
        pressStyle={{ opacity: 0.85 }}
        role="button"
        aria-label="Default match settings"
        onPress={() => {
          router.navigate("/edit-defaults");
        }}
        testID="defaults-row"
      >
        <Body fontSize={10} fontWeight="800" letterSpacing={1.5} color={colors.lime}>
          MATCH DEFAULTS
        </Body>
        <Body flex={1} fontSize={11} fontWeight="700" color={whiteAlpha(0.5)} textAlign="right">
          {defaultsSummary}
        </Body>
        <ChevronRight size={14} color={whiteAlpha(0.5)} />
      </XStack>

      <XStack
        backgroundColor={colors.tileInk}
        borderRadius={18}
        paddingVertical={13}
        paddingHorizontal={17}
        alignItems="center"
        justifyContent="space-between"
        pressStyle={{ opacity: 0.85 }}
        role="button"
        aria-label="Manage your data"
        onPress={() => {
          router.navigate("/data");
        }}
      >
        <Body fontSize={10} fontWeight="800" letterSpacing={1.5} color={colors.lime}>
          ON THIS PHONE
        </Body>
        <Body fontSize={11} fontWeight="700" color={whiteAlpha(0.5)}>
          {`SQLite · ${String(matchCount)} matches · ${megabytesLabel(sizeBytes)}`}
        </Body>
        <ChevronRight size={14} color={whiteAlpha(0.5)} />
      </XStack>
    </ScrollView>
  );
}
