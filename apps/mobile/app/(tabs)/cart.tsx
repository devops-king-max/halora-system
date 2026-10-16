import React, { useState } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  Image,
  RefreshControl,
  Alert,
} from "react-native";
import {
  Text,
  Button,
  Surface,
  IconButton,
  Checkbox,
  Divider,
  Icon,
} from "react-native-paper";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../src/api";
import { useAuth } from "../../src/AuthContext";
import { ApiStateWrapper } from "../../src/components/ApiStateWrapper";
import { formatVnd } from "../../src/format";
import { CartItem } from "@halora/api-client";

export default function CartScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();
  const [selectedItemIds, setSelectedItemIds] = useState<Record<string, boolean>>({});

  const {
    data: cart,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["mobile-cart"],
    queryFn: () => apiClient.cart.getCart(),
    enabled: isAuthenticated,
  });

  const updateQuantityMutation = useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: string; quantity: number }) =>
      apiClient.cart.updateItem(itemId, quantity, cart?.version || 1),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mobile-cart"] });
    },
    onError: (err: any) => {
      Alert.alert("Lỗi cập nhật", err?.message || "Không thể cập nhật số lượng.");
    },
  });

  const removeItemMutation = useMutation({
    mutationFn: (itemId: string) =>
      apiClient.cart.removeItem(itemId, cart?.version || 1),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mobile-cart"] });
    },
    onError: (err: any) => {
      Alert.alert("Lỗi xóa", err?.message || "Không thể xóa sản phẩm khỏi giỏ.");
    },
  });

  if (!isAuthenticated) {
    return (
      <View style={styles.centerContainer}>
        <Surface style={styles.authNoticeCard} elevation={1}>
          <Icon source="cart-outline" size={48} color="#b03a5b" />
          <Text variant="titleMedium" style={styles.authNoticeTitle}>
            Đăng nhập để xem giỏ hàng
          </Text>
          <Text variant="bodyMedium" style={styles.authNoticeSubtitle}>
            Vui lòng đăng nhập tài khoản khách hàng để quản lý giỏ hàng và tiến hành đặt hàng.
          </Text>
          <Button
            mode="contained"
            buttonColor="#b03a5b"
            onPress={() => router.push("/login")}
            style={styles.loginBtn}
          >
            Đăng nhập ngay
          </Button>
        </Surface>
      </View>
    );
  }

  const items = cart?.items || [];

  const toggleSelect = (id: string) => {
    setSelectedItemIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const selectAll = () => {
    const allSelected = items.every((i: CartItem) => selectedItemIds[i.id]);
    const next: Record<string, boolean> = {};
    if (!allSelected) {
      items.forEach((i: CartItem) => {
        next[i.id] = true;
      });
    }
    setSelectedItemIds(next);
  };

  const handleUpdateQty = (itemId: string, currentQty: number, change: number) => {
    const newQty = currentQty + change;
    if (newQty < 1) {
      confirmRemove(itemId);
      return;
    }
    updateQuantityMutation.mutate({ itemId, quantity: newQty });
  };

  const confirmRemove = (itemId: string) => {
    Alert.alert("Xác nhận", "Bạn có chắc muốn xóa sản phẩm này khỏi giỏ hàng?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Xóa",
        style: "destructive",
        onPress: () => removeItemMutation.mutate(itemId),
      },
    ]);
  };

  // Selected subtotal calculation
  const selectedItems = items.filter((i: CartItem) => selectedItemIds[i.id]);
  const selectedTotal = selectedItems.reduce((acc: bigint, curr: CartItem) =>
    acc + BigInt(curr.unitPrice) * BigInt(curr.quantity), BigInt(0));

  const isAllSelected = items.length > 0 && items.every((i: CartItem) => selectedItemIds[i.id]);

  const handleProceedCheckout = () => {
    if (selectedItems.length === 0) {
      Alert.alert("Thông báo", "Vui lòng chọn ít nhất một sản phẩm để thanh toán.");
      return;
    }
    router.push({
      pathname: "/checkout",
      params: {
        itemIds: JSON.stringify(selectedItems.map((i: CartItem) => i.id)),
      },
    });
  };

  return (
    <View style={styles.container}>
      <ApiStateWrapper
        isLoading={isLoading}
        error={error as Error | null}
        onRetry={refetch}
        isEmpty={items.length === 0}
        emptyMessage="Giỏ hàng của bạn đang trống."
      >
        {items.length === 0 ? (
          <View style={styles.centerContainer}>
            <Icon source="cart-off" size={64} color="#9ca3af" />
            <Text variant="titleMedium" style={styles.emptyTitle}>
              Giỏ hàng đang trống
            </Text>
            <Button
              mode="contained"
              buttonColor="#b03a5b"
              onPress={() => router.push("/")}
              style={{ marginTop: 16 }}
            >
              Tiếp tục mua sắm
            </Button>
          </View>
        ) : (
          <>
            <FlatList
              data={items}
              keyExtractor={(item) => item.id}
              refreshControl={
                <RefreshControl
                  refreshing={isRefetching}
                  onRefresh={refetch}
                  colors={["#b03a5b"]}
                />
              }
              ItemSeparatorComponent={() => <Divider />}
              renderItem={({ item }: { item: CartItem }) => {
                const isSelected = !!selectedItemIds[item.id];
                return (
                  <View style={styles.cartRow}>
                    <Checkbox
                      status={isSelected ? "checked" : "unchecked"}
                      onPress={() => toggleSelect(item.id)}
                      color="#b03a5b"
                    />

                    {item.thumbnailUrl ? (
                      <Image
                        source={{ uri: item.thumbnailUrl }}
                        style={styles.itemImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.noImagePlaceholder}>
                        <Icon source="image-off-outline" size={20} color="#9ca3af" />
                      </View>
                    )}

                    <View style={styles.itemDetails}>
                      <Text
                        numberOfLines={2}
                        variant="bodyMedium"
                        style={styles.itemName}
                      >
                        {item.productName}
                      </Text>

                      {item.variantName ? (
                        <Text variant="labelSmall" style={styles.variantOptions}>
                          {item.variantName}
                        </Text>
                      ) : null}

                      <Text variant="titleSmall" style={styles.itemPrice}>
                        {formatVnd(item.unitPrice)}
                      </Text>

                      <View style={styles.qtyControlRow}>
                        <View style={styles.qtyBox}>
                          <IconButton
                            icon="minus"
                            size={16}
                            disabled={updateQuantityMutation.isPending}
                            onPress={() =>
                              handleUpdateQty(item.id, item.quantity, -1)
                            }
                            style={styles.qtyBtn}
                          />
                          <Text style={styles.qtyText}>{item.quantity}</Text>
                          <IconButton
                            icon="plus"
                            size={16}
                            disabled={updateQuantityMutation.isPending}
                            onPress={() =>
                              handleUpdateQty(item.id, item.quantity, 1)
                            }
                            style={styles.qtyBtn}
                          />
                        </View>

                        <IconButton
                          icon="delete-outline"
                          size={20}
                          iconColor="#ba1a1a"
                          onPress={() => confirmRemove(item.id)}
                        />
                      </View>
                    </View>
                  </View>
                );
              }}
            />

            {/* Bottom Checkout Bar */}
            <Surface style={styles.bottomBar} elevation={4}>
              <View style={styles.selectAllBox}>
                <Checkbox
                  status={isAllSelected ? "checked" : "unchecked"}
                  onPress={selectAll}
                  color="#b03a5b"
                />
                <Text variant="bodyMedium">Tất cả ({selectedItems.length})</Text>
              </View>

              <View style={styles.summaryContainer}>
                <View style={styles.totalBox}>
                  <Text variant="labelSmall" style={styles.totalLabel}>
                    Tạm tính:
                  </Text>
                  <Text variant="titleMedium" style={styles.totalValue}>
                    {formatVnd(selectedTotal)}
                  </Text>
                </View>

                <Button
                  mode="contained"
                  buttonColor="#b03a5b"
                  disabled={selectedItems.length === 0}
                  onPress={handleProceedCheckout}
                  style={styles.checkoutBtn}
                >
                  Mua hàng
                </Button>
              </View>
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
    backgroundColor: "#ffffff",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  authNoticeCard: {
    padding: 24,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    alignItems: "center",
    maxWidth: 320,
    width: "100%",
  },
  authNoticeTitle: {
    fontWeight: "700",
    color: "#1f2937",
    marginTop: 12,
    marginBottom: 6,
  },
  authNoticeSubtitle: {
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 20,
  },
  loginBtn: {
    borderRadius: 8,
    width: "100%",
  },
  emptyTitle: {
    color: "#6b7280",
    marginTop: 12,
  },
  cartRow: {
    flexDirection: "row",
    padding: 12,
    alignItems: "center",
  },
  itemImage: {
    width: 72,
    height: 72,
    borderRadius: 6,
    backgroundColor: "#f3f4f6",
    marginLeft: 4,
  },
  noImagePlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 6,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },
  itemDetails: {
    flex: 1,
    marginLeft: 12,
  },
  itemName: {
    fontWeight: "600",
    color: "#1f2937",
  },
  variantOptions: {
    color: "#6b7280",
    marginTop: 2,
  },
  itemPrice: {
    color: "#b03a5b",
    fontWeight: "700",
    marginTop: 4,
  },
  qtyControlRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
  },
  qtyBox: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 6,
    height: 32,
  },
  qtyBtn: {
    margin: 0,
    width: 28,
    height: 28,
  },
  qtyText: {
    paddingHorizontal: 8,
    fontWeight: "600",
    fontSize: 13,
  },
  bottomBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectAllBox: {
    flexDirection: "row",
    alignItems: "center",
  },
  summaryContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  totalBox: {
    alignItems: "flex-end",
  },
  totalLabel: {
    color: "#6b7280",
  },
  totalValue: {
    color: "#b03a5b",
    fontWeight: "700",
  },
  checkoutBtn: {
    borderRadius: 8,
  },
});
