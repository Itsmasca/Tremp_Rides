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

import PillSelector from '@/components/PillSelector';
import PrimaryButton from '@/components/PrimaryButton';
import TextField from '@/components/TextField';
import { CATEGORY_LABEL, EFFICIENCY_KM_L, VehicleCategory } from '@/constants/pricing';
import { Colors, Radius, Shadow } from '@/constants/theme';
import { CAR_CATALOG } from '@/data/vehicles';
import { setUser } from '@/store/user';

type Gender = 'hombre' | 'mujer';
type YesNo = 'si' | 'no';
type VehicleType = VehicleCategory;

const CATEGORIES: VehicleCategory[] = ['Sedan', 'SUV', 'Camioneta'];

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [womenOnly, setWomenOnly] = useState<YesNo | null>(null);
  const [hasVehicle, setHasVehicle] = useState<YesNo | null>(null);
  const [vehicleType, setVehicleType] = useState<VehicleType | null>(null);
  const [carId, setCarId] = useState<string | null>(null);
  const [docsUploaded, setDocsUploaded] = useState(false);

  const selectedCar = CAR_CATALOG.find((c) => c.id === carId) ?? null;

  const handleRegister = () => {
    // TODO: enviar al backend
    setUser({
      name: name || 'Estudiante',
      gender,
      womenOnly: womenOnly === 'si',
      hasVehicle: hasVehicle === 'si',
      vehicleType,
      carName: selectedCar?.name ?? null,
      role: hasVehicle === 'si' ? 'conductor' : 'pasajero',
    });
    router.replace('/home' as any);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <TouchableOpacity onPress={() => router.back()} style={styles.back}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>

          <Text style={styles.title}>Crea tu cuenta</Text>
          <Text style={styles.subtitle}>Únete a la comunidad Tremp</Text>

          {/* Foto de perfil (lógica de subida pendiente) */}
          <TouchableOpacity activeOpacity={0.8} style={styles.photo}>
            <Ionicons name="camera-outline" size={32} color={Colors.primary} />
            <Text style={styles.photoText}>Subir foto</Text>
          </TouchableOpacity>

          <View style={styles.card}>
            <TextField label="Nombre completo" icon="person-outline" placeholder="Tu nombre" value={name} onChangeText={setName} />
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
          </View>

          <View style={styles.card}>
            <Text style={styles.question}>Género</Text>
            <PillSelector
              options={[
                { label: 'Hombre', value: 'hombre' },
                { label: 'Mujer', value: 'mujer' },
              ]}
              value={gender}
              onChange={(g) => {
                setGender(g);
                if (g === 'hombre') setWomenOnly(null);
              }}
            />

            {gender === 'mujer' && (
              <View style={styles.subCard}>
                <Ionicons name="shield-checkmark-outline" size={22} color={Colors.primaryDark} />
                <Text style={styles.subQuestion}>¿Quieres ver únicamente viajes de conductoras mujeres?</Text>
                <PillSelector
                  options={[
                    { label: 'Sí', value: 'si' },
                    { label: 'No', value: 'no' },
                  ]}
                  value={womenOnly}
                  onChange={setWomenOnly}
                />
              </View>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.question}>¿Tienes vehículo?</Text>
            <PillSelector
              options={[
                { label: 'Sí, tengo', value: 'si' },
                { label: 'No, busco ride', value: 'no' },
              ]}
              value={hasVehicle}
              onChange={(v) => {
                setHasVehicle(v);
                if (v === 'no') {
                  setVehicleType(null);
                  setCarId(null);
                }
              }}
            />

            {hasVehicle === 'si' && (
              <View style={styles.subCard}>
                <Ionicons name="car-outline" size={22} color={Colors.primaryDark} />
                <Text style={styles.subQuestion}>Elige tu coche del catálogo</Text>
                <Text style={styles.hint}>
                  Cada categoría tiene un rendimiento fijo que usa el sistema para calcular el precio. No se puede editar.
                </Text>
                <PillSelector
                  options={CATEGORIES.map((c) => ({
                    label: `${CATEGORY_LABEL[c]} · ${EFFICIENCY_KM_L[c]} km/L`,
                    value: c,
                  }))}
                  value={vehicleType}
                  onChange={(c) => {
                    setVehicleType(c);
                    setCarId(null);
                  }}
                />

                {vehicleType && (
                  <View style={styles.catalog}>
                    {CAR_CATALOG.filter((c) => c.category === vehicleType).map((car) => {
                      const active = car.id === carId;
                      return (
                        <TouchableOpacity
                          key={car.id}
                          activeOpacity={0.8}
                          onPress={() => setCarId(car.id)}
                          style={[styles.catalogRow, active && styles.catalogRowActive]}>
                          <Ionicons
                            name={active ? 'radio-button-on' : 'radio-button-off'}
                            size={20}
                            color={active ? Colors.primary : Colors.textMuted}
                          />
                          <Text style={[styles.catalogText, active && styles.catalogTextActive]}>{car.name}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                {selectedCar && (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setDocsUploaded(true)}
                    style={[styles.docs, docsUploaded && styles.docsDone]}>
                    <Ionicons
                      name={docsUploaded ? 'checkmark-circle' : 'document-attach-outline'}
                      size={22}
                      color={docsUploaded ? Colors.primary : Colors.textSecondary}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.docsTitle}>
                        {docsUploaded ? 'Documentos cargados' : 'Subir tarjeta de circulación y licencia'}
                      </Text>
                      <Text style={styles.hint}>
                        {docsUploaded
                          ? 'Validaremos que el coche coincida con el catálogo.'
                          : 'Se usan para validar que tu coche es el que elegiste.'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          <PrimaryButton title="Crear cuenta" onPress={handleRegister} style={{ marginTop: 8 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: { padding: 24, paddingBottom: 48 },
  back: { width: 40, height: 40, justifyContent: 'center', marginBottom: 8 },
  title: { fontSize: 28, fontWeight: '800', color: Colors.text },
  subtitle: { fontSize: 15, color: Colors.textMuted, marginTop: 4, marginBottom: 20 },
  photo: {
    alignSelf: 'center',
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: Colors.card,
    borderWidth: 2,
    borderColor: Colors.primarySoft,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    ...Shadow,
  },
  photoText: { fontSize: 13, color: Colors.primary, fontWeight: '600', marginTop: 4 },
  card: { backgroundColor: Colors.card, borderRadius: Radius.xl, padding: 20, marginBottom: 16, ...Shadow },
  question: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 12 },
  subCard: {
    marginTop: 16,
    padding: 16,
    borderRadius: Radius.md,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  subQuestion: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  hint: { fontSize: 13, color: Colors.textMuted, lineHeight: 18 },
  catalog: { gap: 4 },
  catalogRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: Radius.md,
    backgroundColor: Colors.card,
  },
  catalogRowActive: { backgroundColor: Colors.primarySoft },
  catalogText: { fontSize: 15, color: Colors.textSecondary, fontWeight: '500' },
  catalogTextActive: { color: Colors.text, fontWeight: '700' },
  docs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.primary,
    backgroundColor: Colors.card,
  },
  docsDone: { borderStyle: 'solid', borderColor: Colors.primarySoft, backgroundColor: Colors.primarySoft },
  docsTitle: { fontSize: 14, fontWeight: '700', color: Colors.text },
});
