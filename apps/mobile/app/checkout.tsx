import React, { useState, useEffect, useRef } from "react";
import * as Crypto from "expo-crypto";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from "react-native";
import {
  Text,
  Button,
  Surface,
  RadioButton,
  TextInput,
  Divider,
  Icon,
} from "react-native-paper";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../src/api";
import { useAuth } from "../src/AuthContext";
import { ApiStateWrapper } from "../src/components/ApiStateWrapper";
import { formatVnd } from "../src/format";
import {
  CustomerAddress,
  CheckoutItemInput,
  CartItem,
  OrderDetail,
  ApiClientError,
} from "@halora/api-client";

export default function CheckoutScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();
  const params = useLocalSearchParams<{ itemIds?: string }>();

  const [selectedAddressId, setSelectedAddressId] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<"COD" | "BANK_TRANSFER">(
    "COD"
  );
  const [voucherCode, setVoucherCode] = useState("");
  const [appliedVoucher, setAppliedVoucher] = useState("");
  const [customerNote, setCustomerNote] = useState("");
  const orderAttempt = useRef<{ fingerprint: string; key: string } | null>(null);

  // 1. Fetch addresses
  const {
    data: addresses,
    isLoading: isAddressesLoading,
    error: addressesError,
    refetch: refetchAddresses,
  } = useQuery({
    queryKey: ["checkout-addresses"],
    queryFn: () => apiClient.customerPortal.listAddresses(),
    enabled: isAuthenticated,
  });

  // Set default address when loaded
  useEffect(() => {
    if (addresses && addresses.length > 0 && !selectedAddressId) {
      const def = addresses.find((a: CustomerAddress) => a.isDefault) || addresses[0];
      setSelectedAddressId(def.id);
    }
  }, [addresses, selectedAddressId]);

  // 2. Fetch cart to get items
  const {
    data: cart,
    isLoading: isCartLoading,
    error: cartError,
  } = useQuery({
    queryKey: ["mobile-cart"],
    queryFn: () => apiClient.cart.getCart(),
    enabled: isAuthenticated,
  });

  // Filter items if specific itemIds were passed
  const passedIds: string[] = params.itemIds ? JSON.parse(params.itemIds) : [];
  const checkoutItems: CheckoutItemInput[] = (cart?.items || [])
    .filter((i: CartItem) => passedIds.length === 0 || passedIds.includes(i.id))
    .map((i: CartItem) => ({
      variantId: i.variantId,
      quantity: i.quantity,
    }));

  // 3. Checkout Quote from backend
  const {
    data: quote,
    isLoading: isQuoteLoading,
    error: quoteError,
    refetch: refetchQuote,
  } = useQuery({
    queryKey: [
      "checkout-quote",
      selectedAddressId,
      paymentMethod,
      appliedVoucher,
      checkoutItems,
    ],
    queryFn: () =>
      apiClient.checkout.getQuote({
        items: checkoutItems,
        addressId: selectedAddressId,
        paymentMethod,
        voucherCode: appliedVoucher || undefined,
        note: customerNote.trim() || undefined,
      }),
    enabled: isAuthenticated && checkoutItems.length > 0 && !!selectedAddressId,
  });

  // Place Order Mutation
  const placeOrderMutation = useMutation({
    mutationFn: () => {
      if (!quote?.quoteToken) {
        throw new Error("Không có phiên báo giá hợp lệ từ máy chủ.");
      }
      const fingerprint = JSON.stringify({ checkoutItems, selectedAddressId, paymentMethod, appliedVoucher, customerNote, quoteToken: quote.quoteToken });
      if (orderAttempt.current?.fingerprint !== fingerprint) {
        orderAttempt.current = { fingerprint, key: Crypto.randomUUID() };
      }
      const idempotencyKey = orderAttempt.current.key;

      return apiClient.orders.create(
        {
          items: checkoutItems,
          addressId: selectedAddressId,
          paymentMethod,
          voucherCode: appliedVoucher || undefined,
          note: customerNote.trim() || undefined,
          quoteToken: quote.quoteToken,
        },
        idempotencyKey
      );
    },
    onSuccess: (order: OrderDetail) => {
      orderAttempt.current = null;
      queryClient.invalidateQueries({ queryKey: ["mobile-cart"] });
      queryClient.invalidateQueries({ queryKey: ["customer-orders"] });
      Alert.alert(
        "Đặt hàng thành công",
        `Đơn hàng #${order.orderCode} của bạn đã được ghi nhận thành công!`,
        [
          {
            text: "Xem chi tiết đơn",
            onPress: () => router.replace(`/orders/${order.id}`),
          },
        ]
      );
    },
    onError: (err: unknown) => {
      if (err instanceof ApiClientError && ["QUOTE_EXPIRED", "QUOTE_CHANGED"].includes(err.code)) {
        orderAttempt.current = null;
        refetchQuote();
      }
      Alert.alert(
        "Đặt hàng thất bại",
        err instanceof Error ? err.message : "Không thể hoàn tất đơn hàng. Vui lòng kiểm tra lại."
      );
    },
  });

  const handleApplyVoucher = () => {
    setAppliedVoucher(voucherCode.trim());
  };

  const handleClearVoucher = () => {
    setVoucherCode("");
    setAppliedVoucher("");
  };

  const handlePlaceOrder = () => {
    if (!selectedAddressId) {
      Alert.alert("Chưa chọn địa chỉ", "Vui lòng chọn địa chỉ nhận hàng.");
      return;
    }
    if (checkoutItems.length === 0) {
      Alert.alert("Lỗi", "Không có sản phẩm nào trong giỏ hàng để đặt.");
      return;
    }

    placeOrderMutation.mutate();
  };

  const addrList = addresses || [];

  return (
    <View style={styles.container}>
      <ApiStateWrapper
        isLoading={isAddressesLoading || isCartLoading}
        error={(addressesError || cartError) as Error | null}
        onRetry={() => {
          refetchAddresses();
          refetchQuote();
        }}
        isEmpty={checkoutItems.length === 0}
        emptyMessage="Không có sản phẩm nào cần thanh toán."
      >
        <ScrollView style={styles.scroll}>
          {/* Section: Shipping Address */}
          <Surface style={styles.card} elevation={0}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.headerTitleBox}>
                <Icon source="map-marker-outline" size={20} color="#b03a5b" />
                <Text variant="titleMedium" style={styles.cardTitle}>
                  Địa chỉ nhận hàng
                </Text>
              </View>
              <TouchableOpacity onPress={() => router.push("/addresses/new")}>
                <Text style={styles.linkText}>+ Thêm mới</Text>
              </TouchableOpacity>
            </View>

            {addrList.length === 0 ? (
              <View style={styles.emptyAddressBox}>
                <Text style={styles.emptyAddressText}>
                  Bạn chưa có địa chỉ nhận hàng nào.
                </Text>
                <Button
                  mode="outlined"
                  textColor="#b03a5b"
                  onPress={() => router.push("/addresses/new")}
                  style={{ marginTop: 8 }}
                >
                  Tạo địa chỉ nhận hàng
                </Button>
              </View>
            ) : (
              <View style={styles.addressList}>
                {addrList.map((addr: CustomerAddress) => {
                  const isSelected = selectedAddressId === addr.id;
                  return (
                    <TouchableOpacity
                      key={addr.id}
                      onPress={() => setSelectedAddressId(addr.id)}
                      style={[
                        styles.addressItem,
                        isSelected && styles.addressItemSelected,
                      ]}
                    >
                      <RadioButton
                        value={addr.id}
                        status={isSelected ? "checked" : "unchecked"}
                        onPress={() => setSelectedAddressId(addr.id)}
                        color="#b03a5b"
                      />
                      <View style={styles.addressInfo}>
                        <View style={styles.recipientRow}>
                          <Text style={styles.recipientName}>
                            {addr.recipientName}
                          </Text>
                          <Text style={styles.recipientPhone}>
                            ({addr.recipientPhone})
                          </Text>
                          {addr.isDefault && (
                            <Text style={styles.defaultTag}>Mặc định</Text>
                          )}
                        </View>
                        <Text style={styles.addressDetail}>
                          {addr.addressLine}, {addr.wardName},{" "}
                          {addr.provinceName}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </Surface>

          {/* Section: Payment Method */}
          <Surface style={styles.card} elevation={0}>
            <View style={styles.headerTitleBox}>
              <Icon source="credit-card-outline" size={20} color="#b03a5b" />
              <Text variant="titleMedium" style={styles.cardTitle}>
                Phương thức thanh toán
              </Text>
            </View>

            <TouchableOpacity
              style={styles.paymentOption}
              onPress={() => setPaymentMethod("COD")}
            >
              <RadioButton
                value="COD"
                status={paymentMethod === "COD" ? "checked" : "unchecked"}
                onPress={() => setPaymentMethod("COD")}
                color="#b03a5b"
              />
              <View style={styles.paymentOptionInfo}>
                <Text style={styles.paymentOptionTitle}>
                  Thanh toán khi nhận hàng (COD)
                </Text>
                <Text style={styles.paymentOptionDesc}>
                  Thanh toán tiền mặt cho nhân viên giao hàng khi nhận hàng.
                </Text>
              </View>
            </TouchableOpacity>

            <Divider style={{ marginVertical: 4 }} />

            <TouchableOpacity
              style={styles.paymentOption}
              onPress={() => setPaymentMethod("BANK_TRANSFER")}
            >
              <RadioButton
                value="BANK_TRANSFER"
                status={
                  paymentMethod === "BANK_TRANSFER" ? "checked" : "unchecked"
                }
                onPress={() => setPaymentMethod("BANK_TRANSFER")}
                color="#b03a5b"
              />
              <View style={styles.paymentOptionInfo}>
                <Text style={styles.paymentOptionTitle}>
                  Chuyển khoản ngân hàng
                </Text>
                <Text style={styles.paymentOptionDesc}>
                  Nhân viên Halora sẽ đối soát thanh toán sau khi đặt hàng.
                </Text>
              </View>
            </TouchableOpacity>
          </Surface>

          {/* Section: Voucher Code */}
          <Surface style={styles.card} elevation={0}>
            <View style={styles.headerTitleBox}>
              <Icon source="ticket-percent-outline" size={20} color="#b03a5b" />
              <Text variant="titleMedium" style={styles.cardTitle}>
                Mã giảm giá / Voucher
              </Text>
            </View>

            <View style={styles.voucherInputRow}>
              <TextInput
                mode="outlined"
                placeholder="Nhập mã voucher"
                value={voucherCode}
                onChangeText={setVoucherCode}
                style={styles.voucherInput}
                outlineColor="#d1d5db"
                activeOutlineColor="#b03a5b"
                autoCapitalize="characters"
              />
              {appliedVoucher ? (
                <Button
                  mode="outlined"
                  textColor="#ba1a1a"
                  onPress={handleClearVoucher}
                  style={styles.voucherBtn}
                >
                  Gỡ mã
                </Button>
              ) : (
                <Button
                  mode="contained"
                  buttonColor="#b03a5b"
                  disabled={!voucherCode.trim()}
                  onPress={handleApplyVoucher}
                  style={styles.voucherBtn}
                >
                  Áp dụng
                </Button>
              )}
            </View>

            {appliedVoucher && (
              <Text style={styles.appliedVoucherText}>
                Đang áp dụng mã: <Text style={{ fontWeight: "700" }}>{appliedVoucher}</Text>
              </Text>
            )}
          </Surface>

          {/* Section: Note */}
          <Surface style={styles.card} elevation={0}>
            <Text variant="titleMedium" style={styles.cardTitle}>
              Ghi chú cho đơn hàng
            </Text>
            <TextInput
              mode="outlined"
              placeholder="Lời nhắn cho người bán / giao hàng..."
              value={customerNote}
              onChangeText={setCustomerNote}
              multiline
              numberOfLines={2}
              outlineColor="#d1d5db"
              activeOutlineColor="#b03a5b"
              style={{ backgroundColor: "#ffffff", marginTop: 8 }}
            />
          </Surface>

          {/* Section: Price Breakdown Quote */}
          <Surface style={styles.card} elevation={0}>
            <Text variant="titleMedium" style={styles.cardTitle}>
              Chi tiết thanh toán
            </Text>
            <Divider style={{ marginVertical: 10 }} />

            {quote ? (
              <View style={styles.breakdownList}>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Tổng tiền hàng</Text>
                  <Text style={styles.breakdownValue}>
                    {formatVnd(quote.amounts.subtotalAmount)}
                  </Text>
                </View>

                {parseInt(quote.amounts.productDiscountAmount, 10) > 0 && (
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>Giảm giá sản phẩm</Text>
                    <Text style={styles.discountValue}>
                      -{formatVnd(quote.amounts.productDiscountAmount)}
                    </Text>
                  </View>
                )}

                {parseInt(quote.amounts.orderDiscountAmount, 10) > 0 && (
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>Khuyến mãi đơn hàng</Text>
                    <Text style={styles.discountValue}>
                      -{formatVnd(quote.amounts.orderDiscountAmount)}
                    </Text>
                  </View>
                )}

                {parseInt(quote.amounts.voucherDiscountAmount, 10) > 0 && (
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>Giảm giá voucher</Text>
                    <Text style={styles.discountValue}>
                      -{formatVnd(quote.amounts.voucherDiscountAmount)}
                    </Text>
                  </View>
                )}

                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Phí vận chuyển</Text>
                  <Text style={styles.breakdownValue}>
                    {formatVnd(quote.amounts.shippingFee)}
                  </Text>
                </View>

                <Divider style={{ marginVertical: 8 }} />

                <View style={styles.breakdownRow}>
                  <Text variant="titleMedium" style={{ fontWeight: "700" }}>
                    Tổng thanh toán
                  </Text>
                  <Text variant="titleLarge" style={styles.totalFinal}>
                    {formatVnd(quote.amounts.totalAmount)}
                  </Text>
                </View>
              </View>
            ) : isQuoteLoading ? (
              <Text style={styles.loadingQuoteText}>
                Đang tính toán chi phí từ hệ thống...
              </Text>
            ) : quoteError ? (
              <View style={styles.errorQuoteBox}>
                <Text style={styles.errorQuoteText}>
                  Không thể tính báo giá: {(quoteError as any)?.message}
                </Text>
                <Button
                  compact
                  mode="text"
                  textColor="#b03a5b"
                  onPress={() => refetchQuote()}
                >
                  Thử lại
                </Button>
              </View>
            ) : null}
          </Surface>
        </ScrollView>

        {/* Bottom Place Order Bar */}
        <Surface style={styles.bottomBar} elevation={4}>
          <View style={styles.bottomTotalBlock}>
            <Text variant="labelSmall" style={styles.bottomTotalLabel}>
              Tổng thanh toán:
            </Text>
            <Text variant="titleLarge" style={styles.bottomTotalValue}>
              {quote ? formatVnd(quote.amounts.totalAmount) : "..."}
            </Text>
          </View>

          <Button
            mode="contained"
            buttonColor="#b03a5b"
            disabled={
              !selectedAddressId ||
              placeOrderMutation.isPending ||
              isQuoteLoading ||
              !quote
            }
            loading={placeOrderMutation.isPending}
            onPress={handlePlaceOrder}
            style={styles.placeOrderBtn}
          >
            Đặt hàng
          </Button>
        </Surface>
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
  card: {
    backgroundColor: "#ffffff",
    padding: 16,
    marginBottom: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#e5e7eb",
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  headerTitleBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  cardTitle: {
    fontWeight: "700",
    color: "#1f2937",
  },
  linkText: {
    color: "#b03a5b",
    fontWeight: "600",
    fontSize: 13,
  },
  emptyAddressBox: {
    padding: 16,
    alignItems: "center",
  },
  emptyAddressText: {
    color: "#6b7280",
  },
  addressList: {
    gap: 8,
  },
  addressItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#fafafa",
  },
  addressItemSelected: {
    borderColor: "#b03a5b",
    backgroundColor: "#fffbfa",
  },
  addressInfo: {
    flex: 1,
    marginLeft: 6,
  },
  recipientRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  recipientName: {
    fontWeight: "700",
    color: "#1f2937",
  },
  recipientPhone: {
    color: "#6b7280",
    fontSize: 13,
  },
  defaultTag: {
    fontSize: 10,
    backgroundColor: "#fde8ee",
    color: "#b03a5b",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    fontWeight: "700",
  },
  addressDetail: {
    color: "#4b5563",
    fontSize: 13,
    lineHeight: 18,
  },
  paymentOption: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 8,
  },
  paymentOptionInfo: {
    flex: 1,
    marginLeft: 6,
  },
  paymentOptionTitle: {
    fontWeight: "600",
    color: "#1f2937",
  },
  paymentOptionDesc: {
    color: "#6b7280",
    fontSize: 12,
    marginTop: 2,
  },
  voucherInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  voucherInput: {
    flex: 1,
    height: 44,
    backgroundColor: "#ffffff",
  },
  voucherBtn: {
    borderRadius: 8,
    height: 44,
    justifyContent: "center",
  },
  appliedVoucherText: {
    color: "#16a34a",
    fontSize: 13,
    marginTop: 6,
  },
  breakdownList: {
    gap: 8,
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  breakdownLabel: {
    color: "#6b7280",
  },
  breakdownValue: {
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
  loadingQuoteText: {
    color: "#6b7280",
    fontStyle: "italic",
    paddingVertical: 8,
  },
  errorQuoteBox: {
    padding: 8,
    backgroundColor: "#fff1f2",
    borderRadius: 6,
  },
  errorQuoteText: {
    color: "#e11d48",
    fontSize: 13,
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
  bottomTotalBlock: {
    flex: 1,
  },
  bottomTotalLabel: {
    color: "#6b7280",
  },
  bottomTotalValue: {
    color: "#b03a5b",
    fontWeight: "800",
  },
  placeOrderBtn: {
    borderRadius: 8,
    paddingHorizontal: 16,
  },
});
