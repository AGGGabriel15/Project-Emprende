import { Eye, EyeOff } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { colors, fonts, radius } from '~/theme/tokens';
import { Text } from './text';

export function Field({
  label,
  error,
  hint,
  children,
  right,
}: {
  label?: string;
  error?: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      {(label || right) && (
        <View style={styles.labelRow}>
          {label && <Text variant="smallMedium">{label}</Text>}
          {right}
        </View>
      )}
      {children}
      {error ? (
        <Text variant="small" tone="danger">
          {error}
        </Text>
      ) : typeof hint === 'string' ? (
        <Text variant="small" tone="muted">
          {hint}
        </Text>
      ) : (
        (hint ?? null)
      )}
    </View>
  );
}

export function Input({
  label,
  error,
  hint,
  style,
  multiline,
  right,
  secureTextEntry,
  ...props
}: TextInputProps & { label?: string; error?: string; hint?: React.ReactNode; right?: React.ReactNode }) {
  const [focused, setFocused] = useState(false);
  // Las contraseñas llevan un ojo para mostrarlas u ocultarlas.
  const [revealed, setRevealed] = useState(false);
  const input = (
      <TextInput
        placeholderTextColor={colors.mutedForeground}
        selectionColor={colors.brote}
        cursorColor={colors.catarina}
        {...props}
        secureTextEntry={secureTextEntry && !revealed}
        multiline={multiline}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
        style={[
          styles.input,
          multiline && styles.multiline,
          focused && styles.focused,
          error ? styles.invalid : null,
          secureTextEntry && styles.withEye,
          style,
        ]}
      />
  );
  return (
    <Field label={label} error={error} hint={hint} right={right}>
      {secureTextEntry ? (
        <View>
          {input}
          <Pressable
            onPress={() => setRevealed((current) => !current)}
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            hitSlop={6}
            style={styles.eye}
          >
            {revealed ? <EyeOff size={20} color={colors.mutedForeground} /> : <Eye size={20} color={colors.mutedForeground} />}
          </Pressable>
        </View>
      ) : (
        input
      )}
    </Field>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  input: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.input,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    fontFamily: fonts.sans,
    fontSize: 15,
    color: colors.foreground,
  },
  multiline: { minHeight: 96, paddingTop: 12, textAlignVertical: 'top' },
  focused: { borderColor: colors.brote, borderWidth: 2, paddingHorizontal: 13 },
  invalid: { borderColor: colors.danger },
  withEye: { paddingRight: 46 },
  eye: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 46, alignItems: 'center', justifyContent: 'center' },
});
