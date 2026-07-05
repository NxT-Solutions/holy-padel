import { computeProfileStats, countMatches, databaseSizeBytes, getOwner } from "@holy-padel/db";
import { router, useFocusEffect } from "expo-router";
import type { ReactNode } from "react";
import { useCallback, useState } from "react";
import { Platform, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { View, XStack, YStack } from "tamagui";
import { ChevronRight, Heart } from "@/components/icons.tsx";
import { Avatar, Body, Card, Display, Overline, Pill, ResultBadge } from "@/components/ui.tsx";
import { useDbQuery } from "@/db/provider.tsx";
import {
  getHealthStatus,
  type HealthStatus,
  requestHealthAuthorization,
} from "@/health/health-log.ts";
import { megabytesLabel } from "@/lib/format.ts";
import { colors, inkAlpha, limeAlpha, whiteAlpha } from "@/theme/colors.ts";

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
      .then(setStatus)
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
        <Heart size={19} color={colors.limeInk} strokeWidth={2.4} />
      </View>
      <YStack flex={1} gap={2}>
        <Body fontSize={14.5} fontWeight="800">
          {`Connect ${HEALTH_PLATFORM}`}
        </Body>
        <Body fontSize={11.5} fontWeight="600" color={inkAlpha(0.45)}>
          {denied
            ? "Re-enable workout access in Settings — optional"
            : "Save your matches as workouts — optional"}
        </Body>
      </YStack>
      {denied ? null : (
        <Pill
          backgroundColor={colors.ink}
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

function StatTile({
  value,
  label,
  variant,
}: {
  readonly value: string;
  readonly label: string;
  readonly variant: "ink" | "lime" | "white";
}): ReactNode {
  const palette = {
    ink: { background: colors.ink, value: colors.white, label: whiteAlpha(0.5) },
    lime: { background: colors.lime, value: colors.ink, label: inkAlpha(0.55) },
    white: { background: colors.white, value: colors.ink, label: inkAlpha(0.4) },
  }[variant];
  const { background, value: valueColor, label: labelColor } = palette;
  return (
    <View
      flex={1}
      backgroundColor={background}
      borderRadius={16}
      paddingTop={13}
      paddingBottom={11}
      alignItems="center"
      boxShadow={variant === "white" ? "0 2px 10px rgba(14, 17, 22, 0.05)" : "unset"}
    >
      <Display fontSize={24} color={valueColor}>
        {value}
      </Display>
      <Body fontSize={9} fontWeight="800" letterSpacing={1.5} color={labelColor} marginTop={2}>
        {label}
      </Body>
    </View>
  );
}

function RecordBar({ won, lost }: { readonly won: number; readonly lost: number }): ReactNode {
  const total = won + lost;
  const share = total === 0 ? 0 : won / total;
  return (
    <View
      width={104}
      height={7}
      borderRadius={999}
      backgroundColor={colors.greige}
      overflow="hidden"
    >
      <View width={`${String(share * 100)}%`} height="100%" backgroundColor={colors.lime} />
    </View>
  );
}

export default function ProfileScreen(): ReactNode {
  const insets = useSafeAreaInsets();
  const owner = useDbQuery(getOwner);
  const stats = useDbQuery((driver) => computeProfileStats(driver, "nico"));
  const matchCount = useDbQuery(countMatches);
  const sizeBytes = useDbQuery(databaseSizeBytes);

  const winRate = `${String(stats.winRatePercent)}%`;
  const sideLabel = owner?.side === undefined ? "" : ` · plays ${owner.side} side`;

  return (
    <ScrollView
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
          <Body fontSize={12} fontWeight="600" color={inkAlpha(0.45)}>
            {`${owner?.club ?? ""}${sideLabel}`}
          </Body>
        </YStack>
        <Pill
          borderWidth={1}
          borderColor={inkAlpha(0.16)}
          paddingVertical={8}
          paddingHorizontal={13}
          pressStyle={{ opacity: 0.6 }}
          role="button"
          aria-label="Edit profile"
          onPress={() => {
            router.navigate("/edit-profile");
          }}
        >
          <Body fontSize={11} fontWeight="800" letterSpacing={1.2} color={inkAlpha(0.55)}>
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

      <Card borderRadius={20} paddingVertical={15} paddingHorizontal={17} gap={11}>
        <Overline>WITH PARTNER</Overline>
        {stats.partners.map((partner) => (
          <XStack key={partner.playerId} alignItems="center" gap={12}>
            <Avatar letter={partner.name.charAt(0)} size={30} />
            <Body flex={1} fontSize={14.5} fontWeight="700">
              {partner.name}
            </Body>
            <RecordBar won={partner.won} lost={partner.lost} />
            <Display fontSize={15} width={36} textAlign="right">
              {`${String(partner.won)}–${String(partner.lost)}`}
            </Display>
          </XStack>
        ))}
      </Card>

      <Card borderRadius={20} paddingVertical={15} paddingHorizontal={17} gap={11}>
        <Overline>HEAD-TO-HEAD</Overline>
        {stats.headToHead.map((record) => (
          <XStack key={record.label} alignItems="center" justifyContent="space-between">
            <Body fontSize={14.5} fontWeight="700">
              {`vs ${record.label}`}
            </Body>
            <Display fontSize={15}>{`${String(record.won)}–${String(record.lost)}`}</Display>
          </XStack>
        ))}
      </Card>

      <XStack
        backgroundColor={colors.ink}
        borderRadius={18}
        paddingVertical={13}
        paddingHorizontal={17}
        alignItems="center"
        justifyContent="space-between"
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
