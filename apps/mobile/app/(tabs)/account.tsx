import React from "react";
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
  Avatar,
  Divider,
  Icon,
} from "react-native-paper";
import { useRouter } from "expo-router";
import { useAuth } from "../../src/AuthContext";

export default function AccountScreen() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert("Đăng xuất", "Bạn có chắc chắn muốn đăng xuất khỏi tài khoản?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Đăng xuất",
        style: "destructive",
        onPress: async () => {
          await logout();
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container}>
      {isAuthenticated && user ? (
        <>
          {/* User Profile Header */}
          <Surface style={styles.profileHeader} elevation={1}>
            <Avatar.Text
              size={64}
              label={user.fullName?.charAt(0)?.toUpperCase() || "H"}
              style={{ backgroundColor: "#b03a5b" }}
            />
            <View style={styles.profileInfo}>
              <Text variant="titleMedium" style={styles.userName}>
                {user.fullName}
              </Text>
              <Text variant="bodySmall" style={styles.userEmail}>
                {user.email}
              </Text>
              {user.phone && (
                <Text variant="bodySmall" style={styles.userPhone}>
                  {user.phone}
                </Text>
              )}
            </View>
          </Surface>

          {/* Account Menu */}
          <View style={styles.menuSection}>
            <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/assistant")}>
              <View style={styles.menuIconContainer}><Icon source="robot-outline" size={22} color="#b03a5b" /></View>
              <Text variant="bodyLarge" style={styles.menuLabel}>Trợ lý tư vấn sản phẩm</Text>
              <Icon source="chevron-right" size={22} color="#9ca3af" />
            </TouchableOpacity>
            <Divider style={styles.divider} />
            <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/profile")}>
              <View style={styles.menuIconContainer}><Icon source="account-edit-outline" size={22} color="#b03a5b" /></View>
              <Text variant="bodyLarge" style={styles.menuLabel}>Chỉnh sửa thông tin cá nhân</Text>
              <Icon source="chevron-right" size={22} color="#9ca3af" />
            </TouchableOpacity>
            <Divider style={styles.divider} />
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push("/orders")}
            >
              <View style={styles.menuIconContainer}>
                <Icon source="clipboard-text-outline" size={22} color="#b03a5b" />
              </View>
              <Text variant="bodyLarge" style={styles.menuLabel}>
                Đơn hàng của tôi
              </Text>
              <Icon source="chevron-right" size={22} color="#9ca3af" />
            </TouchableOpacity>
            <Divider style={styles.divider} />

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push("/addresses")}
            >
              <View style={styles.menuIconContainer}>
                <Icon source="map-marker-outline" size={22} color="#b03a5b" />
              </View>
              <Text variant="bodyLarge" style={styles.menuLabel}>
                Sổ địa chỉ nhận hàng
              </Text>
              <Icon source="chevron-right" size={22} color="#9ca3af" />
            </TouchableOpacity>
            <Divider style={styles.divider} />

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push("/change-password")}
            >
              <View style={styles.menuIconContainer}>
                <Icon source="lock-outline" size={22} color="#b03a5b" />
              </View>
              <Text variant="bodyLarge" style={styles.menuLabel}>
                Đổi mật khẩu
              </Text>
              <Icon source="chevron-right" size={22} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          {/* Logout Button */}
          <View style={styles.logoutContainer}>
            <Button
              mode="outlined"
              textColor="#ba1a1a"
              style={styles.logoutBtn}
              onPress={handleLogout}
              icon="logout"
            >
              Đăng xuất
            </Button>
          </View>
        </>
      ) : (
        /* Guest View */
        <View style={styles.guestContainer}>
          <Surface style={styles.guestCard} elevation={1}>
            <Avatar.Icon
              size={72}
              icon="account-outline"
              style={{ backgroundColor: "#fde8ee" }}
              color="#b03a5b"
            />
            <Text variant="titleMedium" style={styles.guestTitle}>
              Chào mừng bạn đến với Halora
            </Text>
            <Text variant="bodyMedium" style={styles.guestSubtitle}>
              Đăng nhập để theo dõi đơn hàng, quản lý địa chỉ nhận hàng và nhận ưu đãi riêng.
            </Text>

            <View style={styles.guestActions}>
              <Button
                mode="contained"
                buttonColor="#b03a5b"
                onPress={() => router.push("/login")}
                style={styles.guestActionBtn}
              >
                Đăng nhập
              </Button>
              <Button
                mode="outlined"
                textColor="#b03a5b"
                onPress={() => router.push("/register")}
                style={styles.guestActionBtn}
              >
                Đăng ký tài khoản
              </Button>
            </View>
          </Surface>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    padding: 20,
    marginBottom: 16,
  },
  profileInfo: {
    marginLeft: 16,
    flex: 1,
  },
  userName: {
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 2,
  },
  userEmail: {
    color: "#6b7280",
  },
  userPhone: {
    color: "#6b7280",
    marginTop: 2,
  },
  menuSection: {
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#e5e7eb",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  menuIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#fde8ee",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  menuLabel: {
    flex: 1,
    color: "#1f2937",
    fontWeight: "500",
  },
  divider: {
    marginLeft: 66,
    backgroundColor: "#f3f4f6",
  },
  logoutContainer: {
    padding: 24,
    marginTop: 12,
  },
  logoutBtn: {
    borderColor: "#fecdd3",
    borderRadius: 8,
  },
  guestContainer: {
    padding: 20,
    paddingTop: 40,
  },
  guestCard: {
    padding: 24,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    alignItems: "center",
  },
  guestTitle: {
    fontWeight: "700",
    color: "#1f2937",
    marginTop: 16,
    marginBottom: 8,
    textAlign: "center",
  },
  guestSubtitle: {
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  guestActions: {
    width: "100%",
    gap: 12,
  },
  guestActionBtn: {
    borderRadius: 8,
  },
});
