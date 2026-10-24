import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import DriverView from '@/components/home/DriverView';
import PassengerView from '@/components/home/PassengerView';
import { Colors, Radius, Shadow } from '@/constants/theme';
import { useUser } from '@/store/user';

// El rol viene del registro: con coche = conductor, sin coche = pasajero
export default function HomeScreen() {
  const user = useUser();
  const isDriver = user.role === 'conductor';

  return (
    <View style={styles.container}>
      {isDriver ? <DriverView /> : <PassengerView />}

      {/* Barra superior flotante sobre el mapa */}
      <SafeAreaView edges={['top']} style={styles.topBar} pointerEvents="box-none">
        <TouchableOpacity style={styles.circle} onPress={() => router.replace('/' as any)}>
          <Ionicons name="log-out-outline" size={22} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.badge}>
          <Ionicons name={isDriver ? 'car-sport' : 'walk'} size={16} color="#FFFFFF" />
          <Text style={styles.badgeText}>{isDriver ? 'Conductor' : 'Pasajero'}</Text>
        </View>
        <View style={styles.circle}>
          <Ionicons name="person-outline" size={22} color={Colors.text} />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  circle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.text,
    borderRadius: Radius.pill,
    paddingVertical: 8,
    paddingHorizontal: 16,
    ...Shadow,
  },
  badgeText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
