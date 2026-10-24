import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Colors, Radius } from '@/constants/theme';

type Props<T extends string> = {
  options: { label: string; value: T }[];
  value: T | null;
  onChange: (value: T) => void;
};

// Botones tipo "píldora" en lugar de dropdowns
export default function PillSelector<T extends string>({ options, value, onChange }: Props<T>) {
  return (
    <View style={styles.row}>
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <TouchableOpacity
            key={opt.value}
            activeOpacity={0.8}
            onPress={() => onChange(opt.value)}
            style={[styles.pill, selected && styles.pillSelected]}>
            <Text style={[styles.text, selected && styles.textSelected]}>{opt.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  pill: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: Radius.pill,
    backgroundColor: Colors.card,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  pillSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  text: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  textSelected: { color: '#FFFFFF' },
});
