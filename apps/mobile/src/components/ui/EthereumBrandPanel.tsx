import { useEffect } from "react";
import { Image, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming
} from "react-native-reanimated";
import { motionDurations } from "@stealth-trails-bank/ui-foundation";
import { AppText } from "./AppText";

type EthereumBrandPanelProps = {
  readonly title?: string;
  readonly subtitle?: string;
  readonly centered?: boolean;
  readonly compact?: boolean;
  readonly testID?: string;
};

type EthereumMarkProps = {
  readonly size?: number;
};

function EthereumMark({ size = 88 }: EthereumMarkProps) {
  return (
    <Image
      accessibilityLabel="Stealth Trails logo"
      resizeMode="contain"
      source={require("../../../assets/brand-mark.png")}
      style={{ height: size, width: size }}
    />
  );
}

export function EthereumBrandPanel({
  title = "Stealth Trails",
  subtitle,
  centered = true,
  compact = false,
  testID,
}: EthereumBrandPanelProps) {
  const alignmentClassName = centered ? "items-center" : "items-start";
  const textClassName = centered ? "text-center" : "text-left";
  const markSize = compact ? 72 : 104;
  const containerClassName = compact
    ? `gap-3 rounded-[28px] border border-sand bg-white/90 px-5 py-5 ${alignmentClassName}`
    : `gap-4 rounded-[32px] border border-sand bg-white/90 px-6 py-6 ${alignmentClassName}`;
  const drift = useSharedValue(0);

  useEffect(() => {
    drift.value = withRepeat(
      withTiming(1, {
        duration: motionDurations.ambientMs,
        easing: Easing.inOut(Easing.quad)
      }),
      -1,
      true
    );
  }, [drift]);

  const markStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: drift.value * -2 },
      { scale: 1 + drift.value * 0.01 }
    ]
  }));

  return (
    <View className={containerClassName} testID={testID}>
      <Animated.View style={markStyle}>
        <EthereumMark size={markSize} />
      </Animated.View>
      <View className={`gap-1 ${alignmentClassName}`}>
        <AppText className={`text-2xl text-ink ${textClassName}`} weight="bold">
          {title}
        </AppText>
        {subtitle ? (
          <AppText
            className={`max-w-[280px] text-sm leading-6 text-slate ${textClassName}`}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}
