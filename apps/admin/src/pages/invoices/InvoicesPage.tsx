import React, { useState } from "react";
import {
  Typography,
  Table,
  Button,
  Select,
  Space,
  Card,
  Tooltip,
  DatePicker,
} from "antd";
import {
  EyeOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../../api";
import { ApiStateWrapper } from "../../components/common/ApiStateWrapper";
import { StatusBadge } from "../../components/common/StatusBadge";
import { formatVnd, formatDateTime } from "../../utils/format";
import type { Invoice, DocumentStatus } from "@halora/api-client";
import dayjs from "dayjs";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

export const InvoicesPage: React.FC = () => {
  const navigate = useNavigate();

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [statusFilter, setStatusFilter] = useState<DocumentStatus | undefined>(undefined);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([null, null]);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: [
      "admin",
      "invoices",
      page,
      limit,
      statusFilter,
      dateRange[0]?.toISOString(),
      dateRange[1]?.toISOString(),
    ],
    queryFn: () =>
      apiClient.invoices.listAdmin({
        page,
        limit,
        status: statusFilter,
        from: dateRange[0]?.toISOString(),
        to: dateRange[1]?.toISOString(),
        sortBy: "createdAt",
        sortOrder: "desc",
      }),
  });

  const columns = [
    {
      title: "Mã hóa đơn",
      dataIndex: "invoiceCode",
      key: "invoiceCode",
      width: 150,
      render: (code: string, r: Invoice) => (
        <a onClick={() => navigate(`/invoices/${r.id}`)}>
          <code>{code}</code>
        </a>
      ),
    },
    {
      title: "Đơn hàng liên kết",
      dataIndex: "orderCode",
      key: "orderCode",
      render: (code: string, r: Invoice) => (
        <a onClick={() => navigate(`/orders/${r.orderId}`)}>
          <code>{code}</code>
        </a>
      ),
    },
    {
      title: "Tổng tiền hàng hóa đơn",
      dataIndex: "totalAmount",
      key: "totalAmount",
      render: (t: string) => <Text strong style={{ color: "#c05c74" }}>{formatVnd(t)}</Text>,
    },
    {
      title: "Người lập hóa đơn",
      dataIndex: "employeeName",
      key: "employeeName",
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 140,
      render: (st: string) => <StatusBadge type="document" status={st} />,
    },
    {
      title: "Ngày phát hành",
      dataIndex: "issuedAt",
      key: "issuedAt",
      width: 160,
      render: (d: string | null) => (d ? formatDateTime(d) : "Chưa phát hành"),
    },
    {
      title: "Thao tác",
      key: "action",
      width: 90,
      render: (_: unknown, record: Invoice) => (
        <Tooltip title="Xem chi tiết hóa đơn & xuất PDF">
          <Button
            type="text"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/invoices/${record.id}`)}
          />
        </Tooltip>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0 }}>
          Quản lý hóa đơn bán lẻ
        </Title>
        <Text type="secondary">Danh sách hóa đơn được lập từ các đơn hàng hoàn tất</Text>
      </div>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select
            placeholder="Trạng thái hóa đơn"
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 180 }}
            allowClear
            options={[
              { value: "DRAFT", label: "Bản nháp" },
              { value: "POSTED", label: "Đã ghi nhận (phát hành)" },
              { value: "CANCELLED", label: "Đã hủy" },
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
        emptyDescription="Không tìm thấy hóa đơn nào"
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
