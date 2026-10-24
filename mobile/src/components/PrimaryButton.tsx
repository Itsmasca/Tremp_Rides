import { StyleSheet, Text, TouchableOpacity, ViewStyle } from 'react-native';

import { Colors, Radius, Shadow } from '@/constants/theme';

type Props = {
  title: string;
  onPress: () => void;
  variant?: 'solid' | 'outline';
  style?: ViewStyle;
};

export default function PrimaryButton({ title, onPress, variant = 'solid', style }: Props) {
  const outline = variant === 'outline';
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[styles.button, outline ? styles.outline : styles.solid, style]}>
      <Text style={[styles.text, outline && { color: Colors.primary }]}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 16,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  solid: {
    backgroundColor: Colors.primary,
    ...Shadow,
  },
  outline: {
    backgroundColor: Colors.card,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
