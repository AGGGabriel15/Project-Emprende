import * as Haptics from 'expo-haptics';
import type { LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { colors, fonts, radius } from '~/theme/tokens';

const VARIANTS = {
  primary: { bg: colors.primary, fg: colors.white, border: colors.primary },
  outline: { bg: colors.card, fg: colors.foreground, border: colors.input },
  secondary: { bg: colors.niebla, fg: colors.secondaryForeground, border: colors.niebla },
  ghost: { bg: 'transparent', fg: colors.foreground, border: 'transparent' },
  danger: { bg: colors.danger, fg: colors.white, border: colors.danger },
  white: { bg: colors.white, fg: colors.catarina, border: colors.white },
  glass: { bg: 'rgba(255,255,255,0.14)', fg: colors.white, border: 'rgba(255,255,255,0.55)' },
} as const;

const SIZES = {
  sm: { height: 38, paddingHorizontal: 14, fontSize: 14, icon: 16 },
  md: { height: 48, paddingHorizontal: 20, fontSize: 15, icon: 18 },
  lg: { height: 54, paddingHorizontal: 24, fontSize: 16, icon: 20 },
} as const;

export type ButtonProps = {
  children?: React.ReactNode;
  onPress?: () => void;
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
  block?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

/** Botón de la marca (Outfit) que se encoge al tocarlo y vibra suave. */
export function Button({
  children,
  onPress,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconRight: IconRight,
  loading,
  disabled,
  block,
  style,
  accessibilityLabel,
}: ButtonProps) {
  const v = VARIANTS[variant];
  const s = SIZES[size];
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const inactive = disabled || loading;

  return (
    <Animated.View style={[block && styles.block, animated, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled: !!inactive, busy: !!loading }}
        disabled={inactive}
        onPressIn={() => scale.set(withSpring(0.96, { damping: 15, stiffness: 400 }))}
        onPressOut={() => scale.set(withSpring(1, { damping: 12, stiffness: 300 }))}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          onPress?.();
        }}
        style={[
          styles.base,
          { height: s.height, paddingHorizontal: s.paddingHorizontal, backgroundColor: v.bg, borderColor: v.border },
          inactive && styles.disabled,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={v.fg} />
        ) : (
          <>
            {Icon && <Icon size={s.icon} color={v.fg} strokeWidth={2.2} />}
            {children != null && (
              <Text numberOfLines={1} style={{ color: v.fg, fontFamily: fonts.displayMedium, fontSize: s.fontSize }}>
                {children}
              </Text>
            )}
            {IconRight && <IconRight size={s.icon} color={v.fg} strokeWidth={2.2} />}
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}

/** Botón redondo solo con ícono (cerrar, menú, acciones en encabezados). */
export function IconButton({
  icon: Icon,
  onPress,
  label,
  tone = 'default',
  size = 40,
}: {
  icon: LucideIcon;
  onPress: () => void;
  label: string;
  tone?: 'default' | 'white' | 'glass';
  size?: number;
}) {
  const bg = tone === 'glass' ? 'rgba(14,59,39,0.35)' : tone === 'white' ? colors.white : 'transparent';
  const fg = tone === 'glass' ? colors.white : colors.foreground;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [
        styles.icon,
        { width: size, height: size, backgroundColor: pressed && tone === 'default' ? colors.muted : bg },
      ]}
    >
      <Icon size={20} color={fg} strokeWidth={2.1} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  block: { alignSelf: 'stretch' },
  disabled: { opacity: 0.5 },
  icon: { borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
});
