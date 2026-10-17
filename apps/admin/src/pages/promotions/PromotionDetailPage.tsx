import React, { useState } from 'react';
import { Alert, Button, Card, Descriptions, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Table, Tabs, Tag, Typography, message } from 'antd';
import { ArrowLeftOutlined, DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiClientError } from '@halora/api-client';
import type { ActiveStatus, OrderPromotionRule, PaginatedResponse, ProductPromotionRule, Promotion, Voucher } from '@halora/api-client';
import { apiClient } from '../../api';
import { ApiStateWrapper } from '../../components/common/ApiStateWrapper';
import { BusinessCodeSelect, ProductBusinessCode, VariantBusinessCode } from '../../components/common/BusinessCodeSelect';
import { PermissionGuard } from '../../components/common/PermissionGuard';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatDateTime, formatVnd } from '../../utils/format';

const { Title, Text } = Typography;
type Condition = ProductPromotionRule | OrderPromotionRule | Voucher;
type Kind = 'product' | 'order' | 'voucher';
interface Values { productId?: string; variantId?: string | null; discountPercent: string; minQuantity?: number; minOrderAmount?: string; maxDiscountAmount?: string | null; code?: string; maxUses?: number | null; perCustomerLimit?: number; status?: ActiveStatus }
const titles: Record<Kind, string> = { product: 'Khuyến mãi theo sản phẩm', order: 'Khuyến mãi theo hóa đơn', voucher: 'Khuyến mãi theo voucher' };
const percentRules = [{ required: true, message: 'Nhập phần trăm giảm.' }, { pattern: /^(?:100(?:\.0{1,2})?|\d{1,2}(?:\.\d{1,2})?)$/, message: 'Từ 0 đến 100, tối đa 2 chữ số thập phân.' }];
const moneyRules = [{ pattern: /^\d{1,18}$/, message: 'Nhập số nguyên VND không âm, tối đa 18 chữ số.' }];

function Conditions({ kind, promotion }: { kind: Kind; promotion: Promotion }) {
  const client = useQueryClient();
  const [page, setPage] = useState(1), [limit, setLimit] = useState(20), [search, setSearch] = useState('');
  const [open, setOpen] = useState(false), [editing, setEditing] = useState<Condition | null>(null);
  const [form] = Form.useForm<Values>();
  const productId = Form.useWatch('productId', form);
  const key = ['admin', 'promotions', promotion.id, kind, page, limit, search];
  const query = useQuery<PaginatedResponse<Condition>>({ queryKey: key, queryFn: () => {
    const params = { page, limit, search: search || undefined };
    return kind === 'product' ? apiClient.promotions.listProductRules(promotion.id, params) : kind === 'order' ? apiClient.promotions.listOrderRules(promotion.id, params) : apiClient.promotions.listVouchers(promotion.id, params);
  }});
  const fail = (error: unknown) => message.error(error instanceof ApiClientError ? error.message : 'Không kết nối được hệ thống. Vui lòng thử lại.');
  const invalidate = () => client.invalidateQueries({ queryKey: ['admin', 'promotions'] });
  const save = useMutation<Condition, unknown, Values>({ mutationFn: (values: Values) => {
    const base = { discountPercent: String(values.discountPercent), maxDiscountAmount: values.maxDiscountAmount == null || values.maxDiscountAmount === '' ? null : String(values.maxDiscountAmount) };
    if (kind === 'product') {
      const input = { ...base, productId: values.productId!, variantId: values.variantId || null, minQuantity: values.minQuantity ?? 1 };
      return editing ? apiClient.promotions.updateProductRule(promotion.id, editing.id, { ...input, version: editing.version }) : apiClient.promotions.createProductRule(promotion.id, input);
    }
    if (kind === 'order') {
      const input = { ...base, minOrderAmount: String(values.minOrderAmount) };
      return editing ? apiClient.promotions.updateOrderRule(promotion.id, editing.id, { ...input, version: editing.version }) : apiClient.promotions.createOrderRule(promotion.id, input);
    }
    const input = { ...base, minOrderAmount: String(values.minOrderAmount), code: values.code?.trim().toUpperCase() || undefined, maxUses: values.maxUses ?? null, perCustomerLimit: values.perCustomerLimit ?? 1, status: values.status! };
    return editing ? apiClient.promotions.updateVoucher(promotion.id, editing.id, { ...input, version: editing.version }) : apiClient.promotions.createVoucher(promotion.id, input);
  }, onSuccess: () => { message.success(editing ? 'Đã cập nhật ưu đãi.' : 'Đã thêm ưu đãi.'); setOpen(false); invalidate(); }, onError: error => { fail(error); invalidate(); } });
  const remove = useMutation({ mutationFn: (row: Condition) => kind === 'product' ? apiClient.promotions.deleteProductRule(promotion.id, row.id) : kind === 'order' ? apiClient.promotions.deleteOrderRule(promotion.id, row.id) : apiClient.promotions.deleteVoucher(promotion.id, row.id), onSuccess: () => { message.success('Đã xóa ưu đãi chưa được sử dụng.'); invalidate(); }, onError: fail });
  const showForm = (row: Condition | null) => {
    setEditing(row); form.resetFields();
    form.setFieldsValue(row ? { ...row } : { discountPercent: '0', minQuantity: 1, minOrderAmount: '0', maxDiscountAmount: null, maxUses: null, perCustomerLimit: 1, status: 'ACTIVE' });
    setOpen(true);
  };
  const columns = [
    { title: 'Mã ưu đãi', dataIndex: 'code', key: 'code', width: 130, render: (code: string) => <code>{code}</code> },
    ...(kind === 'product' ? [
      { title: 'Sản phẩm', key: 'product', width: 180, render: (_: unknown, r: Condition) => <ProductBusinessCode id={(r as ProductPromotionRule).productId} /> },
      { title: 'Biến thể', key: 'variant', width: 200, render: (_: unknown, r: Condition) => { const item = r as ProductPromotionRule; return item.variantId ? <VariantBusinessCode id={item.variantId} productId={item.productId} /> : <Tag>Toàn bộ sản phẩm</Tag>; } },
      { title: 'Số lượng tối thiểu / dòng', key: 'quantity', render: (_: unknown, r: Condition) => (r as ProductPromotionRule).minQuantity },
    ] : [{ title: 'Tiền hàng tối thiểu', key: 'minimum', render: (_: unknown, r: Condition) => formatVnd((r as OrderPromotionRule).minOrderAmount) }]),
    { title: 'Phần trăm giảm', dataIndex: 'discountPercent', key: 'percent', render: (value: string) => value + '%' },
    { title: 'Trần giảm', dataIndex: 'maxDiscountAmount', key: 'cap', render: (value: string | null) => value === null ? 'Không giới hạn' : formatVnd(value) },
    ...(kind === 'voucher' ? [
      { title: 'Đã dùng / Đang giữ / Tối đa', key: 'usage', render: (_: unknown, r: Condition) => { const v = r as Voucher; return v.usedCount + ' / ' + v.reservedCount + ' / ' + (v.maxUses === null ? 'Không giới hạn' : v.maxUses); } },
      { title: 'Giới hạn mỗi khách', dataIndex: 'perCustomerLimit', key: 'customerLimit' },
      { title: 'Trạng thái', dataIndex: 'status', key: 'status', render: (status: string) => <StatusBadge type="active" status={status} /> },
    ] : []),
    { title: 'Đã từng áp dụng', dataIndex: 'hasUsage', key: 'used', render: (used: boolean) => used ? <Tag color="orange">Đã áp dụng</Tag> : <Tag>Chưa áp dụng</Tag> },
    { title: 'Thao tác', key: 'actions', width: 110, render: (_: unknown, row: Condition) => <Space>
      <PermissionGuard permission="promotions.update"><Button aria-label={'Sửa ưu đãi ' + row.code} title="Chỉnh sửa ưu đãi cho lần đặt hàng tiếp theo" icon={<EditOutlined />} size="small" disabled={promotion.status === 'ENDED'} onClick={() => showForm(row)} /></PermissionGuard>
      <PermissionGuard permission="promotions.delete"><Popconfirm title="Xóa ưu đãi chưa được sử dụng?" onConfirm={() => remove.mutate(row)} disabled={row.hasUsage}><Button danger aria-label={'Xóa ưu đãi ' + row.code} icon={<DeleteOutlined />} size="small" disabled={row.hasUsage} loading={remove.isPending} /></Popconfirm></PermissionGuard>
    </Space> },
  ];
  return <Card title={titles[kind]} extra={<PermissionGuard permission="promotions.create"><Button type="primary" icon={<PlusOutlined />} disabled={promotion.status === 'ENDED'} onClick={() => showForm(null)}>Thêm ưu đãi</Button></PermissionGuard>}>
    <Space style={{ marginBottom: 16 }} wrap><Input aria-label={'Tìm mã ' + kind} placeholder="Tìm theo mã ưu đãi" value={search} allowClear onChange={e => { setSearch(e.target.value); setPage(1); }} /><Button icon={<ReloadOutlined />} onClick={() => query.refetch()}>Làm mới</Button></Space>
    {kind === 'order' && <Alert type="info" message="Ưu đãi theo hóa đơn được tính ở cấp đơn hàng trước khi lập hóa đơn. Ngưỡng là tiền hàng sau giảm sản phẩm, chưa gồm phí giao hàng." style={{ marginBottom: 12 }} />}
    {kind === 'voucher' && <Alert type="info" message="Đặt đơn giữ lượt; xác nhận đơn ghi nhận đã dùng; hủy hợp lệ hoàn lượt đúng một lần. Lượt đã dùng và đang giữ đều được tính khi kiểm tra giới hạn." style={{ marginBottom: 12 }} />}
    <ApiStateWrapper isLoading={query.isLoading} isError={query.isError} error={query.error} onRetry={() => query.refetch()} isEmpty={!!query.data && query.data.data.length === 0} emptyDescription="Chưa có ưu đãi phù hợp.">
      {query.data && <Table<Condition> rowKey="id" columns={columns} dataSource={query.data.data} scroll={{ x: kind === 'voucher' ? 1450 : 1150 }} pagination={{ current: query.data.meta.page, pageSize: query.data.meta.limit, total: query.data.meta.total, showSizeChanger: true, onChange: (p, l) => { setPage(p); setLimit(l); } }} />}
    </ApiStateWrapper>
    <Modal title={(editing ? 'Sửa: ' : 'Thêm: ') + titles[kind]} open={open} onCancel={() => { if (!save.isPending) setOpen(false); }} onOk={() => form.submit()} okText="Lưu ưu đãi" cancelText="Hủy" confirmLoading={save.isPending} width={620}>
      {editing?.hasUsage && <Alert type="warning" message="Thay đổi chỉ ảnh hưởng các đơn đặt/sửa về sau; số tiền đã chốt trên đơn cũ giữ nguyên. Không đổi sản phẩm/biến thể đã áp dụng hoặc giảm giới hạn voucher xuống dưới lượt đã dùng và đang giữ." style={{ marginBottom: 12 }} />}
      <Form form={form} layout="vertical" onFinish={values => save.mutate(values)}>
        {kind === 'product' && <>
          <Form.Item name="productId" label="Sản phẩm" rules={[{ required: true, message: 'Chọn sản phẩm.' }]}><BusinessCodeSelect kind="product" disabled={!!editing?.hasUsage} onChange={() => form.setFieldValue('variantId', null)} /></Form.Item>
          <Form.Item name="variantId" label="Biến thể — để trống để áp dụng cả sản phẩm"><BusinessCodeSelect productId={productId} disabled={!!editing?.hasUsage || !productId} /></Form.Item>
          <Form.Item name="minQuantity" label="Số lượng mua tối thiểu trên mỗi dòng" rules={[{ required: true }]}><InputNumber min={0} max={1000000} precision={0} style={{ width: '100%' }} /></Form.Item>
        </>}
        {kind === 'voucher' && <Form.Item name="code" label="Mã voucher" rules={[{ pattern: /^VC[0-9]{2,}$/, message: 'Mã có dạng VC01, VC02...' }]}><Input disabled={!!editing} placeholder="Để trống để cấp mã tự động" /></Form.Item>}
        <Form.Item name="discountPercent" label="Phần trăm giảm" rules={percentRules}><Input addonAfter="%" /></Form.Item>
        {kind !== 'product' && <Form.Item name="minOrderAmount" label="Tiền hàng tối thiểu (VND)" rules={[{ required: true, message: 'Nhập ngưỡng tiền hàng.' }, ...moneyRules]}><Input addonAfter="₫" inputMode="numeric" /></Form.Item>}
        <Form.Item name="maxDiscountAmount" label="Trần giảm (VND) — để trống nếu không giới hạn" rules={moneyRules}><Input addonAfter="₫" inputMode="numeric" /></Form.Item>
        {kind === 'voucher' && <>
          <Form.Item name="maxUses" label="Tổng lượt tối đa — để trống nếu không giới hạn"><InputNumber min={0} max={2147483647} precision={0} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="perCustomerLimit" label="Giới hạn lượt mỗi khách" rules={[{ required: true }]}><InputNumber min={0} max={2147483647} precision={0} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="status" label="Trạng thái" rules={[{ required: true }]}><Select options={[{ value: 'ACTIVE', label: 'Đang hoạt động' }, { value: 'INACTIVE', label: 'Ngừng hoạt động' }]} /></Form.Item>
        </>}
      </Form>
    </Modal>
  </Card>;
}

export const PromotionDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>(); const navigate = useNavigate();
  const query = useQuery({ queryKey: ['admin', 'promotions', id], queryFn: () => apiClient.promotions.getAdmin(id!), enabled: !!id });
  const p = query.data;
  return <div>
    <Space wrap style={{ marginBottom: 20 }}><Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/promotions')}>Danh sách khuyến mãi</Button><Title level={4} style={{ margin: 0 }}>Chi tiết chương trình khuyến mãi</Title></Space>
    <ApiStateWrapper isLoading={query.isLoading} isError={query.isError} error={query.error} onRetry={() => query.refetch()}>
      {p && <>
        <Card style={{ marginBottom: 16 }}><Descriptions title={p.code + ' — ' + p.name} bordered column={{ xs: 1, sm: 2 }}>
          <Descriptions.Item label="Trạng thái">{p.status === 'ACTIVE' ? <Tag color="blue">Đã bật</Tag> : <StatusBadge type="promotion" status={p.status} />}</Descriptions.Item>
          <Descriptions.Item label="Loại khuyến mãi">{titles[p.type === 'PRODUCT' ? 'product' : p.type === 'ORDER' ? 'order' : 'voucher']}</Descriptions.Item>
          <Descriptions.Item label="Hiệu lực">{p.status !== 'ACTIVE' ? 'Không áp dụng' : Date.now() < Date.parse(p.startsAt) ? 'Chưa đến hạn' : Date.now() > Date.parse(p.endsAt) ? 'Đã hết hạn' : 'Đang áp dụng'}</Descriptions.Item>
          <Descriptions.Item label="Đã từng áp dụng">{p.hasUsage ? 'Có' : 'Chưa'}</Descriptions.Item>
          <Descriptions.Item label="Bắt đầu">{formatDateTime(p.startsAt)}</Descriptions.Item><Descriptions.Item label="Kết thúc">{formatDateTime(p.endsAt)}</Descriptions.Item>
          <Descriptions.Item label="Mô tả" span={2}>{p.description || '—'}</Descriptions.Item>
        </Descriptions></Card>
        <Alert type="info" showIcon message="Chính sách kết hợp: mỗi dòng chọn ưu đãi sản phẩm có mức giảm cao nhất; tiếp theo chọn một ưu đãi theo hóa đơn tốt nhất; cuối cùng áp dụng tối đa một voucher trên phần tiền hàng còn lại. Không giảm trên phí giao hàng và không lặp cùng điều kiện trên cùng dòng/đơn." description="Được sửa mức giảm/ngưỡng/trần cho lần đặt hàng sau; số tiền đã chốt trên đơn cũ giữ nguyên. Chỉ xóa điều kiện chưa từng sử dụng. Có thể ngừng voucher hoặc tạm dừng/kết thúc chương trình." style={{ marginBottom: 16 }} />
        <Alert type="info" showIcon message="Mỗi chương trình chỉ có một loại khuyến mãi. Đơn hàng có thể kết hợp các chương trình khác nhau theo chính sách tính tiền." style={{marginBottom:16}} />
        <Conditions key={p.id + p.type} kind={p.type === 'PRODUCT' ? 'product' : p.type === 'ORDER' ? 'order' : 'voucher'} promotion={p} />
      </>}
    </ApiStateWrapper>
  </div>;
};
