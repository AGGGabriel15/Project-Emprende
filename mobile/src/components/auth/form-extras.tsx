import * as WebBrowser from 'expo-web-browser';
import { Check, Circle } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { PASSWORD_RULES } from '@/lib/validations/auth';
import { Text } from '~/components/ui/text';
import { WEB_URL } from '~/lib/api';
import { colors, radius } from '~/theme/tokens';

/** Requisitos de la contraseña marcados en vivo mientras se escribe. */
export function PasswordChecklist({ value }: { value: string }) {
  return (
    <View style={styles.rules} accessibilityLabel="Requisitos de la contraseña">
      {PASSWORD_RULES.map((rule) => {
        const ok = rule.test(value);
        return (
          <View key={rule.label} style={styles.rule}>
            {ok ? <Check size={14} color={colors.catarina} strokeWidth={3} /> : <Circle size={12} color={colors.mutedForeground} />}
            <Text variant="small" tone={ok ? 'primary' : 'muted'}>
              {rule.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/** Casilla de consentimiento (Ley 787) con enlaces a los términos y al aviso de privacidad. */
export function TermsCheckbox({ checked, onChange, error }: { checked: boolean; onChange: (value: boolean) => void; error?: string }) {
  return (
    <View style={styles.wrap}>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={() => onChange(!checked)} style={styles.terms}>
        <View style={[styles.check, checked && styles.checked, error ? styles.checkError : null]}>
          {checked && <Check size={14} color={colors.white} strokeWidth={3} />}
        </View>
        <Text variant="small" style={styles.termsText}>
          Acepto los{' '}
          <Text variant="smallMedium" tone="primary" onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/terminos`)}>
            términos y condiciones
          </Text>{' '}
          y el{' '}
          <Text variant="smallMedium" tone="primary" onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/privacidad`)}>
            aviso de privacidad
          </Text>{' '}
          (Ley 787 de Protección de Datos Personales).
        </Text>
      </Pressable>
      {error ? (
        <Text variant="small" tone="danger">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  rules: { gap: 4, marginTop: 2 },
  rule: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  wrap: { gap: 6 },
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
  checkError: { borderColor: colors.danger },
});
