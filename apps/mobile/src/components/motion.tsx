import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, Pressable, type PressableProps, type ViewStyle } from 'react-native';

/**
 * Entrance animation: fades + slides content up on mount. Pass an incrementing
 * `delay` to stagger a list of siblings for a smooth cascade.
 * Failsafe: if the animation is interrupted, snap to fully visible so content
 * never stays stuck at opacity 0 (common on tab switch / remounts).
 */
export function FadeInUp({
  children,
  delay = 0,
  distance = 16,
  duration = 460,
  style,
}: {
  children: ReactNode;
  delay?: number;
  distance?: number;
  duration?: number;
  style?: ViewStyle | ViewStyle[];
}) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progress.setValue(0);
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start(({ finished }) => {
      if (!finished) progress.setValue(1);
    });
    return () => {
      anim.stop();
      // Ensure cleanup never leaves children invisible.
      progress.setValue(1);
    };
  }, [progress, delay, duration]);

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [distance, 0],
  });

  return (
    <Animated.View style={[{ opacity: progress, transform: [{ translateY }] }, style]}>
      {children}
    </Animated.View>
  );
}

/** Pressable that springs its scale down on press for tactile feedback. */
export function PressCard({
  children,
  style,
  scaleTo = 0.97,
  ...props
}: PressableProps & { children: ReactNode; style?: ViewStyle | ViewStyle[]; scaleTo?: number }) {
  const scale = useRef(new Animated.Value(1)).current;

  function pressIn() {
    Animated.spring(scale, { toValue: scaleTo, useNativeDriver: true, speed: 40, bounciness: 0 }).start();
  }
  function pressOut() {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 6 }).start();
  }

  return (
    <Pressable onPressIn={pressIn} onPressOut={pressOut} {...props}>
      <Animated.View style={[{ transform: [{ scale }] }, style]}>{children}</Animated.View>
    </Pressable>
  );
}

/** Gently pulsing halo/scale, used for status/live indicators. */
export function Pulse({ children, style }: { children: ReactNode; style?: ViewStyle | ViewStyle[] }) {
  const value = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(value, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [value]);

  const scale = value.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const opacity = value.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });

  return <Animated.View style={[{ transform: [{ scale }], opacity }, style]}>{children}</Animated.View>;
}
