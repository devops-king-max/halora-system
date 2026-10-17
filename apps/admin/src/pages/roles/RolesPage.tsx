import React from 'react';
import { Card, Table, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api';
import { ApiStateWrapper } from '../../components/common/ApiStateWrapper';
import { AccountsPage } from '../accounts/AccountsPage';

export const RolesPage: React.FC = () => {
  const roles = useQuery({ queryKey: ['admin', 'roles'], queryFn: () => apiClient.roles.listAdmin() });
  return <>
    <AccountsPage permissionMode />
    <Card title="Vai trò hệ thống" style={{ marginTop: 24 }}>
      <Typography.Paragraph type="secondary">Quản trị viên phân quyền bằng cách gán vai trò cho tài khoản. Bộ quyền của từng vai trò là cố định và không chỉnh sửa trên giao diện.</Typography.Paragraph>
      <ApiStateWrapper isLoading={roles.isLoading} isError={roles.isError} error={roles.error} onRetry={() => roles.refetch()}>
        <Table dataSource={roles.data} rowKey="id" pagination={false} columns={[
          { title: 'Vai trò', dataIndex: 'name' },
          { title: 'Chức năng', dataIndex: 'description' },
        ]} />
      </ApiStateWrapper>
    </Card>
  </>;
};
