import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Button, HelperText, Surface, Text, TextInput } from "react-native-paper";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiClient } from "../src/api";
import { useAuth } from "../src/AuthContext";

const schema = z.object({
  fullName: z.string().trim().min(1, "Vui lòng nhập họ và tên").max(255, "Họ tên tối đa 255 ký tự"),
  email: z.string().trim().email("Email không hợp lệ").max(254, "Email tối đa 254 ký tự"),
  phone: z.string().trim().min(1, "Vui lòng nhập số điện thoại").max(255, "Số điện thoại quá dài"),
});
type Values = z.infer<typeof schema>;

export default function ProfileScreen() {
  const router = useRouter();
  const { isAuthenticated, user, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const key = ["auth", "profile", user?.accountId];
  const { data: profile, isLoading, error: loadError, refetch } = useQuery({
    queryKey: key, queryFn: () => apiClient.auth.getProfile(), enabled: isAuthenticated,
  });
  const { control, handleSubmit, reset, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema), defaultValues: { fullName: "", email: "", phone: "" },
  });
  useEffect(() => { if (profile) reset({ fullName: profile.fullName, email: profile.email, phone: profile.phone }); }, [profile, reset]);
  const save = async (values: Values) => {
    if (!profile) return;
    setSaving(true); setError(""); setSuccess(false);
    try {
      const saved = await apiClient.auth.updateProfile({ ...values, version: profile.version });
      queryClient.setQueryData(key, saved);
      await refreshProfile();
      setSuccess(true);
    } catch (err) { setError(err instanceof Error ? err.message : "Không thể cập nhật thông tin cá nhân."); }
    finally { setSaving(false); }
  };
  if (!isAuthenticated) return <View style={styles.card}><Text>Vui lòng đăng nhập để sửa thông tin cá nhân.</Text><Button onPress={() => router.push("/login")}>Đăng nhập</Button></View>;
  return <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
    <Surface style={styles.card} elevation={0}>
      <Text variant="headlineSmall">Thông tin cá nhân</Text>
      {isLoading && <Text style={styles.notice}>Đang tải thông tin…</Text>}
      {(loadError || error) && <View style={styles.notice}>
        <Text style={{ color: "#ba1a1a" }}>{error || (loadError instanceof Error ? loadError.message : "Không thể tải hồ sơ.")}</Text>
        <Button disabled={saving} onPress={() => { setError(""); setSuccess(false); refetch(); }}>Tải lại</Button>
      </View>}
      {profile && <>
        <Text style={styles.notice}>Tên đăng nhập: {profile.username}</Text>
        {([['fullName', 'Họ và tên'], ['email', 'Email'], ['phone', 'Số điện thoại']] as const).map(([name, label]) => <View key={name}>
          <Controller control={control} name={name} render={({ field: { onChange, onBlur, value } }) => <TextInput
            mode="outlined" label={label + " *"} value={value} onChangeText={onChange} onBlur={onBlur}
            disabled={saving} error={!!errors[name]} autoCapitalize={name === 'fullName' ? 'words' : 'none'}
            keyboardType={name === 'email' ? 'email-address' : name === 'phone' ? 'phone-pad' : 'default'}
            autoComplete={name === 'fullName' ? 'name' : name === 'phone' ? 'tel' : 'email'}
            maxLength={name === 'email' ? 254 : 255} style={styles.input} /> } />
          {errors[name] && <HelperText type="error">{errors[name]?.message}</HelperText>}
        </View>)}
        {success && <Text style={styles.notice}>Đã cập nhật thông tin cá nhân.</Text>}
        <Button mode="contained" buttonColor="#b03a5b" loading={saving} disabled={saving} onPress={handleSubmit(save)}>Lưu thông tin cá nhân</Button>
      </>}
    </Surface>
  </ScrollView>;
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  card: { padding: 20, margin: 16, borderRadius: 12, backgroundColor: "#fff" },
  notice: { marginVertical: 16 },
  input: { marginBottom: 12, backgroundColor: "#fff" },
});
