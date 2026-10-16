import React, { useState } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { Text, Surface, Divider, Chip } from "react-native-paper";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../src/api";
import { useAuth } from "../../src/AuthContext";
import { ApiStateWrapper } from "../../src/components/ApiStateWrapper";
import { StatusChip } from "../../src/components/StatusChip";
import { formatVnd, formatDateTime, PAYMENT_METHOD_LABELS } from "../../src/format";
import { OrderSummary } from "@halora/api-client";

const STATUS_FILTERS = [
  { key: "", label: "Tất cả" },
  { key: "PENDING_CONFIRMATION", label: "Chờ xác nhận" },
  { key: "CONFIRMED", label: "Đã xác nhận" },
  { key: "SHIPPING", label: "Đang giao" },
  { key: "COMPLETED", label: "Hoàn tất" },
  { key: "CANCELLED", label: "Đã hủy" },
];

export default function OrderListScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [selectedStatus, setSelectedStatus] = useState<string>("");

  const {
    data,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["customer-orders", selectedStatus],
    queryFn: () =>
      apiClient.orders.listMy({
        status: selectedStatus || undefined,
        limit: 50,
      }),
    enabled: isAuthenticated,
  });

  const orders = data?.data || [];

  return (
    <View style={styles.container}>
      {/* Horizontal Status Filter Chips */}
      <Surface style={styles.filterBar} elevation={1}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={STATUS_FILTERS}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.filterList}
          renderItem={({ item }: { item: { key: string; label: string } }) => {
            const isSelected = selectedStatus === item.key;
            return (
              <Chip
                selected={isSelected}
                onPress={() => setSelectedStatus(item.key)}
                style={[
                  styles.filterChip,
                  isSelected && styles.filterChipSelected,
                ]}
                textStyle={[
                  styles.filterChipText,
                  isSelected && styles.filterChipTextSelected,
                ]}
              >
                {item.label}
              </Chip>
            );
          }}
        />
      </Surface>

      {/* Order List */}
      <ApiStateWrapper
        isLoading={isLoading}
        error={error as Error | null}
        onRetry={refetch}
        isEmpty={orders.length === 0}
        emptyMessage="Bạn chưa có đơn hàng nào trong mục này."
      >
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              colors={["#b03a5b"]}
            />
          }
          contentContainerStyle={styles.listContent}
          renderItem={({ item }: { item: OrderSummary }) => (
            <TouchableOpacity
              onPress={() => router.push(`/orders/${item.id}`)}
              style={styles.orderCard}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.orderCode}>Đơn #{item.orderCode}</Text>
                <StatusChip status={item.status} type="order" />
              </View>

              <Text style={styles.orderDate}>
                Ngày đặt: {formatDateTime(item.createdAt)}
              </Text>

              <Divider style={{ marginVertical: 8 }} />

              <View style={styles.cardFooter}>
                <View>
                  <Text style={styles.paymentMethod}>
                    {PAYMENT_METHOD_LABELS[item.paymentMethod] || item.paymentMethod}
                  </Text>
                </View>

                <View style={styles.totalBox}>
                  <Text style={styles.totalLabel}>Tổng tiền:</Text>
                  <Text style={styles.totalValue}>
                    {formatVnd(item.totalAmount)}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
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
  filterBar: {
    backgroundColor: "#ffffff",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  filterList: {
    paddingHorizontal: 16,
    gap: 8,
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
    gap: 12,
  },
  orderCard: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  orderCode: {
    fontWeight: "700",
    color: "#1f2937",
    fontSize: 15,
  },
  orderDate: {
    color: "#6b7280",
    fontSize: 12,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  paymentMethod: {
    color: "#6b7280",
    fontSize: 12,
  },
  totalBox: {
    alignItems: "flex-end",
  },
  totalLabel: {
    color: "#6b7280",
    fontSize: 11,
  },
  totalValue: {
    color: "#b03a5b",
    fontWeight: "700",
    fontSize: 16,
  },
});
