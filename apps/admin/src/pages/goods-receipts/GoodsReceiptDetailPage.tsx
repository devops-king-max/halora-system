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
  Input,
  Form,
} from "antd";
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  FilePdfOutlined,
  DeleteOutlined,
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
import type { GoodsReceiptItem } from "@halora/api-client";

const { Title, Text } = Typography;

export const GoodsReceiptDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [postModalOpen, setPostModalOpen] = useState(false);
  const [postNote, setPostNote] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState<string>(generateUUID());
  const [exportingPdf, setExportingPdf] = useState(false);

  // Fetch Goods Receipt Detail
  const {
    data: receipt,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["admin", "goods-receipts", id],
    queryFn: () => apiClient.goodsReceipts.getAdmin(id!),
    enabled: !!id,
  });

  // Post Goods Receipt Mutation
  const postMutation = useMutation({
    mutationFn: () =>
      apiClient.goodsReceipts.post(
        id!,
        { version: receipt!.version, note: postNote || undefined },
        idempotencyKey
      ),
    onSuccess: () => {
      message.success("Ghi nhận phiếu nhập hàng thành công! Đã cập nhật số dư tồn kho.");
      setPostModalOpen(false);
      setIdempotencyKey(generateUUID());
      queryClient.invalidateQueries({ queryKey: ["admin", "goods-receipts", id] });
      queryClient.invalidateQueries({ queryKey: ["admin", "inventory"] });
    },
    onError: (err: unknown) => {
      if (err instanceof ApiClientError) {
        if (err.code === "VERSION_CONFLICT") {
          message.error("Phiếu nhập đã bị thay đổi bởi người khác. Vui lòng tải lại.");
        } else if (err.code === "IDEMPOTENCY_CONFLICT") {
          message.warning("Yêu cầu này đang được xử lý hoặc đã hoàn tất.");
        } else {
          message.error(err.message || `Lỗi: ${err.code}`);
        }
      } else {
        message.error("Lỗi khi ghi nhận phiếu nhập.");
      }
    },
  });

  // Delete Draft Mutation
  const deleteMutation = useMutation({
    mutationFn: () => apiClient.goodsReceipts.deleteAdmin(id!),
    onSuccess: () => {
      message.success("Đã xóa bản nháp phiếu nhập!");
      navigate("/goods-receipts");
    },
    onError: (err: unknown) => {
      if (err instanceof ApiClientError) {
        message.error(err.message || "Không thể xóa chứng từ.");
      } else {
        message.error("Lỗi khi xóa bản nháp.");
      }
    },
  });

  // Export PDF
  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      const blob = await apiClient.goodsReceipts.exportPdf(id!);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Phieu-nhap-${receipt?.receiptCode || id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      message.success("Xuất tệp PDF phiếu nhập thành công!");
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        message.error(err.message || "Không thể xuất tệp PDF.");
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
      title: "Tên mặt hàng sản phẩm",
      dataIndex: "productName",
      key: "productName",
      render: (name: string, r: GoodsReceiptItem) => (
        <div>
          <Text strong>{name}</Text>
          <div style={{ fontSize: 12, color: "#8c8c8c" }}>{r.variantName}</div>
        </div>
      ),
    },
    {
      title: "Số lượng nhập",
      dataIndex: "quantity",
      key: "quantity",
      render: (q: number) => <Text strong>{q}</Text>,
    },
    {
      title: "Giá vốn nhập",
      dataIndex: "unitCost",
      key: "unitCost",
      render: (cost: string) => formatVnd(cost),
    },
    {
      title: "Thành tiền",
      dataIndex: "lineTotal",
      key: "lineTotal",
      render: (total: string) => <Text strong style={{ color: "#c05c74" }}>{formatVnd(total)}</Text>,
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/goods-receipts")}>
            Danh sách phiếu nhập
          </Button>
          <Title level={4} style={{ margin: 0 }}>
            Phiếu nhập: {receipt?.receiptCode || "Đang tải..."}
          </Title>
        </div>

        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
            Làm mới
          </Button>

          <PermissionGuard permission="goodsReceipts.export">
            <Button
              icon={<FilePdfOutlined />}
              loading={exportingPdf}
              onClick={handleExportPdf}
            >
              Xuất PDF
            </Button>
          </PermissionGuard>

          {receipt?.status === "DRAFT" && (
            <>
              <PermissionGuard permission="goodsReceipts.delete">
                <Popconfirm
                  title="Xóa bản nháp phiếu nhập"
                  description="Bạn có chắc chắn muốn xóa bản nháp này?"
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

              <PermissionGuard permission="goodsReceipts.post">
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  onClick={() => {
                    setPostNote("");
                    setPostModalOpen(true);
                  }}
                  style={{ backgroundColor: "#52c41a", borderColor: "#52c41a" }}
                >
                  Ghi nhận nhập kho (POST)
                </Button>
              </PermissionGuard>
            </>
          )}
        </Space>
      </div>

      <ApiStateWrapper isLoading={isLoading} isError={isError} error={error} onRetry={() => refetch()}>
        {receipt && (
          <>
            <Card bordered={false} style={{ marginBottom: 24, background: "#fafafa" }}>
              <Descriptions title="Thông tin chứng từ" bordered size="small" column={{ xs: 1, sm: 2, md: 3 }}>
                <Descriptions.Item label="Mã phiếu nhập">
                  <code>{receipt.receiptCode}</code>
                </Descriptions.Item>
                <Descriptions.Item label="Trạng thái">
                  <StatusBadge type="document" status={receipt.status} />
                </Descriptions.Item>
                <Descriptions.Item label="Tổng tiền hàng nhập">
                  <Text strong style={{ fontSize: 16, color: "#c05c74" }}>
                    {formatVnd(receipt.totalAmount)}
                  </Text>
                </Descriptions.Item>
                <Descriptions.Item label="Nhà cung cấp">
                  <Text strong>{receipt.supplierName}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Người lập phiếu">
                  {receipt.employeeName}
                </Descriptions.Item>
                <Descriptions.Item label="Thời điểm nhập hàng">
                  {formatDateTime(receipt.receivedAt)}
                </Descriptions.Item>
                <Descriptions.Item label="Ghi chú" span={3}>
                  {receipt.note || "—"}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Card title={`Dòng hàng nhập kho (${receipt.items?.length || 0})`} bordered={false}>
              <Table
                dataSource={receipt.items || []}
                columns={columns}
                rowKey="id"
                pagination={false}
              />
            </Card>
          </>
        )}
      </ApiStateWrapper>

      {/* Modal Post Goods Receipt Confirmation */}
      <Modal
        title="Xác nhận ghi nhận phiếu nhập hàng"
        open={postModalOpen}
        onCancel={() => setPostModalOpen(false)}
        onOk={() => postMutation.mutate()}
        confirmLoading={postMutation.isPending}
        okText="Ghi nhận & Tăng tồn kho"
        cancelText="Hủy"
        okButtonProps={{ style: { backgroundColor: "#52c41a", borderColor: "#52c41a" } }}
      >
        <p>
          Hệ thống sẽ chuyển trạng thái phiếu sang <Tag color="green">ĐÃ GHI NHẬN</Tag> và cộng trực tiếp số lượng từng mặt hàng vào kho.
        </p>
        <p>
          Đồng thời, giá vốn báo giá của nhà cung cấp và giá vốn chính thức của biến thể được cập nhật theo đơn giá đã chốt trên phiếu.
        </p>
        <p style={{ color: "#fa8c16", fontSize: 13 }}>
          * Thao tác này không thể hoàn tác sau khi đã ghi nhận.
        </p>

        <Form layout="vertical">
          <Form.Item label="Ghi chú ghi nhận (tùy chọn)">
            <Input.TextArea
              rows={2}
              value={postNote}
              onChange={(e) => setPostNote(e.target.value)}
              placeholder="Ghi chú bổ sung khi duyệt nhập kho..."
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
