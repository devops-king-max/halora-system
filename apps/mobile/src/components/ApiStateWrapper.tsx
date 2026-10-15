import React from "react";
import { View, StyleSheet } from "react-native";
import { ActivityIndicator, Text, Button, Surface } from "react-native-paper";

interface ApiStateWrapperProps {
  isLoading: boolean;
  error: Error | null;
  onRetry?: () => void;
  isEmpty?: boolean;
  emptyMessage?: string;
  children: React.ReactNode;
}

export function ApiStateWrapper({
  isLoading,
  error,
  onRetry,
  isEmpty,
  emptyMessage = "Chưa có dữ liệu.",
  children,
}: ApiStateWrapperProps) {
  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#b03a5b" />
        <Text style={styles.loadingText}>Đang tải dữ liệu...</Text>
      </View>
    );
  }

  if (error) {
    const errorMsg =
      error.message ||
      "Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại kết nối mạng.";
    return (
      <View style={styles.centerContainer}>
        <Surface style={styles.errorCard} elevation={1}>
          <Text variant="titleMedium" style={styles.errorTitle}>
            Lỗi kết nối
          </Text>
          <Text variant="bodyMedium" style={styles.errorMessage}>
            {errorMsg}
          </Text>
          {onRetry && (
            <Button
              mode="contained"
              buttonColor="#b03a5b"
              onPress={onRetry}
              style={styles.retryButton}
            >
              Thử lại
            </Button>
          )}
        </Surface>
      </View>
    );
  }

  if (isEmpty) {
    return (
      <View style={styles.centerContainer}>
        <Text variant="bodyLarge" style={styles.emptyText}>
          {emptyMessage}
        </Text>
        {onRetry && (
          <Button
            mode="outlined"
            textColor="#b03a5b"
            onPress={onRetry}
            style={styles.retryButton}
          >
            Làm mới
          </Button>
        )}
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    color: "#6b7280",
    fontSize: 14,
  },
  errorCard: {
    padding: 20,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#fecdd3",
    alignItems: "center",
    maxWidth: 340,
    width: "100%",
  },
  errorTitle: {
    color: "#ba1a1a",
    fontWeight: "700",
    marginBottom: 8,
  },
  errorMessage: {
    color: "#4b5563",
    textAlign: "center",
    marginBottom: 16,
  },
  emptyText: {
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 12,
  },
  retryButton: {
    marginTop: 8,
    borderRadius: 8,
  },
});
