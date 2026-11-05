import React, { useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  RefreshControl,
  Dimensions,
} from "react-native";
import {
  Searchbar,
  Text,
  Card,
  Surface,
  Button,
  Icon,
} from "react-native-paper";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../src/api";
import { useAuth } from "../../src/AuthContext";
import { ApiStateWrapper } from "../../src/components/ApiStateWrapper";
import { RecommendationRail } from "../../src/components/RecommendationRail";
import { formatVnd } from "../../src/format";
import { Category, PublicProductSummary } from "@halora/api-client";

const { width } = Dimensions.get("window");
const CARD_WIDTH = (width - 48) / 2;

export default function HomeScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");

  const {
    data: categoriesData,
    isLoading: isCategoriesLoading,
    error: categoriesError,
    refetch: refetchCategories,
  } = useQuery({
    queryKey: ["home-categories"],
    queryFn: () => apiClient.categories.listPublic({ limit: 10 }),
  });

  const {
    data: productsData,
    isLoading: isProductsLoading,
    error: productsError,
    refetch: refetchProducts,
    isRefetching,
  } = useQuery({
    queryKey: ["home-featured-products"],
    queryFn: () => apiClient.products.listPublic({ limit: 10, isFeatured: true }),
  });

  const {
    data: recommendations,
    isLoading: isRecommendationsLoading,
    error: recommendationsError,
    refetch: refetchRecommendations,
  } = useQuery({
    queryKey: ["home-recommendations"],
    queryFn: () => apiClient.customerPortal.getRecommendations(6),
    enabled: isAuthenticated,
  });

  const handleSearchSubmit = () => {
    if (searchQuery.trim()) {
      router.push({
        pathname: "/products",
        params: { search: searchQuery.trim() },
      });
    }
  };

  const handleRefresh = async () => {
    await Promise.all([
      refetchCategories(),
      refetchProducts(),
      ...(isAuthenticated ? [refetchRecommendations()] : []),
    ]);
  };

  const categories = categoriesData?.data || [];
  const products = productsData?.data || [];

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={handleRefresh}
          colors={["#b03a5b"]}
        />
      }
    >
      {/* Header Search Banner */}
      <Surface style={styles.headerBanner} elevation={0}>
        <Text variant="headlineSmall" style={styles.brandTitle}>
          Halora
        </Text>
        <Text variant="bodyMedium" style={styles.brandSubtitle}>
          Mỹ phẩm chính hãng & Chăm sóc sắc đẹp
        </Text>
        <Searchbar
          placeholder="Tìm kiếm sản phẩm, thương hiệu..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearchSubmit}
          style={styles.searchbar}
          inputStyle={styles.searchInput}
          iconColor="#b03a5b"
        />
      </Surface>

      {/* Quick Category Bar */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Loại sản phẩm
          </Text>
          <TouchableOpacity onPress={() => router.push("/categories")}>
            <Text style={styles.seeAllText}>Xem tất cả</Text>
          </TouchableOpacity>
        </View>

        {isCategoriesLoading ? (
          <Text style={styles.hintText}>Đang tải loại sản phẩm...</Text>
        ) : categoriesError ? (
          <Surface style={styles.miniError} elevation={0}>
            <Text style={styles.miniErrorText}>
              Không tải được loại sản phẩm.
            </Text>
            <Button
              compact
              mode="text"
              textColor="#b03a5b"
              onPress={() => refetchCategories()}
            >
              Thử lại
            </Button>
          </Surface>
        ) : categories.length === 0 ? (
          <Text style={styles.hintText}>Chưa có loại sản phẩm nào.</Text>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesScroll}
          >
            {categories.map((cat: Category) => (
              <TouchableOpacity
                key={cat.id}
                style={styles.categoryItem}
                onPress={() =>
                  router.push({
                    pathname: "/products",
                    params: { categoryId: cat.id },
                  })
                }
              >
                <View style={styles.categoryIconCircle}>
                  <Icon source="tag-outline" size={24} color="#b03a5b" />
                </View>
                <Text
                  numberOfLines={2}
                  variant="bodySmall"
                  style={styles.categoryName}
                >
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Featured Products */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Sản phẩm nổi bật
          </Text>
          <TouchableOpacity onPress={() => router.push("/products")}>
            <Text style={styles.seeAllText}>Xem tất cả</Text>
          </TouchableOpacity>
        </View>

        <ApiStateWrapper
          isLoading={isProductsLoading}
          error={productsError as Error | null}
          onRetry={refetchProducts}
          isEmpty={products.length === 0}
          emptyMessage="Chưa có sản phẩm nào trên hệ thống."
        >
          <View style={styles.productsGrid}>
            {products.map((product: PublicProductSummary) => (
              <ProductGridCard
                key={product.id}
                product={product}
                onPress={() => router.push(`/products/${product.id}`)}
              />
            ))}
          </View>
        </ApiStateWrapper>
      </View>

      {isAuthenticated ? (
        <RecommendationRail
          title="Gợi ý cho bạn"
          subtitle="Dựa trên sản phẩm bạn đã mua"
          items={recommendations ?? []}
          isLoading={isRecommendationsLoading}
          error={recommendationsError as Error | null}
          onRetry={() => refetchRecommendations()}
          onPressItem={(item) => router.push(`/products/${item.id}`)}
        />
      ) : null}
    </ScrollView>
  );
}

function ProductGridCard({
  product,
  onPress,
}: {
  product: PublicProductSummary;
  onPress: () => void;
}) {
  const imageUrl = product.thumbnailUrl;

  return (
    <Card style={styles.productCard} onPress={onPress}>
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={styles.productImage}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.noImagePlaceholder}>
          <Icon source="image-off-outline" size={32} color="#9ca3af" />
          <Text style={styles.noImageText}>Chưa có ảnh</Text>
        </View>
      )}
      <Card.Content style={styles.productCardContent}>
        {product.brandName ? (
          <Text variant="labelSmall" style={styles.productBrand}>
            {product.brandName}
          </Text>
        ) : null}
        <Text
          numberOfLines={2}
          variant="bodyMedium"
          style={styles.productName}
        >
          {product.name}
        </Text>
        <Text variant="titleSmall" style={styles.productPrice}>
          {formatVnd(product.priceFrom)}
        </Text>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  headerBanner: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  brandTitle: {
    fontWeight: "800",
    color: "#b03a5b",
    letterSpacing: 0.5,
  },
  brandSubtitle: {
    color: "#6b7280",
    marginBottom: 12,
  },
  searchbar: {
    backgroundColor: "#f4f5f7",
    borderRadius: 8,
    height: 46,
  },
  searchInput: {
    minHeight: 0,
    fontSize: 14,
  },
  section: {
    marginTop: 16,
    backgroundColor: "#ffffff",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#f3f4f6",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontWeight: "700",
    color: "#1f2937",
  },
  seeAllText: {
    color: "#b03a5b",
    fontWeight: "600",
    fontSize: 13,
  },
  categoriesScroll: {
    paddingVertical: 4,
    gap: 16,
  },
  categoryItem: {
    alignItems: "center",
    width: 72,
  },
  categoryIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#fde8ee",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  categoryName: {
    textAlign: "center",
    color: "#374151",
    fontSize: 12,
  },
  hintText: {
    color: "#9ca3af",
    fontStyle: "italic",
    paddingVertical: 8,
  },
  miniError: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 8,
    backgroundColor: "#fff1f2",
    borderRadius: 6,
  },
  miniErrorText: {
    color: "#e11d48",
    fontSize: 13,
  },
  productsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
  },
  productCard: {
    width: CARD_WIDTH,
    backgroundColor: "#ffffff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    overflow: "hidden",
    marginBottom: 4,
  },
  productImage: {
    width: "100%",
    height: 140,
    backgroundColor: "#f3f4f6",
  },
  noImagePlaceholder: {
    width: "100%",
    height: 140,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  noImageText: {
    color: "#9ca3af",
    fontSize: 12,
    marginTop: 4,
  },
  productCardContent: {
    padding: 10,
  },
  productBrand: {
    color: "#9ca3af",
    textTransform: "uppercase",
    marginBottom: 2,
    fontSize: 10,
    fontWeight: "600",
  },
  productName: {
    color: "#1f2937",
    fontWeight: "500",
    height: 40,
    lineHeight: 18,
  },
  productPrice: {
    color: "#b03a5b",
    fontWeight: "700",
    marginTop: 6,
  },
});
