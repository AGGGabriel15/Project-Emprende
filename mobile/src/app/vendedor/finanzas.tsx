import { Stack } from 'expo-router';
import { AlertTriangle, Banknote, Hourglass, Receipt, Wallet } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { summarize } from '@/features/reports/compute';
import { formatDate, formatMoney, formatPercent } from '@/lib/format';
import type { LedgerEntry } from '@/types/domain';
import { Badge } from '~/components/ui/badge';
import { Card } from '~/components/ui/card';
import { Skeleton } from '~/components/ui/feedback';
import { Screen } from '~/components/ui/screen';
import { Text } from '~/components/ui/text';
import { PeriodFilter, StatCard } from '~/components/vendor/vendor-bits';
import { useFinances, useMyBusiness } from '~/features/vendor/queries';
import { colors } from '~/theme/tokens';

function splitBalance(entries: LedgerEntry[]) {
  const now = Date.now();
  let available = 0;
  let held = 0;
  for (const entry of entries) {
    if (new Date(entry.available_at).getTime() <= now) available += entry.amount_minor;
    else held += entry.amount_minor;
  }
  return { available, held };
}

export default function FinanceScreen() {
  const business = useMyBusiness().data!;
  const [period, setPeriod] = useState('30d');
  const finances = useFinances(business.id, period);
  const f = finances.data;

  if (!f) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Finanzas' }} />
        <Skeleton height={300} />
      </Screen>
    );
  }
  const summary = summarize(f.orders);
  const unpaid = f.ledger.filter((e) => !e.payout_id);
  const { available, held } = splitBalance(unpaid);
  const activeStrikes = f.strikes.filter((s) => !s.voided_at);

  return (
    <Screen refreshing={finances.isRefetching} onRefresh={() => void finances.refetch()}>
      <Stack.Screen options={{ title: 'Finanzas' }} />
      <Text variant="small" tone="muted">
        Comisión vigente: {formatPercent(f.rate)} sobre los productos. El envío y la tarifa de servicio los cobra Catarina Market, que paga a sus repartidores.
      </Text>

      <Card style={[styles.balance]}>
        <Text variant="small" tone="white">
          Disponible para la próxima liquidación
        </Text>
        <Text variant="hero" tone="white">
          {formatMoney(available)}
        </Text>
        <View style={styles.held}>
          <Hourglass size={14} color={colors.hojaClara} />
          <Text variant="small" style={styles.heldText}>
            Retenido {formatMoney(held + f.inClaimWindow)} · ventana de reclamo (48 h)
            {business.tier === 'informal' ? ' y retención de 7 días de tus primeros pedidos' : ''}
          </Text>
        </View>
      </Card>

      <PeriodFilter value={period} onChange={setPeriod} />
      <View style={styles.stats}>
        <StatCard icon={Receipt} label="Ventas brutas" value={formatMoney(summary.gross)} />
        <StatCard icon={Banknote} label="Comisiones" value={formatMoney(summary.commission)} />
        <StatCard icon={Wallet} label="Neto del período" value={formatMoney(summary.net)} />
        <StatCard icon={AlertTriangle} label="Faltas vigentes" value={String(activeStrikes.length)} hint="3 en 90 días suspenden la tienda" />
      </View>

      <Text variant="small" tone="muted">
        Cobras cuando el cliente recibe el pedido con su PIN y pasan 48 h sin reclamos. Si un reclamo se aprueba a tu cargo, se descuenta de tu liquidación.
      </Text>

      <Card style={styles.gap}>
        <Text variant="heading">Movimientos</Text>
        <Text variant="small" tone="muted">
          Cada pedido cerrado suma la venta y resta la comisión; los reclamos aprobados restan un ajuste.
        </Text>
        {f.ledger.length === 0 ? (
          <Text variant="small" tone="muted">
            Sin movimientos todavía.
          </Text>
        ) : (
          f.ledger.slice(0, 40).map((entry) => (
            <View key={entry.id} style={styles.entry}>
              <View style={styles.flex}>
                <Text variant="small">{entry.description}</Text>
                {entry.payout_id ? (
                  <Badge tone="neutral">Liquidado</Badge>
                ) : new Date(entry.available_at) > new Date(entry.created_at) && entry.kind === 'sale' ? (
                  <Badge tone="amber">Disponible {formatDate(entry.available_at, false)}</Badge>
                ) : null}
              </View>
              <Text variant="smallMedium" tone={entry.amount_minor < 0 ? 'danger' : 'default'}>
                {formatMoney(entry.amount_minor)}
              </Text>
            </View>
          ))
        )}
      </Card>

      {f.strikes.length > 0 && (
        <Card style={styles.gap}>
          <Text variant="heading">Faltas</Text>
          <Text variant="small" tone="muted">
            Por cancelar pedidos pagados, no preparar a tiempo, rechazos en la recolección y reclamos aprobados a tu cargo.
          </Text>
          {f.strikes.map((s) => (
            <View key={s.id} style={styles.entry}>
              <Text variant="small" style={[styles.flex, s.voided_at ? styles.voided : null]}>
                {s.reason}
              </Text>
              {s.voided_at ? <Badge tone="neutral">Anulada</Badge> : null}
              <Text variant="small" tone="muted">
                {formatDate(s.created_at, false)}
              </Text>
            </View>
          ))}
        </Card>
      )}

      <Card style={styles.gap}>
        <Text variant="heading">Liquidaciones</Text>
        {f.payouts.length === 0 ? (
          <Text variant="small" tone="muted">
            Aparecerán aquí cuando la administración las genere.
          </Text>
        ) : (
          f.payouts.map((p) => (
            <View key={p.id} style={styles.payout}>
              <View style={styles.flex}>
                <Text variant="smallMedium">
                  {formatDate(`${p.period_start}T12:00:00`, false)} – {formatDate(`${p.period_end}T12:00:00`, false)}
                </Text>
                <Text variant="small" tone="muted">
                  {p.orders_count} pedidos · bruto {formatMoney(p.gross_minor)} · comisión {formatMoney(p.commission_minor)}
                  {p.adjustments_minor ? ` · ajustes ${formatMoney(p.adjustments_minor)}` : ''}
                </Text>
                {p.status === 'paid' ? <Badge tone="green">Pagado {p.paid_at ? formatDate(p.paid_at, false) : ''}</Badge> : <Badge tone="amber">Pendiente</Badge>}
              </View>
              <Text variant="bodyMedium">{formatMoney(p.net_minor)}</Text>
            </View>
          ))
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 4 },
  gap: { gap: 10 },
  balance: { backgroundColor: colors.catarina, borderColor: colors.catarina, gap: 6 },
  held: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  heldText: { color: 'rgba(255,255,255,0.85)', flex: 1 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  entry: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.muted },
  voided: { textDecorationLine: 'line-through', color: colors.mutedForeground },
  payout: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.muted },
});
