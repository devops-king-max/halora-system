import React, { useState } from "react";
import { View, ScrollView, StyleSheet, Alert } from "react-native";
import { Text, TextInput, Button, Surface } from "react-native-paper";
import { useRouter } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiClient } from "../src/api";

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Vui lòng nhập mật khẩu hiện tại"),
    newPassword: z.string().min(6, "Mật khẩu mới tối thiểu 6 ký tự"),
    confirmPassword: z.string().min(6, "Vui lòng xác nhận mật khẩu"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Mật khẩu xác nhận không khớp",
    path: ["confirmPassword"],
  });

type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;

export default function ChangePasswordScreen() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (data: ChangePasswordFormData) => {
    setIsSubmitting(true);
    try {
      await apiClient.auth.changePassword(data.currentPassword, data.newPassword);
      Alert.alert("Thành công", "Mật khẩu của bạn đã được thay đổi thành công.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert(
        "Đổi mật khẩu thất bại",
        err?.message || "Mật khẩu hiện tại không chính xác."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Surface style={styles.card} elevation={0}>
        <Text variant="headlineSmall" style={styles.title}>
          Đổi mật khẩu
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          Để bảo mật tài khoản, vui lòng không chia sẻ mật khẩu cho người khác.
        </Text>

        <Controller
          control={control}
          name="currentPassword"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              mode="outlined"
              label="Mật khẩu hiện tại *"
              secureTextEntry={!showCurrent}
              right={
                <TextInput.Icon
                  icon={showCurrent ? "eye-off" : "eye"}
                  onPress={() => setShowCurrent(!showCurrent)}
                />
              }
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
              error={!!errors.currentPassword}
              outlineColor="#d1d5db"
              activeOutlineColor="#b03a5b"
              style={styles.input}
            />
          )}
        />
        {errors.currentPassword && (
          <Text style={styles.errorText}>{errors.currentPassword.message}</Text>
        )}

        <Controller
          control={control}
          name="newPassword"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              mode="outlined"
              label="Mật khẩu mới *"
              secureTextEntry={!showNew}
              right={
                <TextInput.Icon
                  icon={showNew ? "eye-off" : "eye"}
                  onPress={() => setShowNew(!showNew)}
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
              secureTextEntry={!showNew}
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
          Cập nhật mật khẩu
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
