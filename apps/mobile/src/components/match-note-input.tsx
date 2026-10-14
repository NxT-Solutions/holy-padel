import type { ReactNode } from "react";
import { TextInput } from "react-native";
import { Card, Overline } from "@/components/ui.tsx";
import { colors, textAlpha } from "@/theme/colors.ts";

export function MatchNoteInput({
  value,
  onChange,
}: {
  readonly value: string;
  readonly onChange: (next: string) => void;
}): ReactNode {
  return (
    <Card borderRadius={20} padding={16} gap={10}>
      <Overline color={textAlpha(0.45)}>NOTE · OPTIONAL</Overline>
      <TextInput
        style={noteInputStyle()}
        value={value}
        onChangeText={onChange}
        placeholder="e.g. league night, new racket…"
        placeholderTextColor={textAlpha(0.4)}
        multiline={true}
        testID="match-note"
      />
    </Card>
  );
}

/** Built per render: a module-level object would freeze the light palette. */
function noteInputStyle() {
  return {
    fontSize: 14,
    fontFamily: "Archivo_600SemiBold",
    color: colors.text,
    paddingVertical: 10,
    paddingHorizontal: 13,
    backgroundColor: colors.row,
    borderRadius: 13,
    minHeight: 44,
    textAlignVertical: "top",
  } as const;
}

/** The accent START MATCH action plus the watch hint beneath it. */
