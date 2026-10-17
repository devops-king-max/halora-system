import React, { useState } from "react";
import {
  Typography,
  Descriptions,
  Button,
  Table,
  Card,
  Space,
  Tag,
  Popconfirm,
  message,
  Modal,
  Form,
  Input,
  Select,
  Row,
  Col,
  Timeline,
  Divider,
} from "antd";
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  SendOutlined,
  CloseCircleOutlined,
  FileTextOutlined,
  DollarOutlined,
  ReloadOutlined,
  ExclamationCircleOutlined,
} from "@ant-design/icons";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../api";
import { ApiStateWrapper } from "../../components/common/ApiStateWrapper";
import { StatusBadge } from "../../components/common/StatusBadge";
import { PermissionGuard } from "../../components/common/PermissionGuard";
import { formatVnd, formatDateTime, generateUUID } from "../../utils/format";
import { ApiClientError } from "@halora/api-client";
import type {
  OrderItem,
  Payment,
  Refund,
  CreateOrderPaymentInput,
  PaymentMethod,
} from "@halora/api-client";

const { Title, Text } = Typography;

export const OrderDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Cancel order modal
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  // Create payment modal
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentForm] = Form.useForm();

  // Fail payment / refund modal
  const [failModalOpen, setFailModalOpen] = useState(false);
  const [failTarget, setFailTarget] = useState<{ type: "payment" | "refund"; id: string } | null>(null);
  const [failNote, setFailNote] = useState("");

  // Invoice creation modal
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [invoiceNote, setInvoiceNote] = useState("");

  // Idempotency keys
  const [idempotencyKey, setIdempotencyKey] = useState<string>(generateUUID());

  // 1. Fetch Order Detail
  const {
    data: order,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["admin", "orders", id],
    queryFn: () => apiClient.orders.getAdmin(id!),
    enabled: !!id,
  });

  // Action Mutations
  const confirmOrderMutation = useMutation({
    mutationFn: () =>
      apiClient.orders.confirm(id!, { version: order!.version }, idempotencyKey),
    onSuccess: () => {
      message.success("Xác nhận đơn hàng thành công! Đã thực hiện xuất kho.");
      setIdempotencyKey(generateUUID());
      queryClient.invalidateQueries({ queryKey: ["admin", "orders", id] });
      queryClient.invalidateQueries({ queryKey: ["admin", "inventory"] });
    },
    onError: (err: unknown) => {
      if (err instanceof ApiClientError) {
        if (err.code === "INSUFFICIENT_STOCK") {
          message.error("Không đủ số lượng hàng tồn kho để xác nhận xuất bán.");
        } else if (err.code === "VERSION_CONFLICT") {
          message.error("Đơn hàng đã bị thay đổi bởi người khác. Vui lòng tải lại.");
        } else {
          message.error(err.message || `Lỗi: ${err.code}`);
        }
      } else {
        message.error("Lỗi khi xác nhận đơn hàng.");
      }
    },
  });

  const dispatchOrderMutation = useMutation({
    mutationFn: () => apiClient.orders.dispatch(id!, { version: order!.version }),
    onSuccess: () => {
      message.success("Đã chuyển đơn hàng sang trạng thái đang giao!");
      queryClient.invalidateQueries({ queryKey: ["admin", "orders", id] });
    },
    onError: (err: unknown) => {
      if (err instanceof ApiClientError) message.error(err.message);
    },
  });

  const completeOrderMutation = useMutation({
    mutationFn: () => apiClient.orders.complete(id!, { version: order!.version }),
    onSuccess: () => {
      message.success("Đơn hàng đã được đánh dấu hoàn tất!");
      queryClient.invalidateQueries({ queryKey: ["admin", "orders", id] });
    },
    onError: (err: unknown) => {
      if (err instanceof ApiClientError) message.error(err.message);
    },
  });

  const cancelOrderMutation = useMutation({
    mutationFn: () =>
      apiClient.orders.cancelAdmin(id!, { version: order!.version, reason: cancelReason }),
    onSuccess: () => {
      message.success("Đã hủy đơn hàng! Nếu đơn từng xác nhận xuất kho, hệ thống đã hoàn trả tồn kho.");
      setCancelModalOpen(false);
      setCancelReason("");
      queryClient.invalidateQueries({ queryKey: ["admin", "orders", id] });
      queryClient.invalidateQueries({ queryKey: ["admin", "inventory"] });
    },
    onError: (err: unknown) => {
      if (err instanceof ApiClientError) message.error(err.message);
    },
  });

  // Payment Mutations
  const createPaymentMutation = useMutation({
    mutationFn: (values: CreateOrderPaymentInput) => apiClient.orders.createPayment(id!, values),
    onSuccess: () => {
      message.success("Tạo yêu cầu thanh toán thành công (trạng thái Chờ xử lý)!");
      setPaymentModalOpen(false);
      paymentForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ["admin", "orders", id] });
    },
    onError: (err: unknown) => {
      if (err instanceof ApiClientError) message.error(err.message);
    },
  });

  const confirmPaymentMutation = useMutation({
    mutationFn: (paymentId: string) =>
      apiClient.payments.confirmPayment(paymentId, undefined, generateUUID()),
    onSuccess: () => {
      message.success("Xác nhận thu tiền thành công! Đã ghi nhận số tiền thu.");
      queryClient.invalidateQueries({ queryKey: ["admin", "orders", id] });
    },
    onError: (err: unknown) => {
      if (err instanceof ApiClientError) message.error(err.message);
    },
  });

  const failPaymentMutation = useMutation({
    mutationFn: ({ paymentId, note }: { paymentId: string; note: string }) =>
      apiClient.payments.failPayment(paymentId, { note }),
    onSuccess: () => {
      message.success("Đã đánh dấu thanh toán thất bại.");
      setFailModalOpen(false);
      setFailTarget(null);
      setFailNote("");
      queryClient.invalidateQueries({ queryKey: ["admin", "orders", id] });
    },
    onError: (err: unknown) => {
      if (err instanceof ApiClientError) message.error(err.message);
    },
  });

  // Refund Mutations
  const confirmRefundMutation = useMutation({
    mutationFn: (refundId: string) =>
      apiClient.payments.confirmRefund(refundId, undefined, generateUUID()),
    onSuccess: () => {
      message.success("Xác nhận hoàn tiền thành công!");
      queryClient.invalidateQueries({ queryKey: ["admin", "orders", id] });
    },
    onError: (err: unknown) => {
      if (err instanceof ApiClientError) message.error(err.message);
    },
  });

  const failRefundMutation = useMutation({
    mutationFn: ({ refundId, note }: { refundId: string; note: string }) =>
      apiClient.payments.failRefund(refundId, { note }),
    onSuccess: () => {
      message.success("Đã đánh dấu hoàn tiền thất bại.");
      setFailModalOpen(false);
      setFailTarget(null);
      setFailNote("");
      queryClient.invalidateQueries({ queryKey: ["admin", "orders", id] });
    },
    onError: (err: unknown) => {
      if (err instanceof ApiClientError) message.error(err.message);
    },
  });

  // Create Invoice Mutation
  const createInvoiceMutation = useMutation({
    mutationFn: () => apiClient.invoices.createFromOrder(id!, { note: invoiceNote || undefined }),
    onSuccess: (inv) => {
      message.success("Tạo hóa đơn từ đơn hàng thành công!");
      setInvoiceModalOpen(false);
      navigate(`/invoices/${inv.id}`);
    },
    onError: (err: unknown) => {
      if (err instanceof ApiClientError) message.error(err.message);
    },
  });

  const itemColumns = [
    {
      title: "Mặt hàng sản phẩm",
      key: "product",
      render: (_: unknown, r: OrderItem) => (
        <div>
          <Text strong>{r.productName}</Text>
          <div style={{ fontSize: 12, color: "#8c8c8c" }}>
            Biến thể: {r.variantName} | SKU: <code>{r.sku}</code>
          </div>
        </div>
      ),
    },
    {
      title: "Số lượng",
      dataIndex: "quantity",
      key: "quantity",
      width: 90,
      render: (q: number) => <Text strong>{q}</Text>,
    },
    {
      title: "Đơn giá gốc",
      dataIndex: "unitPrice",
      key: "unitPrice",
      width: 130,
      render: (p: string) => formatVnd(p),
    },
    {
      title: "Tạm tính",
      dataIndex: "lineSubtotal",
      key: "lineSubtotal",
      width: 130,
      render: (p: string) => formatVnd(p),
    },
    {
      title: "Ưu đãi sản phẩm",
      dataIndex: "productDiscountAmount",
      key: "productDiscountAmount",
      width: 140,
      render: (d: string) => (parseInt(d, 10) > 0 ? <span style={{ color: "#389e0d" }}>-{formatVnd(d)}</span> : "—"),
    },
    {
      title: "Tổng dòng",
      dataIndex: "lineTotal",
      key: "lineTotal",
      width: 140,
      render: (t: string) => <Text strong style={{ color: "#c05c74" }}>{formatVnd(t)}</Text>,
    },
  ];

  const paymentColumns = [
    {
      title: "Tham chiếu thanh toán",
      dataIndex: "reference",
      key: "reference",
      render: (reference: string | null) => <code>{reference || "Chưa có tham chiếu"}</code>,
    },
    {
      title: "Phương thức",
      dataIndex: "method",
      key: "method",
      render: (m: string) => (m === "COD" ? "Thanh toán khi nhận hàng (COD)" : "Chuyển khoản"),
    },
    {
      title: "Số tiền",
      dataIndex: "amount",
      key: "amount",
      render: (amt: string) => <Text strong style={{ color: "#389e0d" }}>{formatVnd(amt)}</Text>,
    },
    {
      title: "Mã đối soát / tham chiếu",
      dataIndex: "reference",
      key: "reference",
      render: (ref: string | null) => ref || "—",
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      render: (st: string) => <StatusBadge type="payment" status={st} />,
    },
    {
      title: "Thời gian thanh toán",
      dataIndex: "paidAt",
      key: "paidAt",
      render: (d: string | null) => (d ? formatDateTime(d) : "—"),
    },
    {
      title: "Thao tác",
      key: "action",
      width: 170,
      render: (_: unknown, r: Payment) =>
        r.status === "PENDING" && (
          <Space size="small">
            <PermissionGuard permission="payments.confirm">
              <Button
                type="primary"
                size="small"
                onClick={() => confirmPaymentMutation.mutate(r.id)}
                style={{ backgroundColor: "#52c41a", borderColor: "#52c41a" }}
              >
                Xác nhận thu
              </Button>
            </PermissionGuard>
            <PermissionGuard permission="payments.fail">
              <Button
                danger
                size="small"
                onClick={() => {
                  setFailTarget({ type: "payment", id: r.id });
                  setFailNote("");
                  setFailModalOpen(true);
                }}
              >
                Báo thất bại
              </Button>
            </PermissionGuard>
          </Space>
        ),
    },
  ];

  const refundColumns = [
    {
      title: "Tham chiếu hoàn tiền",
      dataIndex: "reference",
      key: "reference",
      render: (reference: string | null) => <code>{reference || "Chưa có tham chiếu"}</code>,
    },
    {
      title: "Số tiền hoàn",
      dataIndex: "amount",
      key: "amount",
      render: (amt: string) => <Text strong style={{ color: "#cf1322" }}>{formatVnd(amt)}</Text>,
    },
    {
      title: "Lý do hoàn",
      dataIndex: "reason",
      key: "reason",
      render: (r: string | null) => r || "—",
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      render: (st: string) => <StatusBadge type="refund" status={st} />,
    },
    {
      title: "Thời điểm hoàn",
      dataIndex: "refundedAt",
      key: "refundedAt",
      render: (d: string | null) => (d ? formatDateTime(d) : "—"),
    },
    {
      title: "Thao tác",
      key: "action",
      width: 170,
      render: (_: unknown, r: Refund) =>
        r.status === "PENDING" && (
          <Space size="small">
            <PermissionGuard permission="refunds.confirm">
              <Button
                type="primary"
                size="small"
                onClick={() => confirmRefundMutation.mutate(r.id)}
                style={{ backgroundColor: "#52c41a", borderColor: "#52c41a" }}
              >
                Xác nhận hoàn
              </Button>
            </PermissionGuard>
            <PermissionGuard permission="refunds.fail">
              <Button
                danger
                size="small"
                onClick={() => {
                  setFailTarget({ type: "refund", id: r.id });
                  setFailNote("");
                  setFailModalOpen(true);
                }}
              >
                Báo thất bại
              </Button>
            </PermissionGuard>
          </Space>
        ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/orders")}>
            Danh sách đơn hàng
          </Button>
          <Title level={4} style={{ margin: 0 }}>
            Chi tiết đơn hàng: {order?.orderCode || "Đang tải..."}
          </Title>
        </div>

        <Space wrap>
          <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
            Làm mới
          </Button>

          {/* Action buttons based on status */}
          {order?.status === "PENDING_CONFIRMATION" && (
            <>
              <PermissionGuard permission="orders.cancel">
                <Button danger icon={<CloseCircleOutlined />} onClick={() => setCancelModalOpen(true)}>
                  Hủy đơn hàng
                </Button>
              </PermissionGuard>

              <PermissionGuard permission="orders.confirm">
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  onClick={() => confirmOrderMutation.mutate()}
                  loading={confirmOrderMutation.isPending}
                  style={{ backgroundColor: "#1890ff", borderColor: "#1890ff" }}
                >
                  Xác nhận đơn (Xuất kho)
                </Button>
              </PermissionGuard>
            </>
          )}

          {order?.status === "CONFIRMED" && (
            <>
              <PermissionGuard permission="orders.cancel">
                <Button danger icon={<CloseCircleOutlined />} onClick={() => setCancelModalOpen(true)}>
                  Hủy đơn hàng
                </Button>
              </PermissionGuard>

              <PermissionGuard permission="orders.dispatch">
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  onClick={() => dispatchOrderMutation.mutate()}
                  loading={dispatchOrderMutation.isPending}
                  style={{ backgroundColor: "#13c2c2", borderColor: "#13c2c2" }}
                >
                  Giao hàng (SHIPPING)
                </Button>
              </PermissionGuard>
            </>
          )}

          {order?.status === "SHIPPING" && (
            <PermissionGuard permission="orders.complete">
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={() => completeOrderMutation.mutate()}
                loading={completeOrderMutation.isPending}
                style={{ backgroundColor: "#52c41a", borderColor: "#52c41a" }}
              >
                Hoàn tất đơn hàng (COMPLETED)
              </Button>
            </PermissionGuard>
          )}

          {order?.status === "COMPLETED" && (
            <PermissionGuard permission="invoices.create">
              <Button
                icon={<FileTextOutlined />}
                onClick={() => {
                  setInvoiceNote("");
                  setInvoiceModalOpen(true);
                }}
                style={{ borderColor: "#c05c74", color: "#c05c74" }}
              >
                Lập hóa đơn từ đơn hàng
              </Button>
            </PermissionGuard>
          )}
        </Space>
      </div>

      <ApiStateWrapper isLoading={isLoading} isError={isError} error={error} onRetry={() => refetch()}>
        {order && (
          <>
            <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
              {/* Order Info & Delivery Address */}
              <Col xs={24} lg={15}>
                <Card title="Thông tin đơn hàng & Người nhận" bordered={false} style={{ background: "#fafafa" }}>
                  <Descriptions size="small" column={{ xs: 1, sm: 2 }} bordered>
                    <Descriptions.Item label="Mã đơn hàng">
                      <code>{order.orderCode}</code>
                    </Descriptions.Item>
                    <Descriptions.Item label="Trạng thái đơn">
                      <StatusBadge type="order" status={order.status} />
                    </Descriptions.Item>
                    <Descriptions.Item label="Khách hàng">
                      <Text strong>{order.customerName}</Text>
                    </Descriptions.Item>
                    <Descriptions.Item label="Phương thức thanh toán">
                      {order.paymentMethod === "COD" ? "Thanh toán khi nhận hàng (COD)" : "Chuyển khoản"}
                    </Descriptions.Item>
                    <Descriptions.Item label="Người nhận hàng">
                      {order.recipientName}
                    </Descriptions.Item>
                    <Descriptions.Item label="SĐT người nhận">
                      {order.recipientPhone}
                    </Descriptions.Item>
                    <Descriptions.Item label="Địa chỉ giao hàng" span={2}>
                      {order.addressLine}, {order.wardName}, {order.provinceName}
                    </Descriptions.Item>
                    <Descriptions.Item label="Ghi chú đơn hàng" span={2}>
                      {order.note || "—"}
                    </Descriptions.Item>
                    {order.cancellationReason && (
                      <Descriptions.Item label="Lý do hủy đơn" span={2}>
                        <Text type="danger">{order.cancellationReason}</Text>
                      </Descriptions.Item>
                    )}
                  </Descriptions>
                </Card>
              </Col>

              {/* Amounts Breakdown Card */}
              <Col xs={24} lg={9}>
                <Card title="Chi tiết thanh toán đơn hàng" bordered={false} style={{ background: "#fafafa" }}>
                  <Descriptions column={1} size="small" bordered>
                    <Descriptions.Item label="Tiền hàng (Tạm tính)">
                      {formatVnd(order.amounts.subtotalAmount)}
                    </Descriptions.Item>
                    <Descriptions.Item label="Giảm giá sản phẩm">
                      <span style={{ color: "#389e0d" }}>
                        -{formatVnd(order.amounts.productDiscountAmount)}
                      </span>
                    </Descriptions.Item>
                    <Descriptions.Item label="Giảm giá cấp đơn">
                      <span style={{ color: "#389e0d" }}>
                        -{formatVnd(order.amounts.orderDiscountAmount)}
                      </span>
                    </Descriptions.Item>
                    <Descriptions.Item label="Giảm giá Voucher">
                      <span style={{ color: "#389e0d" }}>
                        -{formatVnd(order.amounts.voucherDiscountAmount)}
                      </span>
                    </Descriptions.Item>
                    <Descriptions.Item label="Phí giao hàng">
                      +{formatVnd(order.amounts.shippingFee)}
                    </Descriptions.Item>
                    <Descriptions.Item label="Tổng tiền phải trả">
                      <Text strong style={{ fontSize: 16, color: "#c05c74" }}>
                        {formatVnd(order.amounts.totalAmount)}
                      </Text>
                    </Descriptions.Item>
                    <Descriptions.Item label="Số tiền đã thu">
                      <Text strong style={{ color: "#389e0d" }}>
                        {formatVnd(order.paidAmount)}
                      </Text>
                    </Descriptions.Item>
                    <Descriptions.Item label="Số tiền đã hoàn">
                      <Text style={{ color: "#cf1322" }}>
                        {formatVnd(order.refundedAmount)}
                      </Text>
                    </Descriptions.Item>
                  </Descriptions>
                </Card>
              </Col>
            </Row>

            {/* Order Items Table */}
            <Card title={`Dòng hàng đã đặt (${order.items?.length || 0})`} bordered={false} style={{ marginBottom: 24 }}>
              <Table
                dataSource={order.items || []}
                columns={itemColumns}
                rowKey="id"
                pagination={false}
              />
            </Card>

            {/* Applied Discounts */}
            {order.discounts && order.discounts.length > 0 && (
              <Card title="Khuyến mãi & Voucher áp dụng trên đơn" bordered={false} style={{ marginBottom: 24 }}>
                <Space wrap>
                  {order.discounts.map((d, idx) => (
                    <Card key={idx} size="small" style={{ width: 280, background: "#fcf8f9" }}>
                      <div>
                        <Tag color="magenta">{d.scope}</Tag>
                        <Text strong>{d.promotionName}</Text>
                      </div>
                      {d.voucherCode && <div>Mã: <code>{d.voucherCode}</code></div>}
                      <div style={{ marginTop: 6, color: "#c05c74", fontWeight: 700 }}>
                        Giảm: {formatVnd(d.amount)}
                      </div>
                    </Card>
                  ))}
                </Space>
              </Card>
            )}

            {/* Payments & Reconciliation Section */}
            <Card
              title="Lịch sử đối soát & Thanh toán (Payments)"
              bordered={false}
              style={{ marginBottom: 24 }}
              extra={
                <PermissionGuard permission="payments.create">
                  <Button
                    type="primary"
                    icon={<DollarOutlined />}
                    onClick={() => {
                      paymentForm.resetFields();
                      paymentForm.setFieldsValue({
                        method: order.paymentMethod,
                        amount: order.amounts.totalAmount,
                      });
                      setPaymentModalOpen(true);
                    }}
                    style={{ backgroundColor: "#c05c74", borderColor: "#c05c74" }}
                  >
                    Tạo lượt thanh toán mới
                  </Button>
                </PermissionGuard>
              }
            >
              <Table
                dataSource={order.payments || []}
                columns={paymentColumns}
                rowKey="id"
                pagination={false}
              />
            </Card>

            {/* Refunds Section */}
            {order.refunds && order.refunds.length > 0 && (
              <Card title="Khoản hoàn tiền phát sinh (Refunds)" bordered={false} style={{ marginBottom: 24 }}>
                <Table
                  dataSource={order.refunds}
                  columns={refundColumns}
                  rowKey="id"
                  pagination={false}
                />
              </Card>
            )}

            {/* Status History Timeline */}
            <Card title="Lịch sử chuyển đổi trạng thái đơn hàng" bordered={false}>
              <Timeline style={{ marginTop: 16 }}>
                {order.statusHistory?.map((hist) => (
                  <Timeline.Item key={hist.id}>
                    <div>
                      <Space>
                        <StatusBadge type="order" status={hist.toStatus} />
                        <Text type="secondary">{formatDateTime(hist.createdAt)}</Text>
                        <Text>bởi {hist.performedByName || "Hệ thống"}</Text>
                      </Space>
                      {hist.note && (
                        <div style={{ marginTop: 4, color: "#595959" }}>{hist.note}</div>
                      )}
                    </div>
                  </Timeline.Item>
                ))}
              </Timeline>
            </Card>
          </>
        )}
      </ApiStateWrapper>

      {/* Modal Cancel Order */}
      <Modal
        title="Xác nhận hủy đơn hàng"
        open={cancelModalOpen}
        onCancel={() => setCancelModalOpen(false)}
        onOk={() => cancelOrderMutation.mutate()}
        confirmLoading={cancelOrderMutation.isPending}
        okText="Hủy đơn hàng"
        cancelText="Đóng"
        okButtonProps={{ danger: true }}
      >
        <p>Nếu đơn hàng đã được xác nhận xuất kho, thao tác hủy sẽ hoàn trả tồn kho về trạng thái ban đầu.</p>
        <Form layout="vertical">
          <Form.Item label="Lý do hủy đơn hàng" required>
            <Input.TextArea
              rows={3}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Khách đổi ý, hết hàng dự trữ, trùng đơn..."
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal Record Payment */}
      <Modal
        title="Ghi nhận lượt thanh toán đơn hàng"
        open={paymentModalOpen}
        onCancel={() => setPaymentModalOpen(false)}
        onOk={() => paymentForm.submit()}
        confirmLoading={createPaymentMutation.isPending}
        okText="Tạo bản ghi thanh toán"
        cancelText="Hủy"
        okButtonProps={{ style: { backgroundColor: "#c05c74", borderColor: "#c05c74" } }}
      >
        <Form
          form={paymentForm}
          layout="vertical"
          onFinish={(vals: { method: PaymentMethod; amount: string; reference?: string; note?: string }) => {
            createPaymentMutation.mutate({
              method: vals.method,
              amount: String(vals.amount),
              reference: vals.reference,
              note: vals.note,
            });
          }}
        >
          <Form.Item name="method" label="Phương thức thanh toán" rules={[{ required: true }]}>
            <Select
              options={[
                { value: "COD", label: "Tiền mặt khi nhận hàng (COD)" },
                { value: "BANK_TRANSFER", label: "Chuyển khoản ngân hàng" },
              ]}
            />
          </Form.Item>

          <Form.Item name="amount" label="Số tiền thanh toán (VND)" rules={[{ required: true }]}>
            <Input addonAfter="₫" />
          </Form.Item>

          <Form.Item name="reference" label="Mã giao dịch ngân hàng / Đối soát">
            <Input placeholder="FT12345678, Mã UNC..." />
          </Form.Item>

          <Form.Item name="note" label="Ghi chú thanh toán">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal Fail Payment/Refund */}
      <Modal
        title={failTarget?.type === "payment" ? "Đánh dấu thanh toán thất bại" : "Đánh dấu hoàn tiền thất bại"}
        open={failModalOpen}
        onCancel={() => setFailModalOpen(false)}
        onOk={() => {
          if (!failTarget) return;
          if (failTarget.type === "payment") {
            failPaymentMutation.mutate({ paymentId: failTarget.id, note: failNote });
          } else {
            failRefundMutation.mutate({ refundId: failTarget.id, note: failNote });
          }
        }}
        confirmLoading={failPaymentMutation.isPending || failRefundMutation.isPending}
        okText="Xác nhận thất bại"
        cancelText="Hủy"
        okButtonProps={{ danger: true }}
      >
        <Form layout="vertical">
          <Form.Item label="Lý do thất bại" required>
            <Input.TextArea
              rows={2}
              value={failNote}
              onChange={(e) => setFailNote(e.target.value)}
              placeholder="Khách không chuyển khoản, tài khoản nhận tiền sai..."
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal Create Invoice */}
      <Modal
        title="Lập hóa đơn bán lẻ từ đơn hàng"
        open={invoiceModalOpen}
        onCancel={() => setInvoiceModalOpen(false)}
        onOk={() => createInvoiceMutation.mutate()}
        confirmLoading={createInvoiceMutation.isPending}
        okText="Tạo bản nháp hóa đơn"
        cancelText="Hủy"
        okButtonProps={{ style: { backgroundColor: "#c05c74", borderColor: "#c05c74" } }}
      >
        <p>Hóa đơn sẽ được lập từ các dòng hàng với đơn giá gốc đã chốt của đơn hàng hoàn tất.</p>
        <Form layout="vertical">
          <Form.Item label="Ghi chú trên hóa đơn (tùy chọn)">
            <Input.TextArea
              rows={2}
              value={invoiceNote}
              onChange={(e) => setInvoiceNote(e.target.value)}
              placeholder="Hóa đơn GTGT, xuất theo yêu cầu khách hàng..."
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
