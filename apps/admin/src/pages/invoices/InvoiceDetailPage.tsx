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
  Alert,
} from "antd";
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  FilePdfOutlined,
  DeleteOutlined,
  EditOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../api";
import { ApiStateWrapper } from "../../components/common/ApiStateWrapper";
import { StatusBadge } from "../../components/common/StatusBadge";
import { PermissionGuard } from "../../components/common/PermissionGuard";
import { formatVnd, formatDateTime, generateUUID } from "../../utils/format";
import { ApiClientError } from "@halora/api-client";
import type { InvoiceItem } from "@halora/api-client";

const { Title, Text } = Typography;

export const InvoiceDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editNote, setEditNote] = useState("");

  const [postModalOpen, setPostModalOpen] = useState(false);
  const [postNote, setPostNote] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState<string>(generateUUID());
  const [exportingPdf, setExportingPdf] = useState(false);

  // Fetch Invoice Detail
  const {
    data: invoice,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["admin", "invoices", id],
    queryFn: () => apiClient.invoices.getAdmin(id!),
    enabled: !!id,
  });

  // Edit Note Mutation
  const updateMutation = useMutation({
    mutationFn: () =>
      apiClient.invoices.updateAdmin(id!, { note: editNote, version: invoice!.version }),
    onSuccess: () => {
      message.success("Cập nhật ghi chú hóa đơn thành công!");
      setEditModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin", "invoices", id] });
    },
    onError: (err: unknown) => {
      if (err instanceof ApiClientError) {
        if (err.code === "VERSION_CONFLICT") {
          message.error("Hóa đơn đã bị sửa đổi bởi người khác. Vui lòng tải lại.");
        } else {
          message.error(err.message || `Lỗi: ${err.code}`);
        }
      } else {
        message.error("Lỗi khi cập nhật.");
      }
    },
  });

  // Refresh Items Mutation
  const refreshItemsMutation = useMutation({
    mutationFn: () =>
      apiClient.invoices.refreshItems(id!, { version: invoice!.version }),
    onSuccess: () => {
      message.success("Đã đồng bộ lại danh sách mặt hàng từ đơn hàng hoàn tất!");
      queryClient.invalidateQueries({ queryKey: ["admin", "invoices", id] });
    },
    onError: (err: unknown) => {
      if (err instanceof ApiClientError) message.error(err.message);
    },
  });

  // Post Invoice Mutation
  const postMutation = useMutation({
    mutationFn: () =>
      apiClient.invoices.post(
        id!,
        { version: invoice!.version, note: postNote || undefined },
        idempotencyKey
      ),
    onSuccess: () => {
      message.success("Ghi nhận phát hành hóa đơn thành công! (Không tác động kho)");
      setPostModalOpen(false);
      setIdempotencyKey(generateUUID());
      queryClient.invalidateQueries({ queryKey: ["admin", "invoices", id] });
    },
    onError: (err: unknown) => {
      if (err instanceof ApiClientError) {
        if (err.code === "VERSION_CONFLICT") {
          message.error("Hóa đơn đã bị sửa đổi bởi người khác. Vui lòng tải lại.");
        } else if (err.code === "IDEMPOTENCY_CONFLICT") {
          message.warning("Yêu cầu này đang được xử lý.");
        } else {
          message.error(err.message || `Lỗi: ${err.code}`);
        }
      } else {
        message.error("Lỗi khi phát hành hóa đơn.");
      }
    },
  });

  // Delete Draft Mutation
  const deleteMutation = useMutation({
    mutationFn: () => apiClient.invoices.deleteAdmin(id!),
    onSuccess: () => {
      message.success("Đã xóa bản nháp hóa đơn!");
      navigate("/invoices");
    },
    onError: (err: unknown) => {
      if (err instanceof ApiClientError) message.error(err.message || "Không thể xóa chứng từ.");
    },
  });

  // Export PDF
  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      const blob = await apiClient.invoices.exportPdf(id!);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Hoa-don-${invoice?.invoiceCode || id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      message.success("Xuất tệp PDF hóa đơn thành công!");
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        message.error(err.message || "Không thể tải tệp PDF.");
      } else {
        message.error("Lỗi khi tải tệp PDF.");
      }
    } finally {
      setExportingPdf(false);
    }
  };

  const columns = [
    {
      title: "SKU",
      dataIndex: "sku",
      key: "sku",
      render: (sku: string) => <code>{sku}</code>,
    },
    {
      title: "Tên mặt hàng",
      dataIndex: "productName",
      key: "productName",
      render: (name: string, r: InvoiceItem) => (
        <div>
          <Text strong>{name}</Text>
          <div style={{ fontSize: 12, color: "#8c8c8c" }}>{r.variantName}</div>
        </div>
      ),
    },
    {
      title: "Số lượng",
      dataIndex: "quantity",
      key: "quantity",
      render: (q: number) => <Text strong>{q}</Text>,
    },
    {
      title: "Đơn giá gốc đã chốt",
      dataIndex: "unitPrice",
      key: "unitPrice",
      render: (p: string) => formatVnd(p),
    },
    {
      title: "Thành tiền",
      dataIndex: "lineTotal",
      key: "lineTotal",
      render: (t: string) => <Text strong style={{ color: "#c05c74" }}>{formatVnd(t)}</Text>,
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/invoices")}>
            Danh sách hóa đơn
          </Button>
          <Title level={4} style={{ margin: 0 }}>
            Hóa đơn: {invoice?.invoiceCode || "Đang tải..."}
          </Title>
        </div>

        <Space wrap>
          <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
            Làm mới
          </Button>

          <PermissionGuard permission="invoices.export">
            <Button icon={<FilePdfOutlined />} loading={exportingPdf} onClick={handleExportPdf}>
              Xuất PDF
            </Button>
          </PermissionGuard>

          {invoice?.status === "DRAFT" && (
            <>
              <PermissionGuard permission="invoices.update">
                <Button
                  icon={<SyncOutlined />}
                  onClick={() => refreshItemsMutation.mutate()}
                  loading={refreshItemsMutation.isPending}
                >
                  Làm mới dòng từ đơn hàng
                </Button>
                <Button
                  icon={<EditOutlined />}
                  onClick={() => {
                    setEditNote(invoice.note || "");
                    setEditModalOpen(true);
                  }}
                >
                  Sửa ghi chú
                </Button>
              </PermissionGuard>

              <PermissionGuard permission="invoices.delete">
                <Popconfirm
                  title="Xóa bản nháp hóa đơn"
                  description="Bạn có chắc chắn muốn xóa bản nháp hóa đơn này?"
                  okText="Xóa"
                  cancelText="Hủy"
                  okButtonProps={{ danger: true }}
                  onConfirm={() => deleteMutation.mutate()}
                >
                  <Button danger icon={<DeleteOutlined />}>
                    Xóa bản nháp
                  </Button>
                </Popconfirm>
              </PermissionGuard>

              <PermissionGuard permission="invoices.post">
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  onClick={() => {
                    setPostNote("");
                    setPostModalOpen(true);
                  }}
                  style={{ backgroundColor: "#52c41a", borderColor: "#52c41a" }}
                >
                  Ghi nhận phát hành (POST)
                </Button>
              </PermissionGuard>
            </>
          )}
        </Space>
      </div>

      <ApiStateWrapper isLoading={isLoading} isError={isError} error={error} onRetry={() => refetch()}>
        {invoice && (
          <>
            <Alert
              message="Nguyên tắc tính tiền hóa đơn"
              description="Tổng tiền hóa đơn được tính bằng tổng (số lượng × đơn giá gốc đã chốt của từng dòng hàng). Chiết khấu cấp đơn, voucher và phí giao hàng được quản lý độc lập tại đơn hàng liên kết. Lập hóa đơn không làm thay đổi tồn kho."
              type="info"
              showIcon
              style={{ marginBottom: 20 }}
            />

            <Card bordered={false} style={{ marginBottom: 24, background: "#fafafa" }}>
              <Descriptions title="Chi tiết hóa đơn" bordered size="small" column={{ xs: 1, sm: 2, md: 3 }}>
                <Descriptions.Item label="Mã hóa đơn">
                  <code>{invoice.invoiceCode}</code>
                </Descriptions.Item>
                <Descriptions.Item label="Đơn hàng liên kết">
                  <a onClick={() => navigate(`/orders/${invoice.orderId}`)}>
                    <code>{invoice.orderCode}</code>
                  </a>
                </Descriptions.Item>
                <Descriptions.Item label="Trạng thái">
                  <StatusBadge type="document" status={invoice.status} />
                </Descriptions.Item>
                <Descriptions.Item label="Tổng tiền hàng hóa đơn">
                  <Text strong style={{ fontSize: 16, color: "#c05c74" }}>
                    {formatVnd(invoice.totalAmount)}
                  </Text>
                </Descriptions.Item>
                <Descriptions.Item label="Người lập hóa đơn">
                  {invoice.employeeName}
                </Descriptions.Item>
                <Descriptions.Item label="Ngày phát hành">
                  {formatDateTime(invoice.issuedAt)}
                </Descriptions.Item>
                <Descriptions.Item label="Ghi chú hóa đơn" span={3}>
                  {invoice.note || "—"}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Card title={`Dòng hàng hóa đơn (${invoice.items?.length || 0})`} bordered={false}>
              <Table
                dataSource={invoice.items || []}
                columns={columns}
                rowKey="id"
                pagination={false}
              />
            </Card>
          </>
        )}
      </ApiStateWrapper>

      {/* Modal Edit Note */}
      <Modal
        title="Chỉnh sửa ghi chú hóa đơn"
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        onOk={() => updateMutation.mutate()}
        confirmLoading={updateMutation.isPending}
        okText="Lưu ghi chú"
        cancelText="Hủy"
      >
        <Form layout="vertical">
          <Form.Item label="Ghi chú hóa đơn">
            <Input.TextArea
              rows={3}
              value={editNote}
              onChange={(e) => setEditNote(e.target.value)}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal Post Invoice */}
      <Modal
        title="Xác nhận ghi nhận phát hành hóa đơn"
        open={postModalOpen}
        onCancel={() => setPostModalOpen(false)}
        onOk={() => postMutation.mutate()}
        confirmLoading={postMutation.isPending}
        okText="Ghi nhận (POST)"
        cancelText="Hủy"
        okButtonProps={{ style: { backgroundColor: "#52c41a", borderColor: "#52c41a" } }}
      >
        <p>Hóa đơn sau khi ghi nhận sẽ chuyển sang trạng thái <Tag color="green">ĐÃ GHI NHẬN</Tag> và không thể chỉnh sửa hoặc xóa.</p>
        <Form layout="vertical">
          <Form.Item label="Ghi chú phát hành (tùy chọn)">
            <Input.TextArea
              rows={2}
              value={postNote}
              onChange={(e) => setPostNote(e.target.value)}
              placeholder="Ghi chú bổ sung..."
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
