import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Bike, Check, CircleAlert, Lock, MapPin, Plus, ShoppingBag, Store } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import type { Quote } from '@/features/checkout/types';
import { groupByBusiness, useCart } from '@/features/cart/store';
import { formatMoney } from '@/lib/format';
import { formatPhone } from '@/lib/phone';
import { checkoutSchema } from '@/lib/validations/checkout';
import { AddressSheet } from '~/components/account/address-sheet';
import { Button } from '~/components/ui/button';
import { Card, Divider, InfoRow } from '~/components/ui/card';
import { EmptyState, Skeleton } from '~/components/ui/feedback';
import { Input } from '~/components/ui/input';
import { PhoneInput } from '~/components/ui/phone-input';
import { Screen } from '~/components/ui/screen';
import { Text } from '~/components/ui/text';
import { toast } from '~/components/ui/toast';
import { useAddresses } from '~/features/account/addresses';
import { useSession } from '~/features/auth/session';
import { openPayment } from '~/features/checkout/payment';
import { api, appReturnBase } from '~/lib/api';
import { fieldErrors } from '~/lib/forms';
import { supabase } from '~/lib/supabase';
import { colors, radius } from '~/theme/tokens';

export default function CheckoutScreen() {
  const { businessId } = useLocalSearchParams<{ businessId: string }>();
  const router = useRouter();
  const { profile } = useSession();
  const items = useCart((s) => s.items);
  const removeProducts = useCart((s) => s.removeProducts);
  const group = groupByBusiness(items).find((g) => g.businessId === businessId);
  const addresses = useAddresses();
  const business = useQuery({
    queryKey: ['checkout-business', businessId],
    queryFn: async () => {
      const { data } = await supabase.from('businesses').select('id, trade_name, accepts_pickup').eq('id', businessId).maybeSingle();
      return data as { id: string; trade_name: string; accepts_pickup: boolean } | null;
    },
  });

  const [service, setService] = useState<'delivery' | 'pickup'>('delivery');
  const [chosenAddress, setChosenAddress] = useState<string | null>(null);
  const [contact, setContact] = useState({ name: profile?.full_name ?? '', phone: formatPhone(profile?.phone) });
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [addressSheet, setAddressSheet] = useState(0);
  const [paying, setPaying] = useState(false);

  const addressId = chosenAddress ?? addresses.data?.find((a) => a.is_default)?.id ?? addresses.data?.[0]?.id ?? null;
  const lines = (group?.items ?? []).map((i) => ({ productId: i.productId, quantity: i.quantity, note: i.note }));
  const clientPrices = Object.fromEntries((group?.items ?? []).map((i) => [i.productId, i.priceMinor]));

  const quote = useQuery({
    queryKey: ['quote', businessId, service, addressId, lines],
    enabled: lines.length > 0,
    queryFn: async () => {
      const result = await api<Quote>('checkout/quote', {
        input: { businessId, serviceType: service, addressId: service === 'delivery' ? (addressId ?? undefined) : undefined, items: lines },
        clientPrices,
      });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });

  if (!group) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Pagar pedido' }} />
        <EmptyState
          icon={ShoppingBag}
          title="No hay productos de este negocio en tu carrito"
          action={<Button onPress={() => router.replace('/carrito')}>Ver carrito</Button>}
        />
      </Screen>
    );
  }

  const q = quote.data;
  const blocked = !q || !q.open || q.lines.some((l) => !l.available) || (service === 'delivery' && !q.canDeliver);

  async function pay() {
    const input = {
      businessId,
      serviceType: service,
      addressId: service === 'delivery' ? (addressId ?? undefined) : undefined,
      items: lines,
      contactName: contact.name,
      contactPhone: contact.phone,
      note: note.trim() || undefined,
    };
    const parsed = checkoutSchema.safeParse(input);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return toast.error(parsed.error.issues[0]!.message);
    }
    setErrors({});
    setPaying(true);
    const result = await api<{ orderId: string; url: string }>('checkout', { input, app: appReturnBase() });
    if (!result.ok) {
      setPaying(false);
      // El pedido se creó pero falló Stripe: se reintenta desde el pedido.
      if (result.error.startsWith('El pedido se creó')) {
        removeProducts(group!.items.map((i) => i.productId));
        router.replace('/pedidos');
      }
      return toast.error(result.error);
    }
    removeProducts(group!.items.map((i) => i.productId));
    await openPayment(router, result.data.orderId, result.data.url);
    setPaying(false);
  }

  return (
    <Screen
      footer={
        <View style={styles.footer}>
          <View style={styles.flex}>
            <Text variant="small" tone="muted">
              Total
            </Text>
            <Text variant="title">{q ? formatMoney(q.total) : '—'}</Text>
          </View>
          <Button icon={Lock} onPress={pay} loading={paying} disabled={blocked || quote.isFetching} size="lg">
            Pagar
          </Button>
        </View>
      }
    >
      <Stack.Screen options={{ title: `Pedido a ${group.businessName}` }} />

      <Card style={styles.gap}>
        <Text variant="heading">¿Cómo lo recibes?</Text>
        <Option
          active={service === 'delivery'}
          icon={Bike}
          title="Delivery Catarina Market"
          text={q && service === 'delivery' && q.canDeliver ? `${formatMoney(q.deliveryFee)}${q.estimatedDays != null ? ` · ${q.estimatedDays === 0 ? 'el mismo día' : `${q.estimatedDays} día(s)`}` : ''}` : 'Te lo lleva un repartidor de Catarina Market'}
          onPress={() => setService('delivery')}
        />
        {business.data?.accepts_pickup && (
          <Option active={service === 'pickup'} icon={Store} title="Retiro en el negocio" text="Sin costo de envío" onPress={() => setService('pickup')} />
        )}
      </Card>

      {service === 'delivery' && (
        <Card style={styles.gap}>
          <View style={styles.row}>
            <Text variant="heading" style={styles.flex}>
              Dirección de entrega
            </Text>
            <Button size="sm" variant="secondary" icon={Plus} onPress={() => setAddressSheet((n) => n + 1)}>
              Nueva
            </Button>
          </View>
          {addresses.isLoading ? (
            <Skeleton height={60} />
          ) : addresses.data?.length ? (
            addresses.data.map((a) => (
              <Option
                key={a.id}
                active={addressId === a.id}
                icon={MapPin}
                title={a.label}
                text={`${a.address_line} · ${a.recipient_name}`}
                onPress={() => setChosenAddress(a.id)}
              />
            ))
          ) : (
            <Text variant="small" tone="muted">
              Agrega una dirección para el delivery.
            </Text>
          )}
          {errors.addressId && (
            <Text variant="small" tone="danger">
              {errors.addressId}
            </Text>
          )}
        </Card>
      )}

      <Card style={styles.gap}>
        <Text variant="heading">Contacto</Text>
        <Input label="Nombre" value={contact.name} onChangeText={(name) => setContact((c) => ({ ...c, name }))} error={errors.contactName} />
        <PhoneInput value={contact.phone} onChange={(phone) => setContact((c) => ({ ...c, phone }))} error={errors.contactPhone} />
        <Input label="Nota para el negocio (opcional)" multiline value={note} onChangeText={setNote} maxLength={300} />
      </Card>

      <Card style={styles.gap}>
        <Text variant="heading">Resumen</Text>
        {quote.isLoading ? (
          <Skeleton height={90} />
        ) : quote.isError ? (
          <Text variant="small" tone="danger">
            {quote.error.message}
          </Text>
        ) : q ? (
          <Animated.View entering={FadeIn} style={styles.gap}>
            {q.lines.map((l) => (
              <View key={l.productId} style={styles.row}>
                <Text variant="small" style={styles.flex} numberOfLines={2}>
                  {l.quantity} × {l.name}
                  {l.issue ? <Text variant="small" tone="danger">{`  · ${l.issue}`}</Text> : null}
                </Text>
                <Text variant="small">{formatMoney(l.unitPrice * l.quantity)}</Text>
              </View>
            ))}
            <Divider />
            <InfoRow label="Subtotal" value={formatMoney(q.subtotal)} />
            {service === 'delivery' && <InfoRow label="Delivery" value={q.canDeliver ? formatMoney(q.deliveryFee) : '—'} />}
            <InfoRow label="Tarifa de servicio" value={formatMoney(q.serviceFee)} />
            <InfoRow label="Total" value={formatMoney(q.total)} strong />
            {q.issues.map((issue) => (
              <View key={issue} style={styles.issue}>
                <CircleAlert size={16} color={colors.warning} />
                <Text variant="small" tone="warning" style={styles.flex}>
                  {issue}
                </Text>
              </View>
            ))}
          </Animated.View>
        ) : null}
        <Text variant="small" tone="muted">
          Pagas con tarjeta en Stripe. Al confirmarse el pago, el negocio prepara tu pedido; lo recibes con un PIN de 4 dígitos.
        </Text>
      </Card>

      {addressSheet > 0 && (
        <AddressSheet
          key={addressSheet}
          open
          onClose={() => setAddressSheet(0)}
          onSaved={(a) => setChosenAddress(a.id)}
        />
      )}
    </Screen>
  );
}

function Option({
  active,
  icon: Icon,
  title,
  text,
  onPress,
}: {
  active: boolean;
  icon: typeof Bike;
  title: string;
  text: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.option, active && styles.optionActive]} accessibilityState={{ selected: active }}>
      <Icon size={20} color={active ? colors.catarina : colors.mutedForeground} />
      <View style={styles.flex}>
        <Text variant="bodyMedium">{title}</Text>
        <Text variant="small" tone="muted" numberOfLines={2}>
          {text}
        </Text>
      </View>
      <View style={[styles.radio, active && styles.radioActive]}>{active && <Check size={13} color={colors.white} strokeWidth={3} />}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  gap: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flex: { flex: 1 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionActive: { borderColor: colors.catarina, backgroundColor: colors.niebla },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: colors.input, alignItems: 'center', justifyContent: 'center' },
  radioActive: { backgroundColor: colors.catarina, borderColor: colors.catarina },
  issue: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
});
