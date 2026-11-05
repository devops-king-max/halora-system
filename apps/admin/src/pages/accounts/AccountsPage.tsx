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
  Modal,
  Alert,
} from "antd";
import {
  SearchOutlined,
  LockOutlined,
  UnlockOutlined,
  StopOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
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

export const AccountsPage: React.FC<{ permissionMode?: boolean }> = ({ permissionMode = false }) => {
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState("");
  const [realmFilter, setRealmFilter] = useState<string | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const rolesQuery = useQuery({ queryKey: ['admin', 'roles'], queryFn: () => apiClient.roles.listAdmin() });
  const assignRolesMutation = useMutation({
    mutationFn: () => apiClient.accounts.assignRoles(editingAccount!.id, { roleIds: selectedRoles, version: editingAccount!.version }),
    onSuccess: () => {
      message.success('Đã gán vai trò. Tài khoản được cập nhật cần đăng nhập lại.');
      setEditingAccount(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'accounts'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'employees'] });
    },
    onError: (error: unknown) => message.error(error instanceof ApiClientError ? error.message : 'Không thể gán vai trò. Vui lòng thử lại.'),
  });

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
      dataIndex: "code",
      key: "code",
      width: 130,
      render: (code: string) => <code>{code}</code>,
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
      title: 'Vai trò',
      key: 'roles',
      render: (_: unknown, record: Account) => <Space wrap>{record.roleIds.map(id => <Tag key={id} color="magenta">{rolesQuery.data?.find(role => role.id === id)?.name || 'Đang tải vai trò'}</Tag>)}{record.roleIds.length === 0 && <Text type="secondary">Chưa gán vai trò</Text>}</Space>,
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
          {record.realm === 'STAFF' ? <PermissionGuard permission="employees.assignRoles">
            <Button size="small" icon={<SafetyCertificateOutlined />} disabled={!rolesQuery.data} onClick={() => { setEditingAccount(record); setSelectedRoles(record.roleIds.slice(0, 1)); }}>Gán vai trò</Button>
          </PermissionGuard> : <Text type="secondary">Vai trò cố định</Text>}
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
          {permissionMode ? 'Phân quyền tài khoản' : 'Quản lý tài khoản hệ thống'}
        </Title>
        <Text type="secondary">Gán vai trò cho từng tài khoản; mỗi tài khoản nhân viên chỉ có tối đa một vai trò và quyền của vai trò được hệ thống quy định cố định. Khách hàng luôn có vai trò Khách hàng.</Text>
      </div>

      {rolesQuery.isError && <Alert type="error" showIcon message="Không tải được vai trò" action={<Button onClick={() => rolesQuery.refetch()}>Thử lại</Button>} style={{ marginBottom: 16 }} />}

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
            columns={permissionMode ? columns.filter(column => column.key !== 'createdAt') : columns}
            rowKey="id"
            scroll={{ x: 1200 }}
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
      <Modal title={`Gán vai trò: ${editingAccount?.username || ''}`} open={!!editingAccount} onCancel={() => setEditingAccount(null)} onOk={() => assignRolesMutation.mutate()} confirmLoading={assignRolesMutation.isPending} okText="Lưu vai trò" cancelText="Hủy">
        <Typography.Paragraph>Mỗi tài khoản nhân viên chỉ có tối đa một vai trò; bộ quyền của vai trò là cố định. Sau khi đổi vai trò, các phiên đăng nhập của tài khoản này sẽ hết hiệu lực.</Typography.Paragraph>
        <Select
          aria-label="Vai trò tài khoản"
          value={selectedRoles[0]}
          onChange={(value) => setSelectedRoles(value ? [String(value)] : [])}
          allowClear
          placeholder="Chọn một vai trò"
          style={{ width: '100%' }}
          options={rolesQuery.data?.filter(role => role.code !== 'CUSTOMER').map(role => ({ value: role.id, label: `${role.name} (${role.code})` }))}
        />
      </Modal>
    </div>
  );
};
