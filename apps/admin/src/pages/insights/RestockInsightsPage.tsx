import React, { useState } from "react";
import {
  Button,
  Card,
  Col,
  InputNumber,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import { ReloadOutlined, RiseOutlined, WarningOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../api";
import { ApiStateWrapper } from "../../components/common/ApiStateWrapper";
import { PermissionGuard } from "../../components/common/PermissionGuard";
import { formatDateTime, formatVnd } from "../../utils/format";
import type { RestockInsight } from "@halora/api-client";

const { Title, Text } = Typography;

const DEFAULT_TARGET_COVER_DAYS = 30;
const LOW_COVER_ALERT_DAYS = 14;

export const RestockInsightsPage: React.FC = () => {
  const [targetCoverDays, setTargetCoverDays] = useState(DEFAULT_TARGET_COVER_DAYS);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["admin", "insights", "restock", targetCoverDays],
    queryFn: () => apiClient.insights.getRestock({ targetCoverDays, limit: 200 }),
    enabled: targetCoverDays >= 1 && targetCoverDays <= 365,
  });

  const rows = data ?? [];
  const lowStockCount = rows.filter((row) => row.isLowStock).length;
  const suggestedUnits = rows.reduce((total, row) => total + row.suggestedOrderQuantity, 0);

  const columns = [
    {
      title: "SKU",
      dataIndex: "sku",
      key: "sku",
      width: 100,
      render: (sku: string) => <code>{sku}</code>,
    },
    {
      title: "Sản phẩm / Biến thể",
      key: "product",
      render: (_: unknown, row: RestockInsight) => (
        <div>
          <Text strong>{row.productName}</Text>
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {row.variantName}
            </Text>
          </div>
        </div>
      ),
    },
    {
      title: "Tồn kho",
      dataIndex: "stockQuantity",
      key: "stockQuantity",
      align: "right" as const,
      render: (value: number, row: RestockInsight) => (
        <Text type={row.isLowStock ? "danger" : undefined} strong={row.isLowStock}>
          {new Intl.NumberFormat("vi-VN").format(value)}
        </Text>
      ),
    },
    {
      title: "Ngưỡng",
      dataIndex: "lowStockThreshold",
      key: "lowStockThreshold",
      align: "right" as const,
    },
    {
      title: "Bán 30 ngày",
      dataIndex: "unitsSold30",
      key: "unitsSold30",
      align: "right" as const,
    },
    {
      title: "Bán 90 ngày",
      dataIndex: "unitsSold90",
      key: "unitsSold90",
      align: "right" as const,
    },
    {
      title: "TB/ngày (30)",
      dataIndex: "averageDailySales30",
      key: "averageDailySales30",
      align: "right" as const,
      render: (value: number) => Number(value).toFixed(3),
    },
    {
      title: "Ngày đủ hàng",
      dataIndex: "daysOfCover",
      key: "daysOfCover",
      align: "right" as const,
      render: (value: number | null) =>
        value === null ? (
          <Tooltip title="Chưa có phát sinh bán trong 90 ngày gần nhất">
            <Text type="secondary">Không xác định</Text>
          </Tooltip>
        ) : (
          <Text type={value <= LOW_COVER_ALERT_DAYS ? "warning" : undefined}>{value.toFixed(1)}</Text>
        ),
    },
    {
      title: "SL đề xuất nhập",
      dataIndex: "suggestedOrderQuantity",
      key: "suggestedOrderQuantity",
      align: "right" as const,
      render: (value: number) => (
        <Text strong type={value > 0 ? "danger" : "secondary"}>
          {new Intl.NumberFormat("vi-VN").format(value)}
        </Text>
      ),
    },
    {
      title: "Cảnh báo",
      key: "status",
      render: (_: unknown, row: RestockInsight) =>
        row.isLowStock ? (
          <Tag color="red" icon={<WarningOutlined />}>
            Dưới ngưỡng
          </Tag>
        ) : row.daysOfCover !== null && row.daysOfCover <= LOW_COVER_ALERT_DAYS ? (
          <Tag color="orange">Sắp hết</Tag>
        ) : (
          <Tag color="green">Đủ hàng</Tag>
        ),
    },
    {
      title: "Nhà cung cấp gần nhất",
      key: "supplier",
      render: (_: unknown, row: RestockInsight) => (
        <div>
          <Text>{row.lastSupplierName ?? "—"}</Text>
          {row.lastReceivedAt ? (
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Nhập {formatDateTime(row.lastReceivedAt)}
              </Text>
            </div>
          ) : null}
        </div>
      ),
    },
    {
      title: "Giá nhập gần nhất",
      dataIndex: "lastUnitCost",
      key: "lastUnitCost",
      align: "right" as const,
      render: (value: string | null) => formatVnd(value),
    },
    {
      title: "Giá báo NCC",
      dataIndex: "quotedCostPrice",
      key: "quotedCostPrice",
      align: "right" as const,
      render: (value: string | null) => formatVnd(value),
    },
  ];

  return (
    <PermissionGuard
      permission="inventory.read"
      fallback={<Text type="danger">Bạn không có quyền xem gợi ý nhập hàng.</Text>}
    >
      <div>
        <div style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <Title level={4} style={{ margin: 0 }}>
              <RiseOutlined style={{ color: "#c05c74", marginRight: 8 }} />
              Gợi ý nhập hàng
            </Title>
            <Text type="secondary">
              Tính từ lịch sử xuất kho thật: tốc độ bán 30/90 ngày, số ngày còn đủ hàng và lượng cần nhập thêm.
            </Text>
          </div>
          <Space>
            <Text>Mục tiêu tồn (ngày)</Text>
            <InputNumber
              min={1}
              max={365}
              value={targetCoverDays}
              onChange={(value) => setTargetCoverDays(Number(value) || DEFAULT_TARGET_COVER_DAYS)}
              style={{ width: 90 }}
            />
            <Button
              icon={<ReloadOutlined />}
              loading={isFetching}
              onClick={() => refetch()}
            >
              Làm mới
            </Button>
          </Space>
        </div>

        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col xs={24} md={8}>
            <Card>
              <Statistic title="Biến thể đang kinh doanh" value={rows.length} suffix="SKU" />
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card>
              <Statistic
                title="Biến thể dưới ngưỡng tồn"
                value={lowStockCount}
                suffix="SKU"
                valueStyle={{ color: lowStockCount > 0 ? "#cf1322" : undefined }}
              />
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card>
              <Statistic title="Tổng lượng đề xuất nhập" value={suggestedUnits} suffix="sản phẩm" />
            </Card>
          </Col>
        </Row>

        <Card styles={{ body: { padding: 0 } }}>
          <ApiStateWrapper
            isLoading={isLoading}
            isError={isError}
            error={error}
            isEmpty={rows.length === 0}
            emptyDescription="Chưa có dữ liệu bán hàng để tính gợi ý nhập hàng."
            onRetry={() => refetch()}
          >
            <Table<RestockInsight>
              rowKey="variantId"
              size="middle"
              columns={columns}
              dataSource={rows}
              pagination={{ pageSize: 20, showSizeChanger: false }}
              scroll={{ x: 1400 }}
            />
          </ApiStateWrapper>
        </Card>

        <Text type="secondary" style={{ display: "block", marginTop: 12, fontSize: 12 }}>
          Lượng đề xuất = ceil(tốc độ bán × số ngày mục tiêu − tồn kho). Tốc độ dùng 30 ngày gần nhất, chỉ khi
          30 ngày không phát sinh mới dùng mức 90 ngày. Không có số liệu bán thì không đề xuất.
        </Text>
      </div>
    </PermissionGuard>
  );
};
