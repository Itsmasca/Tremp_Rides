import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import PrimaryButton from '@/components/PrimaryButton';
import TextField from '@/components/TextField';
import { Colors, Radius, Shadow } from '@/constants/theme';
import { setUser } from '@/store/user';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = () => {
    // TODO: validar contra backend. Mientras tanto, el rol lo decide el registro;
    // para probar sin registrarte, un correo que contenga "conductor" entra como conductor.
    if (email.toLowerCase().includes('conductor')) setUser({ role: 'conductor', hasVehicle: true });
    router.replace('/home' as any);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.logo}>
            <Ionicons name="car-sport" size={44} color="#FFFFFF" />
          </View>
          <Text style={styles.title}>Tremp</Text>
          <Text style={styles.subtitle}>Rides solidarios a la Anáhuac Mayab</Text>

          <View style={styles.card}>
            <TextField
              label="Correo institucional"
              icon="mail-outline"
              placeholder="tu.nombre@anahuac.mx"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
            <TextField
              label="Contraseña"
              icon="lock-closed-outline"
              placeholder="••••••••"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
            <PrimaryButton title="Entrar" onPress={handleLogin} style={{ marginTop: 8 }} />
          </View>

          <TouchableOpacity onPress={() => router.push('/register' as any)} style={styles.linkRow}>
            <Text style={styles.linkText}>
              ¿No tienes cuenta? <Text style={styles.link}>Regístrate</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logo: {
    alignSelf: 'center',
    width: 84,
    height: 84,
    borderRadius: Radius.xl,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    ...Shadow,
  },
  title: { fontSize: 34, fontWeight: '800', color: Colors.text, textAlign: 'center' },
  subtitle: { fontSize: 15, color: Colors.textMuted, textAlign: 'center', marginTop: 4, marginBottom: 28 },
  card: { backgroundColor: Colors.card, borderRadius: Radius.xl, padding: 20, ...Shadow },
  linkRow: { marginTop: 24, alignItems: 'center' },
  linkText: { fontSize: 15, color: Colors.textSecondary },
  link: { color: Colors.primary, fontWeight: '700' },
});
