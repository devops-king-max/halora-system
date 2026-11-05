import React, { useEffect, useState } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
  RefreshControl,
  Dimensions,
} from "react-native";
import {
  Text,
  Searchbar,
  Card,
  Icon,
  Chip,
  Surface,
} from "react-native-paper";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../src/api";
import { ApiStateWrapper } from "../../src/components/ApiStateWrapper";
import { PriceOperatorSlider } from "../../src/components/PriceOperatorSlider";
import { formatVnd } from "../../src/format";
import { Category, PriceOperator, PublicProductSummary } from "@halora/api-client";

const { width } = Dimensions.get("window");
const CARD_WIDTH = (width - 48) / 2;

export default function ProductListScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    search?: string;
    categoryId?: string;
    categoryName?: string;
    brandId?: string;
  }>();

  const [search, setSearch] = useState(params.search || "");
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(
    params.categoryId
  );
  const [priceFilter, setPriceFilter] = useState<
    { operator: PriceOperator; value: number } | undefined
  >(undefined);
  const [appliedPriceFilter, setAppliedPriceFilter] = useState(priceFilter);

  useEffect(() => {
    const timer = setTimeout(() => setAppliedPriceFilter(priceFilter), 300);
    return () => clearTimeout(timer);
  }, [priceFilter]);

  const {
    data: categoriesData,
  } = useQuery({
    queryKey: ["filter-categories"],
    queryFn: () => apiClient.categories.listPublic({ limit: 100 }),
  });

  const { data: priceRange } = useQuery({
    queryKey: ["mobile-products-price-range"],
    queryFn: () => apiClient.products.priceRange(),
  });

  const priceMin = priceRange ? Number(priceRange.minPrice) : 0;
  const priceMax = priceRange ? Number(priceRange.maxPrice) : 0;
  const priceBoundsAvailable =
    priceRange !== undefined &&
    priceRange.minPrice !== null &&
    priceRange.maxPrice !== null &&
    Number.isFinite(priceMin) &&
    Number.isFinite(priceMax) &&
    priceMax > priceMin;

  const {
    data,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: [
      "mobile-products-list",
      search,
      selectedCategory,
      params.brandId,
      appliedPriceFilter?.operator,
      appliedPriceFilter?.value,
    ],
    queryFn: () =>
      apiClient.products.listPublic({
        search: search.trim() || undefined,
        categoryId: selectedCategory || undefined,
        brandId: params.brandId || undefined,
        priceOperator: appliedPriceFilter?.operator,
        priceValue:
          appliedPriceFilter === undefined
            ? undefined
            : String(Math.round(appliedPriceFilter.value)),
        limit: 50,
      }),
  });

  const categories = categoriesData?.data || [];
  const products = data?.data || [];

  return (
    <View style={styles.container}>
      {/* Search Header */}
      <Surface style={styles.searchHeader} elevation={1}>
        <Searchbar
          placeholder="Tìm kiếm mỹ phẩm..."
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={() => refetch()}
          style={styles.searchbar}
          inputStyle={styles.searchInput}
          iconColor="#b03a5b"
        />

        {/* Categories horizontal filter bar */}
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[{ id: "", name: "Tất cả" }, ...categories]}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.chipsContainer}
          renderItem={({ item }: { item: { id: string; name: string } }) => {
            const isSelected =
              (!selectedCategory && item.id === "") ||
              selectedCategory === item.id;
            return (
              <Chip
                selected={isSelected}
                onPress={() =>
                  setSelectedCategory(item.id === "" ? undefined : item.id)
                }
                style={[
                  styles.filterChip,
                  isSelected && styles.filterChipSelected,
                ]}
                textStyle={[
                  styles.filterChipText,
                  isSelected && styles.filterChipTextSelected,
                ]}
              >
                {item.name}
              </Chip>
            );
          }}
        />
        {priceBoundsAvailable ? (
          <PriceOperatorSlider
            min={priceMin}
            max={priceMax}
            operator={priceFilter?.operator ?? "GTE"}
            value={priceFilter?.value ?? priceMin}
            active={priceFilter !== undefined}
            onChange={(operator, value) => setPriceFilter({ operator, value })}
            onClear={() => setPriceFilter(undefined)}
          />
        ) : null}
      </Surface>

      {/* Product Grid */}
      <ApiStateWrapper
        isLoading={isLoading}
        error={error as Error | null}
        onRetry={refetch}
        isEmpty={products.length === 0}
        emptyMessage="Không tìm thấy sản phẩm nào phù hợp với bộ lọc."
      >
        <FlatList
          data={products}
          numColumns={2}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              colors={["#b03a5b"]}
            />
          }
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }: { item: PublicProductSummary }) => (
            <Card
              style={styles.productCard}
              onPress={() => router.push(`/products/${item.id}`)}
            >
              {item.thumbnailUrl ? (
                <Image
                  source={{ uri: item.thumbnailUrl }}
                  style={styles.productImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.noImagePlaceholder}>
                  <Icon source="image-off-outline" size={28} color="#9ca3af" />
                  <Text style={styles.noImageText}>Chưa có ảnh</Text>
                </View>
              )}
              <Card.Content style={styles.productCardContent}>
                {item.brandName ? (
                  <Text variant="labelSmall" style={styles.productBrand}>
                    {item.brandName}
                  </Text>
                ) : null}
                <Text
                  numberOfLines={2}
                  variant="bodyMedium"
                  style={styles.productName}
                >
                  {item.name}
                </Text>
                <Text variant="titleSmall" style={styles.productPrice}>
                  {formatVnd(item.priceFrom)}
                </Text>
              </Card.Content>
            </Card>
          )}
        />
      </ApiStateWrapper>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  searchHeader: {
    backgroundColor: "#ffffff",
    paddingTop: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  searchbar: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: "#f4f5f7",
    borderRadius: 8,
    height: 44,
  },
  searchInput: {
    minHeight: 0,
    fontSize: 14,
  },
  chipsContainer: {
    paddingHorizontal: 16,
    gap: 8,
    paddingVertical: 4,
  },
  filterChip: {
    backgroundColor: "#f3f4f6",
  },
  filterChipSelected: {
    backgroundColor: "#fde8ee",
    borderColor: "#b03a5b",
  },
  filterChipText: {
    color: "#4b5563",
    fontSize: 12,
  },
  filterChipTextSelected: {
    color: "#b03a5b",
    fontWeight: "700",
  },
  listContent: {
    padding: 16,
  },
  columnWrapper: {
    justifyContent: "space-between",
    marginBottom: 12,
  },
  productCard: {
    width: CARD_WIDTH,
    backgroundColor: "#ffffff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    overflow: "hidden",
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
