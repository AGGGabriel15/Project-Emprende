import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Camera, ImagePlus, Star, Trash2, X } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Switch, View } from 'react-native';
import { deleteProductWith, saveProductWith } from '@/features/businesses/mutations';
import type { Product } from '@/types/domain';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Screen } from '~/components/ui/screen';
import { Select } from '~/components/ui/select';
import { Text } from '~/components/ui/text';
import { toast } from '~/components/ui/toast';
import { actionFieldErrors, useMyBusiness, useProductCategories, useVendorAction } from '~/features/vendor/queries';
import { pickImage, uploadImage } from '~/lib/upload';
import { colors, radius } from '~/theme/tokens';

/** Crear o editar un producto: fotos (hasta 6), precio, stock y sección (como ProductForm del web). */
export function ProductEditor({ product }: { product?: Product | null }) {
  const router = useRouter();
  const business = useMyBusiness().data!;
  const categories = useProductCategories(business.id);
  const save = useVendorAction(saveProductWith, { invalidate: ['vendor-products', 'vendor-product', 'vendor-dashboard'] });
  const remove = useVendorAction(deleteProductWith, { success: 'Producto eliminado.', invalidate: ['vendor-products'] });
  const [form, setForm] = useState({
    name: product?.name ?? '',
    description: product?.description ?? '',
    categoryId: product?.category_id ?? '',
    material: product?.material ?? '',
    dimensions: product?.dimensions ?? '',
    weightGrams: product?.weight_grams != null ? String(product.weight_grams) : '',
    price: product ? String(product.price_minor / 100) : '',
    stock: product ? String(product.stock) : '1',
    isActive: product?.is_active ?? true,
    images: product?.images ?? [],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  async function addPhoto(source: 'camera' | 'library') {
    const { uri, error } = await pickImage(source);
    if (error) return toast.error(error);
    if (!uri) return;
    setUploading(true);
    try {
      const { publicUrl } = await uploadImage(uri, 'product-images', 'products');
      set({ images: [...form.images, publicUrl!].slice(0, 6) });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No pudimos subir la foto.');
    } finally {
      setUploading(false);
    }
  }

  function submit() {
    const input = {
      ...form,
      categoryId: form.categoryId || '',
      material: form.material || undefined,
      dimensions: form.dimensions || undefined,
      weightGrams: form.weightGrams ? Number(form.weightGrams) : undefined,
      price: form.price.replace(',', '.'),
    };
    save.mutate([input, product?.id], {
      onSuccess: () => {
        setErrors({});
        toast.success(product ? 'Producto guardado.' : 'Producto creado.');
        router.back();
      },
      onError: (error) => setErrors(actionFieldErrors(error)),
    });
  }

  return (
    <Screen
      footer={
        <Button onPress={submit} loading={save.isPending} disabled={uploading} block>
          {product ? 'Guardar cambios' : 'Publicar producto'}
        </Button>
      }
    >
      <Card style={styles.gap}>
        <Text variant="heading">Fotos</Text>
        <Text variant="small" tone="muted">
          La primera es la portada. Hasta 6 fotos claras, con buena luz.
        </Text>
        <View style={styles.photos}>
          {form.images.map((url, i) => (
            <View key={url} style={styles.photo}>
              <Image source={url} style={StyleSheet.absoluteFill} contentFit="cover" />
              {i === 0 ? (
                <View style={styles.cover}>
                  <Star size={10} color={colors.white} fill={colors.white} />
                </View>
              ) : (
                <Pressable style={styles.cover} onPress={() => set({ images: [url, ...form.images.filter((x) => x !== url)] })} accessibilityLabel="Usar como portada">
                  <Star size={10} color={colors.white} />
                </Pressable>
              )}
              <Pressable style={styles.remove} onPress={() => set({ images: form.images.filter((x) => x !== url) })} accessibilityLabel="Quitar foto">
                <X size={13} color={colors.white} />
              </Pressable>
            </View>
          ))}
          {uploading && (
            <View style={[styles.photo, styles.add]}>
              <ActivityIndicator color={colors.catarina} />
            </View>
          )}
          {form.images.length < 6 && !uploading && (
            <>
              <Pressable onPress={() => addPhoto('camera')} style={[styles.photo, styles.add]}>
                <Camera size={22} color={colors.catarina} />
                <Text variant="small" tone="primary">
                  Cámara
                </Text>
              </Pressable>
              <Pressable onPress={() => addPhoto('library')} style={[styles.photo, styles.add]}>
                <ImagePlus size={22} color={colors.catarina} />
                <Text variant="small" tone="primary">
                  Galería
                </Text>
              </Pressable>
            </>
          )}
        </View>
        {errors.images && (
          <Text variant="small" tone="danger">
            {errors.images}
          </Text>
        )}
      </Card>

      <Card style={styles.gap}>
        <Input label="Nombre" value={form.name} onChangeText={(name) => set({ name })} error={errors.name} />
        <Input label="Descripción" multiline value={form.description} onChangeText={(description) => set({ description })} error={errors.description} />
        <View style={styles.row}>
          <View style={styles.flex}>
            <Input label="Precio (C$)" keyboardType="decimal-pad" value={form.price} onChangeText={(price) => set({ price })} error={errors.price} />
          </View>
          <View style={styles.flex}>
            <Input label="Stock" keyboardType="number-pad" value={form.stock} onChangeText={(stock) => set({ stock: stock.replace(/\D/g, '') })} error={errors.stock} />
          </View>
        </View>
        <Select
          label="Sección de tu tienda (opcional)"
          value={form.categoryId || null}
          options={[{ value: '', label: 'Sin sección' }, ...(categories.data ?? []).map((c) => ({ value: c.id, label: c.name }))]}
          onChange={(categoryId) => set({ categoryId })}
        />
        <Input label="Material (opcional)" value={form.material} onChangeText={(material) => set({ material })} />
        <View style={styles.row}>
          <View style={styles.flex}>
            <Input label="Medidas (opcional)" value={form.dimensions} onChangeText={(dimensions) => set({ dimensions })} placeholder="30 × 15 cm" />
          </View>
          <View style={styles.flex}>
            <Input label="Peso (g)" keyboardType="number-pad" value={form.weightGrams} onChangeText={(weightGrams) => set({ weightGrams: weightGrams.replace(/\D/g, '') })} />
          </View>
        </View>
        <View style={styles.switch}>
          <View style={styles.flex}>
            <Text variant="bodyMedium">Visible en la tienda</Text>
            <Text variant="small" tone="muted">
              Ocúltalo sin borrarlo si ya no lo ofreces.
            </Text>
          </View>
          <Switch value={form.isActive} onValueChange={(isActive) => set({ isActive })} trackColor={{ true: colors.catarina, false: colors.border }} thumbColor={colors.white} />
        </View>
      </Card>

      {product && (
        <Button
          variant="ghost"
          icon={Trash2}
          loading={remove.isPending}
          onPress={() =>
            Alert.alert('Eliminar producto', `¿Eliminar "${product.name}"? No se puede deshacer.`, [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Eliminar', style: 'destructive', onPress: () => remove.mutate([product.id], { onSuccess: () => router.back() }) },
            ])
          }
        >
          Eliminar producto
        </Button>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gap: { gap: 12 },
  row: { flexDirection: 'row', gap: 10 },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photo: { width: 92, height: 92, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.muted },
  add: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.hojaClara, backgroundColor: colors.niebla, alignItems: 'center', justifyContent: 'center', gap: 2 },
  cover: { position: 'absolute', left: 4, top: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(14,59,39,0.7)', alignItems: 'center', justifyContent: 'center' },
  remove: { position: 'absolute', right: 4, top: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  switch: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
