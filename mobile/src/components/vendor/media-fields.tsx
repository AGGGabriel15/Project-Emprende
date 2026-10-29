import { Image } from 'expo-image';
import { Camera, CheckCircle2, FileUp, ImagePlus } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '~/components/ui/text';
import { toast } from '~/components/ui/toast';
import { pickImage, uploadImage } from '~/lib/upload';
import { colors, radius } from '~/theme/tokens';

/** Pregunta cámara o galería y devuelve la foto elegida. */
async function chooseSource(title: string): Promise<'camera' | 'library' | null> {
  return new Promise((resolve) =>
    Alert.alert(title, undefined, [
      { text: 'Cámara', onPress: () => resolve('camera') },
      { text: 'Galería', onPress: () => resolve('library') },
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(null) },
    ]),
  );
}

/** Logo o portada del negocio (bucket business-media, como SingleImageUploader del web). */
export function BusinessImageField({
  label,
  value,
  onChange,
  wide,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  wide?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  async function pick() {
    const source = await chooseSource(label);
    if (!source) return;
    const { uri, error } = await pickImage(source, { square: !wide });
    if (error) return toast.error(error);
    if (!uri) return;
    setBusy(true);
    try {
      const { publicUrl } = await uploadImage(uri, 'business-media', 'media', wide ? 1600 : 600);
      onChange(publicUrl!);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No pudimos subir la imagen.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={styles.field}>
      <Text variant="smallMedium">{label}</Text>
      <Pressable onPress={pick} style={[styles.image, wide ? styles.wide : styles.square]}>
        {value ? <Image source={value} style={StyleSheet.absoluteFill} contentFit="cover" /> : <ImagePlus size={24} color={colors.catarina} />}
        {busy && (
          <View style={styles.busy}>
            <ActivityIndicator color={colors.white} />
          </View>
        )}
      </Pressable>
    </View>
  );
}

/**
 * Documento de la solicitud (bucket privado business-documents). Con el
 * celular se toma la foto directo; `onUploaded` registra el documento.
 */
export function DocumentField({
  label,
  hint,
  uploaded,
  onUploaded,
}: {
  label: string;
  hint?: string;
  uploaded: boolean;
  onUploaded: (path: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  async function pick() {
    const source = await chooseSource(label);
    if (!source) return;
    const { uri, error } = await pickImage(source);
    if (error) return toast.error(error);
    if (!uri) return;
    setBusy(true);
    try {
      const { path } = await uploadImage(uri, 'business-documents', 'docs', 2000);
      await onUploaded(path);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No pudimos subir el documento.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Pressable onPress={pick} disabled={busy} style={[styles.doc, uploaded && styles.docDone]}>
      <View style={[styles.docIcon, uploaded && styles.docIconDone]}>
        {busy ? (
          <ActivityIndicator color={colors.catarina} />
        ) : uploaded ? (
          <CheckCircle2 size={20} color={colors.white} />
        ) : label.toLowerCase().includes('selfie') ? (
          <Camera size={20} color={colors.catarina} />
        ) : (
          <FileUp size={20} color={colors.catarina} />
        )}
      </View>
      <View style={styles.flex}>
        <Text variant="bodyMedium">{label}</Text>
        <Text variant="small" tone="muted">
          {uploaded ? 'Recibido · toca para reemplazar' : (hint ?? 'Toma una foto clara o elígela de tu galería')}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  field: { gap: 6, flex: 1 },
  image: {
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.hojaClara,
    backgroundColor: colors.niebla,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  square: { width: 96, height: 96 },
  wide: { width: '100%', aspectRatio: 2.4 },
  busy: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(14,59,39,0.5)', alignItems: 'center', justifyContent: 'center' },
  doc: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  docDone: { borderColor: colors.hojaClara, backgroundColor: colors.niebla },
  docIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.niebla, alignItems: 'center', justifyContent: 'center' },
  docIconDone: { backgroundColor: colors.catarina },
});
