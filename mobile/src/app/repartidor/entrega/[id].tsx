import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  Camera,
  CheckCircle2,
  KeyRound,
  MapPin,
  MapPinned,
  MessageCircle,
  Navigation,
  PackageCheck,
  PackageX,
  Phone,
  RefreshCw,
  Star,
  Store,
  TriangleAlert,
  Undo2,
  UserRound,
  type LucideIcon,
} from 'lucide-react-native';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { courierStage, SHIPMENT_STATUS, type CourierStage } from '@/features/couriers/status';
import { mapsSearchUrl, mapsUrl } from '@/lib/maps';
import { formatPhone, phoneHref, whatsappHref } from '@/lib/phone';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { EmptyState, Skeleton } from '~/components/ui/feedback';
import { Input } from '~/components/ui/input';
import { Screen } from '~/components/ui/screen';
import { Sheet } from '~/components/ui/sheet';
import { badgeTone } from '~/components/ui/status';
import { Text } from '~/components/ui/text';
import { toast } from '~/components/ui/toast';
import { useCourierStep, useDelivery, type StepKind } from '~/features/couriers/queries';
import { useRealtimeRefresh } from '~/lib/realtime';
import { pickImage } from '~/lib/upload';
import { colors, fonts, radius } from '~/theme/tokens';

type DialogKind = 'pickup' | 'reject' | 'deliver' | 'fail' | 'release';

const COPY: Record<DialogKind, { title: string; description: string; confirm: string; photo: boolean; pin?: boolean; notes?: string }> = {
  pickup: {
    title: 'Recoger el pedido',
    description: 'Revisa que el paquete coincida con la foto del negocio y toma una foto al recibirlo.',
    confirm: 'Recogí el pedido',
    photo: true,
    notes: 'Observaciones (opcional)',
  },
  reject: {
    title: 'Rechazar el pedido',
    description: 'Úsalo si el producto no coincide con la publicación o viene dañado. Se le devuelve el dinero al cliente.',
    confirm: 'Rechazar',
    photo: true,
    notes: '¿Qué está mal? (obligatorio)',
  },
  deliver: {
    title: 'Confirmar entrega',
    description: 'Pídele al cliente su PIN de 4 dígitos después de que reciba y revise el pedido. Toma una foto de la entrega.',
    confirm: 'Entregado',
    photo: true,
    pin: true,
  },
  fail: {
    title: 'No se pudo entregar',
    description: 'Antes, llama al cliente y espera unos minutos. Al segundo intento fallido el pedido vuelve al negocio.',
    confirm: 'Registrar intento',
    photo: false,
    notes: '¿Qué pasó? (cliente ausente, dirección incorrecta…)',
  },
  release: {
    title: 'Soltar el pedido',
    description: 'Vuelve a la lista de disponibles para otro repartidor. Solo antes de recogerlo.',
    confirm: 'Soltar',
    photo: false,
    notes: '¿Por qué lo sueltas?',
  },
};

export default function DeliveryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useDelivery(id);
  useRealtimeRefresh('shipments', `id=eq.${id}`, ['delivery', id]);
  const view = query.data;

  if (query.isLoading) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Entrega' }} />
        <Skeleton height={120} />
        <Skeleton height={180} />
      </Screen>
    );
  }
  if (!view) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Entrega' }} />
        <EmptyState icon={PackageX} title="Entrega no encontrada" />
      </Screen>
    );
  }

  const { shipment, order, business, customer } = view;
  const stage = courierStage(shipment.status);
  const [label, tone] = SHIPMENT_STATUS[shipment.status];
  const toBusiness = stage === 'to_pickup' || stage === 'at_pickup';
  const toCustomer = stage === 'to_dropoff' || stage === 'at_dropoff';
  const fullAddress = [customer.address_line, order.municipality, order.department].filter(Boolean).join(', ');
  const greeting = `Hola ${customer.name.split(' ')[0]}, soy ${shipment.courier_name?.split(' ')[0]}, tu repartidor de Catarina Market (pedido ${order.order_number}).`;
  const businessMap =
    business.latitude != null && business.longitude != null
      ? mapsUrl(business.latitude, business.longitude)
      : mapsSearchUrl(`${business.address_line ?? business.trade_name}, ${business.municipality ?? ''}, Nicaragua`);

  return (
    <Screen refreshing={query.isRefetching} onRefresh={() => void query.refetch()}>
      <Stack.Screen options={{ title: order.order_number }} />
      <View style={styles.inline}>
        <Badge tone={badgeTone(tone)}>{label}</Badge>
        {shipment.attempts > 0 && (
          <Text variant="small" tone="danger">
            {shipment.attempts} intento(s) fallido(s)
          </Text>
        )}
      </View>

      <Card style={[styles.gap, toBusiness && styles.focus]}>
        <View style={styles.inline}>
          <Store size={18} color={colors.catarina} />
          <Text variant="heading" style={styles.flex}>
            1 · Recoger en {business.trade_name}
          </Text>
        </View>
        <Line icon={MapPin} text={`${business.address_line ?? ''}${business.municipality ? `, ${business.municipality}` : ''}`} />
        {view.active && (
          <View style={styles.actions}>
            {business.phone && <Contact icon={Phone} label="Llamar" onPress={() => Linking.openURL(phoneHref(business.phone!))} />}
            {business.whatsapp && <Contact icon={MessageCircle} label="WhatsApp" onPress={() => Linking.openURL(whatsappHref(business.whatsapp!))} />}
            <Contact icon={Navigation} label="Cómo llegar" onPress={() => Linking.openURL(businessMap)} />
          </View>
        )}
      </Card>

      <Card style={styles.gap}>
        <Text variant="heading">Qué debes recibir</Text>
        {order.items.map((item) => (
          <Text key={item.name} variant="body">
            <Text variant="bodyMedium">{item.quantity}×</Text> {item.name}
          </Text>
        ))}
        {view.readyPhoto && (
          <>
            <Image source={view.readyPhoto} style={styles.readyPhoto} contentFit="cover" />
            <Text variant="small" tone="muted">
              Foto del negocio al empacar: compárala al recoger.
            </Text>
          </>
        )}
      </Card>

      <Card style={[styles.gap, toCustomer && styles.focus]}>
        <View style={styles.inline}>
          <UserRound size={18} color={colors.catarina} />
          <Text variant="heading" style={styles.flex}>
            2 · Entregar a {customer.name}
          </Text>
        </View>
        <Line icon={MapPin} text={view.active ? fullAddress : `${order.municipality ?? ''}, ${order.department ?? ''}`} />
        {customer.note ? (
          <View style={styles.note}>
            <Text variant="small">Nota del cliente: {customer.note}</Text>
          </View>
        ) : null}
        {view.active && customer.phone ? (
          <View style={styles.actions}>
            <Contact icon={Phone} label={formatPhone(customer.phone)} onPress={() => Linking.openURL(phoneHref(customer.phone!))} />
            <Contact icon={MessageCircle} label="WhatsApp" onPress={() => Linking.openURL(whatsappHref(customer.phone!, greeting))} />
            <Contact icon={Navigation} label="Cómo llegar" onPress={() => Linking.openURL(mapsSearchUrl(`${fullAddress}, Nicaragua`))} />
          </View>
        ) : null}
        {!view.active && (
          <Text variant="small" tone="muted">
            Los datos de contacto se ocultan al terminar la entrega.
          </Text>
        )}
      </Card>

      {view.rating && (
        <Card style={styles.gap}>
          <View style={styles.inline}>
            <Star size={18} color="#E3A008" fill="#E3A008" />
            <Text variant="bodyMedium">El cliente te calificó con {view.rating.rating} de 5</Text>
          </View>
          {view.rating.tags.length > 0 && (
            <Text variant="small" tone="muted">
              {view.rating.tags.join(' · ')}
            </Text>
          )}
          {view.rating.comment ? <Text variant="small">“{view.rating.comment}”</Text> : null}
        </Card>
      )}

      <StepButtons shipmentId={shipment.id} orderId={order.id} stage={stage} />
      {stage === 'at_dropoff' && (
        <Text variant="small" tone="muted" style={styles.center}>
          El cliente ve su PIN en su pedido. Pídeselo después de que revise el paquete.
        </Text>
      )}
    </Screen>
  );
}

function Line({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <View style={styles.line}>
      <Icon size={16} color={colors.mutedForeground} />
      <Text variant="small" tone="muted" style={styles.flex}>
        {text}
      </Text>
    </View>
  );
}

function Contact({ icon, label, onPress }: { icon: LucideIcon; label: string; onPress: () => void }) {
  return (
    <Button size="sm" variant="secondary" icon={icon} onPress={onPress}>
      {label}
    </Button>
  );
}

/** Botones grandes de cada paso; los que piden evidencia abren un panel. */
function StepButtons({ shipmentId, orderId, stage }: { shipmentId: string; orderId: string; stage: CourierStage }) {
  const router = useRouter();
  const step = useCourierStep(shipmentId, orderId);
  const [dialog, setDialog] = useState<DialogKind | null>(null);

  if (stage === 'done') {
    return (
      <Animated.View entering={FadeIn} style={styles.done}>
        <CheckCircle2 size={22} color={colors.catarina} />
        <Text variant="bodyMedium">Esta entrega ya terminó. ¡Gracias!</Text>
      </Animated.View>
    );
  }

  const arrive = (kind: StepKind, message: string) =>
    step.mutate({ kind }, { onSuccess: () => toast.success(message), onError: (e) => toast.error(e.message) });

  return (
    <View style={styles.gap}>
      {stage === 'to_pickup' && (
        <Button size="lg" icon={MapPinned} loading={step.isPending} onPress={() => arrive('arrive_pickup', 'Le avisamos al negocio que llegaste.')}>
          Llegué al negocio
        </Button>
      )}
      {stage === 'at_pickup' && (
        <>
          <Button size="lg" icon={PackageCheck} onPress={() => setDialog('pickup')}>
            Recogí el pedido
          </Button>
          <Button size="lg" variant="outline" icon={PackageX} onPress={() => setDialog('reject')}>
            No coincide / viene dañado
          </Button>
        </>
      )}
      {stage === 'to_dropoff' && (
        <Button size="lg" icon={MapPinned} loading={step.isPending} onPress={() => arrive('arrive_dropoff', 'Le avisamos al cliente que llegaste.')}>
          Llegué donde el cliente
        </Button>
      )}
      {stage === 'at_dropoff' && (
        <Button size="lg" icon={KeyRound} onPress={() => setDialog('deliver')}>
          Entregar con PIN
        </Button>
      )}
      {(stage === 'to_dropoff' || stage === 'at_dropoff') && (
        <Button size="lg" variant="outline" icon={TriangleAlert} onPress={() => setDialog('fail')}>
          No pude entregar
        </Button>
      )}
      {(stage === 'to_pickup' || stage === 'at_pickup') && (
        <Button variant="ghost" icon={Undo2} onPress={() => setDialog('release')}>
          Soltar el pedido
        </Button>
      )}
      {dialog && (
        <StepSheet
          kind={dialog}
          pending={step.isPending}
          onClose={() => setDialog(null)}
          onSubmit={(values) =>
            step.mutate(
              { kind: dialog, ...values },
              {
                onSuccess: () => {
                  toast.success(dialog === 'deliver' ? '¡Entregado!' : dialog === 'release' ? 'Pedido liberado.' : 'Registrado.');
                  setDialog(null);
                  if (dialog === 'release') router.replace('/repartidor');
                },
                onError: (e) => toast.error(e.message),
              },
            )
          }
        />
      )}
    </View>
  );
}

function StepSheet({
  kind,
  pending,
  onClose,
  onSubmit,
}: {
  kind: DialogKind;
  pending: boolean;
  onClose: () => void;
  onSubmit: (values: { photo?: string | null; notes?: string; pin?: string }) => void;
}) {
  const copy = COPY[kind];
  const [photo, setPhoto] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [pin, setPin] = useState('');
  const ready = (!copy.photo || photo) && (!copy.pin || pin.length === 4) && (kind === 'pickup' || !copy.notes || notes.trim().length >= 5);

  async function takePhoto() {
    const { uri, error } = await pickImage('camera');
    if (error) return toast.error(error);
    if (uri) setPhoto(uri);
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={copy.title}
      description={copy.description}
      footer={
        <>
          <Button variant="outline" onPress={onClose} style={styles.flex} block>
            Volver
          </Button>
          <Button
            variant={kind === 'reject' ? 'danger' : 'primary'}
            onPress={() => onSubmit({ photo, notes, pin })}
            loading={pending}
            disabled={!ready}
            style={styles.flex}
            block
          >
            {copy.confirm}
          </Button>
        </>
      }
    >
      {copy.photo && (
        <Pressable onPress={takePhoto} style={styles.photo} accessibilityLabel="Tomar foto">
          {photo ? (
            <>
              <Image source={photo} style={StyleSheet.absoluteFill} contentFit="cover" />
              <View style={styles.retake}>
                <RefreshCw size={14} color={colors.white} />
                <Text variant="small" tone="white">
                  Repetir
                </Text>
              </View>
            </>
          ) : (
            <>
              <Camera size={28} color={colors.catarina} />
              <Text variant="smallMedium" tone="primary">
                Tomar foto
              </Text>
            </>
          )}
        </Pressable>
      )}
      {copy.pin && (
        <View style={styles.gap}>
          <Text variant="smallMedium">PIN del cliente</Text>
          <TextInput
            value={pin}
            onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, 4))}
            keyboardType="number-pad"
            maxLength={4}
            placeholder="• • • •"
            placeholderTextColor={colors.input}
            style={styles.pin}
            accessibilityLabel="PIN del cliente"
          />
        </View>
      )}
      {copy.notes && <Input label={copy.notes} multiline value={notes} onChangeText={setNotes} maxLength={300} />}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gap: { gap: 10 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  focus: { borderColor: colors.catarina, borderWidth: 2 },
  line: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  note: { borderRadius: radius.md, backgroundColor: colors.warningSoft, padding: 10 },
  readyPhoto: { width: '100%', aspectRatio: 16 / 9, borderRadius: radius.md, backgroundColor: colors.muted },
  center: { textAlign: 'center' },
  done: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, borderRadius: radius.lg, backgroundColor: colors.niebla },
  photo: {
    height: 180,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.hojaClara,
    backgroundColor: colors.niebla,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    overflow: 'hidden',
  },
  retake: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(14,59,39,0.7)',
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pin: {
    height: 64,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.brote,
    textAlign: 'center',
    fontFamily: fonts.display,
    fontSize: 32,
    letterSpacing: 16,
    color: colors.foreground,
  },
});
