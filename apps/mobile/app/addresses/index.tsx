import React from "react";
import {
  View,
  FlatList,
  StyleSheet,
  RefreshControl,
  Alert,
} from "react-native";
import {
  Text,
  Button,
  Surface,
  IconButton,
  Divider,
} from "react-native-paper";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../src/api";
import { useAuth } from "../../src/AuthContext";
import { ApiStateWrapper } from "../../src/components/ApiStateWrapper";
import { CustomerAddress } from "@halora/api-client";

export default function AddressListScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();

  const {
    data: addresses,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["customer-addresses"],
    queryFn: () => apiClient.customerPortal.listAddresses(),
    enabled: isAuthenticated,
  });

  const setDefaultMutation = useMutation({
    mutationFn: (item: CustomerAddress) =>
      apiClient.customerPortal.updateAddress(item.id, {
        recipientName: item.recipientName,
        recipientPhone: item.recipientPhone,
        addressLine: item.addressLine,
        provinceName: item.provinceName,
        wardName: item.wardName,
        isDefault: true,
        version: item.version,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-addresses"] });
      queryClient.invalidateQueries({ queryKey: ["checkout-addresses"] });
    },
    onError: (err: any) => {
      Alert.alert(
        "Lỗi đặt mặc định",
        err?.message || "Không thể đặt địa chỉ làm mặc định."
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.customerPortal.deleteAddress(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-addresses"] });
      queryClient.invalidateQueries({ queryKey: ["checkout-addresses"] });
    },
    onError: (err: any) => {
      Alert.alert(
        "Lỗi xóa địa chỉ",
        err?.message || "Không thể xóa địa chỉ này."
      );
    },
  });

  const confirmDelete = (id: string) => {
    Alert.alert("Xác nhận xóa", "Bạn có chắc muốn xóa địa chỉ nhận hàng này?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Xóa",
        style: "destructive",
        onPress: () => deleteMutation.mutate(id),
      },
    ]);
  };

  const addressList = addresses || [];

  return (
    <View style={styles.container}>
      <ApiStateWrapper
        isLoading={isLoading}
        error={error as Error | null}
        onRetry={refetch}
        isEmpty={addressList.length === 0}
        emptyMessage="Bạn chưa thêm địa chỉ nhận hàng nào."
      >
        <FlatList
          data={addressList}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              colors={["#b03a5b"]}
            />
          }
          contentContainerStyle={styles.listContent}
          renderItem={({ item }: { item: CustomerAddress }) => (
            <Surface style={styles.addressCard} elevation={1}>
              <View style={styles.headerRow}>
                <View style={styles.namePhoneBox}>
                  <Text style={styles.recipientName}>{item.recipientName}</Text>
                  <Text style={styles.phone}>({item.recipientPhone})</Text>
                  {item.isDefault && (
                    <Text style={styles.defaultBadge}>Mặc định</Text>
                  )}
                </View>

                <View style={styles.actionBtns}>
                  <IconButton
                    icon="pencil-outline"
                    size={20}
                    onPress={() => router.push(`/addresses/${item.id}`)}
                  />
                  <IconButton
                    icon="delete-outline"
                    size={20}
                    iconColor="#ba1a1a"
                    onPress={() => confirmDelete(item.id)}
                  />
                </View>
              </View>

              <Text style={styles.addressLine}>
                {item.addressLine}, {item.wardName}, {item.provinceName}
              </Text>

              {!item.isDefault && (
                <>
                  <Divider style={{ marginVertical: 8 }} />
                  <Button
                    mode="text"
                    textColor="#b03a5b"
                    compact
                    onPress={() => setDefaultMutation.mutate(item)}
                    style={{ alignSelf: "flex-start" }}
                  >
                    Đặt làm mặc định
                  </Button>
                </>
              )}
            </Surface>
          )}
        />
      </ApiStateWrapper>

      {/* Bottom Add Address Button */}
      <Surface style={styles.bottomBar} elevation={4}>
        <Button
          mode="contained"
          buttonColor="#b03a5b"
          icon="plus"
          onPress={() => router.push("/addresses/new")}
          style={styles.addBtn}
        >
          Thêm địa chỉ mới
        </Button>
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  listContent: {
    padding: 16,
    paddingBottom: 80,
    gap: 12,
  },
  addressCard: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  namePhoneBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  recipientName: {
    fontWeight: "700",
    color: "#1f2937",
    fontSize: 15,
  },
  phone: {
    color: "#6b7280",
    fontSize: 13,
  },
  defaultBadge: {
    fontSize: 11,
    backgroundColor: "#fde8ee",
    color: "#b03a5b",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    fontWeight: "700",
  },
  actionBtns: {
    flexDirection: "row",
  },
  addressLine: {
    color: "#4b5563",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#ffffff",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  addBtn: {
    borderRadius: 8,
  },
});
