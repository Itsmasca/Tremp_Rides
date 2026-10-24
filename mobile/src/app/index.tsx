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

import { login } from '@/api/auth';
import ErrorText from '@/components/ErrorText';
import PrimaryButton from '@/components/PrimaryButton';
import TextField from '@/components/TextField';
import { Colors, Radius, Shadow } from '@/constants/theme';
import { emailError, passwordError } from '@/utils/validation';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    const invalid = emailError(email) ?? passwordError(password);
    if (invalid) return setError(invalid);

    setError(null);
    setLoading(true);
    try {
      // El backend devuelve { token, user }; el rol (conductor/pasajero) viene del registro
      await login(email.trim().toLowerCase(), password);
      router.replace('/home' as any);
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo iniciar sesión');
    } finally {
      setLoading(false);
    }
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
              onChangeText={(t) => {
                setEmail(t);
                setError(null);
              }}
            />
            <TextField
              label="Contraseña"
              icon="lock-closed-outline"
              placeholder="••••••••"
              secureTextEntry
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                setError(null);
              }}
            />
            <ErrorText message={error} />
            <PrimaryButton title="Entrar" onPress={handleLogin} loading={loading} style={{ marginTop: 8 }} />
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
