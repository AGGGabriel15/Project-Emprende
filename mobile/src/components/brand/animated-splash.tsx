import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';
import { colors } from '~/theme/tokens';
import { PatternBackground } from './pattern';
import { ISOTIPO, MARKET_PATHS, NAME_PATHS } from './paths';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const MARK = 150; // px del isotipo (su caja es de 120 unidades)
const K = MARK / 120;

/**
 * Animación de apertura con la identidad de la marca. Arranca sobre el mismo
 * verde del splash nativo (que no tiene imagen), así no hay salto:
 * el patrón aparece, la C se dibuja, ruedan las ruedas, brota la hoja y sube
 * "Catarina MARKET". Espera a que la app esté lista (`ready`) para salir.
 * `short` es la versión breve al volver tras un rato en segundo plano.
 */
export function AnimatedSplash({
  ready,
  variant = 'full',
  onFinish,
}: {
  ready: boolean;
  variant?: 'full' | 'short';
  onFinish: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const t = variant === 'short' ? 0.5 : 1;

  const pattern = useSharedValue(0);
  const drawC = useSharedValue(0);
  const wheels = useSharedValue(0);
  const leaf = useSharedValue(0);
  const sway = useSharedValue(0);
  const name = useSharedValue(0);
  const market = useSharedValue(0);
  const exit = useSharedValue(0);
  const startedAt = useRef(0);
  const length = reduceMotion ? 250 : 1800 * t;

  useEffect(() => {
    startedAt.current = Date.now();
    if (reduceMotion) {
      [pattern, drawC, wheels, leaf, name, market].forEach((v) => v.set(1));
      return;
    }
    const ease = Easing.out(Easing.cubic);
    pattern.set(withTiming(1, { duration: 700 * t, easing: ease }));
    drawC.set(withDelay(150 * t, withTiming(1, { duration: 750 * t, easing: Easing.inOut(Easing.cubic) })));
    wheels.set(withDelay(550 * t, withSpring(1, { damping: 9, stiffness: 170, mass: 0.7 })));
    leaf.set(withDelay(850 * t, withSpring(1, { damping: 7, stiffness: 150, mass: 0.6 })));
    name.set(withDelay(1050 * t, withTiming(1, { duration: 450 * t, easing: ease })));
    market.set(withDelay(1200 * t, withTiming(1, { duration: 550 * t, easing: ease })));
  }, [reduceMotion, t, pattern, drawC, wheels, leaf, name, market]);

  // Si la app tarda, la hoja se mece mientras espera; luego sale.
  useEffect(() => {
    if (ready) {
      // Sale cuando termina la animación, o de inmediato si la app tardó más que ella.
      const wait = Math.max(0, length - (Date.now() - startedAt.current));
      exit.set(
        withDelay(
          wait,
          withTiming(1, { duration: reduceMotion ? 220 : 420, easing: Easing.in(Easing.cubic) }, (finished) => {
            if (finished) scheduleOnRN(onFinish);
          }),
        ),
      );
    } else if (!reduceMotion) {
      sway.set(withDelay(length, withRepeat(withSequence(withTiming(1, { duration: 500 }), withTiming(-1, { duration: 500 })), -1, true)));
    }
  }, [ready, reduceMotion, length, exit, sway, onFinish]);

  const container = useAnimatedStyle(() => ({ opacity: 1 - exit.get() }));
  const patternStyle = useAnimatedStyle(() => ({
    opacity: pattern.get(),
    transform: [{ translateX: -48 + 24 * pattern.get() }, { translateY: -48 + 24 * pattern.get() }],
  }));
  const markStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -24 * exit.get() }, { scale: 1 - 0.18 * exit.get() }],
  }));
  const cProps = useAnimatedProps(() => ({ strokeDashoffset: ISOTIPO.cLength * (1 - drawC.get()) }));
  const leafStyle = useAnimatedStyle(() => ({
    opacity: leaf.get() > 0.02 ? 1 : 0,
    transform: [{ scale: leaf.get() }, { rotate: `${sway.get() * 7}deg` }],
  }));
  const nameStyle = useAnimatedStyle(() => ({ opacity: name.get(), transform: [{ translateY: 18 * (1 - name.get()) }] }));
  const marketStyle = useAnimatedStyle(() => ({
    opacity: market.get(),
    transform: [{ scaleX: 0.7 + 0.3 * market.get() }],
  }));

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.root, container]}
      onLayout={() => SplashScreen.hideAsync().catch(() => {})}
      pointerEvents="none"
      accessibilityLabel="Catarina Market"
    >
      <Animated.View style={[styles.pattern, patternStyle]}>
        <PatternBackground variant="green" />
      </Animated.View>

      <Animated.View style={markStyle}>
        <View style={styles.mark}>
          <Svg width={MARK} height={MARK} viewBox="0 0 120 120">
            <AnimatedPath
              d={ISOTIPO.c}
              fill="none"
              stroke="#FFFFFF"
              strokeWidth={14}
              strokeLinecap="round"
              strokeDasharray={[ISOTIPO.cLength, ISOTIPO.cLength]}
              animatedProps={cProps}
            />
          </Svg>
          <Animated.View style={[styles.leaf, leafStyle]}>
            <Svg width={22 * K} height={22 * K} viewBox="84 12 22 22">
              <Path d={ISOTIPO.leaf} fill={colors.hojaClara} />
            </Svg>
          </Animated.View>
          {ISOTIPO.wheels.map((w, index) => (
            <Wheel key={w.cx} cx={w.cx} cy={w.cy} side={index === 0 ? -1 : 1} progress={wheels} />
          ))}
        </View>

        <Animated.View style={[styles.name, nameStyle]}>
          <Svg width={210} height={(210 * 50) / 248} viewBox="162 25 248 50">
            <G fill="#FFFFFF">
              {NAME_PATHS.map((d) => (
                <Path key={d.slice(0, 12)} d={d} />
              ))}
            </G>
          </Svg>
        </Animated.View>
        <Animated.View style={[styles.market, marketStyle]}>
          <Svg width={124} height={(124 * 18) / 146} viewBox="162 97 146 18">
            <G fill={colors.hojaClara}>
              {MARKET_PATHS.map((d) => (
                <Path key={d.slice(0, 12)} d={d} />
              ))}
            </G>
          </Svg>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

/** Una rueda: cae desde arriba y rueda hacia su lugar con un rebote. */
function Wheel({ cx, cy, side, progress }: { cx: number; cy: number; side: -1 | 1; progress: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({
    opacity: Math.min(1, progress.get() * 3),
    transform: [{ translateY: -46 * (1 - progress.get()) }, { translateX: side * 14 * (1 - progress.get()) }],
  }));
  return (
    <Animated.View style={[styles.wheel, { left: (cx - 7) * K, top: (cy - 7) * K }, style]}>
      <Svg width={14 * K} height={14 * K} viewBox="0 0 14 14">
        <Circle cx={7} cy={7} r={7} fill="#FFFFFF" />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: colors.catarina, alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  pattern: { position: 'absolute', top: -96, left: -96, right: -96, bottom: -96 },
  mark: { width: MARK, height: MARK, alignSelf: 'center' },
  leaf: { position: 'absolute', left: 84 * K, top: 12 * K, transformOrigin: 'left bottom' },
  wheel: { position: 'absolute' },
  name: { alignItems: 'center', marginTop: 22 },
  market: { alignItems: 'center', marginTop: 10 },
});
