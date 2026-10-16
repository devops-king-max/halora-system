import React, { useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Image,
  Alert,
} from "react-native";
import {
  Text,
  Button,
  Surface,
  Divider,
  Portal,
  Modal,
  TextInput,
  Icon,
} from "react-native-paper";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../src/api";
import { ApiStateWrapper } from "../../src/components/ApiStateWrapper";
import { StatusChip } from "../../src/components/StatusChip";
import {
  formatVnd,
  formatDateTime,
  PAYMENT_METHOD_LABELS,
} from "../../src/format";
import { OrderItem, AppliedDiscount } from "@halora/api-client";

export default function OrderDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();

  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const {
    data: order,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["customer-order-detail", id],
    queryFn: () => apiClient.orders.getMy(id!),
    enabled: !!id,
  });

  const cancelOrderMutation = useMutation({
    mutationFn: () =>
      apiClient.orders.cancelMy(id!, {
        version: order!.version,
        reason: cancelReason.trim() || "Khách hàng yêu cầu hủy đơn qua ứng dụng",
      }),
    onSuccess: () => {
      setCancelModalVisible(false);
      setCancelReason("");
      queryClient.invalidateQueries({ queryKey: ["customer-order-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["customer-orders"] });
      Alert.alert("Thành công", "Đơn hàng đã được hủy theo yêu cầu của bạn.");
    },
    onError: (err: any) => {
      Alert.alert(
        "Hủy đơn thất bại",
        err?.message || "Không thể hủy đơn hàng vào lúc này."
      );
    },
  });

  const handleConfirmCancel = () => {
    cancelOrderMutation.mutate();
  };

  const isCancellable = order?.status === "PENDING_CONFIRMATION";
  const lastPayment = order?.payments?.[order.payments.length - 1];

  return (
    <View style={styles.container}>
      <ApiStateWrapper
        isLoading={isLoading}
        error={error as Error | null}
        onRetry={refetch}
        isEmpty={!order}
        emptyMessage="Không tìm thấy đơn hàng."
      >
        {order && (
          <>
            <ScrollView style={styles.scroll}>
              {/* Order Status Header */}
              <Surface style={styles.headerCard} elevation={0}>
                <View style={styles.statusRow}>
                  <View>
                    <Text variant="titleMedium" style={styles.orderCode}>
                      Đơn #{order.orderCode}
                    </Text>
                    <Text style={styles.orderDate}>
                      Ngày đặt: {formatDateTime(order.createdAt)}
                    </Text>
                  </View>
                  <StatusChip status={order.status} type="order" />
                </View>

                {isCancellable && (
                  <Button
                    mode="outlined"
                    textColor="#ba1a1a"
                    style={styles.cancelBtn}
                    onPress={() => setCancelModalVisible(true)}
                  >
                    Hủy đơn hàng
                  </Button>
                )}
              </Surface>

              {/* Shipping Address */}
              <Surface style={styles.card} elevation={0}>
                <View style={styles.sectionTitleRow}>
                  <Icon source="map-marker-outline" size={20} color="#b03a5b" />
                  <Text variant="titleMedium" style={styles.sectionTitle}>
                    Địa chỉ nhận hàng
                  </Text>
                </View>
                <Text style={styles.recipientName}>
                  {order.recipientName} - {order.recipientPhone}
                </Text>
                <Text style={styles.addressLine}>
                  {order.addressLine}, {order.wardName}, {order.provinceName}
                </Text>
                {order.note && (
                  <Text style={styles.orderNote}>
                    Ghi chú: <Text style={{ fontStyle: "italic" }}>{order.note}</Text>
                  </Text>
                )}
              </Surface>

              {/* Item List */}
              <Surface style={styles.card} elevation={0}>
                <Text variant="titleMedium" style={styles.sectionTitle}>
                  Sản phẩm ({order.items?.length || 0})
                </Text>
                <Divider style={{ marginVertical: 8 }} />

                <View style={styles.itemsList}>
                  {order.items?.map((item: OrderItem) => (
                    <View key={item.id} style={styles.itemRow}>
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
                          <Text style={styles.variantOptions}>
                            {item.variantName}
                          </Text>
                        ) : null}
                        <View style={styles.itemPriceQty}>
                          <Text style={styles.itemPrice}>
                            {formatVnd(item.unitPrice)} x {item.quantity}
                          </Text>
                          <Text style={styles.itemSubtotal}>
                            {formatVnd(item.lineTotal)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              </Surface>

              {/* Discounts Applied */}
              {order.discounts && order.discounts.length > 0 && (
                <Surface style={styles.card} elevation={0}>
                  <Text variant="titleMedium" style={styles.sectionTitle}>
                    Khuyến mãi & Voucher đã áp dụng
                  </Text>
                  <Divider style={{ marginVertical: 8 }} />
                  {order.discounts.map((d: AppliedDiscount, index: number) => (
                    <View key={index} style={styles.discountRow}>
                      <View>
                        <Text style={styles.discountName}>{d.promotionName}</Text>
                        {d.voucherCode && (
                          <Text style={styles.voucherCode}>Mã: {d.voucherCode}</Text>
                        )}
                      </View>
                      <Text style={styles.discountAmount}>
                        -{formatVnd(d.amount)}
                      </Text>
                    </View>
                  ))}
                </Surface>
              )}

              {/* Payment & Price Summary */}
              <Surface style={styles.card} elevation={0}>
                <Text variant="titleMedium" style={styles.sectionTitle}>
                  Chi tiết thanh toán
                </Text>
                <Divider style={{ marginVertical: 10 }} />

                <View style={styles.summaryList}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Phương thức thanh toán:</Text>
                    <Text style={styles.summaryValue}>
                      {PAYMENT_METHOD_LABELS[order.paymentMethod] ||
                        order.paymentMethod}
                    </Text>
                  </View>

                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Trạng thái thanh toán:</Text>
                    <StatusChip
                      status={lastPayment?.status || (BigInt(order.paidAmount) >= BigInt(order.totalAmount) ? "SUCCEEDED" : "PENDING")}
                      type="payment"
                    />
                  </View>

                  <Divider style={{ marginVertical: 6 }} />

                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Tổng tiền hàng</Text>
                    <Text style={styles.summaryValue}>
                      {formatVnd(order.amounts?.subtotalAmount || order.totalAmount)}
                    </Text>
                  </View>

                  {order.amounts && parseInt(order.amounts.productDiscountAmount, 10) > 0 && (
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Giảm giá sản phẩm</Text>
                      <Text style={styles.discountValue}>
                        -{formatVnd(order.amounts.productDiscountAmount)}
                      </Text>
                    </View>
                  )}

                  {order.amounts && parseInt(order.amounts.orderDiscountAmount, 10) > 0 && (
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Khuyến mãi đơn</Text>
                      <Text style={styles.discountValue}>
                        -{formatVnd(order.amounts.orderDiscountAmount)}
                      </Text>
                    </View>
                  )}

                  {order.amounts && parseInt(order.amounts.voucherDiscountAmount, 10) > 0 && (
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Giảm voucher</Text>
                      <Text style={styles.discountValue}>
                        -{formatVnd(order.amounts.voucherDiscountAmount)}
                      </Text>
                    </View>
                  )}

                  {order.amounts && (
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Phí vận chuyển</Text>
                      <Text style={styles.summaryValue}>
                        {formatVnd(order.amounts.shippingFee)}
                      </Text>
                    </View>
                  )}

                  <Divider style={{ marginVertical: 8 }} />

                  <View style={styles.summaryRow}>
                    <Text variant="titleMedium" style={{ fontWeight: "700" }}>
                      Tổng tiền thanh toán
                    </Text>
                    <Text variant="titleLarge" style={styles.totalFinal}>
                      {formatVnd(order.totalAmount)}
                    </Text>
                  </View>
                </View>
              </Surface>
            </ScrollView>

            {/* Cancel Modal */}
            <Portal>
              <Modal
                visible={cancelModalVisible}
                onDismiss={() => setCancelModalVisible(false)}
                contentContainerStyle={styles.modalContent}
              >
                <Text variant="titleMedium" style={styles.modalTitle}>
                  Hủy đơn hàng #{order.orderCode}
                </Text>
                <Text variant="bodySmall" style={styles.modalSubtitle}>
                  Đơn hàng chỉ có thể hủy khi chưa được xác nhận bởi nhân viên.
                </Text>

                <TextInput
                  mode="outlined"
                  label="Lý do hủy đơn"
                  placeholder="Nhập lý do bạn muốn hủy đơn..."
                  value={cancelReason}
                  onChangeText={setCancelReason}
                  multiline
                  numberOfLines={3}
                  outlineColor="#d1d5db"
                  activeOutlineColor="#b03a5b"
                  style={{ marginTop: 12, backgroundColor: "#ffffff" }}
                />

                <View style={styles.modalActions}>
                  <Button
                    mode="text"
                    textColor="#6b7280"
                    onPress={() => setCancelModalVisible(false)}
                  >
                    Đóng
                  </Button>
                  <Button
                    mode="contained"
                    buttonColor="#ba1a1a"
                    loading={cancelOrderMutation.isPending}
                    disabled={cancelOrderMutation.isPending}
                    onPress={handleConfirmCancel}
                  >
                    Xác nhận hủy
                  </Button>
                </View>
              </Modal>
            </Portal>
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
  scroll: {
    flex: 1,
  },
  headerCard: {
    backgroundColor: "#ffffff",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    marginBottom: 10,
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  orderCode: {
    fontWeight: "700",
    color: "#1f2937",
  },
  orderDate: {
    color: "#6b7280",
    fontSize: 12,
    marginTop: 2,
  },
  cancelBtn: {
    marginTop: 12,
    borderColor: "#fecdd3",
    borderRadius: 8,
  },
  card: {
    backgroundColor: "#ffffff",
    padding: 16,
    marginBottom: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#e5e7eb",
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    fontWeight: "700",
    color: "#1f2937",
  },
  recipientName: {
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 2,
  },
  addressLine: {
    color: "#4b5563",
    fontSize: 13,
    lineHeight: 18,
  },
  orderNote: {
    marginTop: 6,
    color: "#6b7280",
    fontSize: 13,
  },
  itemsList: {
    gap: 12,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  itemImage: {
    width: 60,
    height: 60,
    borderRadius: 6,
    backgroundColor: "#f3f4f6",
  },
  noImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 6,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
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
    fontSize: 12,
  },
  itemPriceQty: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  itemPrice: {
    color: "#6b7280",
    fontSize: 13,
  },
  itemSubtotal: {
    color: "#b03a5b",
    fontWeight: "700",
  },
  discountRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  discountName: {
    fontWeight: "600",
    color: "#1f2937",
  },
  voucherCode: {
    color: "#6b7280",
    fontSize: 12,
  },
  discountAmount: {
    color: "#16a34a",
    fontWeight: "700",
  },
  summaryList: {
    gap: 8,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryLabel: {
    color: "#6b7280",
  },
  summaryValue: {
    color: "#1f2937",
    fontWeight: "500",
  },
  discountValue: {
    color: "#16a34a",
    fontWeight: "600",
  },
  totalFinal: {
    color: "#b03a5b",
    fontWeight: "800",
  },
  modalContent: {
    backgroundColor: "#ffffff",
    padding: 20,
    margin: 20,
    borderRadius: 12,
  },
  modalTitle: {
    fontWeight: "700",
    color: "#1f2937",
  },
  modalSubtitle: {
    color: "#6b7280",
    marginTop: 4,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 16,
  },
});
