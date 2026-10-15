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
  DeleteOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../api";
import { ApiStateWrapper } from "../../components/common/ApiStateWrapper";
import { StatusBadge } from "../../components/common/StatusBadge";
import { PermissionGuard } from "../../components/common/PermissionGuard";
import { formatDateTime, generateUUID } from "../../utils/format";
import { ApiClientError } from "@halora/api-client";
import type { InventoryAdjustmentItem } from "@halora/api-client";

const { Title, Text } = Typography;

export const InventoryAdjustmentDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [postModalOpen, setPostModalOpen] = useState(false);
  const [postNote, setPostNote] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState<string>(generateUUID());

  // Fetch Adjustment Detail
  const {
    data: adjustment,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["admin", "inventory-adjustments", id],
    queryFn: () => apiClient.inventory.getAdjustment(id!),
    enabled: !!id,
  });

  // Post Mutation
  const postMutation = useMutation({
    mutationFn: () =>
      apiClient.inventory.postAdjustment(
        id!,
        { version: adjustment!.version, note: postNote || undefined },
        idempotencyKey
      ),
    onSuccess: () => {
      message.success("Ghi nhận điều chỉnh kho thành công! Đã cập nhật số dư tồn kho.");
      setPostModalOpen(false);
      setIdempotencyKey(generateUUID());
      queryClient.invalidateQueries({ queryKey: ["admin", "inventory-adjustments", id] });
      queryClient.invalidateQueries({ queryKey: ["admin", "inventory"] });
    },
    onError: (err: unknown) => {
      if (err instanceof ApiClientError) {
        if (err.code === "VERSION_CONFLICT") {
          message.error("Phiếu đã bị thay đổi bởi người khác. Vui lòng tải lại.");
        } else if (err.code === "IDEMPOTENCY_CONFLICT") {
          message.warning("Yêu cầu này đang được xử lý.");
        } else {
          message.error(err.message || `Lỗi: ${err.code}`);
        }
      } else {
        message.error("Lỗi khi ghi nhận điều chỉnh.");
      }
    },
  });

  // Delete Draft Mutation
  const deleteMutation = useMutation({
    mutationFn: () => apiClient.inventory.deleteAdjustment(id!),
    onSuccess: () => {
      message.success("Đã xóa bản nháp phiếu điều chỉnh!");
      navigate("/inventory-adjustments");
    },
    onError: (err: unknown) => {
      if (err instanceof ApiClientError) {
        message.error(err.message || "Không thể xóa chứng từ.");
      } else {
        message.error("Lỗi khi xóa bản nháp.");
      }
    },
  });

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
      render: (name: string, r: InventoryAdjustmentItem) => (
        <div>
          <Text strong>{name}</Text>
          <div style={{ fontSize: 12, color: "#8c8c8c" }}>{r.variantName}</div>
        </div>
      ),
    },
    {
      title: "Số lượng chênh lệch",
      dataIndex: "quantityDelta",
      key: "quantityDelta",
      render: (delta: number) => (
        <Text strong style={{ color: delta > 0 ? "#52c41a" : "#f5222d", fontSize: 15 }}>
          {delta > 0 ? `+${delta}` : delta}
        </Text>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/inventory-adjustments")}>
            Danh sách phiếu điều chỉnh
          </Button>
          <Title level={4} style={{ margin: 0 }}>
            Phiếu điều chỉnh: {adjustment?.adjustmentCode || "Đang tải..."}
          </Title>
        </div>

        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
            Làm mới
          </Button>

          {adjustment?.status === "DRAFT" && (
            <>
              <PermissionGuard permission="inventoryAdjustments.delete">
                <Popconfirm
                  title="Xóa bản nháp phiếu điều chỉnh"
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

              <PermissionGuard permission="inventoryAdjustments.post">
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  onClick={() => {
                    setPostNote("");
                    setPostModalOpen(true);
                  }}
                  style={{ backgroundColor: "#52c41a", borderColor: "#52c41a" }}
                >
                  Ghi nhận điều chỉnh kho (POST)
                </Button>
              </PermissionGuard>
            </>
          )}
        </Space>
      </div>

      <ApiStateWrapper isLoading={isLoading} isError={isError} error={error} onRetry={() => refetch()}>
        {adjustment && (
          <>
            <Card bordered={false} style={{ marginBottom: 24, background: "#fafafa" }}>
              <Descriptions title="Thông tin phiếu điều chỉnh" bordered size="small" column={{ xs: 1, sm: 2, md: 3 }}>
                <Descriptions.Item label="Mã phiếu điều chỉnh">
                  <code>{adjustment.adjustmentCode}</code>
                </Descriptions.Item>
                <Descriptions.Item label="Trạng thái">
                  <StatusBadge type="document" status={adjustment.status} />
                </Descriptions.Item>
                <Descriptions.Item label="Người lập phiếu">
                  {adjustment.employeeName}
                </Descriptions.Item>
                <Descriptions.Item label="Lý do điều chỉnh" span={2}>
                  <Text strong>{adjustment.reason}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Thời điểm ghi nhận">
                  {formatDateTime(adjustment.postedAt)}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Card title={`Danh sách mặt hàng điều chỉnh số lượng (${adjustment.items?.length || 0})`} bordered={false}>
              <Table
                dataSource={adjustment.items || []}
                columns={columns}
                rowKey="id"
                pagination={false}
              />
            </Card>
          </>
        )}
      </ApiStateWrapper>

      {/* Modal Post Adjustment */}
      <Modal
        title="Xác nhận ghi nhận phiếu điều chỉnh kho"
        open={postModalOpen}
        onCancel={() => setPostModalOpen(false)}
        onOk={() => postMutation.mutate()}
        confirmLoading={postMutation.isPending}
        okText="Ghi nhận & Cập nhật tồn kho"
        cancelText="Hủy"
        okButtonProps={{ style: { backgroundColor: "#52c41a", borderColor: "#52c41a" } }}
      >
        <p>
          Hệ thống sẽ cập nhật số dư tồn kho theo các mức chênh lệch (+ / -) đã nhập và chuyển trạng thái phiếu sang <Tag color="green">ĐÃ GHI NHẬN</Tag>.
        </p>

        <Form layout="vertical">
          <Form.Item label="Ghi chú ghi nhận (tùy chọn)">
            <Input.TextArea
              rows={2}
              value={postNote}
              onChange={(e) => setPostNote(e.target.value)}
              placeholder="Ghi chú biên bản kiểm kê..."
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
