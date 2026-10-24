import { StyleSheet, Text, View } from 'react-native';

import { CATEGORY_LABEL, Colors, FUEL, money, PriceBreakdown as Breakdown, Radius, VehicleCategory } from '@/constants';

type Props = {
  breakdown: Breakdown;
  category: VehicleCategory;
  pickupKm?: number;
  tripKm?: number;
  frozen?: boolean;
};

// Desglose del cobro: km → litros → costo → reparto 70/30. Nada de esto se edita en la app.
export default function PriceBreakdown({ breakdown, category, pickupKm, tripKm, frozen }: Props) {
  return (
    <View style={styles.box}>
      {frozen && (
        <View style={styles.frozen}>
          <Text style={styles.frozenText}>🔒 Precio congelado al aceptar el conductor</Text>
        </View>
      )}
      {pickupKm !== undefined && tripKm !== undefined && (
        <Row label="Distancia (recogida + viaje)" value={`${pickupKm} km + ${tripKm} km = ${breakdown.km} km`} />
      )}
      {pickupKm === undefined && <Row label="Distancia" value={`${breakdown.km} km`} />}
      <Row label={`Rendimiento (${CATEGORY_LABEL[category]})`} value={`${breakdown.efficiency} km/L`} />
      <Row label="Gasolina usada" value={`${breakdown.liters.toFixed(2)} L`} />
      <Row label={`Gasolina ${FUEL.name} · ${money(FUEL.pricePerLiter)}/L`} value={money(breakdown.fuelCost)} />
      <View style={styles.divider} />
      <Row label="Pagas tú (70%)" value={money(breakdown.passengerPays)} bold />
      <Row label="Absorbe el conductor (30%)" value={money(breakdown.driverAbsorbs)} />
    </View>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.label, bold && styles.bold]}>{label}</Text>
      <Text style={[styles.value, bold && styles.bold]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: Colors.background, borderRadius: Radius.md, padding: 14, gap: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  label: { fontSize: 13, color: Colors.textMuted, flex: 1 },
  value: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600' },
  bold: { fontSize: 15, color: Colors.text, fontWeight: '800' },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 2 },
  frozen: { backgroundColor: Colors.primarySoft, borderRadius: Radius.md, padding: 8, marginBottom: 4 },
  frozenText: { fontSize: 12, fontWeight: '700', color: Colors.primaryDark, textAlign: 'center' },
});
