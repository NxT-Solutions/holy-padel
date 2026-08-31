import type { ReactNode } from "react";
import { useState } from "react";
import { TextInput } from "react-native";
import { View, XStack } from "tamagui";
import { Plus } from "@/components/icons.tsx";
import { colors, textAlpha } from "@/theme/colors.ts";

/** The dashed "New player" input row — shared by the picker sheet and the players card. */
export function NewPlayerRow({
  onCreate,
  onCreated,
  placeholder = "New player",
}: {
  readonly onCreate: (name: string) => void;
  readonly onCreated?: () => void;
  readonly placeholder?: string;
}): ReactNode {
  const [newName, setNewName] = useState("");
  return (
    <XStack alignItems="center" gap={10} paddingVertical={11} paddingHorizontal={14}>
      <View
        width={36}
        height={36}
        borderRadius={18}
        borderWidth={1.5}
        borderColor={textAlpha(0.3)}
        borderStyle="dashed"
        alignItems="center"
        justifyContent="center"
      >
        <Plus size={14} color={textAlpha(0.45)} strokeWidth={2.6} />
      </View>
      <TextInput
        style={{
          flex: 1,
          fontSize: 14,
          fontFamily: "Archivo_700Bold",
          color: colors.text,
          padding: 0,
        }}
        placeholder={placeholder}
        placeholderTextColor={textAlpha(0.55)}
        value={newName}
        onChangeText={setNewName}
        onSubmitEditing={() => {
          if (newName.trim() !== "") {
            onCreate(newName.trim());
            setNewName("");
            onCreated?.();
          }
        }}
        returnKeyType="done"
      />
    </XStack>
  );
}
