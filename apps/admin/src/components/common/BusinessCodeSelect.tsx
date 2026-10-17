import React, { useState } from 'react';
import { Button, Select, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api';

interface Props { value?: string; onChange?: (value: string | undefined) => void; disabled?: boolean; productId?: string; kind?: 'product' | 'variant'; }
export const BusinessCodeSelect: React.FC<Props> = ({ value, onChange, disabled, productId, kind = 'variant' }) => {
  const [search, setSearch] = useState('');
  const query = useQuery({
    queryKey: ['business-code-options', kind, productId, search],
    queryFn: async () => {
      if (kind === 'product') {
        const result = await apiClient.products.listAdmin({ page: 1, limit: 100, search: search || undefined });
        return result.data.map(row => ({ value: row.id, label: `${row.code} · ${row.name}` }));
      }
      const result = await apiClient.inventory.getBalances({ page: 1, limit: 100, productId, search: search || undefined });
      return result.data.map(row => ({ value: row.variantId, label: `${row.sku} · ${row.productName} · ${row.variantName}` }));
    },
  });
  return <Select value={value} onChange={onChange} disabled={disabled} allowClear showSearch filterOption={false} onSearch={setSearch}
    loading={query.isFetching} options={query.data} style={{ width: '100%' }}
    placeholder={kind === 'product' ? 'Tìm theo mã SP01 hoặc tên sản phẩm' : 'Tìm theo mã SKU01 hoặc tên sản phẩm'}
    notFoundContent={query.isError ? <Button size="small" onClick={() => query.refetch()}>Không tải được dữ liệu. Thử lại</Button> : query.isFetching ? 'Đang tải...' : 'Không có kết quả'} />;
};

export const ProductBusinessCode: React.FC<{ id: string }> = ({ id }) => {
  const query = useQuery({ queryKey: ['admin', 'products', id], queryFn: () => apiClient.products.getAdmin(id) });
  return <Typography.Text>{query.data?.code || (query.isError ? 'Không tải được mã' : 'Đang tải...')}</Typography.Text>;
};

export const VariantBusinessCode: React.FC<{ id: string; productId: string }> = ({ id, productId }) => {
  const query = useQuery({ queryKey: ['variant-business-code', productId, id], queryFn: async () => {
    for (let page = 1; ; page++) {
      const result = await apiClient.inventory.getBalances({ page, limit: 100, productId });
      const found = result.data.find(row => row.variantId === id);
      if (found) return found.sku;
      if (page >= result.meta.totalPages) throw new Error('Không tìm thấy biến thể');
    }
  } });
  return <Typography.Text>{query.data || (query.isError ? 'Không tải được mã' : 'Đang tải...')}</Typography.Text>;
};
