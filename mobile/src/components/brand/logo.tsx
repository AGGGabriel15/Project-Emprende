import Svg, { Circle, G, Path } from 'react-native-svg';
import { ISOTIPO, LOGO_ISOTIPO, MARKET_PATHS, NAME_PATHS } from './paths';

/** Positiva (uso principal) y negativa (sobre verde), según el manual. */
const TONES = {
  color: { stroke: '#1E7A4C', leaf: '#3FA66B', wheels: '#1E7A4C', name: '#0E3B27', market: '#1E7A4C' },
  negative: { stroke: '#FFFFFF', leaf: '#9BD3AE', wheels: '#FFFFFF', name: '#FFFFFF', market: '#FFFFFF' },
} as const;

type Tone = keyof typeof TONES;

/** Logotipo horizontal: isotipo + Catarina MARKET. */
export function Logo({ height = 36, tone = 'color' }: { height?: number; tone?: Tone }) {
  const c = TONES[tone];
  return (
    <Svg width={(height * 378) / 108} height={height} viewBox="33 18 378 108" accessibilityLabel="Catarina Market">
      <Path d={LOGO_ISOTIPO.c} fill="none" stroke={c.stroke} strokeLinecap="round" strokeWidth={14} />
      <Path d={LOGO_ISOTIPO.leaf} fill={c.leaf} />
      {LOGO_ISOTIPO.wheels.map((w) => (
        <Circle key={w.cx} cx={w.cx} cy={w.cy} r={7} fill={c.wheels} />
      ))}
      <G fill={c.name}>
        {NAME_PATHS.map((d) => (
          <Path key={d.slice(0, 12)} d={d} />
        ))}
      </G>
      <G fill={c.market}>
        {MARKET_PATHS.map((d) => (
          <Path key={d.slice(0, 12)} d={d} />
        ))}
      </G>
    </Svg>
  );
}

/** Isotipo solo (la C con la hoja y las ruedas). */
export function Isotipo({ size = 40, tone = 'color' }: { size?: number; tone?: Tone }) {
  const c = TONES[tone];
  return (
    <Svg width={size} height={size} viewBox="30 4 84 116">
      <Path d={ISOTIPO.c} fill="none" stroke={c.stroke} strokeLinecap="round" strokeWidth={14} />
      <Path d={ISOTIPO.leaf} fill={c.leaf} />
      {ISOTIPO.wheels.map((w) => (
        <Circle key={w.cx} cx={w.cx} cy={w.cy} r={7} fill={c.wheels} />
      ))}
    </Svg>
  );
}
