import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, G, Path, Pattern, Rect } from 'react-native-svg';
import { colors } from '~/theme/tokens';

/**
 * Patrón gráfico de la marca (flor, cántaro, hoja y carrito), igual que
 * public/brand/patron-*.svg: sobre verde al 16 % de blanco, o sobre Niebla.
 */
const VARIANTS = {
  green: { background: colors.catarina, fill: '#FFFFFF', opacity: 0.16 },
  light: { background: colors.niebla, fill: '#D6E9DC', opacity: 1 },
} as const;

export function PatternTile({ fill, opacity }: { fill: string; opacity: number }) {
  return (
    <G opacity={opacity}>
      <G transform="translate(4 4)" fill={fill}>
        <Circle cx={20} cy={13} r={5.5} />
        <Circle cx={26.66} cy={17.84} r={5.5} />
        <Circle cx={24.11} cy={25.66} r={5.5} />
        <Circle cx={15.89} cy={25.66} r={5.5} />
        <Circle cx={13.34} cy={17.84} r={5.5} />
      </G>
      <Path
        transform="translate(52 4)"
        fill={fill}
        d="M14 5H26V8H24V12C30 14 33 20 33 26C33 32 27 36 20 36C13 36 7 32 7 26C7 20 10 14 16 12V8H14Z"
      />
      <Path transform="translate(4 52)" fill={fill} d="M8 32C8 18 18 8 32 8C32 22 22 32 8 32Z" />
      <G transform="translate(54 54) scale(0.32)">
        <Path d="M82.5 35.4A32 32 0 1 0 82.5 76.6" fill="none" stroke={fill} strokeWidth={14} strokeLinecap="round" />
        <Circle cx={44} cy={106} r={7} fill={fill} />
        <Circle cx={72} cy={106} r={7} fill={fill} />
      </G>
    </G>
  );
}

/** Fondo con el patrón; ocupa todo su contenedor. */
export function PatternBackground({
  variant = 'green',
  style,
  tile = 96,
}: {
  variant?: keyof typeof VARIANTS;
  style?: StyleProp<ViewStyle>;
  tile?: number;
}) {
  const v = VARIANTS[variant];
  const id = `patron-${variant}`;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: v.background }, style]}>
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id={id} width={tile} height={tile} patternUnits="userSpaceOnUse" viewBox="0 0 96 96">
            <PatternTile fill={v.fill} opacity={v.opacity} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}
