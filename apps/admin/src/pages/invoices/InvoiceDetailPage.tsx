import React, { useState } from "react";
import {
  Typography,
  Button,
  Table,
  Card,
  Space,
  Tag,
  Popconfirm,
  message,
  Modal,
} from "antd";
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  FilePdfOutlined,
  DeleteOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../api";
import { ApiStateWrapper } from "../../components/common/ApiStateWrapper";
import { PermissionGuard } from "../../components/common/PermissionGuard";
import { formatVnd, generateUUID } from "../../utils/format";
import { ApiClientError } from "@halora/api-client";
import type { InvoiceItem } from "@halora/api-client";

const { Title, Text } = Typography;

export const InvoiceDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [postModalOpen, setPostModalOpen] = useState(false);
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
      apiClient.invoices.post(id!, { version: invoice!.version }, idempotencyKey),
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
      title: "Tên mặt hàng",
      dataIndex: "productName",
      key: "productName",
      render: (name: string, r: InvoiceItem) => (
        <div>
          <Text strong>{name}</Text>
          {r.variantName ? (
            <div style={{ fontSize: 12, color: "#8c8c8c" }}>{r.variantName}</div>
          ) : null}
        </div>
      ),
    },
    {
      title: "Số lượng",
      dataIndex: "quantity",
      key: "quantity",
      width: 120,
      align: "right" as const,
      render: (q: number) => <Text strong>{q}</Text>,
    },
    {
      title: "Đơn giá",
      dataIndex: "unitPrice",
      key: "unitPrice",
      width: 180,
      align: "right" as const,
      render: (p: string) => formatVnd(p),
    },
    {
      title: "Thành tiền",
      dataIndex: "lineTotal",
      key: "lineTotal",
      width: 180,
      align: "right" as const,
      render: (t: string) => (
        <Text strong style={{ color: "#c05c74" }}>
          {formatVnd(t)}
        </Text>
      ),
    },
  ];

  return (
    <div>
      <div
        style={{
          marginBottom: 20,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/invoices")}>
            Danh sách hóa đơn
          </Button>
          <div>
            <Title level={4} style={{ margin: 0 }}>
              Hóa đơn: {invoice?.invoiceCode || "Đang tải..."}
            </Title>
            {invoice && (
              <Text type="secondary">
                Đơn hàng:{" "}
                <a onClick={() => navigate(`/orders/${invoice.orderId}`)}>
                  <code>{invoice.orderCode}</code>
                </a>
              </Text>
            )}
          </div>
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
                  onClick={() => setPostModalOpen(true)}
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
          <Card title="Sản phẩm trong hóa đơn" bordered={false}>
            <Table
              dataSource={invoice.items || []}
              columns={columns}
              rowKey="id"
              pagination={false}
              locale={{ emptyText: "Hóa đơn chưa có dòng hàng" }}
              summary={() => (
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={3} align="right">
                    <Text strong>Tổng cộng</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="right">
                    <Text strong style={{ fontSize: 16, color: "#c05c74" }}>
                      {formatVnd(
                        (invoice.items || []).reduce(
                          (sum, item) => sum + BigInt(item.lineTotal),
                          0n
                        )
                      )}
                    </Text>
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              )}
            />
          </Card>
        )}
      </ApiStateWrapper>

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
      </Modal>
    </div>
  );
};
