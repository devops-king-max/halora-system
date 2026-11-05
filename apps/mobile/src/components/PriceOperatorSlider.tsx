import React, { useMemo, useRef, useState } from "react";
import {
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  type AccessibilityActionEvent,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from "react-native";
import type { PriceOperator } from "@halora/api-client";
import { formatVnd } from "../format";

interface PriceOperatorSliderProps {
  min: number;
  max: number;
  operator: PriceOperator;
  value: number;
  onChange: (operator: PriceOperator, value: number) => void;
  onClear: () => void;
  active: boolean;
}

const OPERATORS: { value: PriceOperator; label: string; hint: string }[] = [
  { value: "GTE", label: "≥", hint: "lớn hơn hoặc bằng" },
  { value: "GT", label: ">", hint: "lớn hơn" },
  { value: "EQ", label: "=", hint: "bằng" },
  { value: "LTE", label: "≤", hint: "nhỏ hơn hoặc bằng" },
  { value: "LT", label: "<", hint: "nhỏ hơn" },
  { value: "NE", label: "≠", hint: "khác" },
];

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export function PriceOperatorSlider({
  min,
  max,
  operator,
  value,
  onChange,
  onClear,
  active,
}: PriceOperatorSliderProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const trackWidthRef = useRef(0);
  const propsRef = useRef({ min, max, operator, onChange });
  propsRef.current = { min, max, operator, onChange };

  const span = Math.max(1, max - min);
  const step = Math.max(1, Math.round(span / 100));

  const updateFromX = (x: number): void => {
    const current = propsRef.current;
    const width = trackWidthRef.current;
    if (width <= 0) return;
    const currentStep = Math.max(1, Math.round((current.max - current.min) / 100));
    const ratio = clamp(x / width, 0, 1);
    const raw = current.min + ratio * (current.max - current.min);
    const snapped = clamp(
      current.min + Math.round((raw - current.min) / currentStep) * currentStep,
      current.min,
      current.max
    );
    current.onChange(current.operator, snapped);
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event: GestureResponderEvent) =>
          updateFromX(event.nativeEvent.locationX),
        onPanResponderMove: (event: GestureResponderEvent) =>
          updateFromX(event.nativeEvent.locationX),
      }),
    []
  );

  const onLayout = (event: LayoutChangeEvent): void => {
    trackWidthRef.current = event.nativeEvent.layout.width;
    setTrackWidth(event.nativeEvent.layout.width);
  };

  const ratio = clamp((value - min) / span, 0, 1);
  const thumbX = trackWidth * ratio;
  const bubbleWidth = 128;
  const bubbleLeft = clamp(thumbX - bubbleWidth / 2, 0, Math.max(0, trackWidth - bubbleWidth));

  const accessibilityValue = {
    min,
    max,
    now: value,
    text: `${operator} ${formatVnd(String(value))}`,
  };
  const onAccessibilityAction = (event: AccessibilityActionEvent): void => {
    if (event.nativeEvent.actionName === "increment") onChange(operator, clamp(value + step, min, max));
    if (event.nativeEvent.actionName === "decrement") onChange(operator, clamp(value - step, min, max));
  };

  return (
    <View style={styles.container}>
      <View style={styles.operatorRow}>
        {OPERATORS.map((item) => {
          const selected = item.value === operator;
          return (
            <Pressable
              key={item.value}
              accessibilityRole="button"
              accessibilityLabel={`Toán tử ${item.hint}`}
              accessibilityState={{ selected }}
              onPress={() => onChange(item.value, value)}
              style={[styles.operatorChip, selected && styles.operatorChipSelected]}
            >
              <Text style={[styles.operatorLabel, selected && styles.operatorLabelSelected]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
        {active ? (
          <Pressable accessibilityRole="button" onPress={onClear} style={styles.clearButton}>
            <Text style={styles.clearText}>Bỏ lọc</Text>
          </Pressable>
        ) : null}
      </View>

      <View
        style={styles.trackArea}
        onLayout={onLayout}
        accessibilityRole="adjustable"
        accessibilityLabel="Chọn giá lọc sản phẩm"
        accessibilityValue={accessibilityValue}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={onAccessibilityAction}
        {...panResponder.panHandlers}
      >
        {trackWidth > 0 ? (
          <View
            pointerEvents="none"
            style={[styles.valueBubble, { left: bubbleLeft, width: bubbleWidth }]}
          >
            <Text style={styles.valueBubbleText} numberOfLines={1}>
              {formatVnd(String(value))}
            </Text>
          </View>
        ) : null}
        <View pointerEvents="none" style={styles.track}>
          <View style={[styles.trackFill, { width: thumbX }]} />
        </View>
        <View pointerEvents="none" style={[styles.thumb, { left: Math.max(0, thumbX - 11) }]} />
      </View>

      <View style={styles.boundsRow}>
        <Text style={styles.boundsText}>{formatVnd(String(min))}</Text>
        <Text style={styles.boundsText}>{formatVnd(String(max))}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  operatorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  operatorChip: {
    minWidth: 34,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f9fafb",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  operatorChipSelected: {
    backgroundColor: "#fde8ee",
    borderColor: "#b03a5b",
  },
  operatorLabel: {
    color: "#4b5563",
    fontSize: 15,
    fontWeight: "600",
  },
  operatorLabelSelected: {
    color: "#b03a5b",
  },
  clearButton: {
    marginLeft: "auto",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  clearText: {
    color: "#b03a5b",
    fontSize: 12,
    fontWeight: "600",
  },
  trackArea: {
    height: 56,
    justifyContent: "flex-end",
    paddingBottom: 8,
    marginTop: 4,
  },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "#e5e7eb",
    overflow: "hidden",
  },
  trackFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "#b03a5b",
  },
  thumb: {
    position: "absolute",
    bottom: 2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#ffffff",
    borderWidth: 3,
    borderColor: "#b03a5b",
  },
  valueBubble: {
    position: "absolute",
    top: 0,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#b03a5b",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  valueBubbleText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  boundsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 2,
  },
  boundsText: {
    color: "#9ca3af",
    fontSize: 11,
  },
});
