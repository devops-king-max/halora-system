import React, { useState } from "react";
import { View, ScrollView, StyleSheet, Alert } from "react-native";
import { Text, TextInput, Button, Surface } from "react-native-paper";
import { useRouter } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiClient } from "../src/api";

const forgotSchema = z.object({
  email: z.string().email("Email không đúng định dạng"),
});

type ForgotFormData = z.infer<typeof forgotSchema>;

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotFormData>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (data: ForgotFormData) => {
    setIsSubmitting(true);
    try {
      await apiClient.auth.customerForgotPassword(data.email);
      setIsSent(true);
    } catch (err: any) {
      Alert.alert(
        "Lỗi gửi yêu cầu",
        err?.message || "Không thể gửi yêu cầu đặt lại mật khẩu."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Surface style={styles.card} elevation={0}>
        <Text variant="headlineSmall" style={styles.title}>
          Quên mật khẩu?
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          Nhập địa chỉ email tài khoản của bạn để nhận mã liên kết đặt lại mật khẩu.
        </Text>

        {isSent ? (
          <Surface style={styles.successBox} elevation={0}>
            <Text variant="titleMedium" style={styles.successTitle}>
              Đã gửi yêu cầu thành công!
            </Text>
            <Text style={styles.successDesc}>
              Vui lòng kiểm tra hộp thư đến (hoặc hòm thư rác) của bạn để lấy mã đặt lại mật khẩu.
            </Text>
            <Button
              mode="contained"
              buttonColor="#b03a5b"
              onPress={() => router.push("/reset-password")}
              style={{ marginTop: 16 }}
            >
              Tiến hành đặt lại mật khẩu
            </Button>
          </Surface>
        ) : (
          <>
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  mode="outlined"
                  label="Email *"
                  placeholder="example@gmail.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  error={!!errors.email}
                  outlineColor="#d1d5db"
                  activeOutlineColor="#b03a5b"
                  style={styles.input}
                />
              )}
            />
            {errors.email && (
              <Text style={styles.errorText}>{errors.email.message}</Text>
            )}

            <Button
              mode="contained"
              buttonColor="#b03a5b"
              loading={isSubmitting}
              disabled={isSubmitting}
              onPress={handleSubmit(onSubmit)}
              style={styles.submitBtn}
            >
              Gửi mã đặt lại
            </Button>
          </>
        )}
      </Surface>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  card: {
    padding: 24,
    backgroundColor: "#ffffff",
  },
  title: {
    fontWeight: "800",
    color: "#b03a5b",
    marginBottom: 4,
  },
  subtitle: {
    color: "#6b7280",
    marginBottom: 20,
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
  submitBtn: {
    marginTop: 24,
    borderRadius: 8,
    paddingVertical: 4,
  },
  successBox: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    marginTop: 12,
  },
  successTitle: {
    color: "#166534",
    fontWeight: "700",
    marginBottom: 6,
  },
  successDesc: {
    color: "#15803d",
    lineHeight: 20,
  },
});
