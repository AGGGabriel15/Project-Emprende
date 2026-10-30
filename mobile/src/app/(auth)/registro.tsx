import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Check, MailCheck } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { registerSchema } from '@/lib/validations/auth';
import { AuthShell } from '~/components/auth/auth-shell';
import { GoogleButton, OrDivider } from '~/components/auth/google-button';
import { Button } from '~/components/ui/button';
import { EmptyState } from '~/components/ui/feedback';
import { Input } from '~/components/ui/input';
import { Text } from '~/components/ui/text';
import { toast } from '~/components/ui/toast';
import { WEB_URL } from '~/lib/api';
import { useGoToHomeWhenSignedIn } from '~/features/auth/navigation';
import { fieldErrors } from '~/lib/forms';
import { supabase } from '~/lib/supabase';
import { colors, radius } from '~/theme/tokens';

export default function RegisterScreen() {
  const router = useRouter();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const [form, setForm] = useState({ fullName: '', email: '', password: '', acceptTerms: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const set = (patch: Partial<typeof form>) => setForm((current) => ({ ...current, ...patch }));
  useGoToHomeWhenSignedIn(next);

  async function submit() {
    const parsed = registerSchema.safeParse(form);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    setPending(true);
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: { full_name: parsed.data.fullName, accepted_terms: true },
        // El enlace del correo abre el web; después se entra a la app con la contraseña.
        emailRedirectTo: `${WEB_URL}/auth/callback?next=/completar-perfil`,
      },
    });
    setPending(false);
    if (error) return toast.error(error.code === 'user_already_exists' ? 'Ya existe una cuenta con ese correo.' : 'No pudimos crear tu cuenta.');
    // Con sesión inmediata, useGoToHomeWhenSignedIn lleva a completar el perfil.
    if (!data.session) setSentTo(parsed.data.email);
  }

  if (sentTo) {
    return (
      <AuthShell title="Revisa tu correo">
        <EmptyState
          icon={MailCheck}
          title="Confirma tu cuenta"
          description={`Te enviamos un enlace a ${sentTo}. Ábrelo y luego vuelve aquí para entrar.`}
          action={
            <Button onPress={() => router.replace('/login')} block>
              Ir a entrar
            </Button>
          }
        />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Crea tu cuenta"
      description="Compra directo a los viveros y talleres de Catarina."
      footer={
        <Text variant="small" tone="muted">
          ¿Ya tienes cuenta?{' '}
          <Link href={{ pathname: '/login', params: next ? { next } : {} }} replace>
            <Text variant="smallMedium" tone="primary">
              Entrar
            </Text>
          </Link>
        </Text>
      }
    >
      <GoogleButton />
      <OrDivider />
      <View style={styles.form}>
        <Input label="Nombre completo" value={form.fullName} onChangeText={(fullName) => set({ fullName })} autoComplete="name" error={errors.fullName} />
        <Input
          label="Correo"
          value={form.email}
          onChangeText={(email) => set({ email })}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          error={errors.email}
        />
        <Input
          label="Contraseña"
          value={form.password}
          onChangeText={(password) => set({ password })}
          secureTextEntry
          autoComplete="new-password"
          hint="Mínimo 8 caracteres, con letras y números."
          error={errors.password}
        />
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: form.acceptTerms }}
          onPress={() => set({ acceptTerms: !form.acceptTerms })}
          style={styles.terms}
        >
          <View style={[styles.check, form.acceptTerms && styles.checked]}>
            {form.acceptTerms && <Check size={14} color={colors.white} strokeWidth={3} />}
          </View>
          <Text variant="small" style={styles.termsText}>
            Acepto los{' '}
            <Text variant="smallMedium" tone="primary" onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/terminos`)}>
              términos
            </Text>{' '}
            y el{' '}
            <Text variant="smallMedium" tone="primary" onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/privacidad`)}>
              aviso de privacidad
            </Text>
            .
          </Text>
        </Pressable>
        {errors.acceptTerms && (
          <Text variant="small" tone="danger">
            {errors.acceptTerms}
          </Text>
        )}
        <Button onPress={submit} loading={pending} block size="lg">
          Crear cuenta
        </Button>
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  form: { gap: 14 },
  terms: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  termsText: { flex: 1 },
  check: {
    width: 22,
    height: 22,
    borderRadius: radius.sm / 2,
    borderWidth: 1.5,
    borderColor: colors.input,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checked: { backgroundColor: colors.catarina, borderColor: colors.catarina },
});
