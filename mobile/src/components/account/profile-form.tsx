import { Camera, ImagePlus } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { setAvatarWith, updateProfileWith } from '@/features/account/profile';
import { formatPhone } from '@/lib/phone';
import { phoneSchema } from '@/lib/validations/common';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { Avatar } from '~/components/ui/feedback';
import { Input } from '~/components/ui/input';
import { PhoneInput } from '~/components/ui/phone-input';
import { Select } from '~/components/ui/select';
import { Text } from '~/components/ui/text';
import { toast } from '~/components/ui/toast';
import { useSession } from '~/features/auth/session';
import { useDepartments, useMunicipalities } from '~/features/location/geo';
import { supabase } from '~/lib/supabase';
import { pickImage, uploadImage } from '~/lib/upload';
import { colors } from '~/theme/tokens';

/** Foto, nombre, teléfono, cédula y ubicación (el repartidor solo foto y teléfono). */
export function ProfileForm() {
  const { profile, refreshProfile } = useSession();
  const courier = profile?.role === 'courier';
  const [form, setForm] = useState({
    fullName: profile?.full_name ?? '',
    phone: formatPhone(profile?.phone),
    cedula: profile?.cedula ?? '',
    departmentId: profile?.department_id ?? null,
    municipalityId: profile?.municipality_id ?? null,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const departments = useDepartments();
  const municipalities = useMunicipalities(form.departmentId);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  if (!profile) return null;

  async function changePhoto(source: 'camera' | 'library') {
    const { uri, error } = await pickImage(source, { square: true });
    if (error) return toast.error(error);
    if (!uri) return;
    setUploading(true);
    try {
      const { publicUrl } = await uploadImage(uri, 'avatars', 'avatar', 512);
      const result = await setAvatarWith(supabase, profile!.id, publicUrl);
      if (!result.ok) return toast.error(result.error);
      await refreshProfile();
      toast.success('Foto actualizada.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No pudimos subir la foto.');
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setSaving(true);
    let result;
    if (courier) {
      const phone = phoneSchema.safeParse(form.phone);
      if (!phone.success) {
        setSaving(false);
        return setErrors({ phone: phone.error.issues[0]!.message });
      }
      const { error } = await supabase.from('profiles').update({ phone: phone.data }).eq('id', profile!.id);
      result = error ? { ok: false as const, error: 'No pudimos guardar.' } : { ok: true as const };
    } else {
      result = await updateProfileWith(supabase, profile!.id, { ...form, departmentId: form.departmentId ?? 0, municipalityId: form.municipalityId ?? 0 });
    }
    setSaving(false);
    if (!result.ok) {
      setErrors(Object.fromEntries(Object.entries(('fieldErrors' in result && result.fieldErrors) || {}).map(([k, v]) => [k, v[0]!])));
      return toast.error(result.error);
    }
    setErrors({});
    await refreshProfile();
    toast.success('Perfil guardado.');
  }

  return (
    <>
      <Card style={styles.photoCard}>
        <View>
          <Avatar uri={profile.avatar_url} name={profile.full_name} size={84} />
          {uploading && (
            <View style={styles.uploading}>
              <ActivityIndicator color={colors.white} />
            </View>
          )}
        </View>
        <View style={styles.flex}>
          <Text variant="heading">{profile.full_name || 'Tu nombre'}</Text>
          <Text variant="small" tone="muted">
            {profile.email}
          </Text>
          <View style={styles.photoActions}>
            <Pressable style={styles.photoAction} onPress={() => changePhoto('camera')}>
              <Camera size={16} color={colors.catarina} />
              <Text variant="smallMedium" tone="primary">
                Tomar foto
              </Text>
            </Pressable>
            <Pressable style={styles.photoAction} onPress={() => changePhoto('library')}>
              <ImagePlus size={16} color={colors.catarina} />
              <Text variant="smallMedium" tone="primary">
                Galería
              </Text>
            </Pressable>
          </View>
        </View>
      </Card>
      <Card style={styles.gap}>
        {!courier && <Input label="Nombre completo" value={form.fullName} onChangeText={(fullName) => set({ fullName })} error={errors.fullName} />}
        <PhoneInput value={form.phone} onChange={(phone) => set({ phone })} error={errors.phone} />
        {!courier && (
          <>
            <Input
              label="Cédula (opcional)"
              value={form.cedula}
              onChangeText={(cedula) => set({ cedula })}
              placeholder="001-010190-0001A"
              autoCapitalize="characters"
              error={errors.cedula}
            />
            <Select
              label="Departamento"
              value={form.departmentId}
              options={(departments.data ?? []).map((d) => ({ value: d.id, label: d.name }))}
              onChange={(departmentId) => set({ departmentId, municipalityId: null })}
              error={errors.departmentId}
            />
            <Select
              label="Ciudad / municipio"
              value={form.municipalityId}
              disabled={!form.departmentId}
              options={(municipalities.data ?? []).map((m) => ({ value: m.id, label: m.name }))}
              onChange={(municipalityId) => set({ municipalityId })}
              error={errors.municipalityId}
            />
          </>
        )}
        <Button onPress={save} loading={saving}>
          Guardar cambios
        </Button>
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  gap: { gap: 14 },
  photoCard: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  uploading: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 42, backgroundColor: 'rgba(14,59,39,0.5)', alignItems: 'center', justifyContent: 'center' },
  photoActions: { flexDirection: 'row', gap: 16, marginTop: 8 },
  photoAction: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
