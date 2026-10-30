import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { loginSchema } from '@/lib/validations/auth';
import { AuthShell } from '~/components/auth/auth-shell';
import { GoogleButton, OrDivider } from '~/components/auth/google-button';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Text } from '~/components/ui/text';
import { toast } from '~/components/ui/toast';
import { signInWithPassword, WEB_URL } from '~/lib/api';
import { supabase } from '~/lib/supabase';
import { useGoToHomeWhenSignedIn } from '~/features/auth/navigation';
import { fieldErrors } from '~/lib/forms';

export default function LoginScreen() {
  const router = useRouter();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  // Al entrar, va directo a la pantalla de su rol (ver useGoToHomeWhenSignedIn).
  useGoToHomeWhenSignedIn(next);

  async function submit() {
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    setPending(true);
    const result = await signInWithPassword(parsed.data);
    if (!result.ok) {
      setPending(false);
      return toast.error(result.error);
    }
    const { data: profile } = await supabase.from('profiles').select('is_active').eq('id', result.data.userId).single();
    if (profile && !profile.is_active) {
      await supabase.auth.signOut();
      setPending(false);
      return toast.error('Tu cuenta está desactivada. Contacta a soporte.');
    }
    // Sigue "cargando" hasta que la sesión tenga perfil y navegue.
  }

  return (
    <AuthShell
      title="Bienvenido de vuelta"
      description="Entra para comprar, atender tu negocio o hacer tus entregas."
      footer={
        <>
          <Text variant="small" tone="muted">
            ¿No tienes cuenta?{' '}
            <Link href={{ pathname: '/registro', params: next ? { next } : {} }} replace>
              <Text variant="smallMedium" tone="primary">
                Regístrate gratis
              </Text>
            </Link>
          </Text>
          <Pressable onPress={() => router.replace('/')} hitSlop={8}>
            <Text variant="smallMedium" tone="muted">
              Explorar sin cuenta
            </Text>
          </Pressable>
        </>
      }
    >
      <GoogleButton />
      <OrDivider />
      <View style={styles.form}>
        <Input
          label="Correo"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          error={errors.email}
          returnKeyType="next"
        />
        <Input
          label="Contraseña"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          error={errors.password}
          returnKeyType="go"
          onSubmitEditing={submit}
          right={
            <Pressable hitSlop={8} onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/recuperar`)}>
              <Text variant="smallMedium" tone="primary">
                ¿La olvidaste?
              </Text>
            </Pressable>
          }
        />
        <Button onPress={submit} loading={pending} block size="lg">
          Entrar
        </Button>
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  form: { gap: 14 },
});
