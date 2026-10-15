import React, { useState } from "react";
import {
  Typography,
  Descriptions,
  Tabs,
  Button,
  Table,
  Card,
  Space,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Tag,
  Popconfirm,
  message,
  Tooltip,
} from "antd";
import {
  ArrowLeftOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  TagOutlined,
  ShoppingOutlined,
  BarcodeOutlined,
} from "@ant-design/icons";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../api";
import { ApiStateWrapper } from "../../components/common/ApiStateWrapper";
import { StatusBadge } from "../../components/common/StatusBadge";
import { PermissionGuard } from "../../components/common/PermissionGuard";
import { formatVnd, formatDateTime } from "../../utils/format";
import { ApiClientError } from "@halora/api-client";
import type {
  ProductPromotionRule,
  ProductPromotionRuleInput,
  OrderPromotionRule,
  OrderPromotionRuleInput,
  Voucher,
  VoucherInput,
} from "@halora/api-client";

const { Title, Text } = Typography;

export const PromotionDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Tab 1 state: Product Rules
  const [productRuleModalOpen, setProductRuleModalOpen] = useState(false);
  const [editingProductRule, setEditingProductRule] = useState<ProductPromotionRule | null>(null);
  const [productRuleForm] = Form.useForm();

  // Tab 2 state: Order Rules
  const [orderRuleModalOpen, setOrderRuleModalOpen] = useState(false);
  const [editingOrderRule, setEditingOrderRule] = useState<OrderPromotionRule | null>(null);
  const [orderRuleForm] = Form.useForm();

  // Tab 3 state: Vouchers
  const [voucherModalOpen, setVoucherModalOpen] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState<Voucher | null>(null);
  const [voucherForm] = Form.useForm();

  // Fetch Promotion Detail
  const {
    data: promotion,
    isLoading: promoLoading,
    isError: promoError,
    error: pError,
    refetch: refetchPromotion,
  } = useQuery({
    queryKey: ["admin", "promotions", id],
    queryFn: () => apiClient.promotions.getAdmin(id!),
    enabled: !!id,
  });

  // Fetch Product Rules
  const {
    data: productRules,
    isLoading: productRulesLoading,
    refetch: refetchProductRules,
  } = useQuery({
    queryKey: ["admin", "promotions", id, "product-rules"],
    queryFn: () => apiClient.promotions.listProductRules(id!),
    enabled: !!id,
  });

  // Fetch Order Rules
  const {
    data: orderRules,
    isLoading: orderRulesLoading,
    refetch: refetchOrderRules,
  } = useQuery({
    queryKey: ["admin", "promotions", id, "order-rules"],
    queryFn: () => apiClient.promotions.listOrderRules(id!),
    enabled: !!id,
  });

  // Fetch Vouchers
  const {
    data: vouchers,
    isLoading: vouchersLoading,
    refetch: refetchVouchers,
  } = useQuery({
    queryKey: ["admin", "promotions", id, "vouchers"],
    queryFn: () => apiClient.promotions.listVouchers(id!),
    enabled: !!id,
  });

  // Product Rule Mutations
  const createProductRuleMutation = useMutation({
    mutationFn: (input: ProductPromotionRuleInput) => apiClient.promotions.createProductRule(id!, input),
    onSuccess: () => {
      message.success("Thêm quy tắc giảm giá sản phẩm thành công!");
      setProductRuleModalOpen(false);
      productRuleForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ["admin", "promotions", id, "product-rules"] });
    },
    onError: (err: unknown) => {
      if (err instanceof ApiClientError) {
        message.error(err.message || `Lỗi: ${err.code}`);
      } else {
        message.error("Lỗi khi thêm quy tắc.");
      }
    },
  });

  const deleteProductRuleMutation = useMutation({
    mutationFn: (ruleId: string) => apiClient.promotions.deleteProductRule(id!, ruleId),
    onSuccess: () => {
      message.success("Đã xóa quy tắc!");
      queryClient.invalidateQueries({ queryKey: ["admin", "promotions", id, "product-rules"] });
    },
    onError: (err: unknown) => {
      if (err instanceof ApiClientError) message.error(err.message);
    },
  });

  // Order Rule Mutations
  const createOrderRuleMutation = useMutation({
    mutationFn: (input: OrderPromotionRuleInput) => apiClient.promotions.createOrderRule(id!, input),
    onSuccess: () => {
      message.success("Thêm quy tắc giảm giá đơn hàng thành công!");
      setOrderRuleModalOpen(false);
      orderRuleForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ["admin", "promotions", id, "order-rules"] });
    },
    onError: (err: unknown) => {
      if (err instanceof ApiClientError) {
        message.error(err.message || `Lỗi: ${err.code}`);
      } else {
        message.error("Lỗi khi thêm quy tắc.");
      }
    },
  });

  const deleteOrderRuleMutation = useMutation({
    mutationFn: (ruleId: string) => apiClient.promotions.deleteOrderRule(id!, ruleId),
    onSuccess: () => {
      message.success("Đã xóa quy tắc!");
      queryClient.invalidateQueries({ queryKey: ["admin", "promotions", id, "order-rules"] });
    },
    onError: (err: unknown) => {
      if (err instanceof ApiClientError) message.error(err.message);
    },
  });

  // Voucher Mutations
  const createVoucherMutation = useMutation({
    mutationFn: (input: VoucherInput) => apiClient.promotions.createVoucher(id!, input),
    onSuccess: () => {
      message.success("Tạo mã voucher thành công!");
      setVoucherModalOpen(false);
      voucherForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ["admin", "promotions", id, "vouchers"] });
    },
    onError: (err: unknown) => {
      if (err instanceof ApiClientError) {
        message.error(err.message || `Lỗi: ${err.code}`);
      } else {
        message.error("Lỗi khi tạo voucher.");
      }
    },
  });

  const deleteVoucherMutation = useMutation({
    mutationFn: (voucherId: string) => apiClient.promotions.deleteVoucher(id!, voucherId),
    onSuccess: () => {
      message.success("Đã xóa voucher!");
      queryClient.invalidateQueries({ queryKey: ["admin", "promotions", id, "vouchers"] });
    },
    onError: (err: unknown) => {
      if (err instanceof ApiClientError) message.error(err.message);
    },
  });

  const productRuleColumns = [
    {
      title: "Mã sản phẩm (Product ID)",
      dataIndex: "productId",
      key: "productId",
      render: (pid: string) => <code>{pid.substring(0, 8)}...</code>,
    },
    {
      title: "Biến thể áp dụng",
      dataIndex: "variantId",
      key: "variantId",
      render: (vid: string | null) => (vid ? <code>{vid.substring(0, 8)}...</code> : <Tag color="blue">Toàn bộ sản phẩm</Tag>),
    },
    {
      title: "% Giảm giá",
      dataIndex: "discountPercent",
      key: "discountPercent",
      render: (pct: string) => <Text strong style={{ color: "#c05c74" }}>{pct}%</Text>,
    },
    {
      title: "Số lượng tối thiểu",
      dataIndex: "minQuantity",
      key: "minQuantity",
      render: (q: number) => q || 1,
    },
    {
      title: "Trần giảm tối đa",
      dataIndex: "maxDiscountAmount",
      key: "maxDiscountAmount",
      render: (amt: string | null) => (amt ? formatVnd(amt) : "Không giới hạn"),
    },
    {
      title: "Thao tác",
      key: "action",
      width: 80,
      render: (_: unknown, r: ProductPromotionRule) => (
        <PermissionGuard permission="promotions.delete">
          <Popconfirm
            title="Xóa quy tắc giảm giá này?"
            onConfirm={() => deleteProductRuleMutation.mutate(r.id)}
            disabled={!!promotion?.hasUsage}
          >
            <Button type="text" danger size="small" icon={<DeleteOutlined />} disabled={!!promotion?.hasUsage} />
          </Popconfirm>
        </PermissionGuard>
      ),
    },
  ];

  const orderRuleColumns = [
    {
      title: "Giá trị đơn tối thiểu",
      dataIndex: "minOrderAmount",
      key: "minOrderAmount",
      render: (amt: string) => <Text strong>{formatVnd(amt)}</Text>,
    },
    {
      title: "% Giảm giá",
      dataIndex: "discountPercent",
      key: "discountPercent",
      render: (pct: string) => <Text strong style={{ color: "#c05c74" }}>{pct}%</Text>,
    },
    {
      title: "Trần giảm tối đa",
      dataIndex: "maxDiscountAmount",
      key: "maxDiscountAmount",
      render: (amt: string | null) => (amt ? formatVnd(amt) : "Không giới hạn"),
    },
    {
      title: "Thao tác",
      key: "action",
      width: 80,
      render: (_: unknown, r: OrderPromotionRule) => (
        <PermissionGuard permission="promotions.delete">
          <Popconfirm
            title="Xóa quy tắc này?"
            onConfirm={() => deleteOrderRuleMutation.mutate(r.id)}
            disabled={!!promotion?.hasUsage}
          >
            <Button type="text" danger size="small" icon={<DeleteOutlined />} disabled={!!promotion?.hasUsage} />
          </Popconfirm>
        </PermissionGuard>
      ),
    },
  ];

  const voucherColumns = [
    {
      title: "Mã Voucher",
      dataIndex: "code",
      key: "code",
      render: (c: string) => <Tag color="magenta" style={{ fontSize: 13, fontWeight: 700 }}>{c}</Tag>,
    },
    {
      title: "% Giảm",
      dataIndex: "discountPercent",
      key: "discountPercent",
      render: (pct: string) => <Text strong style={{ color: "#c05c74" }}>{pct}%</Text>,
    },
    {
      title: "Đơn tối thiểu",
      dataIndex: "minOrderAmount",
      key: "minOrderAmount",
      render: (amt: string) => formatVnd(amt),
    },
    {
      title: "Giảm tối đa",
      dataIndex: "maxDiscountAmount",
      key: "maxDiscountAmount",
      render: (amt: string | null) => (amt ? formatVnd(amt) : "Không trần"),
    },
    {
      title: "Lượt dùng (Đã dùng / Đang giữ / Tổng)",
      key: "usage",
      render: (_: unknown, r: Voucher) => (
        <span>
          <Text strong style={{ color: "#52c41a" }}>{r.usedCount}</Text>
          {" / "}
          <Text style={{ color: "#fa8c16" }}>{r.reservedCount}</Text>
          {" / "}
          <span>{r.maxUses === null ? "∞" : r.maxUses}</span>
        </span>
      ),
    },
    {
      title: "Giới hạn / Khách",
      dataIndex: "perCustomerLimit",
      key: "perCustomerLimit",
      width: 130,
      render: (l: number) => `${l} lần`,
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      render: (st: string) => <StatusBadge type="active" status={st} />,
    },
    {
      title: "Thao tác",
      key: "action",
      width: 80,
      render: (_: unknown, r: Voucher) => (
        <PermissionGuard permission="promotions.delete">
          <Popconfirm
            title="Xóa voucher này?"
            onConfirm={() => deleteVoucherMutation.mutate(r.id)}
            disabled={r.usedCount > 0}
          >
            <Button type="text" danger size="small" icon={<DeleteOutlined />} disabled={r.usedCount > 0} />
          </Popconfirm>
        </PermissionGuard>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/promotions")}>
            Danh sách khuyến mãi
          </Button>
          <Title level={4} style={{ margin: 0 }}>
            Chi tiết CTKM: {promotion?.name || "Đang tải..."}
          </Title>
        </div>

        <Button icon={<ReloadOutlined />} onClick={() => refetchPromotion()}>
          Làm mới
        </Button>
      </div>

      <ApiStateWrapper isLoading={promoLoading} isError={promoError} error={pError} onRetry={() => refetchPromotion()}>
        {promotion && (
          <>
            <Card bordered={false} style={{ marginBottom: 24, background: "#fafafa" }}>
              <Descriptions title="Thông tin chương trình" bordered size="small" column={{ xs: 1, sm: 2, md: 3 }}>
                <Descriptions.Item label="Mã CTKM">
                  <code>{promotion.code}</code>
                </Descriptions.Item>
                <Descriptions.Item label="Tên chương trình">
                  <Text strong>{promotion.name}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Trạng thái">
                  <StatusBadge type="promotion" status={promotion.status} />
                </Descriptions.Item>
                <Descriptions.Item label="Thời gian bắt đầu">
                  {formatDateTime(promotion.startsAt)}
                </Descriptions.Item>
                <Descriptions.Item label="Thời gian kết thúc">
                  {formatDateTime(promotion.endsAt)}
                </Descriptions.Item>
                <Descriptions.Item label="Khóa chỉnh sửa thương mại">
                  {promotion.hasUsage ? (
                    <Tag color="error">Đã phát sinh lượt dùng (Khóa rule)</Tag>
                  ) : (
                    <Tag color="green">Chưa phát sinh (Được sửa)</Tag>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="Mô tả" span={3}>
                  {promotion.description || "—"}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Tabs
              defaultActiveKey="vouchers"
              items={[
                {
                  key: "productRules",
                  label: (
                    <span>
                      <TagOutlined /> Giảm giá theo sản phẩm ({productRules?.data?.length || 0})
                    </span>
                  ),
                  children: (
                    <Card
                      title="Quy tắc giảm giá trên từng dòng hàng"
                      bordered={false}
                      extra={
                        <Space>
                          <Button icon={<ReloadOutlined />} onClick={() => refetchProductRules()}>
                            Làm mới
                          </Button>
                          <PermissionGuard permission="promotions.create">
                            <Button
                              type="primary"
                              icon={<PlusOutlined />}
                              disabled={!!promotion.hasUsage}
                              onClick={() => {
                                productRuleForm.resetFields();
                                setProductRuleModalOpen(true);
                              }}
                              style={{ backgroundColor: "#c05c74", borderColor: "#c05c74" }}
                            >
                              Thêm quy tắc sản phẩm
                            </Button>
                          </PermissionGuard>
                        </Space>
                      }
                    >
                      <Table
                        dataSource={productRules?.data || []}
                        columns={productRuleColumns}
                        rowKey="id"
                        loading={productRulesLoading}
                        pagination={false}
                      />
                    </Card>
                  ),
                },
                {
                  key: "orderRules",
                  label: (
                    <span>
                      <ShoppingOutlined /> Giảm giá cấp đơn ({orderRules?.data?.length || 0})
                    </span>
                  ),
                  children: (
                    <Card
                      title="Quy tắc chiết khấu tổng giá trị đơn hàng"
                      bordered={false}
                      extra={
                        <Space>
                          <Button icon={<ReloadOutlined />} onClick={() => refetchOrderRules()}>
                            Làm mới
                          </Button>
                          <PermissionGuard permission="promotions.create">
                            <Button
                              type="primary"
                              icon={<PlusOutlined />}
                              disabled={!!promotion.hasUsage}
                              onClick={() => {
                                orderRuleForm.resetFields();
                                setOrderRuleModalOpen(true);
                              }}
                              style={{ backgroundColor: "#c05c74", borderColor: "#c05c74" }}
                            >
                              Thêm quy tắc cấp đơn
                            </Button>
                          </PermissionGuard>
                        </Space>
                      }
                    >
                      <Table
                        dataSource={orderRules?.data || []}
                        columns={orderRuleColumns}
                        rowKey="id"
                        loading={orderRulesLoading}
                        pagination={false}
                      />
                    </Card>
                  ),
                },
                {
                  key: "vouchers",
                  label: (
                    <span>
                      <BarcodeOutlined /> Mã Voucher ({vouchers?.data?.length || 0})
                    </span>
                  ),
                  children: (
                    <Card
                      title="Danh sách mã giảm giá Voucher"
                      bordered={false}
                      extra={
                        <Space>
                          <Button icon={<ReloadOutlined />} onClick={() => refetchVouchers()}>
                            Làm mới
                          </Button>
                          <PermissionGuard permission="promotions.create">
                            <Button
                              type="primary"
                              icon={<PlusOutlined />}
                              onClick={() => {
                                voucherForm.resetFields();
                                voucherForm.setFieldsValue({ status: "ACTIVE", perCustomerLimit: 1 });
                                setVoucherModalOpen(true);
                              }}
                              style={{ backgroundColor: "#c05c74", borderColor: "#c05c74" }}
                            >
                              Tạo mã Voucher
                            </Button>
                          </PermissionGuard>
                        </Space>
                      }
                    >
                      <Table
                        dataSource={vouchers?.data || []}
                        columns={voucherColumns}
                        rowKey="id"
                        loading={vouchersLoading}
                        pagination={false}
                      />
                    </Card>
                  ),
                },
              ]}
            />
          </>
        )}
      </ApiStateWrapper>

      {/* Modal Add Product Rule */}
      <Modal
        title="Thêm quy tắc giảm giá sản phẩm"
        open={productRuleModalOpen}
        onCancel={() => setProductRuleModalOpen(false)}
        onOk={() => productRuleForm.submit()}
        confirmLoading={createProductRuleMutation.isPending}
        okText="Lưu quy tắc"
        cancelText="Hủy"
        okButtonProps={{ style: { backgroundColor: "#c05c74", borderColor: "#c05c74" } }}
      >
        <Form
          form={productRuleForm}
          layout="vertical"
          onFinish={(vals: { productId: string; variantId?: string; discountPercent: string; minQuantity?: number; maxDiscountAmount?: string }) => {
            createProductRuleMutation.mutate({
              productId: vals.productId,
              variantId: vals.variantId || null,
              discountPercent: String(vals.discountPercent),
              minQuantity: vals.minQuantity || 1,
              maxDiscountAmount: vals.maxDiscountAmount ? String(vals.maxDiscountAmount) : null,
            });
          }}
        >
          <Form.Item name="productId" label="Mã sản phẩm (Product UUID)" rules={[{ required: true, message: "Nhập Product ID" }]}>
            <Input placeholder="UUID của sản phẩm" />
          </Form.Item>

          <Form.Item name="variantId" label="Mã biến thể (Variant UUID) - để trống nếu áp dụng cả sản phẩm">
            <Input placeholder="UUID biến thể (tùy chọn)" />
          </Form.Item>

          <Form.Item name="discountPercent" label="% Giảm giá" rules={[{ required: true, message: "Nhập % giảm giá" }]}>
            <Input placeholder="Ví dụ: 15.00" addonAfter="%" />
          </Form.Item>

          <Form.Item name="minQuantity" label="Số lượng mua tối thiểu" initialValue={1}>
            <InputNumber min={1} style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item name="maxDiscountAmount" label="Số tiền giảm tối đa (VND) - để trống nếu không trần">
            <Input placeholder="Ví dụ: 50000" addonAfter="₫" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal Add Order Rule */}
      <Modal
        title="Thêm quy tắc giảm giá cấp đơn hàng"
        open={orderRuleModalOpen}
        onCancel={() => setOrderRuleModalOpen(false)}
        onOk={() => orderRuleForm.submit()}
        confirmLoading={createOrderRuleMutation.isPending}
        okText="Lưu quy tắc"
        cancelText="Hủy"
        okButtonProps={{ style: { backgroundColor: "#c05c74", borderColor: "#c05c74" } }}
      >
        <Form
          form={orderRuleForm}
          layout="vertical"
          onFinish={(vals: { minOrderAmount: string; discountPercent: string; maxDiscountAmount?: string }) => {
            createOrderRuleMutation.mutate({
              minOrderAmount: String(vals.minOrderAmount),
              discountPercent: String(vals.discountPercent),
              maxDiscountAmount: vals.maxDiscountAmount ? String(vals.maxDiscountAmount) : null,
            });
          }}
        >
          <Form.Item name="minOrderAmount" label="Giá trị đơn hàng tối thiểu (VND)" rules={[{ required: true, message: "Nhập giá trị đơn" }]}>
            <Input placeholder="Ví dụ: 500000" addonAfter="₫" />
          </Form.Item>

          <Form.Item name="discountPercent" label="% Giảm giá trên đơn" rules={[{ required: true, message: "Nhập % giảm giá" }]}>
            <Input placeholder="Ví dụ: 10.00" addonAfter="%" />
          </Form.Item>

          <Form.Item name="maxDiscountAmount" label="Số tiền giảm tối đa (VND) - để trống nếu không trần">
            <Input placeholder="Ví dụ: 100000" addonAfter="₫" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal Add Voucher */}
      <Modal
        title="Tạo mã giảm giá Voucher mới"
        open={voucherModalOpen}
        onCancel={() => setVoucherModalOpen(false)}
        onOk={() => voucherForm.submit()}
        confirmLoading={createVoucherMutation.isPending}
        okText="Tạo Voucher"
        cancelText="Hủy"
        width={620}
        okButtonProps={{ style: { backgroundColor: "#c05c74", borderColor: "#c05c74" } }}
      >
        <Form
          form={voucherForm}
          layout="vertical"
          onFinish={(vals: {
            code: string;
            discountPercent: string;
            minOrderAmount: string;
            maxDiscountAmount?: string;
            maxUses?: number;
            perCustomerLimit: number;
            status: "ACTIVE" | "INACTIVE";
          }) => {
            createVoucherMutation.mutate({
              code: vals.code.toUpperCase(),
              discountPercent: String(vals.discountPercent),
              minOrderAmount: String(vals.minOrderAmount),
              maxDiscountAmount: vals.maxDiscountAmount ? String(vals.maxDiscountAmount) : null,
              maxUses: vals.maxUses !== undefined && vals.maxUses !== null ? vals.maxUses : null,
              perCustomerLimit: vals.perCustomerLimit || 1,
              status: vals.status,
            });
          }}
        >
          <Form.Item
            name="code"
            label="Mã Voucher (viết hoa, không dấu)"
            rules={[{ required: true, message: "Vui lòng nhập mã voucher" }]}
          >
            <Input placeholder="Ví dụ: HALORA50, TRIANVIP, ..." />
          </Form.Item>

          <Space style={{ display: "flex", width: "100%" }} size="middle">
            <Form.Item
              name="discountPercent"
              label="% Giảm giá"
              rules={[{ required: true, message: "Nhập % giảm" }]}
              style={{ flex: 1 }}
            >
              <Input placeholder="Ví dụ: 15.00" addonAfter="%" />
            </Form.Item>

            <Form.Item
              name="minOrderAmount"
              label="Đơn tối thiểu (VND)"
              rules={[{ required: true, message: "Nhập giá trị đơn tối thiểu" }]}
              style={{ flex: 1 }}
            >
              <Input placeholder="Ví dụ: 300000" addonAfter="₫" />
            </Form.Item>
          </Space>

          <Space style={{ display: "flex", width: "100%" }} size="middle">
            <Form.Item name="maxDiscountAmount" label="Số tiền giảm tối đa (VND)" style={{ flex: 1 }}>
              <Input placeholder="Để trống nếu không trần" addonAfter="₫" />
            </Form.Item>

            <Form.Item name="maxUses" label="Tổng lượt dùng toàn hệ thống" style={{ flex: 1 }}>
              <InputNumber min={1} placeholder="Để trống = vô hạn" style={{ width: "100%" }} />
            </Form.Item>
          </Space>

          <Space style={{ display: "flex", width: "100%" }} size="middle">
            <Form.Item
              name="perCustomerLimit"
              label="Giới hạn lượt dùng / 1 khách hàng"
              rules={[{ required: true, message: "Nhập giới hạn/khách" }]}
              style={{ flex: 1 }}
            >
              <InputNumber min={1} style={{ width: "100%" }} />
            </Form.Item>

            <Form.Item
              name="status"
              label="Trạng thái"
              rules={[{ required: true, message: "Chọn trạng thái" }]}
              style={{ flex: 1 }}
            >
              <Select
                options={[
                  { value: "ACTIVE", label: "Đang hoạt động" },
                  { value: "INACTIVE", label: "Ngừng hoạt động" },
                ]}
              />
            </Form.Item>
          </Space>

          <Text type="secondary" style={{ fontSize: 12 }}>
            * Lưu ý: Lượt đã dùng (usedCount) và lượt đang giữ tạm (reservedCount) được backend quản lý và là thông tin chỉ đọc.
          </Text>
        </Form>
      </Modal>
    </div>
  );
};
