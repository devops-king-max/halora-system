import React, { useState } from "react";
import {
  Typography,
  Table,
  Button,
  Input,
  Select,
  Space,
  Card,
  Tag,
  Popconfirm,
  message,
  Tooltip,
} from "antd";
import {
  SearchOutlined,
  LockOutlined,
  UnlockOutlined,
  StopOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../api";
import { ApiStateWrapper } from "../../components/common/ApiStateWrapper";
import { StatusBadge } from "../../components/common/StatusBadge";
import { PermissionGuard } from "../../components/common/PermissionGuard";
import { formatDateTime } from "../../utils/format";
import { ApiClientError } from "@halora/api-client";
import type { Account, AccountStatus } from "@halora/api-client";

const { Title, Text } = Typography;

export const AccountsPage: React.FC = () => {
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState("");
  const [realmFilter, setRealmFilter] = useState<string | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["admin", "accounts", page, limit, search, realmFilter, statusFilter],
    queryFn: () =>
      apiClient.accounts.listAdmin({
        page,
        limit,
        search: search || undefined,
        realm: realmFilter,
        status: statusFilter,
        sortBy: "createdAt",
        sortOrder: "desc",
      }),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ account, newStatus }: { account: Account; newStatus: AccountStatus }) =>
      apiClient.accounts.updateStatus(account.id, {
        status: newStatus,
        version: account.version,
      }),
    onSuccess: () => {
      message.success("Cập nhật trạng thái tài khoản thành công!");
      queryClient.invalidateQueries({ queryKey: ["admin", "accounts"] });
    },
    onError: (err: unknown) => {
      if (err instanceof ApiClientError) {
        if (err.code === "VERSION_CONFLICT") {
          message.error("Tài khoản đã bị thay đổi bởi người khác. Vui lòng tải lại.");
        } else {
          message.error(err.message || `Lỗi: ${err.code}`);
        }
      } else {
        message.error("Lỗi khi cập nhật tài khoản.");
      }
    },
  });

  const columns = [
    {
      title: "Mã tài khoản",
      dataIndex: "id",
      key: "id",
      width: 130,
      render: (id: string) => <code>{id.substring(0, 8)}...</code>,
    },
    {
      title: "Phân vùng (Realm)",
      dataIndex: "realm",
      key: "realm",
      width: 140,
      render: (realm: string) =>
        realm === "STAFF" ? <Tag color="blue">Nhân viên</Tag> : <Tag color="green">Khách hàng</Tag>,
    },
    {
      title: "Tên đăng nhập",
      dataIndex: "username",
      key: "username",
      render: (u: string) => <Text strong>{u}</Text>,
    },
    {
      title: "Email",
      dataIndex: "email",
      key: "email",
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 140,
      render: (st: string) => <StatusBadge type="account" status={st} />,
    },
    {
      title: "Ngày tạo",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 160,
      render: (d: string) => formatDateTime(d),
    },
    {
      title: "Thao tác",
      key: "action",
      width: 130,
      render: (_: unknown, record: Account) => (
        <Space size="small">
          <PermissionGuard permission="accounts.update">
            {record.status === "LOCKED" ? (
              <Popconfirm
                title="Mở khóa tài khoản"
                description="Bạn có muốn mở khóa cho tài khoản này?"
                onConfirm={() => updateStatusMutation.mutate({ account: record, newStatus: "ACTIVE" })}
              >
                <Tooltip title="Mở khóa">
                  <Button type="text" size="small" icon={<UnlockOutlined style={{ color: "#52c41a" }} />} />
                </Tooltip>
              </Popconfirm>
            ) : (
              <Popconfirm
                title="Khóa tài khoản"
                description="Bạn có chắc chắn muốn khóa tài khoản này?"
                onConfirm={() => updateStatusMutation.mutate({ account: record, newStatus: "LOCKED" })}
              >
                <Tooltip title="Khóa">
                  <Button type="text" size="small" icon={<LockOutlined style={{ color: "#fa8c16" }} />} />
                </Tooltip>
              </Popconfirm>
            )}

            {record.status !== "INACTIVE" && (
              <Popconfirm
                title="Ngừng hoạt động"
                description="Vô hiệu hóa tài khoản vĩnh viễn?"
                onConfirm={() => updateStatusMutation.mutate({ account: record, newStatus: "INACTIVE" })}
              >
                <Tooltip title="Ngừng hoạt động">
                  <Button type="text" danger size="small" icon={<StopOutlined />} />
                </Tooltip>
              </Popconfirm>
            )}
          </PermissionGuard>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0 }}>
          Quản lý tài khoản hệ thống
        </Title>
        <Text type="secondary">Giám sát, khóa/mở khóa tài khoản nhân viên và khách hàng</Text>
      </div>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            placeholder="Tìm theo username, email..."
            prefix={<SearchOutlined style={{ color: "#bfbfbf" }} />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 260 }}
            allowClear
          />
          <Select
            placeholder="Phân vùng (Realm)"
            value={realmFilter}
            onChange={setRealmFilter}
            style={{ width: 170 }}
            allowClear
            options={[
              { value: "STAFF", label: "Tài khoản nhân viên" },
              { value: "CUSTOMER", label: "Tài khoản khách hàng" },
            ]}
          />
          <Select
            placeholder="Trạng thái tài khoản"
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 170 }}
            allowClear
            options={[
              { value: "ACTIVE", label: "Đang hoạt động" },
              { value: "LOCKED", label: "Đã khóa" },
              { value: "INACTIVE", label: "Ngừng hoạt động" },
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
        emptyDescription="Không tìm thấy tài khoản nào"
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
