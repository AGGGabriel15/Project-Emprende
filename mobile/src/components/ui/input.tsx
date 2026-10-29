import { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
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
  hint?: string;
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
      ) : hint ? (
        <Text variant="small" tone="muted">
          {hint}
        </Text>
      ) : null}
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
  ...props
}: TextInputProps & { label?: string; error?: string; hint?: string; right?: React.ReactNode }) {
  const [focused, setFocused] = useState(false);
  return (
    <Field label={label} error={error} hint={hint} right={right}>
      <TextInput
        placeholderTextColor={colors.mutedForeground}
        selectionColor={colors.brote}
        cursorColor={colors.catarina}
        {...props}
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
          style,
        ]}
      />
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
});
