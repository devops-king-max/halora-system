import React, { useState } from "react";
import { View, ScrollView, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { Text, TextInput, Button, Surface } from "react-native-paper";
import { useRouter } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "../src/AuthContext";

const loginSchema = z.object({
  email: z.string().email("Email không đúng định dạng"),
  password: z.string().min(6, "Mật khẩu tối thiểu 6 ký tự"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsSubmitting(true);
    try {
      await login(data);
      router.back();
    } catch (err: any) {
      Alert.alert(
        "Đăng nhập thất bại",
        err?.message || "Email hoặc mật khẩu không chính xác."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Surface style={styles.card} elevation={0}>
        <Text variant="headlineSmall" style={styles.title}>
          Đăng nhập tài khoản
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          Chào mừng quý khách đến với thế giới làm đẹp Halora
        </Text>

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

        <TouchableOpacity
          onPress={() => router.push("/forgot-password")}
          style={styles.forgotBtn}
        >
          <Text style={styles.forgotText}>Quên mật khẩu?</Text>
        </TouchableOpacity>

        <Button
          mode="contained"
          buttonColor="#b03a5b"
          loading={isSubmitting}
          disabled={isSubmitting}
          onPress={handleSubmit(onSubmit)}
          style={styles.submitBtn}
        >
          Đăng nhập
        </Button>

        <View style={styles.registerRow}>
          <Text style={{ color: "#6b7280" }}>Chưa có tài khoản? </Text>
          <TouchableOpacity onPress={() => router.push("/register")}>
            <Text style={styles.registerLink}>Đăng ký ngay</Text>
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
  forgotBtn: {
    alignSelf: "flex-end",
    marginTop: 10,
    marginBottom: 16,
  },
  forgotText: {
    color: "#b03a5b",
    fontSize: 13,
    fontWeight: "600",
  },
  submitBtn: {
    borderRadius: 8,
    paddingVertical: 4,
  },
  registerRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 20,
  },
  registerLink: {
    color: "#b03a5b",
    fontWeight: "700",
  },
});
