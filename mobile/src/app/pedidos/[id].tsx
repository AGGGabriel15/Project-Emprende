import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Bike, MapPin, MessageCircle, Package, Phone, ShieldCheck, Store } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { CUSTOMER_COURIER_STEP, VEHICLE_LABEL } from '@/features/couriers/status';
import { CLAIM_REASONS, SERVICE_LABEL } from '@/features/orders/status';
import { formatDate, formatMoney } from '@/lib/format';
import { formatPhone, phoneHref, whatsappHref } from '@/lib/phone';
import { ClaimSheet, DeliveryRatingForm, ReviewForm } from '~/components/orders/order-forms';
import { EvidenceGallery, OrderStatusBadge, OrderTimeline, PinCard } from '~/components/orders/order-bits';
import { Button } from '~/components/ui/button';
import { Card, Divider, InfoRow } from '~/components/ui/card';
import { Avatar, EmptyState, Skeleton, Stars } from '~/components/ui/feedback';
import { Screen } from '~/components/ui/screen';
import { Text } from '~/components/ui/text';
import { toast } from '~/components/ui/toast';
import { resumePayment } from '~/features/checkout/payment';
import { useEvidence, useOrderDetail } from '~/features/orders/queries';
import { api } from '~/lib/api';
import { useRealtimeRefresh } from '~/lib/realtime';
import { nowMs } from '~/lib/time';
import { colors, radius } from '~/theme/tokens';

export default function OrderScreen() {
  const { id, pago } = useLocalSearchParams<{ id: string; pago?: string }>();
  const router = useRouter();
  const query = useOrderDetail(id);
  const [claimOpen, setClaimOpen] = useState(false);
  const [paying, setPaying] = useState(false);
  const data = query.data;
  const order = data?.order;
  const evidence = useEvidence(id, !!order && (!!order.ready_photo_path || !!order.shipment || order.claims.length > 0));

  useRealtimeRefresh('orders', `id=eq.${id}`, ['order', id]);
  useRealtimeRefresh('shipments', order?.service_type === 'delivery' ? `order_id=eq.${id}` : null, ['order', id]);

  // Al volver de Stripe: acredita el pago si el webhook aún no llegó.
  const { refetch } = query;
  useEffect(() => {
    if (!pago || pago === 'cancelado') {
      if (pago === 'cancelado') toast.error('El pago no se completó. Puedes reintentarlo.');
      return;
    }
    api<{ outcome: string | null }>(`orders/${id}/sync`).then((result) => {
      refetch();
      if (result.ok && (result.data.outcome === 'confirmed' || result.data.outcome === 'already')) toast.success('¡Pago confirmado! El negocio ya prepara tu pedido.');
    });
  }, [pago, id, refetch]);

  const header = <Stack.Screen options={{ title: order ? `Pedido ${order.order_number}` : 'Pedido' }} />;
  if (query.isLoading) {
    return (
      <Screen>
        {header}
        <Skeleton height={120} />
        <Skeleton height={260} />
      </Screen>
    );
  }
  if (!data || !order) {
    return (
      <Screen>
        {header}
        <EmptyState icon={Package} title="Pedido no encontrado" action={<Button onPress={() => router.replace('/pedidos')}>Mis pedidos</Button>} />
      </Screen>
    );
  }

  const { pin, courier, claimHours, deliveryRating } = data;
  const delivery = order.service_type === 'delivery';
  const address = order.address_snapshot;
  const courierArrived = courier?.status === 'at_dropoff';
  const claimDeadline = order.delivered_at ? new Date(new Date(order.delivered_at).getTime() + claimHours * 3_600_000) : null;
  const canClaim = order.status === 'delivered' && !!claimDeadline && claimDeadline.getTime() > nowMs() && !order.claims.some((c) => c.status === 'open');
  const canRateCourier = courier?.status === 'delivered' && !deliveryRating && ['delivered', 'disputed', 'completed'].includes(order.status);
  const urls = evidence.data ?? {};

  return (
    <Screen refreshing={query.isRefetching} onRefresh={query.refetch}>
      {header}
      <View style={styles.title}>
        <View style={styles.flex}>
          <Text variant="small" tone="muted">
            {formatDate(order.created_at)} · {SERVICE_LABEL[order.service_type]}
          </Text>
        </View>
        <OrderStatusBadge status={order.status} />
      </View>

      {order.status === 'pending_payment' && (
        <Card style={[styles.gap, styles.warning]}>
          <Text variant="body">Falta confirmar el pago. El pedido vence {order.expires_at ? formatDate(order.expires_at) : 'pronto'}.</Text>
          <Button
            loading={paying}
            onPress={async () => {
              setPaying(true);
              const error = await resumePayment(router, order.id);
              setPaying(false);
              if (error) toast.error(error);
            }}
          >
            Pagar ahora
          </Button>
        </Card>
      )}

      {pin && <PinCard pin={pin} arrived={courierArrived} delivery={delivery} />}

      {delivery && ['ready', 'on_the_way'].includes(order.status) && (
        <Card style={styles.gap}>
          <View style={styles.row}>
            <Bike size={18} color={colors.catarina} />
            <Text variant="heading">Tu repartidor</Text>
          </View>
          {courier ? (
            <>
              <View style={styles.row}>
                <Avatar uri={courier.avatar_url} name={courier.name} size={48} />
                <View style={styles.flex}>
                  <Text variant="bodyMedium">{courier.name}</Text>
                  <Text variant="small" tone="muted">
                    {courier.vehicle ? VEHICLE_LABEL[courier.vehicle] : ''}
                    {courier.plate ? ` · ${courier.plate}` : ''}
                    {courier.rating_count ? ` · ★ ${Number(courier.rating_avg).toFixed(1)}` : ''}
                  </Text>
                </View>
              </View>
              <View style={[styles.step, courierArrived && styles.stepArrived]}>
                <Text variant="smallMedium" tone={courierArrived ? 'white' : 'default'}>
                  {CUSTOMER_COURIER_STEP[courier.status]}
                </Text>
              </View>
              {courier.phone && (
                <View style={styles.row}>
                  <Button size="sm" variant="secondary" icon={Phone} onPress={() => Linking.openURL(phoneHref(courier.phone!))}>
                    Llamar
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={MessageCircle}
                    onPress={() => Linking.openURL(whatsappHref(courier.phone!, `Hola, soy quien recibe el pedido ${order.order_number}.`))}
                  >
                    WhatsApp
                  </Button>
                </View>
              )}
            </>
          ) : (
            <Text variant="small" tone="muted">
              {CUSTOMER_COURIER_STEP.available}
            </Text>
          )}
        </Card>
      )}

      <Card>
        <Text variant="heading" style={styles.cardTitle}>
          Seguimiento
        </Text>
        <OrderTimeline status={order.status} service={order.service_type} history={order.history} />
        {order.refunds.map((refund) => (
          <View key={refund.created_at} style={styles.refund}>
            <Text variant="small">
              Reembolso de {formatMoney(refund.amount_minor)}:{' '}
              {refund.status === 'processed' ? `procesado el ${formatDate(refund.processed_at ?? refund.created_at)}` : 'en proceso (puede tardar unos días en tu tarjeta)'}
            </Text>
            <Text variant="small" tone="muted">
              {refund.reason}
            </Text>
          </View>
        ))}
      </Card>

      <Card style={styles.gap}>
        <Text variant="heading">Productos</Text>
        {order.items.map((item) => (
          <Pressable key={item.id} disabled={!item.product_id} onPress={() => router.push(`/productos/${item.product_id}`)} style={styles.item}>
            <View style={styles.thumb}>{item.image_url ? <Image source={item.image_url} style={StyleSheet.absoluteFill} /> : null}</View>
            <View style={styles.flex}>
              <Text variant="bodyMedium" numberOfLines={2}>
                {item.product_name}
              </Text>
              <Text variant="small" tone="muted">
                {item.quantity} × {formatMoney(item.unit_price_minor)}
              </Text>
              {item.note ? (
                <Text variant="small" tone="muted">
                  Nota: {item.note}
                </Text>
              ) : null}
            </View>
            <Text variant="bodyMedium">{formatMoney(item.subtotal_minor)}</Text>
          </Pressable>
        ))}
        <Divider />
        <InfoRow label="Subtotal" value={formatMoney(order.subtotal_minor)} />
        {delivery && <InfoRow label="Delivery" value={formatMoney(order.delivery_fee_minor)} />}
        {order.service_fee_minor > 0 && <InfoRow label="Tarifa de servicio" value={formatMoney(order.service_fee_minor)} />}
        <InfoRow label="Total" value={formatMoney(order.total_minor)} strong />
      </Card>

      {Object.keys(urls).length > 0 && (
        <Card style={styles.gap}>
          <Text variant="heading">Evidencia del pedido</Text>
          <Text variant="small" tone="muted">
            Fotos tomadas en cada paso. Se usan para resolver cualquier reclamo.
          </Text>
          <EvidenceGallery
            items={[
              { label: 'Empacado por el negocio', url: urls[order.ready_photo_path ?? ''], at: order.ready_at },
              { label: 'Recogido por el repartidor', url: urls[order.shipment?.pickup_photo_path ?? ''], at: order.shipment?.picked_up_at },
              { label: 'Entregado', url: urls[order.shipment?.delivery_photo_path ?? ''], at: order.shipment?.delivered_at },
            ]}
          />
        </Card>
      )}

      {(canClaim || order.claims.length > 0) && (
        <Card style={styles.gap}>
          <Text variant="heading">¿Algún problema?</Text>
          {order.claims.map((claim) => (
            <View key={claim.id} style={styles.claim}>
              <Text variant="bodyMedium">
                {CLAIM_REASONS[claim.reason]} · {claim.status === 'open' ? 'En revisión' : claim.status === 'approved' ? 'Aprobado' : 'Rechazado'}
              </Text>
              <Text variant="small" tone="muted">
                {claim.description}
              </Text>
              {claim.resolution_note ? <Text variant="small">Respuesta: {claim.resolution_note}</Text> : null}
              {claim.refund_minor ? <Text variant="small">Reembolso: {formatMoney(claim.refund_minor)}</Text> : null}
              <EvidenceGallery items={claim.photo_paths.map((path, i) => ({ label: `Tu foto ${i + 1}`, url: urls[path] }))} />
            </View>
          ))}
          {canClaim && claimDeadline && (
            <>
              <Button variant="outline" onPress={() => setClaimOpen(true)}>
                Reportar un problema
              </Button>
              <ClaimSheet orderId={order.id} deadline={formatDate(claimDeadline.toISOString())} open={claimOpen} onClose={() => setClaimOpen(false)} />
            </>
          )}
        </Card>
      )}

      {(canRateCourier || deliveryRating) && courier && (
        <Card style={styles.gap}>
          <Text variant="heading">Tu repartidor</Text>
          {deliveryRating ? (
            <>
              <Stars value={deliveryRating.rating} />
              {deliveryRating.tags.length > 0 && (
                <Text variant="small" tone="muted">
                  {deliveryRating.tags.join(' · ')}
                </Text>
              )}
              {deliveryRating.comment ? <Text variant="small">{deliveryRating.comment}</Text> : null}
            </>
          ) : (
            <DeliveryRatingForm orderId={order.id} courierName={courier.name} />
          )}
        </Card>
      )}

      {order.status === 'completed' && (
        <Card style={styles.gap}>
          <Text variant="heading">Tu reseña</Text>
          {order.review ? (
            <>
              <Stars value={order.review.rating} />
              {order.review.comment ? <Text variant="small">{order.review.comment}</Text> : null}
            </>
          ) : (
            <ReviewForm orderId={order.id} businessName={order.business.trade_name} />
          )}
        </Card>
      )}

      <Card style={styles.gap}>
        <View style={styles.row}>
          <MapPin size={18} color={colors.catarina} />
          <Text variant="heading">{delivery ? 'Entrega' : 'Retiro en el local'}</Text>
        </View>
        {address ? (
          <>
            <Text variant="small">{address.address_line}</Text>
            <Text variant="small" tone="muted">
              {address.municipality}, {address.department}
            </Text>
            <Text variant="small" tone="muted">
              Recibe {address.recipient_name} · {formatPhone(address.phone)}
            </Text>
            {order.estimated_days !== null && (
              <Text variant="small">
                Tiempo estimado: {order.estimated_days === 0 ? 'el mismo día' : `${order.estimated_days} ${order.estimated_days === 1 ? 'día' : 'días'}`}
              </Text>
            )}
          </>
        ) : (
          <Text variant="small" tone="muted">
            {order.business.address_line ?? 'Coordina con el negocio.'}
          </Text>
        )}
        <Divider />
        <Text variant="small" tone="muted">
          Contacto: {order.contact_name} · {formatPhone(order.contact_phone)}
        </Text>
        {order.customer_note ? (
          <Text variant="small" tone="muted">
            Nota: {order.customer_note}
          </Text>
        ) : null}
      </Card>

      <Card style={styles.gap}>
        <Pressable style={styles.row} onPress={() => router.push(`/negocios/${order.business.slug}`)}>
          <Store size={18} color={colors.catarina} />
          <Text variant="heading">{order.business.trade_name}</Text>
        </Pressable>
        <View style={styles.row}>
          {order.business.phone && (
            <Button size="sm" variant="secondary" icon={Phone} onPress={() => Linking.openURL(phoneHref(order.business.phone!))}>
              Llamar
            </Button>
          )}
          {order.business.whatsapp && (
            <Button
              size="sm"
              variant="secondary"
              icon={MessageCircle}
              onPress={() => Linking.openURL(whatsappHref(order.business.whatsapp!, `Hola, consulto por mi pedido ${order.order_number}`))}
            >
              WhatsApp
            </Button>
          )}
        </View>
      </Card>

      <View style={styles.protected}>
        <ShieldCheck size={20} color={colors.catarina} />
        <Text variant="small" tone="muted" style={styles.flex}>
          <Text variant="smallMedium">Pago protegido. </Text>
          Retenemos tu pago y se lo liberamos al negocio {claimHours} h después de la entrega, si no reportas problemas.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gap: { gap: 10 },
  title: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  warning: { backgroundColor: colors.warningSoft, borderColor: '#F1D9A6' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  step: { borderRadius: radius.md, padding: 12, backgroundColor: colors.muted },
  stepArrived: { backgroundColor: colors.catarina },
  cardTitle: { marginBottom: 14 },
  refund: { marginTop: 8, borderRadius: radius.md, backgroundColor: colors.muted, padding: 12, gap: 2 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: { width: 54, height: 54, borderRadius: radius.md, backgroundColor: colors.muted, overflow: 'hidden' },
  claim: { gap: 6, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12 },
  protected: { flexDirection: 'row', gap: 10, padding: 4 },
});
