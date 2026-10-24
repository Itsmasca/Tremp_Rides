import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

import { Colors, Radius } from '@/constants/theme';

type Props = TextInputProps & {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
};

export default function TextField({ label, icon, ...inputProps }: Props) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputRow}>
        <Ionicons name={icon} size={20} color={Colors.textMuted} />
        <TextInput placeholderTextColor={Colors.textMuted} style={styles.input} {...inputProps} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 16 },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.text,
  },
});
