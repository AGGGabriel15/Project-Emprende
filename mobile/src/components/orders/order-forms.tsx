import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Camera, ImagePlus, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { RATING_TAGS } from '@/features/couriers/status';
import { cancelOrderWith, openClaimWith, rateDeliveryWith, submitReviewWith } from '@/features/orders/mutations';
import { CLAIM_REASONS } from '@/features/orders/status';
import type { ClaimReason } from '@/types/domain';
import { Button } from '~/components/ui/button';
import { Stars } from '~/components/ui/feedback';
import { Input } from '~/components/ui/input';
import { Select } from '~/components/ui/select';
import { Sheet } from '~/components/ui/sheet';
import { Text } from '~/components/ui/text';
import { toast } from '~/components/ui/toast';
import { useSession } from '~/features/auth/session';
import { processRefunds } from '~/lib/api';
import { supabase } from '~/lib/supabase';
import { pickImage, uploadImage } from '~/lib/upload';
import { colors, radius } from '~/theme/tokens';

function useRefresh(orderId: string) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['order', orderId] });
    queryClient.invalidateQueries({ queryKey: ['orders'] });
    queryClient.invalidateQueries({ queryKey: ['vendor-board'] });
  };
}

/** Cancelar con motivo (cliente o negocio); el reembolso se procesa al momento. */
export function CancelSheet({ orderId, open, onClose, onDone }: { orderId: string; open: boolean; onClose: () => void; onDone?: () => void }) {
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const refresh = useRefresh(orderId);
  async function submit() {
    setPending(true);
    const result = await cancelOrderWith(supabase, { orderId, reason });
    if (!result.ok) {
      setPending(false);
      return toast.error(result.error);
    }
    if (result.data.queued) {
      const refunds = await processRefunds(orderId);
      if (!refunds.ok || refunds.data.failed) toast.error('El pedido se canceló, pero el reembolso quedó pendiente. La administración lo revisará.');
    }
    setPending(false);
    toast.success('Pedido cancelado.');
    refresh();
    onDone?.();
    onClose();
  }
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Cancelar pedido"
      description="Se devuelve el pago completo a la tarjeta."
      footer={
        <>
          <Button variant="outline" onPress={onClose} style={styles.flex} block>
            Volver
          </Button>
          <Button variant="danger" onPress={submit} loading={pending} style={styles.flex} block>
            Cancelar pedido
          </Button>
        </>
      }
    >
      <Input label="Motivo" multiline value={reason} onChangeText={setReason} placeholder="Cuéntanos por qué cancelas" maxLength={300} />
    </Sheet>
  );
}

/** Reseña del negocio (pedido completado). */
export function ReviewForm({ orderId, businessName }: { orderId: string; businessName: string }) {
  const { session } = useSession();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [pending, setPending] = useState(false);
  const refresh = useRefresh(orderId);
  return (
    <View style={styles.form}>
      <Text variant="small" tone="muted">
        ¿Qué tal tu experiencia con {businessName}?
      </Text>
      <Stars value={rating} size={30} onChange={setRating} />
      <Input label="Comentario (opcional)" multiline value={comment} onChangeText={setComment} maxLength={500} />
      <Button
        loading={pending}
        onPress={async () => {
          setPending(true);
          const result = await submitReviewWith(supabase, session!.user.id, { orderId, rating, comment: comment || undefined });
          setPending(false);
          if (!result.ok) return toast.error(result.error);
          toast.success('¡Gracias por tu reseña!');
          refresh();
        }}
      >
        Publicar reseña
      </Button>
    </View>
  );
}

/** Calificación del repartidor (estrellas + etiquetas). */
export function DeliveryRatingForm({ orderId, courierName }: { orderId: string; courierName: string }) {
  const [rating, setRating] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [pending, setPending] = useState(false);
  const refresh = useRefresh(orderId);
  return (
    <View style={styles.form}>
      <Text variant="small" tone="muted">
        ¿Cómo te atendió {courierName}?
      </Text>
      <Stars value={rating} size={30} onChange={setRating} />
      <View style={styles.tags}>
        {RATING_TAGS.map((tag) => {
          const on = tags.includes(tag);
          return (
            <Pressable
              key={tag}
              onPress={() => setTags((t) => (on ? t.filter((x) => x !== tag) : [...t, tag]))}
              style={[styles.tag, on && styles.tagOn]}
            >
              <Text variant="small" tone={on ? 'white' : 'default'}>
                {tag}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Input label="Comentario (opcional)" multiline value={comment} onChangeText={setComment} maxLength={500} />
      <Button
        loading={pending}
        onPress={async () => {
          setPending(true);
          const result = await rateDeliveryWith(supabase, { orderId, rating, tags, comment: comment || undefined });
          setPending(false);
          if (!result.ok) return toast.error(result.error);
          toast.success('¡Gracias por calificar la entrega!');
          refresh();
        }}
      >
        Enviar calificación
      </Button>
    </View>
  );
}

/** Reclamo con fotos dentro del plazo tras la entrega. */
export function ClaimSheet({ orderId, deadline, open, onClose }: { orderId: string; deadline: string; open: boolean; onClose: () => void }) {
  const [reason, setReason] = useState<ClaimReason | null>(null);
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const refresh = useRefresh(orderId);

  async function addPhoto(source: 'camera' | 'library') {
    const { uri, error } = await pickImage(source);
    if (error) return toast.error(error);
    if (uri) setPhotos((p) => [...p, uri].slice(0, 4));
  }

  async function submit() {
    if (!reason) return toast.error('Elige qué pasó.');
    setPending(true);
    try {
      const paths: string[] = [];
      for (const uri of photos) paths.push((await uploadImage(uri, 'delivery-evidence', 'claims')).path);
      const result = await openClaimWith(supabase, { orderId, reason, description, photos: paths });
      if (!result.ok) return toast.error(result.error);
      toast.success('Reclamo enviado. Te avisaremos la respuesta.');
      refresh();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No pudimos enviar el reclamo.');
    } finally {
      setPending(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Reportar un problema"
      description={`Puedes reclamar hasta el ${deadline}. Retenemos el pago al negocio mientras lo revisamos.`}
      footer={
        <Button onPress={submit} loading={pending} block style={styles.flex}>
          Enviar reclamo
        </Button>
      }
    >
      <Select
        label="¿Qué pasó?"
        value={reason}
        options={(Object.keys(CLAIM_REASONS) as ClaimReason[]).map((value) => ({ value, label: CLAIM_REASONS[value] }))}
        onChange={setReason}
      />
      <Input label="Cuéntanos los detalles" multiline value={description} onChangeText={setDescription} maxLength={1000} />
      <Text variant="smallMedium">Fotos (hasta 4)</Text>
      <View style={styles.photos}>
        {photos.map((uri) => (
          <View key={uri} style={styles.photo}>
            <Image source={uri} style={StyleSheet.absoluteFill} contentFit="cover" />
            <Pressable style={styles.remove} onPress={() => setPhotos((p) => p.filter((x) => x !== uri))} accessibilityLabel="Quitar foto">
              <X size={14} color={colors.white} />
            </Pressable>
          </View>
        ))}
        {photos.length < 4 && (
          <>
            <PhotoButton icon={Camera} label="Cámara" onPress={() => addPhoto('camera')} />
            <PhotoButton icon={ImagePlus} label="Galería" onPress={() => addPhoto('library')} />
          </>
        )}
      </View>
    </Sheet>
  );
}

export function PhotoButton({ icon: Icon, label, onPress }: { icon: typeof Camera; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.photoButton}>
      <Icon size={22} color={colors.catarina} />
      <Text variant="small" tone="primary">
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  form: { gap: 12 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 6 },
  tagOn: { backgroundColor: colors.catarina, borderColor: colors.catarina },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photo: { width: 76, height: 76, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.muted },
  remove: { position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  photoButton: {
    width: 76,
    height: 76,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.hojaClara,
    backgroundColor: colors.niebla,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
});
