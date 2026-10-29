import { Check, ChevronDown, Search } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { colors, fonts, radius } from '~/theme/tokens';
import { Field } from './input';
import { Sheet } from './sheet';
import { Text } from './text';

export type Option<T extends string | number> = { value: T; label: string; detail?: string };

/** Lista desplegable: abre un panel con las opciones (y buscador si son muchas). */
export function Select<T extends string | number>({
  label,
  value,
  options,
  onChange,
  placeholder = 'Elige…',
  error,
  disabled,
}: {
  label?: string;
  value: T | null | undefined;
  options: Option<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = options.find((o) => o.value === value);
  const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const filtered = query ? options.filter((o) => normalize(o.label).includes(normalize(query))) : options;

  return (
    <Field label={label} error={error}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={disabled}
        onPress={() => {
          setQuery('');
          setOpen(true);
        }}
        style={[styles.trigger, error ? styles.invalid : null, disabled && styles.disabled]}
      >
        <Text variant="body" tone={selected ? 'default' : 'muted'} numberOfLines={1} style={styles.value}>
          {selected?.label ?? placeholder}
        </Text>
        <ChevronDown size={18} color={colors.catarina} />
      </Pressable>
      <Sheet open={open} onClose={() => setOpen(false)} title={label ?? 'Elige una opción'}>
        {options.length > 8 && (
          <View style={styles.search}>
            <Search size={18} color={colors.mutedForeground} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Buscar…"
              placeholderTextColor={colors.mutedForeground}
              style={styles.searchInput}
              autoCorrect={false}
            />
          </View>
        )}
        <View>
          {filtered.map((option) => {
            const active = option.value === value;
            return (
              <Pressable
                key={String(option.value)}
                onPress={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
              >
                <View style={styles.optionText}>
                  <Text variant={active ? 'bodyMedium' : 'body'} tone={active ? 'primary' : 'default'}>
                    {option.label}
                  </Text>
                  {option.detail && (
                    <Text variant="small" tone="muted">
                      {option.detail}
                    </Text>
                  )}
                </View>
                {active && <Check size={18} color={colors.catarina} />}
              </Pressable>
            );
          })}
          {filtered.length === 0 && (
            <Text variant="small" tone="muted" style={styles.none}>
              Sin resultados.
            </Text>
          )}
        </View>
      </Sheet>
    </Field>
  );
}

const styles = StyleSheet.create({
  trigger: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.input,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
  },
  value: { flex: 1 },
  invalid: { borderColor: colors.danger },
  disabled: { opacity: 0.5, backgroundColor: colors.muted },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: radius.md,
    backgroundColor: colors.muted,
    paddingHorizontal: 12,
  },
  searchInput: { flex: 1, minHeight: 44, fontFamily: fonts.sans, fontSize: 15, color: colors.foreground },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.muted,
  },
  optionPressed: { backgroundColor: colors.muted },
  optionText: { flex: 1, gap: 2 },
  none: { textAlign: 'center', paddingVertical: 16 },
});
