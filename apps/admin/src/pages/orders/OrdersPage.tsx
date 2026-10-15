import React, { useState } from "react";
import {
  Typography,
  Table,
  Button,
  Input,
  Select,
  Space,
  Card,
  Tooltip,
  DatePicker,
} from "antd";
import {
  SearchOutlined,
  EyeOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../../api";
import { ApiStateWrapper } from "../../components/common/ApiStateWrapper";
import { StatusBadge } from "../../components/common/StatusBadge";
import { formatVnd, formatDateTime } from "../../utils/format";
import type { OrderSummary, OrderStatus, PaymentMethod } from "@halora/api-client";
import dayjs from "dayjs";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

export const OrdersPage: React.FC = () => {
  const navigate = useNavigate();

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | undefined>(undefined);
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<PaymentMethod | undefined>(undefined);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([null, null]);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: [
      "admin",
      "orders",
      page,
      limit,
      search,
      statusFilter,
      paymentMethodFilter,
      dateRange[0]?.toISOString(),
      dateRange[1]?.toISOString(),
    ],
    queryFn: () =>
      apiClient.orders.listAdmin({
        page,
        limit,
        search: search || undefined,
        status: statusFilter,
        paymentMethod: paymentMethodFilter,
        from: dateRange[0]?.toISOString(),
        to: dateRange[1]?.toISOString(),
        sortBy: "createdAt",
        sortOrder: "desc",
      }),
  });

  const columns = [
    {
      title: "Mã đơn hàng",
      dataIndex: "orderCode",
      key: "orderCode",
      width: 140,
      render: (code: string, r: OrderSummary) => (
        <a onClick={() => navigate(`/orders/${r.id}`)}>
          <code>{code}</code>
        </a>
      ),
    },
    {
      title: "Khách hàng",
      dataIndex: "customerName",
      key: "customerName",
      render: (name: string) => <Text strong>{name}</Text>,
    },
    {
      title: "Tổng giá trị đơn",
      dataIndex: "totalAmount",
      key: "totalAmount",
      render: (t: string) => <Text strong style={{ color: "#c05c74", fontSize: 14 }}>{formatVnd(t)}</Text>,
    },
    {
      title: "Tiền đã thu",
      dataIndex: "paidAmount",
      key: "paidAmount",
      render: (p: string) => <span style={{ color: "#389e0d" }}>{formatVnd(p)}</span>,
    },
    {
      title: "Tiền đã hoàn",
      dataIndex: "refundedAmount",
      key: "refundedAmount",
      render: (r: string) => (parseInt(r, 10) > 0 ? <span style={{ color: "#cf1322" }}>{formatVnd(r)}</span> : "—"),
    },
    {
      title: "Phương thức",
      dataIndex: "paymentMethod",
      key: "paymentMethod",
      width: 140,
      render: (m: string) => (m === "COD" ? "COD" : "Chuyển khoản"),
    },
    {
      title: "Trạng thái đơn",
      dataIndex: "status",
      key: "status",
      width: 160,
      render: (st: string) => <StatusBadge type="order" status={st} />,
    },
    {
      title: "Ngày đặt",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 160,
      render: (d: string) => formatDateTime(d),
    },
    {
      title: "Thao tác",
      key: "action",
      width: 90,
      render: (_: unknown, record: OrderSummary) => (
        <Tooltip title="Xem chi tiết đơn hàng & xử lý">
          <Button
            type="text"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/orders/${record.id}`)}
          />
        </Tooltip>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0 }}>
          Quản lý đơn hàng
        </Title>
        <Text type="secondary">Theo dõi tiến trình xử lý, xuất kho bán lẻ, thanh toán và hoàn tiền</Text>
      </div>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            placeholder="Tìm theo mã đơn, tên khách..."
            prefix={<SearchOutlined style={{ color: "#bfbfbf" }} />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 240 }}
            allowClear
          />
          <Select
            placeholder="Trạng thái đơn hàng"
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 180 }}
            allowClear
            options={[
              { value: "PENDING_CONFIRMATION", label: "Chờ xác nhận" },
              { value: "CONFIRMED", label: "Đã xác nhận" },
              { value: "SHIPPING", label: "Đang giao hàng" },
              { value: "COMPLETED", label: "Hoàn tất" },
              { value: "CANCELLED", label: "Đã hủy" },
            ]}
          />
          <Select
            placeholder="Phương thức thanh toán"
            value={paymentMethodFilter}
            onChange={setPaymentMethodFilter}
            style={{ width: 180 }}
            allowClear
            options={[
              { value: "COD", label: "Thanh toán COD" },
              { value: "BANK_TRANSFER", label: "Chuyển khoản ngân hàng" },
            ]}
          />
          <RangePicker
            value={dateRange}
            onChange={(d) => (d ? setDateRange([d[0], d[1]]) : setDateRange([null, null]))}
          />
          <Button icon={<ReloadOutlined spin={isFetching} />} onClick={() => refetch()}>
            Làm mới
          </Button>
        </Space>
      </Card>

      <ApiStateWrapper
        isLoading={isLoading}
        isError={isError}
        error={error}
        isEmpty={!data || data.data.length === 0}
        emptyDescription="Không tìm thấy đơn hàng nào phù hợp"
        onRetry={() => refetch()}
      >
        {data && (
          <Table
            dataSource={data.data}
            columns={columns}
            rowKey="id"
            pagination={{
              current: data.meta.page,
              pageSize: data.meta.limit,
              total: data.meta.total,
              showSizeChanger: true,
              onChange: (p, l) => {
                setPage(p);
                setLimit(l);
              },
            }}
          />
        )}
      </ApiStateWrapper>
    </div>
  );
};
