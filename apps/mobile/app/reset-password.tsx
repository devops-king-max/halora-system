import React, { useState } from "react";
import { View, ScrollView, StyleSheet, Alert } from "react-native";
import { Text, TextInput, Button, Surface } from "react-native-paper";
import { useRouter } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiClient } from "../src/api";

const resetSchema = z
  .object({
    token: z.string().min(1, "Vui lòng nhập mã xác thực đã nhận qua email"),
    newPassword: z.string().min(6, "Mật khẩu mới tối thiểu 6 ký tự"),
    confirmPassword: z.string().min(6, "Vui lòng xác nhận mật khẩu"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Mật khẩu xác nhận không khớp",
    path: ["confirmPassword"],
  });

type ResetFormData = z.infer<typeof resetSchema>;

export default function ResetPasswordScreen() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetFormData>({
    resolver: zodResolver(resetSchema),
    defaultValues: {
      token: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (data: ResetFormData) => {
    setIsSubmitting(true);
    try {
      await apiClient.auth.customerResetPassword(data.token, data.newPassword);
      Alert.alert(
        "Thành công",
        "Mật khẩu đã được đặt lại thành công. Vui lòng đăng nhập với mật khẩu mới.",
        [{ text: "Đăng nhập", onPress: () => router.replace("/login") }]
      );
    } catch (err: any) {
      Alert.alert(
        "Lỗi đặt lại mật khẩu",
        err?.message || "Mã xác thực không hợp lệ hoặc đã hết hạn."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Surface style={styles.card} elevation={0}>
        <Text variant="headlineSmall" style={styles.title}>
          Đặt lại mật khẩu
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          Nhập mã xác thực từ email và thiết lập mật khẩu mới của bạn.
        </Text>

        <Controller
          control={control}
          name="token"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              mode="outlined"
              label="Mã xác thực từ email *"
              placeholder="Nhập mã token..."
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
              error={!!errors.token}
              outlineColor="#d1d5db"
              activeOutlineColor="#b03a5b"
              style={styles.input}
            />
          )}
        />
        {errors.token && (
          <Text style={styles.errorText}>{errors.token.message}</Text>
        )}

        <Controller
          control={control}
          name="newPassword"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              mode="outlined"
              label="Mật khẩu mới *"
              secureTextEntry={!showPassword}
              right={
                <TextInput.Icon
                  icon={showPassword ? "eye-off" : "eye"}
                  onPress={() => setShowPassword(!showPassword)}
                />
              }
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
              error={!!errors.newPassword}
              outlineColor="#d1d5db"
              activeOutlineColor="#b03a5b"
              style={styles.input}
            />
          )}
        />
        {errors.newPassword && (
          <Text style={styles.errorText}>{errors.newPassword.message}</Text>
        )}

        <Controller
          control={control}
          name="confirmPassword"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              mode="outlined"
              label="Xác nhận mật khẩu mới *"
              secureTextEntry={!showPassword}
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
              error={!!errors.confirmPassword}
              outlineColor="#d1d5db"
              activeOutlineColor="#b03a5b"
              style={styles.input}
            />
          )}
        />
        {errors.confirmPassword && (
          <Text style={styles.errorText}>{errors.confirmPassword.message}</Text>
        )}

        <Button
          mode="contained"
          buttonColor="#b03a5b"
          loading={isSubmitting}
          disabled={isSubmitting}
          onPress={handleSubmit(onSubmit)}
          style={styles.submitBtn}
        >
          Xác nhận đổi mật khẩu
        </Button>
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
});
