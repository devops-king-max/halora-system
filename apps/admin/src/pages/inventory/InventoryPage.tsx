import React, { useState } from "react";
import {
  Typography,
  Table,
  Button,
  Input,
  Select,
  Space,
  Card,
  Tabs,
  Switch,
  Tag,
  DatePicker,
} from "antd";
import {
  SearchOutlined,
  ReloadOutlined,
  WarningOutlined,
  DatabaseOutlined,
  HistoryOutlined,
} from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../api";
import { ApiStateWrapper } from "../../components/common/ApiStateWrapper";
import { formatDateTime } from "../../utils/format";
import type { InventoryBalance, StockMovement, StockMovementType } from "@halora/api-client";
import dayjs from "dayjs";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

export const InventoryPage: React.FC = () => {
  // Tab 1 state: Balances
  const [balancePage, setBalancePage] = useState(1);
  const [balanceLimit, setBalanceLimit] = useState(20);
  const [balanceSearch, setBalanceSearch] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);

  // Tab 2 state: Movements
  const [movementPage, setMovementPage] = useState(1);
  const [movementLimit, setMovementLimit] = useState(20);
  const [movementType, setMovementType] = useState<StockMovementType | undefined>(undefined);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([null, null]);

  // Query Balances
  const {
    data: balancesData,
    isLoading: balancesLoading,
    isError: balancesError,
    error: bError,
    refetch: refetchBalances,
    isFetching: balancesFetching,
  } = useQuery({
    queryKey: ["admin", "inventory-balances", balancePage, balanceLimit, balanceSearch, lowStockOnly],
    queryFn: () =>
      apiClient.inventory.getBalances({
        page: balancePage,
        limit: balanceLimit,
        search: balanceSearch || undefined,
        lowStockOnly: lowStockOnly || undefined,
      }),
  });

  // Query Movements
  const {
    data: movementsData,
    isLoading: movementsLoading,
    isError: movementsError,
    error: mError,
    refetch: refetchMovements,
    isFetching: movementsFetching,
  } = useQuery({
    queryKey: [
      "admin",
      "inventory-movements",
      movementPage,
      movementLimit,
      movementType,
      dateRange[0]?.toISOString(),
      dateRange[1]?.toISOString(),
    ],
    queryFn: () =>
      apiClient.inventory.getMovements({
        page: movementPage,
        limit: movementLimit,
        type: movementType,
        from: dateRange[0]?.toISOString(),
        to: dateRange[1]?.toISOString(),
      }),
  });

  const getMovementTypeTag = (type: StockMovementType) => {
    switch (type) {
      case "RECEIPT":
        return <Tag color="green">Nhập kho (Phiếu nhập)</Tag>;
      case "SALE":
        return <Tag color="blue">Xuất bán (Xác nhận đơn)</Tag>;
      case "CANCELLATION":
        return <Tag color="orange">Hoàn kho (Hủy đơn)</Tag>;
      case "ADJUSTMENT":
        return <Tag color="purple">Điều chỉnh kiểm kê</Tag>;
      default:
        return <Tag>{type}</Tag>;
    }
  };

  const balanceColumns = [
    {
      title: "SKU",
      dataIndex: "sku",
      key: "sku",
      render: (sku: string) => <code>{sku}</code>,
    },
    {
      title: "Tên mặt hàng sản phẩm",
      dataIndex: "productName",
      key: "productName",
      render: (name: string, r: InventoryBalance) => (
        <div>
          <Text strong>{name}</Text>
          <div style={{ fontSize: 12, color: "#8c8c8c" }}>{r.variantName}</div>
        </div>
      ),
    },
    {
      title: "Số lượng tồn kho",
      dataIndex: "stockQuantity",
      key: "stockQuantity",
      render: (qty: number, r: InventoryBalance) => {
        const isLow = qty <= r.lowStockThreshold;
        return (
          <Space>
            <Text strong style={{ color: isLow ? "#cf1322" : "#389e0d", fontSize: 15 }}>
              {qty}
            </Text>
            {isLow && (
              <Tag color="error" icon={<WarningOutlined />}>
                Sắp hết hàng
              </Tag>
            )}
          </Space>
        );
      },
    },
    {
      title: "Ngưỡng cảnh báo tồn",
      dataIndex: "lowStockThreshold",
      key: "lowStockThreshold",
      width: 160,
    },
    {
      title: "Cập nhật lần cuối",
      dataIndex: "updatedAt",
      key: "updatedAt",
      width: 170,
      render: (d: string) => formatDateTime(d),
    },
  ];

  const movementColumns = [
    {
      title: "Thời gian",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 160,
      render: (d: string) => formatDateTime(d),
    },
    {
      title: "SKU",
      dataIndex: "sku",
      key: "sku",
      render: (sku: string) => <code>{sku}</code>,
    },
    {
      title: "Loại biến động",
      dataIndex: "type",
      key: "type",
      width: 180,
      render: (t: StockMovementType) => getMovementTypeTag(t),
    },
    {
      title: "Số lượng thay đổi",
      dataIndex: "quantityDelta",
      key: "quantityDelta",
      render: (delta: number) => (
        <Text strong style={{ color: delta > 0 ? "#52c41a" : "#f5222d", fontSize: 14 }}>
          {delta > 0 ? `+${delta}` : delta}
        </Text>
      ),
    },
    {
      title: "Tồn sau biến động",
      dataIndex: "quantityAfter",
      key: "quantityAfter",
      render: (q: number) => <Text strong>{q}</Text>,
    },
    {
      title: "Chứng từ liên kết",
      dataIndex: "sourceType",
      key: "sourceType",
      render: (st: string, r: StockMovement) => (
        <span>
          <Tag>{st}</Tag>

        </span>
      ),
    },
    {
      title: "Người thực hiện",
      dataIndex: "performedByName",
      key: "performedByName",
      render: (name: string | null) => name || "Hệ thống",
    },
    {
      title: "Ghi chú",
      dataIndex: "note",
      key: "note",
      ellipsis: true,
      render: (n: string | null) => n || "—",
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0 }}>
          Quản lý tồn kho & Nhật ký biến động
        </Title>
        <Text type="secondary">Theo dõi số lượng hàng hóa thực tế và lịch sử luân chuyển nhập/xuất kho</Text>
      </div>

      <Tabs
        defaultActiveKey="balances"
        items={[
          {
            key: "balances",
            label: (
              <span>
                <DatabaseOutlined /> Số dư tồn kho thực tế
              </span>
            ),
            children: (
              <>
                <Card size="small" style={{ marginBottom: 16 }}>
                  <Space wrap>
                    <Input
                      placeholder="Tìm theo tên sản phẩm, SKU..."
                      prefix={<SearchOutlined style={{ color: "#bfbfbf" }} />}
                      value={balanceSearch}
                      onChange={(e) => setBalanceSearch(e.target.value)}
                      style={{ width: 280 }}
                      allowClear
                    />
                    <Space>
                      <Switch checked={lowStockOnly} onChange={setLowStockOnly} />
                      <Text>Chỉ hiển thị mặt hàng sắp hết</Text>
                    </Space>
                    <Button icon={<ReloadOutlined spin={balancesFetching} />} onClick={() => refetchBalances()}>
                      Làm mới
                    </Button>
                  </Space>
                </Card>

                <ApiStateWrapper
                  isLoading={balancesLoading}
                  isError={balancesError}
                  error={bError}
                  isEmpty={!balancesData || balancesData.data.length === 0}
                  emptyDescription="Không có dữ liệu tồn kho nào"
                  onRetry={() => refetchBalances()}
                >
                  {balancesData && (
                    <Table
                      dataSource={balancesData.data}
                      columns={balanceColumns}
                      rowKey="variantId"
                      pagination={{
                        current: balancesData.meta.page,
                        pageSize: balancesData.meta.limit,
                        total: balancesData.meta.total,
                        showSizeChanger: true,
                        onChange: (p, l) => {
                          setBalancePage(p);
                          setBalanceLimit(l);
                        },
                      }}
                    />
                  )}
                </ApiStateWrapper>
              </>
            ),
          },
          {
            key: "movements",
            label: (
              <span>
                <HistoryOutlined /> Lịch sử biến động nhập/xuất
              </span>
            ),
            children: (
              <>
                <Card size="small" style={{ marginBottom: 16 }}>
                  <Space wrap>
                    <Select
                      placeholder="Loại biến động"
                      value={movementType}
                      onChange={setMovementType}
                      style={{ width: 200 }}
                      allowClear
                      options={[
                        { value: "RECEIPT", label: "Nhập kho (Phiếu nhập)" },
                        { value: "SALE", label: "Xuất bán (Đơn hàng)" },
                        { value: "CANCELLATION", label: "Hoàn kho (Hủy đơn)" },
                        { value: "ADJUSTMENT", label: "Điều chỉnh kiểm kê" },
                      ]}
                    />
                    <RangePicker
                      value={dateRange}
                      onChange={(d) => (d ? setDateRange([d[0], d[1]]) : setDateRange([null, null]))}
                    />
                    <Button icon={<ReloadOutlined spin={movementsFetching} />} onClick={() => refetchMovements()}>
                      Làm mới
                    </Button>
                  </Space>
                </Card>

                <ApiStateWrapper
                  isLoading={movementsLoading}
                  isError={movementsError}
                  error={mError}
                  isEmpty={!movementsData || movementsData.data.length === 0}
                  emptyDescription="Không có lịch sử biến động kho nào"
                  onRetry={() => refetchMovements()}
                >
                  {movementsData && (
                    <Table
                      dataSource={movementsData.data}
                      columns={movementColumns}
                      rowKey="id"
                      pagination={{
                        current: movementsData.meta.page,
                        pageSize: movementsData.meta.limit,
                        total: movementsData.meta.total,
                        showSizeChanger: true,
                        onChange: (p, l) => {
                          setMovementPage(p);
                          setMovementLimit(l);
                        },
                      }}
                    />
                  )}
                </ApiStateWrapper>
              </>
            ),
          },
        ]}
      />
    </div>
  );
};
