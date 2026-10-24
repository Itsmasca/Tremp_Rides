import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { Colors, Radius } from '@/constants/theme';

// Mensaje de error debajo de un formulario
export default function ErrorText({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <View style={styles.box}>
      <Ionicons name="alert-circle-outline" size={18} color={Colors.danger} />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  text: { flex: 1, fontSize: 14, color: Colors.danger, fontWeight: '600' },
});
