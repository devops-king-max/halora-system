import React from "react";
import {
  View,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { Text, Surface, Icon, Divider } from "react-native-paper";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../src/api";
import { ApiStateWrapper } from "../../src/components/ApiStateWrapper";
import { Category } from "@halora/api-client";

export default function CategoriesScreen() {
  const router = useRouter();

  const {
    data,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["mobile-categories"],
    queryFn: () => apiClient.categories.listPublic({ limit: 100 }),
  });

  const categories = data?.data || [];

  const handleCategoryPress = (category: Category) => {
    router.push({
      pathname: "/products",
      params: {
        categoryId: category.id,
        categoryName: category.name,
      },
    });
  };

  return (
    <View style={styles.container}>
      <ApiStateWrapper
        isLoading={isLoading}
        error={error as Error | null}
        onRetry={refetch}
        isEmpty={categories.length === 0}
        emptyMessage="Chưa có loại sản phẩm nào trong hệ thống."
      >
        <FlatList
          data={categories}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              colors={["#b03a5b"]}
            />
          }
          ItemSeparatorComponent={() => <Divider style={styles.divider} />}
          renderItem={({ item }: { item: Category }) => (
            <TouchableOpacity
              style={styles.itemRow}
              onPress={() => handleCategoryPress(item)}
            >
              <Surface style={styles.iconContainer} elevation={0}>
                <Icon source="tag-heart-outline" size={24} color="#b03a5b" />
              </Surface>
              <View style={styles.textContainer}>
                <Text variant="titleMedium" style={styles.categoryName}>
                  {item.name}
                </Text>
                {item.description ? (
                  <Text
                    numberOfLines={2}
                    variant="bodySmall"
                    style={styles.categoryDesc}
                  >
                    {item.description}
                  </Text>
                ) : null}
              </View>
              <Icon source="chevron-right" size={24} color="#9ca3af" />
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.listContent}
        />
      </ApiStateWrapper>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  listContent: {
    paddingVertical: 8,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#fde8ee",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  textContainer: {
    flex: 1,
  },
  categoryName: {
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 2,
  },
  categoryDesc: {
    color: "#6b7280",
  },
  divider: {
    marginLeft: 78,
    backgroundColor: "#f3f4f6",
  },
});
