import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Button, Chip, Icon, IconButton, Surface, Text, TextInput } from "react-native-paper";
import { useRouter } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { ApiClientError, AssistantChatMessage, AssistantProduct } from "@halora/api-client";
import { apiClient } from "../src/api";
import { formatVnd } from "../src/format";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  products?: AssistantProduct[];
  failed?: boolean;
  request?: AssistantChatMessage[];
}

const SUGGESTIONS = [
  "Sản phẩm nào phù hợp cho da khô?",
  "Son môi dưới 300.000đ",
  "Sản phẩm nổi bật đang còn hàng",
];

let messageSeq = 0;
const nextId = (): string => {
  messageSeq += 1;
  return `m${messageSeq}`;
};

export default function AssistantScreen() {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [history, setHistory] = useState<AssistantChatMessage[]>([]);
  const [input, setInput] = useState("");
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const send = useMutation({
    mutationFn: (payload: AssistantChatMessage[]) =>
      apiClient.customerPortal.chatAssistant({ messages: payload }),
  });

  const run = async (request: AssistantChatMessage[], userText?: string) => {
    if (userText) {
      setMessages((prev) => [...prev, { id: nextId(), role: "user", content: userText }]);
    }
    try {
      const result = await send.mutateAsync(request);
      setHistory(request);
      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: "assistant", content: result.reply, products: result.products },
      ]);
    } catch (error) {
      const message =
        error instanceof ApiClientError
          ? error.message
          : "Không thể kết nối trợ lý AI. Vui lòng kiểm tra kết nối và thử lại.";
      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: "assistant", content: message, failed: true, request },
      ]);
    }
  };

  const submit = () => {
    const content = input.trim();
    if (!content || send.isPending) return;
    setInput("");
    void run([...history, { role: "user", content }], content);
  };

  const retry = (failed: ChatMessage) => {
    if (!failed.request || send.isPending) return;
    setMessages((prev) => prev.filter((message) => message.id !== failed.id));
    void run(failed.request);
  };

  const renderProduct = (product: AssistantProduct) => (
    <TouchableOpacity
      key={product.id}
      style={styles.productCard}
      onPress={() => router.push(`/products/${product.id}`)}
    >
      {product.thumbnailUrl ? (
        <Image source={{ uri: product.thumbnailUrl }} style={styles.productImage} />
      ) : (
        <View style={[styles.productImage, styles.productPlaceholder]}>
          <Icon source="image-outline" size={22} color="#9ca3af" />
        </View>
      )}
      <View style={styles.productInfo}>
        <Text variant="bodyMedium" numberOfLines={2} style={styles.productName}>
          {product.name}
        </Text>
        <Text variant="bodySmall" style={styles.productCode}>
          {product.code}
        </Text>
        <Text variant="bodySmall" style={styles.productPrice}>
          {product.priceFrom ? `Từ ${formatVnd(product.priceFrom)}` : "Đang cập nhật giá"}
        </Text>
      </View>
      <Icon source="chevron-right" size={20} color="#9ca3af" />
    </TouchableOpacity>
  );

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const mine = item.role === "user";
    return (
      <View style={[styles.messageRow, mine ? styles.rowRight : styles.rowLeft]}>
        <Surface style={[styles.bubble, mine ? styles.userBubble : styles.assistantBubble]} elevation={0}>
          <Text variant="bodyMedium" style={mine ? styles.userText : styles.assistantText}>
            {item.content}
          </Text>
          {!mine && item.products && item.products.length > 0 ? (
            <View style={styles.products}>{item.products.map(renderProduct)}</View>
          ) : null}
          {item.failed ? (
            <Button
              mode="text"
              compact
              textColor="#b03a5b"
              disabled={send.isPending}
              onPress={() => retry(item)}
            >
              Thử lại
            </Button>
          ) : null}
        </Surface>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <Surface style={styles.welcome} elevation={0}>
            <Icon source="robot-outline" size={40} color="#b03a5b" />
            <Text variant="titleMedium" style={styles.welcomeTitle}>
              Trợ lý tư vấn Halora
            </Text>
            <Text variant="bodyMedium" style={styles.welcomeText}>
              Tôi tìm sản phẩm trực tiếp trong dữ liệu của Halora. Hãy cho tôi biết bạn
              cần loại mỹ phẩm nào, ngân sách bao nhiêu.
            </Text>
            <View style={styles.suggestions}>
              {SUGGESTIONS.map((suggestion) => (
                <Chip key={suggestion} style={styles.suggestion} onPress={() => setInput(suggestion)}>
                  {suggestion}
                </Chip>
              ))}
            </View>
          </Surface>
        }
        ListFooterComponent={
          send.isPending ? (
            <View style={[styles.messageRow, styles.rowLeft]}>
              <Surface style={[styles.bubble, styles.assistantBubble]} elevation={0}>
                <View style={styles.typing}>
                  <ActivityIndicator size="small" color="#b03a5b" />
                  <Text variant="bodySmall" style={styles.typingText}>
                    Đang tra cứu sản phẩm…
                  </Text>
                </View>
              </Surface>
            </View>
          ) : null
        }
      />
      <Surface style={styles.composer} elevation={2}>
        <TextInput
          mode="outlined"
          dense
          placeholder="Nhập câu hỏi về sản phẩm…"
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={2000}
          disabled={send.isPending}
          style={styles.input}
          outlineColor="#e5e7eb"
          activeOutlineColor="#b03a5b"
          onSubmitEditing={submit}
        />
        <IconButton
          icon="send"
          size={24}
          iconColor="#ffffff"
          containerColor={input.trim() && !send.isPending ? "#b03a5b" : "#d1d5db"}
          disabled={!input.trim() || send.isPending}
          onPress={submit}
          accessibilityLabel="Gửi câu hỏi"
        />
      </Surface>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  listContent: { padding: 16, paddingBottom: 24, flexGrow: 1 },
  welcome: {
    padding: 20,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    alignItems: "center",
    marginTop: 24,
  },
  welcomeTitle: { fontWeight: "700", color: "#1f2937", marginTop: 8 },
  welcomeText: { color: "#6b7280", textAlign: "center", marginTop: 6 },
  suggestions: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", marginTop: 14 },
  suggestion: { margin: 4, backgroundColor: "#fde8ee" },
  messageRow: { marginBottom: 12, flexDirection: "row" },
  rowLeft: { justifyContent: "flex-start" },
  rowRight: { justifyContent: "flex-end" },
  bubble: { maxWidth: "86%", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  userBubble: { backgroundColor: "#b03a5b", borderBottomRightRadius: 4 },
  assistantBubble: { backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#e5e7eb", borderBottomLeftRadius: 4 },
  userText: { color: "#ffffff" },
  assistantText: { color: "#1f2937" },
  products: { marginTop: 10, gap: 8 },
  productCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    borderRadius: 12,
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#eef0f3",
  },
  productImage: { width: 48, height: 48, borderRadius: 8, backgroundColor: "#f3f4f6" },
  productPlaceholder: { alignItems: "center", justifyContent: "center" },
  productInfo: { flex: 1, marginHorizontal: 10 },
  productName: { fontWeight: "600", color: "#1f2937" },
  productCode: { color: "#9ca3af" },
  productPrice: { color: "#b03a5b", fontWeight: "700", marginTop: 2 },
  typing: { flexDirection: "row", alignItems: "center" },
  typingText: { marginLeft: 8, color: "#6b7280" },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  input: { flex: 1, backgroundColor: "#ffffff", maxHeight: 120, marginRight: 8 },
});
