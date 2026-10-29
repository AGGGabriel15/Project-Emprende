import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Text } from '~/components/ui/text';
import { toast } from '~/components/ui/toast';
import { signInWithGoogle } from '~/features/auth/google';
import { colors, radius } from '~/theme/tokens';

function GoogleG() {
  return (
    <Svg width={18} height={18} viewBox="0 0 48 48">
      <Path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <Path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <Path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <Path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </Svg>
  );
}

export function GoogleButton({ onSignedIn }: { onSignedIn: () => void }) {
  const [pending, setPending] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      disabled={pending}
      onPress={async () => {
        setPending(true);
        const result = await signInWithGoogle();
        setPending(false);
        if (result.ok) onSignedIn();
        else if (result.error) toast.error(result.error);
      }}
      style={({ pressed }) => [styles.google, pressed && styles.pressed]}
    >
      {pending ? <ActivityIndicator color={colors.catarina} /> : <GoogleG />}
      <Text variant="bodyMedium">Continuar con Google</Text>
    </Pressable>
  );
}

export function OrDivider({ label = 'o con tu correo' }: { label?: string }) {
  return (
    <View style={styles.divider}>
      <View style={styles.line} />
      <Text variant="small" tone="muted">
        {label}
      </Text>
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  google: {
    height: 50,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.input,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.card,
  },
  pressed: { backgroundColor: colors.muted },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
});
