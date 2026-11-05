import React, { useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Image,
  Dimensions,
  TouchableOpacity,
  Alert,
} from "react-native";
import {
  Text,
  Button,
  Surface,
  Chip,
  IconButton,
  Divider,
  Icon,
} from "react-native-paper";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../src/api";
import { useAuth } from "../../src/AuthContext";
import { ApiStateWrapper } from "../../src/components/ApiStateWrapper";
import { RecommendationRail } from "../../src/components/RecommendationRail";
import { formatVnd } from "../../src/format";
import { PublicProductVariant, ProductImage } from "@halora/api-client";

const { width } = Dimensions.get("window");

export default function ProductDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const [selectedVariant, setSelectedVariant] = useState<PublicProductVariant | null>(null);
  const [quantity, setQuantity] = useState(1);

  const {
    data: product,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["mobile-product-detail", id],
    queryFn: () => apiClient.products.getPublic(id!),
    enabled: !!id,
  });

  const {
    data: relatedProducts,
    isLoading: isRelatedLoading,
    error: relatedError,
    refetch: refetchRelated,
  } = useQuery({
    queryKey: ["mobile-product-related", id],
    queryFn: () => apiClient.products.getRelated(id!, 6),
    enabled: !!id,
  });

  const addToCartMutation = useMutation({
    mutationFn: () => {
      const targetVariantId = selectedVariant?.id || product?.variants?.[0]?.id;
      if (!targetVariantId) {
        throw new Error("Sản phẩm chưa có biến thể khả dụng.");
      }
      return apiClient.cart.addItem(targetVariantId, quantity);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mobile-cart"] });
      Alert.alert(
        "Thành công",
        "Đã thêm sản phẩm vào giỏ hàng!",
        [
          { text: "Tiếp tục xem", style: "cancel" },
          {
            text: "Xem giỏ hàng",
            onPress: () => router.push("/(tabs)/cart"),
          },
        ]
      );
    },
    onError: (err: any) => {
      Alert.alert(
        "Lỗi thêm vào giỏ",
        err?.message || "Không thể thêm sản phẩm vào giỏ hàng."
      );
    },
  });

  const handleAddToCart = () => {
    if (!isAuthenticated) {
      Alert.alert(
        "Yêu cầu đăng nhập",
        "Vui lòng đăng nhập để thêm sản phẩm vào giỏ hàng.",
        [
          { text: "Hủy", style: "cancel" },
          { text: "Đăng nhập", onPress: () => router.push("/login") },
        ]
      );
      return;
    }

    if (product?.variants && product.variants.length > 1 && !selectedVariant) {
      Alert.alert("Chưa chọn biến thể", "Vui lòng chọn một phiên bản / biến thể sản phẩm.");
      return;
    }

    addToCartMutation.mutate();
  };

  const displayImages = product?.thumbnailUrl ? [{ id: 'thumbnail', url: product.thumbnailUrl }, ...(product.images || []).filter(image => image.url !== product.thumbnailUrl)] : product?.images || [];
  const variants = product?.variants || [];
  const currentPrice = selectedVariant?.salePrice || product?.priceFrom || "0";
  const stock = selectedVariant ? selectedVariant.stockQuantity : variants.reduce((acc, v) => acc + v.stockQuantity, 0);
  const isOutOfStock = stock <= 0;

  return (
    <View style={styles.container}>
      <ApiStateWrapper
        isLoading={isLoading}
        error={error as Error | null}
        onRetry={refetch}
        isEmpty={!product}
        emptyMessage="Không tìm thấy thông tin sản phẩm."
      >
        {product && (
          <>
            <ScrollView style={styles.scrollContent}>
              {/* Product Image Gallery */}
              {displayImages.length > 0 ? (
                <ScrollView
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  style={styles.imageScroll}
                >
                  {displayImages.map((img, index: number) => (
                    <Image
                      key={img.id || index}
                      source={{ uri: img.url }}
                      style={styles.productBannerImage}
                      resizeMode="cover"
                    />
                  ))}
                </ScrollView>
              ) : product.thumbnailUrl ? (
                <Image
                  source={{ uri: product.thumbnailUrl }}
                  style={styles.productBannerImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.noImageBanner}>
                  <Icon source="image-off-outline" size={48} color="#9ca3af" />
                  <Text style={styles.noImageBannerText}>Chưa có ảnh</Text>
                </View>
              )}

              {/* Main Info Card */}
              <Surface style={styles.infoCard} elevation={0}>
                {product.brandName ? (
                  <Text variant="labelMedium" style={styles.brandName}>
                    {product.brandName}
                  </Text>
                ) : null}
                <Text variant="titleLarge" style={styles.productTitle}>
                  {product.name}
                </Text>

                <View style={styles.priceRow}>
                  <Text variant="headlineSmall" style={styles.priceText}>
                    {formatVnd(currentPrice)}
                  </Text>
                  <Text
                    style={[
                      styles.stockStatus,
                      isOutOfStock ? styles.outOfStock : styles.inStock,
                    ]}
                  >
                    {isOutOfStock ? "Hết hàng" : `Còn hàng (${stock})`}
                  </Text>
                </View>

                {product.categoryName ? (
                  <View style={styles.categoryMetaRow}>
                    <Text variant="bodySmall" style={styles.categoryLabel}>
                      Loại sản phẩm:
                    </Text>
                    <Chip compact style={styles.categoryChip}>
                      {product.categoryName}
                    </Chip>
                  </View>
                ) : null}
              </Surface>

              {/* Variant Selection */}
              {variants.length > 0 && (
                <Surface style={styles.sectionCard} elevation={0}>
                  <Text variant="titleMedium" style={styles.sectionHeader}>
                    Chọn phân loại
                  </Text>
                  <View style={styles.variantsWrap}>
                    {variants.map((v: PublicProductVariant) => {
                      const isSelected = selectedVariant?.id === v.id;
                      const variantLabel = v.name || v.color || v.sku;
                      const disabled = v.stockQuantity <= 0;

                      return (
                        <TouchableOpacity
                          key={v.id}
                          disabled={disabled}
                          onPress={() => setSelectedVariant(v)}
                          style={[
                            styles.variantOptionBox,
                            isSelected && styles.variantOptionSelected,
                            disabled && styles.variantOptionDisabled,
                          ]}
                        >
                          <Text
                            style={[
                              styles.variantOptionText,
                              isSelected && styles.variantOptionTextSelected,
                              disabled && styles.variantOptionTextDisabled,
                            ]}
                          >
                            {variantLabel}
                          </Text>
                          <Text
                            style={[
                              styles.variantOptionSubtext,
                              isSelected && styles.variantOptionSubtextSelected,
                            ]}
                          >
                            {formatVnd(v.salePrice)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </Surface>
              )}

              {/* Quantity Selector */}
              <Surface style={styles.sectionCard} elevation={0}>
                <View style={styles.quantityRow}>
                  <Text variant="titleMedium" style={styles.sectionHeader}>
                    Số lượng
                  </Text>
                  <View style={styles.qtyBox}>
                    <IconButton
                      icon="minus"
                      size={18}
                      disabled={quantity <= 1}
                      onPress={() => setQuantity((q) => Math.max(1, q - 1))}
                    />
                    <Text style={styles.qtyText}>{quantity}</Text>
                    <IconButton
                      icon="plus"
                      size={18}
                      disabled={isOutOfStock || quantity >= stock}
                      onPress={() => setQuantity((q) => q + 1)}
                    />
                  </View>
                </View>
              </Surface>

              {/* Product Description */}
              <Surface style={styles.sectionCard} elevation={0}>
                <Text variant="titleMedium" style={styles.sectionHeader}>
                  Mô tả sản phẩm
                </Text>
                <Divider style={{ marginVertical: 8 }} />
                <Text variant="bodyMedium" style={styles.descriptionText}>
                  {product.description || "Chưa có mô tả chi tiết cho sản phẩm này."}
                </Text>

                {product.ingredients && (
                  <>
                    <Text variant="titleSmall" style={[styles.sectionHeader, { marginTop: 12 }]}>
                      Thành phần
                    </Text>
                    <Text variant="bodySmall" style={styles.descriptionText}>
                      {product.ingredients}
                    </Text>
                  </>
                )}

                {product.benefits && (
                  <>
                    <Text variant="titleSmall" style={[styles.sectionHeader, { marginTop: 12 }]}>
                      Công dụng
                    </Text>
                    <Text variant="bodySmall" style={styles.descriptionText}>
                      {product.benefits}
                    </Text>
                  </>
                )}
              </Surface>

              {/* Frequently bought together */}
              <RecommendationRail
                title="Thường được mua cùng"
                items={relatedProducts ?? []}
                isLoading={isRelatedLoading}
                error={relatedError as Error | null}
                onRetry={() => refetchRelated()}
                onPressItem={(item) => router.push(`/products/${item.id}`)}
              />
            </ScrollView>

            {/* Bottom Add to Cart Bar */}
            <Surface style={styles.bottomBar} elevation={4}>
              <View style={styles.bottomPriceBlock}>
                <Text variant="labelSmall" style={styles.bottomPriceLabel}>
                  Tạm tính:
                </Text>
                <Text variant="titleLarge" style={styles.bottomPriceValue}>
                  {formatVnd(BigInt(currentPrice) * BigInt(quantity))}
                </Text>
              </View>

              <Button
                mode="contained"
                buttonColor="#b03a5b"
                disabled={isOutOfStock || addToCartMutation.isPending}
                loading={addToCartMutation.isPending}
                onPress={handleAddToCart}
                icon="cart-plus"
                style={styles.addToCartBtn}
              >
                {isOutOfStock ? "Hết hàng" : "Thêm vào giỏ"}
              </Button>
            </Surface>
          </>
        )}
      </ApiStateWrapper>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  scrollContent: {
    flex: 1,
  },
  imageScroll: {
    backgroundColor: "#f3f4f6",
  },
  productBannerImage: {
    width,
    height: 320,
    backgroundColor: "#f3f4f6",
  },
  noImageBanner: {
    width,
    height: 240,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  noImageBannerText: {
    color: "#9ca3af",
    fontSize: 14,
    marginTop: 6,
  },
  infoCard: {
    backgroundColor: "#ffffff",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  brandName: {
    color: "#9ca3af",
    textTransform: "uppercase",
    fontWeight: "700",
    marginBottom: 4,
  },
  productTitle: {
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  priceText: {
    color: "#b03a5b",
    fontWeight: "800",
  },
  stockStatus: {
    fontSize: 13,
    fontWeight: "600",
  },
  inStock: {
    color: "#16a34a",
  },
  outOfStock: {
    color: "#dc2626",
  },
  categoryMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    gap: 8,
  },
  categoryLabel: {
    color: "#6b7280",
  },
  categoryChip: {
    backgroundColor: "#fde8ee",
  },
  sectionCard: {
    backgroundColor: "#ffffff",
    padding: 16,
    marginTop: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#e5e7eb",
  },
  sectionHeader: {
    fontWeight: "700",
    color: "#1f2937",
  },
  variantsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 10,
  },
  variantOptionBox: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#ffffff",
  },
  variantOptionSelected: {
    borderColor: "#b03a5b",
    backgroundColor: "#fdf2f4",
  },
  variantOptionDisabled: {
    borderColor: "#e5e7eb",
    backgroundColor: "#f9fafb",
  },
  variantOptionText: {
    fontWeight: "600",
    color: "#374151",
    fontSize: 13,
  },
  variantOptionTextSelected: {
    color: "#b03a5b",
  },
  variantOptionTextDisabled: {
    color: "#9ca3af",
  },
  variantOptionSubtext: {
    fontSize: 11,
    color: "#6b7280",
    marginTop: 2,
  },
  variantOptionSubtextSelected: {
    color: "#b03a5b",
  },
  quantityRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  qtyBox: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 6,
  },
  qtyText: {
    paddingHorizontal: 10,
    fontWeight: "700",
    fontSize: 15,
  },
  descriptionText: {
    color: "#4b5563",
    lineHeight: 22,
  },
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  bottomPriceBlock: {
    flex: 1,
  },
  bottomPriceLabel: {
    color: "#6b7280",
  },
  bottomPriceValue: {
    color: "#b03a5b",
    fontWeight: "800",
  },
  addToCartBtn: {
    borderRadius: 8,
    paddingHorizontal: 12,
  },
});
