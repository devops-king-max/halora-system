import React from "react";
import { Image, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { ActivityIndicator, Button, Icon, Surface, Text } from "react-native-paper";
import type { RecommendationItem, RecommendationReason } from "@halora/api-client";
import { formatVnd } from "../format";

const REASON_LABEL: Record<RecommendationReason, string> = {
  CO_PURCHASE: "Thường mua cùng",
  CATEGORY: "Cùng loại sản phẩm",
  POPULAR: "Bán chạy",
};

interface RecommendationRailProps {
  title: string;
  subtitle?: string;
  items: RecommendationItem[];
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
  onPressItem: (item: RecommendationItem) => void;
}

/**
 * Horizontal recommendation list. Renders nothing when the API returns an
 * empty list, so a section with no real data is hidden instead of faked.
 */
export function RecommendationRail({
  title,
  subtitle,
  items,
  isLoading,
  error,
  onRetry,
  onPressItem,
}: RecommendationRailProps) {
  if (!isLoading && !error && items.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text variant="titleMedium" style={styles.title}>
        {title}
      </Text>
      {subtitle ? (
        <Text variant="bodySmall" style={styles.subtitle}>
          {subtitle}
        </Text>
      ) : null}

      {isLoading ? (
        <View style={styles.stateRow}>
          <ActivityIndicator size="small" color="#b03a5b" />
          <Text style={styles.stateText}>Đang tải gợi ý...</Text>
        </View>
      ) : error ? (
        <Surface style={styles.errorCard} elevation={0}>
          <Text style={styles.errorText}>Không tải được gợi ý sản phẩm.</Text>
          <Button compact mode="text" textColor="#b03a5b" onPress={onRetry}>
            Thử lại
          </Button>
        </Surface>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.rail}
        >
          {items.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.card}
              onPress={() => onPressItem(item)}
            >
              {item.thumbnailUrl ? (
                <Image source={{ uri: item.thumbnailUrl }} style={styles.image} resizeMode="cover" />
              ) : (
                <View style={styles.noImage}>
                  <Icon source="image-off-outline" size={24} color="#9ca3af" />
                </View>
              )}
              <View style={styles.body}>
                {item.brandName ? (
                  <Text variant="labelSmall" style={styles.brand} numberOfLines={1}>
                    {item.brandName}
                  </Text>
                ) : null}
                <Text numberOfLines={2} variant="bodySmall" style={styles.name}>
                  {item.name}
                </Text>
                <Text variant="titleSmall" style={styles.price}>
                  {formatVnd(item.priceFrom)}
                </Text>
                <Text variant="labelSmall" style={styles.reason} numberOfLines={1}>
                  {REASON_LABEL[item.reason]}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 10,
    backgroundColor: "#ffffff",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#f3f4f6",
  },
  title: {
    fontWeight: "700",
    color: "#1f2937",
  },
  subtitle: {
    color: "#6b7280",
    marginTop: 2,
    marginBottom: 4,
  },
  stateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
  },
  stateText: {
    color: "#6b7280",
    marginLeft: 8,
  },
  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 8,
    backgroundColor: "#fff1f2",
    borderRadius: 6,
    marginTop: 8,
  },
  errorText: {
    color: "#e11d48",
    fontSize: 13,
  },
  rail: {
    gap: 12,
    paddingTop: 10,
    paddingBottom: 2,
  },
  card: {
    width: 150,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    overflow: "hidden",
    backgroundColor: "#ffffff",
  },
  image: {
    width: "100%",
    height: 120,
    backgroundColor: "#f3f4f6",
  },
  noImage: {
    width: "100%",
    height: 120,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    padding: 8,
  },
  brand: {
    color: "#9ca3af",
    textTransform: "uppercase",
    fontSize: 10,
    fontWeight: "600",
  },
  name: {
    color: "#1f2937",
    fontWeight: "500",
    minHeight: 34,
    lineHeight: 17,
    marginTop: 2,
  },
  price: {
    color: "#b03a5b",
    fontWeight: "700",
    marginTop: 4,
  },
  reason: {
    color: "#6b7280",
    marginTop: 2,
  },
});
