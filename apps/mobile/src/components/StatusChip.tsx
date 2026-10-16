import React from "react";
import { StyleSheet } from "react-native";
import { Chip, Text } from "react-native-paper";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  PAYMENT_STATUS_LABELS,
} from "../format";

interface StatusChipProps {
  status: string;
  type?: "order" | "payment";
}

export function StatusChip({ status, type = "order" }: StatusChipProps) {
  if (type === "order") {
    const label = ORDER_STATUS_LABELS[status] || status;
    const color = ORDER_STATUS_COLORS[status] || "#6b7280";

    return (
      <Chip
        compact
        style={[styles.chip, { backgroundColor: color + "1a", borderColor: color }]}
      >
        <Text style={{ color, fontSize: 12, fontWeight: "600" }}>{label}</Text>
      </Chip>
    );
  }

  // Payment status
  const label = PAYMENT_STATUS_LABELS[status] || status;
  const isPaid = status === "SUCCEEDED";
  const color = isPaid ? "#52c41a" : status === "FAILED" ? "#f5222d" : status === "CANCELLED" ? "#6b7280" : "#faad14";

  return (
    <Chip
      compact
      style={[styles.chip, { backgroundColor: color + "1a", borderColor: color }]}
    >
      <Text style={{ color, fontSize: 12, fontWeight: "600" }}>{label}</Text>
    </Chip>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderWidth: 1,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
});
