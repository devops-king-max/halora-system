import React from 'react';
import { Card, Table, Typography, Tag, Space } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api';
import { ApiStateWrapper } from '../../components/common/ApiStateWrapper';
import { AccountsPage } from '../accounts/AccountsPage';
import type { Role } from '@halora/api-client';

const { Text } = Typography;

export const RolesPage: React.FC = () => {
  const roles = useQuery({ queryKey: ['admin', 'roles'], queryFn: () => apiClient.roles.listAdmin() });
  const permissions = useQuery({
    queryKey: ['admin', 'permissions'],
    queryFn: () => apiClient.roles.listPermissionsAdmin(),
  });
  const permissionCodes = new Map((permissions.data ?? []).map((permission) => [permission.id, permission.code]));

  return <>
    <AccountsPage permissionMode />
    <Card title="Vai trò hệ thống" style={{ marginTop: 24 }}>
      <Typography.Paragraph type="secondary">Quản trị viên phân quyền bằng cách gán vai trò cho tài khoản. Bộ quyền của từng vai trò là cố định do migration quy định và không chỉnh sửa trên giao diện.</Typography.Paragraph>
      <ApiStateWrapper
        isLoading={roles.isLoading || permissions.isLoading}
        isError={roles.isError || permissions.isError}
        error={roles.error || permissions.error}
        onRetry={() => {
          roles.refetch();
          permissions.refetch();
        }}
      >
        <Table dataSource={roles.data} rowKey="id" pagination={false} columns={[
          {
            title: 'Vai trò',
            dataIndex: 'name',
            width: 220,
            render: (name: string, role: Role) => (
              <div>
                <Text strong>{name}</Text>
                <div><code>{role.code}</code></div>
              </div>
            ),
          },
          { title: 'Chức năng', dataIndex: 'description' },
          {
            title: 'Số quyền cố định',
            key: 'permissionCount',
            width: 160,
            align: 'center' as const,
            render: (_: unknown, role: Role) => <Tag color="blue">{role.permissionIds.length}</Tag>,
          },
          {
            title: 'Danh sách quyền (chỉ đọc)',
            key: 'permissionList',
            render: (_: unknown, role: Role) => role.permissionIds.length === 0
              ? <Text type="secondary">Không có quyền</Text>
              : (
                <Space size={[4, 4]} wrap>
                  {role.permissionIds.map((permissionId) => (
                    <Tag key={permissionId}>{permissionCodes.get(permissionId) ?? permissionId}</Tag>
                  ))}
                </Space>
              ),
          },
        ]} />
      </ApiStateWrapper>
    </Card>
  </>;
};
