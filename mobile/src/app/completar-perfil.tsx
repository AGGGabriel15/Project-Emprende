import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { formatPhone } from '@/lib/phone';
import { phoneSchema } from '@/lib/validations/common';
import { profileSchema } from '@/lib/validations/profile';
import { AuthShell } from '~/components/auth/auth-shell';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { PhoneInput } from '~/components/ui/phone-input';
import { Select } from '~/components/ui/select';
import { toast } from '~/components/ui/toast';
import { useSignOut } from '~/features/auth/navigation';
import { useSession } from '~/features/auth/session';
import { useDepartments, useMunicipalities, useVisitorLocation } from '~/features/location/geo';
import { fieldErrors } from '~/lib/forms';
import { supabase } from '~/lib/supabase';
import { errorMessage } from '@/lib/format';

/** Teléfono y ubicación (el repartidor solo necesita el teléfono), como /completar-perfil del web. */
export default function CompleteProfileScreen() {
  const router = useRouter();
  const { profile, refreshProfile } = useSession();
  const signOut = useSignOut();
  const visitor = useVisitorLocation((s) => s.location);
  const setVisitor = useVisitorLocation((s) => s.setLocation);
  const courier = profile?.role === 'courier';
  const [form, setForm] = useState({
    fullName: profile?.full_name ?? '',
    phone: formatPhone(profile?.phone),
    departmentId: profile?.department_id ?? visitor?.departmentId ?? null,
    municipalityId: profile?.municipality_id ?? visitor?.municipalityId ?? null,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const departments = useDepartments();
  const municipalities = useMunicipalities(form.departmentId);
  const set = (patch: Partial<typeof form>) => setForm((current) => ({ ...current, ...patch }));

  async function submit() {
    if (!profile) return;
    let update: Record<string, unknown>;
    if (courier) {
      const phone = phoneSchema.safeParse(form.phone);
      if (!phone.success) return setErrors({ phone: phone.error.issues[0]!.message });
      update = { phone: phone.data };
    } else {
      const parsed = profileSchema.safeParse({ ...form, departmentId: form.departmentId ?? 0, municipalityId: form.municipalityId ?? 0 });
      if (!parsed.success) return setErrors(fieldErrors(parsed.error));
      update = {
        full_name: parsed.data.fullName,
        phone: parsed.data.phone,
        department_id: parsed.data.departmentId,
        municipality_id: parsed.data.municipalityId,
        accepted_terms_at: new Date().toISOString(),
      };
      setVisitor({ departmentId: parsed.data.departmentId, municipalityId: parsed.data.municipalityId });
    }
    setErrors({});
    setPending(true);
    const { error } = await supabase.from('profiles').update(update).eq('id', profile.id);
    if (error) {
      setPending(false);
      return toast.error(errorMessage(error));
    }
    await refreshProfile();
    setPending(false);
    // Perfil ya completo: directo a la pantalla de su rol.
    router.replace(profile.role === 'courier' ? '/repartidor' : profile.role === 'vendor' ? '/vendedor/panel' : '/');
  }

  return (
    <AuthShell title="Un último paso" description="Tu teléfono y ubicación ayudan a coordinar las entregas.">
      <View style={styles.form}>
        {!courier && <Input label="Nombre completo" value={form.fullName} onChangeText={(fullName) => set({ fullName })} error={errors.fullName} />}
        <PhoneInput value={form.phone} onChange={(phone) => set({ phone })} error={errors.phone} />
        {!courier && (
          <>
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
              placeholder={form.departmentId ? 'Elige…' : 'Primero el departamento'}
              options={(municipalities.data ?? []).map((m) => ({ value: m.id, label: m.name }))}
              onChange={(municipalityId) => set({ municipalityId })}
              error={errors.municipalityId}
            />
          </>
        )}
        <Button onPress={submit} loading={pending} block size="lg">
          Guardar y continuar
        </Button>
        <Button variant="ghost" onPress={signOut} block>
          Cerrar sesión
        </Button>
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({ form: { gap: 14 } });
