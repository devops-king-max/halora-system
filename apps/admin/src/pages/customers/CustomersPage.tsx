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
import { formatDateTime } from "../../utils/format";
import type { Customer } from "@halora/api-client";

const { Title, Text } = Typography;

export const CustomersPage: React.FC = () => {
  const navigate = useNavigate();

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [accountStatusFilter, setAccountStatusFilter] = useState<string | undefined>(undefined);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["admin", "customers", page, limit, search, statusFilter, accountStatusFilter],
    queryFn: () =>
      apiClient.customers.listAdmin({
        page,
        limit,
        search: search || undefined,
        status: statusFilter,
        accountStatus: accountStatusFilter,
        sortBy: "createdAt",
        sortOrder: "desc",
      }),
  });

  const columns = [
    {
      title: "Mã KH",
      dataIndex: "code",
      key: "code",
      width: 130,
      render: (code: string) => <code>{code}</code>,
    },
    {
      title: "Họ và tên",
      dataIndex: "fullName",
      key: "fullName",
      render: (name: string, record: Customer) => (
        <a onClick={() => navigate(`/customers/${record.id}`)} style={{ fontWeight: 600 }}>
          {name}
        </a>
      ),
    },
    {
      title: "Số điện thoại",
      dataIndex: "phone",
      key: "phone",
    },
    {
      title: "Email",
      dataIndex: "email",
      key: "email",
    },
    {
      title: "Trạng thái KH",
      dataIndex: "status",
      key: "status",
      width: 140,
      render: (status: string) => <StatusBadge type="active" status={status} />,
    },
    {
      title: "Tài khoản",
      dataIndex: "accountStatus",
      key: "accountStatus",
      width: 140,
      render: (status: string) => <StatusBadge type="account" status={status} />,
    },
    {
      title: "Ngày tham gia",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 160,
      render: (date: string) => formatDateTime(date),
    },
    {
      title: "Thao tác",
      key: "action",
      width: 90,
      render: (_: unknown, record: Customer) => (
        <Tooltip title="Xem chi tiết hồ sơ & lịch sử">
          <Button
            type="text"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/customers/${record.id}`)}
          />
        </Tooltip>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0 }}>
          Quản lý khách hàng
        </Title>
        <Text type="secondary">Danh sách khách hàng, hồ sơ và lịch sử mua sắm mỹ phẩm</Text>
      </div>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            placeholder="Tìm theo tên, email, SĐT..."
            prefix={<SearchOutlined style={{ color: "#bfbfbf" }} />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 260 }}
            allowClear
          />
          <Select
            placeholder="Trạng thái khách hàng"
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 180 }}
            allowClear
            options={[
              { value: "ACTIVE", label: "Đang hoạt động" },
              { value: "INACTIVE", label: "Ngừng hoạt động" },
            ]}
          />
          <Select
            placeholder="Trạng thái tài khoản"
            value={accountStatusFilter}
            onChange={setAccountStatusFilter}
            style={{ width: 180 }}
            allowClear
            options={[
              { value: "ACTIVE", label: "Tài khoản hoạt động" },
              { value: "LOCKED", label: "Tài khoản đã khóa" },
              { value: "INACTIVE", label: "Tài khoản vô hiệu" },
            ]}
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
        emptyDescription="Không tìm thấy khách hàng nào"
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
