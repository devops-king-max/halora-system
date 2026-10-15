import React, { useEffect } from "react";
import { View, ScrollView, StyleSheet, Alert } from "react-native";
import { Text, TextInput, Button, Checkbox, Surface } from "react-native-paper";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../src/api";
import { ApiStateWrapper } from "../../src/components/ApiStateWrapper";
import { CustomerAddress } from "@halora/api-client";

const addressSchema = z.object({
  recipientName: z.string().min(2, "Vui lòng nhập tên người nhận"),
  recipientPhone: z
    .string()
    .min(10, "Số điện thoại tối thiểu 10 ký tự")
    .regex(/^[0-9+]+$/, "Số điện thoại không hợp lệ"),
  provinceName: z.string().min(1, "Vui lòng nhập Tỉnh/Thành phố"),
  wardName: z.string().min(1, "Vui lòng nhập Phường/Xã/Quận"),
  addressLine: z.string().min(3, "Vui lòng nhập địa chỉ cụ thể (số nhà, tên đường)"),
  isDefault: z.boolean().default(false),
});

type AddressFormData = z.infer<typeof addressSchema>;

export default function EditAddressScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AddressFormData>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      recipientName: "",
      recipientPhone: "",
      provinceName: "",
      wardName: "",
      addressLine: "",
      isDefault: false,
    },
  });

  const {
    data: addresses,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["customer-addresses"],
    queryFn: () => apiClient.customerPortal.listAddresses(),
  });

  const currentAddress = addresses?.find((a: CustomerAddress) => a.id === id);

  useEffect(() => {
    if (currentAddress) {
      reset({
        recipientName: currentAddress.recipientName,
        recipientPhone: currentAddress.recipientPhone,
        provinceName: currentAddress.provinceName,
        wardName: currentAddress.wardName,
        addressLine: currentAddress.addressLine,
        isDefault: currentAddress.isDefault,
      });
    }
  }, [currentAddress, reset]);

  const updateAddressMutation = useMutation({
    mutationFn: (data: AddressFormData) =>
      apiClient.customerPortal.updateAddress(id!, {
        ...data,
        version: currentAddress?.version || 1,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-addresses"] });
      queryClient.invalidateQueries({ queryKey: ["checkout-addresses"] });
      Alert.alert("Thành công", "Đã cập nhật địa chỉ nhận hàng.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    },
    onError: (err: any) => {
      Alert.alert(
        "Lỗi cập nhật",
        err?.message || "Không thể cập nhật địa chỉ."
      );
    },
  });

  const onSubmit = (data: AddressFormData) => {
    updateAddressMutation.mutate(data);
  };

  return (
    <ScrollView style={styles.container}>
      <ApiStateWrapper
        isLoading={isLoading}
        error={error as Error | null}
        onRetry={refetch}
        isEmpty={!currentAddress}
        emptyMessage="Không tìm thấy thông tin địa chỉ."
      >
        <Surface style={styles.formCard} elevation={0}>
          {/* Recipient Name */}
          <Controller
            control={control}
            name="recipientName"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                mode="outlined"
                label="Họ và tên người nhận *"
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                error={!!errors.recipientName}
                outlineColor="#d1d5db"
                activeOutlineColor="#b03a5b"
                style={styles.input}
              />
            )}
          />
          {errors.recipientName && (
            <Text style={styles.errorText}>{errors.recipientName.message}</Text>
          )}

          {/* Recipient Phone */}
          <Controller
            control={control}
            name="recipientPhone"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                mode="outlined"
                label="Số điện thoại *"
                keyboardType="phone-pad"
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                error={!!errors.recipientPhone}
                outlineColor="#d1d5db"
                activeOutlineColor="#b03a5b"
                style={styles.input}
              />
            )}
          />
          {errors.recipientPhone && (
            <Text style={styles.errorText}>{errors.recipientPhone.message}</Text>
          )}

          {/* Province Name */}
          <Controller
            control={control}
            name="provinceName"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                mode="outlined"
                label="Tỉnh / Thành phố *"
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                error={!!errors.provinceName}
                outlineColor="#d1d5db"
                activeOutlineColor="#b03a5b"
                style={styles.input}
              />
            )}
          />
          {errors.provinceName && (
            <Text style={styles.errorText}>{errors.provinceName.message}</Text>
          )}

          {/* Ward / District Name */}
          <Controller
            control={control}
            name="wardName"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                mode="outlined"
                label="Phường / Xã / Quận *"
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                error={!!errors.wardName}
                outlineColor="#d1d5db"
                activeOutlineColor="#b03a5b"
                style={styles.input}
              />
            )}
          />
          {errors.wardName && (
            <Text style={styles.errorText}>{errors.wardName.message}</Text>
          )}

          {/* Address Line */}
          <Controller
            control={control}
            name="addressLine"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                mode="outlined"
                label="Địa chỉ chi tiết *"
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                error={!!errors.addressLine}
                outlineColor="#d1d5db"
                activeOutlineColor="#b03a5b"
                style={styles.input}
              />
            )}
          />
          {errors.addressLine && (
            <Text style={styles.errorText}>{errors.addressLine.message}</Text>
          )}

          {/* Is Default Checkbox */}
          <Controller
            control={control}
            name="isDefault"
            render={({ field: { onChange, value } }) => (
              <View style={styles.checkboxRow}>
                <Checkbox
                  status={value ? "checked" : "unchecked"}
                  onPress={() => onChange(!value)}
                  color="#b03a5b"
                />
                <Text variant="bodyMedium">Đặt làm địa chỉ nhận hàng mặc định</Text>
              </View>
            )}
          />

          <Button
            mode="contained"
            buttonColor="#b03a5b"
            loading={updateAddressMutation.isPending}
            disabled={updateAddressMutation.isPending}
            onPress={handleSubmit(onSubmit)}
            style={styles.submitBtn}
          >
            Cập nhật địa chỉ
          </Button>
        </Surface>
      </ApiStateWrapper>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  formCard: {
    backgroundColor: "#ffffff",
    padding: 16,
    margin: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  input: {
    backgroundColor: "#ffffff",
    marginTop: 12,
  },
  errorText: {
    color: "#ba1a1a",
    fontSize: 12,
    marginTop: 4,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    marginBottom: 8,
  },
  submitBtn: {
    marginTop: 16,
    borderRadius: 8,
  },
});
