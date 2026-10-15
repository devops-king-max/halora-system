import React, { useState } from "react";
import { View, ScrollView, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { Text, TextInput, Button, Surface } from "react-native-paper";
import { useRouter } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "../src/AuthContext";

const registerSchema = z.object({
  fullName: z.string().min(2, "Họ tên tối thiểu 2 ký tự"),
  email: z.string().email("Email không đúng định dạng"),
  phone: z
    .string()
    .min(10, "Số điện thoại tối thiểu 10 số")
    .regex(/^[0-9+]+$/, "Số điện thoại không hợp lệ"),
  password: z.string().min(6, "Mật khẩu tối thiểu 6 ký tự"),
});

type RegisterFormData = z.infer<typeof registerSchema>;

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      password: "",
    },
  });

  const onSubmit = async (data: RegisterFormData) => {
    setIsSubmitting(true);
    try {
      await register(data);
      Alert.alert("Thành công", "Tài khoản của bạn đã được tạo thành công!", [
        { text: "OK", onPress: () => router.replace("/(tabs)/account") },
      ]);
    } catch (err: any) {
      Alert.alert(
        "Đăng ký thất bại",
        err?.message || "Không thể tạo tài khoản. Vui lòng thử lại."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Surface style={styles.card} elevation={0}>
        <Text variant="headlineSmall" style={styles.title}>
          Tạo tài khoản mới
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          Đăng ký để tận hưởng các quyền lợi ưu đãi từ Halora
        </Text>

        <Controller
          control={control}
          name="fullName"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              mode="outlined"
              label="Họ và tên *"
              placeholder="Nguyễn Văn A"
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
              error={!!errors.fullName}
              outlineColor="#d1d5db"
              activeOutlineColor="#b03a5b"
              style={styles.input}
            />
          )}
        />
        {errors.fullName && (
          <Text style={styles.errorText}>{errors.fullName.message}</Text>
        )}

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

        <Controller
          control={control}
          name="phone"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              mode="outlined"
              label="Số điện thoại *"
              placeholder="0912345678"
              keyboardType="phone-pad"
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
              error={!!errors.phone}
              outlineColor="#d1d5db"
              activeOutlineColor="#b03a5b"
              style={styles.input}
            />
          )}
        />
        {errors.phone && (
          <Text style={styles.errorText}>{errors.phone.message}</Text>
        )}

        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              mode="outlined"
              label="Mật khẩu *"
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
              error={!!errors.password}
              outlineColor="#d1d5db"
              activeOutlineColor="#b03a5b"
              style={styles.input}
            />
          )}
        />
        {errors.password && (
          <Text style={styles.errorText}>{errors.password.message}</Text>
        )}

        <Button
          mode="contained"
          buttonColor="#b03a5b"
          loading={isSubmitting}
          disabled={isSubmitting}
          onPress={handleSubmit(onSubmit)}
          style={styles.submitBtn}
        >
          Đăng ký tài khoản
        </Button>

        <View style={styles.loginRow}>
          <Text style={{ color: "#6b7280" }}>Đã có tài khoản? </Text>
          <TouchableOpacity onPress={() => router.replace("/login")}>
            <Text style={styles.loginLink}>Đăng nhập ngay</Text>
          </TouchableOpacity>
        </View>
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
  loginRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 20,
  },
  loginLink: {
    color: "#b03a5b",
    fontWeight: "700",
  },
});
