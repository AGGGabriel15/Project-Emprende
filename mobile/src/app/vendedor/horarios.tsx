import { Stack } from 'expo-router';
import { CalendarOff, Plus, Power, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { addClosureWith, deleteClosureWith, saveHoursWith, setOpenOverrideWith } from '@/features/businesses/mutations';
import { DAY_NAMES, formatTime, localNow } from '@/features/businesses/hours';
import { businessOpenState } from '@/features/catalog/meta';
import { formatDate } from '@/lib/format';
import type { BusinessHour } from '@/types/domain';
import { OpenBadge } from '~/components/catalog/catalog-bits';
import { Button, IconButton } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { Skeleton } from '~/components/ui/feedback';
import { Input } from '~/components/ui/input';
import { Screen } from '~/components/ui/screen';
import { Select } from '~/components/ui/select';
import { Text } from '~/components/ui/text';
import { useBusinessHours, useMyBusiness, useVendorAction } from '~/features/vendor/queries';
import { colors, radius } from '~/theme/tokens';

const ORDER = [1, 2, 3, 4, 5, 6, 0];
const TIMES = Array.from({ length: 48 }, (_, i) => {
  const value = `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`;
  return { value, label: formatTime(value) };
});

/** Próximos 180 días para elegir un cierre especial. */
function nextDays() {
  const today = localNow().date;
  return Array.from({ length: 180 }, (_, i) => {
    const d = new Date(`${today}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    const value = d.toISOString().slice(0, 10);
    return { value, label: formatDate(`${value}T12:00:00`, false), detail: DAY_NAMES[d.getUTCDay()] };
  });
}

export default function HoursScreen() {
  const business = useMyBusiness().data!;
  const query = useBusinessHours(business.id);
  return (
    <Screen refreshing={query.isRefetching} onRefresh={() => void query.refetch()}>
      <Stack.Screen options={{ title: 'Horarios' }} />
      <Text variant="small" tone="muted">
        Fuera de horario tu negocio aparece como Cerrado y no recibe pagos. Zona horaria: Managua.
      </Text>
      {query.data ? <HoursEditor hours={query.data.hours} /> : <Skeleton height={300} />}
    </Screen>
  );
}

function HoursEditor({ hours }: { hours: BusinessHour[] }) {
  const business = useMyBusiness().data!;
  const query = useBusinessHours(business.id);
  const save = useVendorAction(saveHoursWith, { success: 'Horario guardado.', invalidate: ['business-hours'] });
  const override = useVendorAction(setOpenOverrideWith, { invalidate: ['my-business', 'business-hours'] });
  const addClosure = useVendorAction(addClosureWith, { success: 'Cierre agregado.', invalidate: ['business-hours'] });
  const removeClosure = useVendorAction(deleteClosureWith, { success: 'Cierre eliminado.', invalidate: ['business-hours'] });
  const [days, setDays] = useState(() =>
    ORDER.map((dow) => {
      const h = hours.find((x) => x.day_of_week === dow);
      return { dayOfWeek: dow, opensAt: (h?.opens_at ?? '08:00').slice(0, 5), closesAt: (h?.closes_at ?? '17:00').slice(0, 5), isClosed: h ? h.is_closed : dow === 0 };
    }),
  );
  const [closure, setClosure] = useState<{ date: string | null; reason: string }>({ date: null, reason: '' });
  const update = (index: number, patch: Partial<(typeof days)[number]>) => setDays((current) => current.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  const closures = query.data?.closures ?? [];
  const state = businessOpenState({ ...business, category: null, business_hours: query.data?.hours ?? [], business_closures: closures });
  const closed = business.is_open_override === false;

  return (
    <>
      <Card style={[styles.gap, closed && styles.closed]}>
        <Text variant="small" tone="muted">
          Estado ahora
        </Text>
        <OpenBadge state={state} />
        {closed ? (
          <Button icon={Power} loading={override.isPending} onPress={() => override.mutate([null])}>
            Reabrir (seguir horario)
          </Button>
        ) : (
          <Button variant="danger" icon={Power} loading={override.isPending} onPress={() => override.mutate([false])}>
            Cerrar ahora
          </Button>
        )}
        <Text variant="small" tone="muted">
          “Cerrar ahora” detiene los pagos de inmediato (por ejemplo, si te quedaste sin personal) hasta que reabras.
        </Text>
      </Card>

      <Card padded={false}>
        <Text variant="heading" style={styles.title}>
          Horario semanal
        </Text>
        {days.map((day, index) => (
          <View key={day.dayOfWeek} style={styles.day}>
            <View style={styles.dayHead}>
              <Text variant="bodyMedium" style={styles.flex}>
                {DAY_NAMES[day.dayOfWeek]}
              </Text>
              {day.isClosed && (
                <Text variant="small" tone="muted">
                  Cerrado
                </Text>
              )}
              <Switch
                value={!day.isClosed}
                onValueChange={(open) => update(index, { isClosed: !open })}
                trackColor={{ true: colors.catarina, false: colors.border }}
                thumbColor={colors.white}
                accessibilityLabel={`Abre el ${DAY_NAMES[day.dayOfWeek]}`}
              />
            </View>
            {!day.isClosed && (
              <View style={styles.times}>
                <View style={styles.flex}>
                  <Select value={day.opensAt} options={TIMES} onChange={(opensAt) => update(index, { opensAt })} label="Abre" />
                </View>
                <View style={styles.flex}>
                  <Select value={day.closesAt} options={TIMES} onChange={(closesAt) => update(index, { closesAt })} label="Cierra" />
                </View>
              </View>
            )}
          </View>
        ))}
        <View style={styles.footer}>
          <Button loading={save.isPending} onPress={() => save.mutate([days])} block>
            Guardar horario
          </Button>
          <Button
            variant="outline"
            block
            onPress={() => {
              const monday = days[0]!;
              setDays((current) => current.map((d) => (d.dayOfWeek >= 1 && d.dayOfWeek <= 5 ? { ...monday, dayOfWeek: d.dayOfWeek } : d)));
            }}
          >
            Copiar lunes a días hábiles
          </Button>
        </View>
      </Card>

      <Card style={styles.gap}>
        <Text variant="heading">Cierres especiales</Text>
        <Text variant="small" tone="muted">
          Feriados, vacaciones o días sin atención.
        </Text>
        <Select label="Fecha" value={closure.date} options={nextDays()} onChange={(date) => setClosure((c) => ({ ...c, date }))} />
        <Input label="Motivo" value={closure.reason} onChangeText={(reason) => setClosure((c) => ({ ...c, reason }))} placeholder="p. ej. Semana Santa" />
        <Button
          variant="secondary"
          icon={Plus}
          loading={addClosure.isPending}
          disabled={!closure.date}
          onPress={() => addClosure.mutate([closure], { onSuccess: () => setClosure({ date: null, reason: '' }) })}
        >
          Agregar cierre
        </Button>
        {closures.length === 0 ? (
          <View style={styles.inline}>
            <CalendarOff size={16} color={colors.mutedForeground} />
            <Text variant="small" tone="muted">
              Sin cierres programados.
            </Text>
          </View>
        ) : (
          closures.map((c) => (
            <View key={c.id} style={styles.closure}>
              <View style={styles.flex}>
                <Text variant="bodyMedium">{formatDate(`${c.date}T12:00:00`, false)}</Text>
                <Text variant="small" tone="muted">
                  {c.reason}
                </Text>
              </View>
              <IconButton icon={Trash2} label="Eliminar cierre" onPress={() => removeClosure.mutate([c.id])} />
            </View>
          ))
        )}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gap: { gap: 10 },
  closed: { backgroundColor: colors.dangerSoft, borderColor: '#F2C4C1' },
  title: { padding: 16, paddingBottom: 4 },
  day: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.muted, gap: 8 },
  dayHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  times: { flexDirection: 'row', gap: 10 },
  footer: { padding: 16, gap: 10 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  closure: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: radius.md, backgroundColor: colors.muted, paddingLeft: 12 },
});
