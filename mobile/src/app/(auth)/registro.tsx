import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { CircleCheck, MailCheck } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { emailSchema, registerSchema } from '@/lib/validations/auth';
import { AuthShell } from '~/components/auth/auth-shell';
import { PasswordChecklist, TermsCheckbox } from '~/components/auth/form-extras';
import { GoogleButton, OrDivider } from '~/components/auth/google-button';
import { Button } from '~/components/ui/button';
import { EmptyState } from '~/components/ui/feedback';
import { Input } from '~/components/ui/input';
import { Text } from '~/components/ui/text';
import { toast } from '~/components/ui/toast';
import { publicApi, WEB_URL } from '~/lib/api';
import { useGoToHomeWhenSignedIn } from '~/features/auth/navigation';
import { useLiveValidation } from '~/lib/forms';
import { supabase } from '~/lib/supabase';
import { colors } from '~/theme/tokens';

type EmailState = { email: string; status: 'checking' | 'available' | 'registered' | 'unconfirmed'; message?: string | null };

// El enlace del correo abre el web; después se entra a la app con la contraseña.
const CONFIRM_REDIRECT = `${WEB_URL}/auth/callback?next=/completar-perfil`;
const RESEND_WAIT_S = 60;

export default function RegisterScreen() {
  const router = useRouter();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const [form, setForm] = useState({ fullName: '', email: '', password: '', acceptTerms: false });
  const { errors, touch, validate } = useLiveValidation(registerSchema, form);
  const [pending, setPending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [check, setCheck] = useState<EmailState | null>(null);
  const set = (patch: Partial<typeof form>) => setForm((current) => ({ ...current, ...patch }));
  useGoToHomeWhenSignedIn(next);

  // ¿Ya existe una cuenta con este correo? Se consulta al dejar de escribir.
  useEffect(() => {
    const parsed = emailSchema.safeParse(form.email);
    if (!parsed.success) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setCheck({ email: parsed.data, status: 'checking' });
      const result = await publicApi<{ status: EmailState['status'] | 'invalid'; message: string | null }>('email-status', { email: parsed.data });
      if (cancelled || !result.ok || result.data.status === 'invalid') return;
      setCheck({ email: parsed.data, status: result.data.status, message: result.data.message });
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [form.email]);

  const current = check && check.email === form.email.trim().toLowerCase() ? check : null;
  const taken = current?.status === 'registered' ? current.message : null;

  async function submit() {
    const parsed = validate();
    if (!parsed.success || taken) return;
    const email = parsed.data.email.trim().toLowerCase();
    setPending(true);
    if (current?.status === 'unconfirmed') {
      // Ya se registró pero no confirmó: se reenvía el enlace.
      await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: CONFIRM_REDIRECT } });
      setPending(false);
      return setSentTo(email);
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password: parsed.data.password,
      options: { data: { full_name: parsed.data.fullName, accepted_terms: true }, emailRedirectTo: CONFIRM_REDIRECT },
    });
    setPending(false);
    if (error) return toast.error(error.code === 'user_already_exists' ? 'Este correo ya tiene una cuenta. Entra o recupera tu contraseña.' : 'No pudimos crear tu cuenta.');
    // Supabase disimula el registro repetido devolviendo un usuario sin identidades.
    if (data.user && data.user.identities?.length === 0) return toast.error('Este correo ya tiene una cuenta. Entra o recupera tu contraseña.');
    // Con sesión inmediata, useGoToHomeWhenSignedIn lleva a completar el perfil.
    if (!data.session) setSentTo(email);
  }

  if (sentTo) return <ConfirmationSent email={sentTo} onLogin={() => router.replace('/login')} />;

  const emailError = errors.email ?? taken ?? undefined;
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
        <Input
          label="Nombre completo"
          value={form.fullName}
          onChangeText={(fullName) => set({ fullName })}
          onBlur={touch('fullName')}
          autoComplete="name"
          error={errors.fullName}
        />
        <Input
          label="Correo"
          value={form.email}
          onChangeText={(email) => set({ email })}
          onBlur={touch('email')}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          error={emailError}
          right={
            current?.status === 'checking' ? (
              <ActivityIndicator size="small" color={colors.mutedForeground} />
            ) : current?.status === 'available' && !errors.email ? (
              <CircleCheck size={16} color={colors.catarina} />
            ) : null
          }
          hint={
            current?.status === 'unconfirmed'
              ? 'Este correo ya se registró pero falta confirmarlo: al continuar te reenviamos el enlace.'
              : undefined
          }
        />
        {taken ? (
          <View style={styles.links}>
            <Text variant="smallMedium" tone="primary" onPress={() => router.replace('/login')}>
              Entrar
            </Text>
            <Text variant="small" tone="muted">
              ·
            </Text>
            <Text variant="smallMedium" tone="primary" onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/recuperar`)}>
              Recuperar contraseña
            </Text>
          </View>
        ) : null}
        <Input
          label="Contraseña"
          value={form.password}
          onChangeText={(password) => set({ password })}
          onBlur={touch('password')}
          secureTextEntry
          autoComplete="new-password"
          error={errors.password}
          hint={<PasswordChecklist value={form.password} />}
        />
        <TermsCheckbox checked={form.acceptTerms} onChange={(acceptTerms) => set({ acceptTerms })} error={errors.acceptTerms} />
        <Button onPress={submit} loading={pending} disabled={Boolean(taken)} block size="lg">
          Crear cuenta
        </Button>
      </View>
    </AuthShell>
  );
}

/** Tras registrarse: pide revisar el correo y permite reenviarlo. */
function ConfirmationSent({ email, onLogin }: { email: string; onLogin: () => void }) {
  const [wait, setWait] = useState(RESEND_WAIT_S);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  async function resend() {
    setSending(true);
    const { error } = await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: CONFIRM_REDIRECT } });
    setSending(false);
    if (error) return toast.error(error.status === 429 ? 'Espera un minuto antes de pedir otro correo.' : 'No pudimos reenviar el correo.');
    toast.success('Te enviamos el correo otra vez.');
    setWait(RESEND_WAIT_S);
  }

  return (
    <AuthShell title="Revisa tu correo">
      <EmptyState
        icon={MailCheck}
        title="Confirma tu cuenta"
        description={`Te enviamos un enlace a ${email}. Ábrelo y luego vuelve aquí para entrar. Si no lo ves, revisa spam o promociones.`}
        action={
          <View style={styles.actions}>
            <Button onPress={onLogin} block>
              Ir a entrar
            </Button>
            <Button variant="outline" onPress={resend} loading={sending} disabled={wait > 0} block>
              {wait > 0 ? `Reenviar correo en ${wait} s` : 'Reenviar correo'}
            </Button>
          </View>
        }
      />
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  form: { gap: 14 },
  links: { flexDirection: 'row', gap: 8, marginTop: -6 },
  actions: { gap: 10, alignSelf: 'stretch' },
});
