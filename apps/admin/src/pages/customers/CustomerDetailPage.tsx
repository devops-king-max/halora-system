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
  Select,
  Tag,
  Popconfirm,
  message,
  Tooltip,
} from "antd";
import {
  ArrowLeftOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  EnvironmentOutlined,
  ShoppingCartOutlined,
} from "@ant-design/icons";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../api";
import { ApiStateWrapper } from "../../components/common/ApiStateWrapper";
import { StatusBadge } from "../../components/common/StatusBadge";
import { PermissionGuard } from "../../components/common/PermissionGuard";
import { formatVnd, formatDateTime } from "../../utils/format";
import { ApiClientError } from "@halora/api-client";
import type { Customer, CustomerAddress, OrderSummary } from "@halora/api-client";

const { Title, Text } = Typography;

export const CustomerDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [form] = Form.useForm();

  // 1. Fetch Customer detail
  const {
    data: customer,
    isLoading: customerLoading,
    isError: customerError,
    error: cError,
    refetch: refetchCustomer,
  } = useQuery({
    queryKey: ["admin", "customers", id],
    queryFn: () => apiClient.customers.getAdmin(id!),
    enabled: !!id,
  });

  // 2. Fetch Addresses
  const {
    data: addresses,
    isLoading: addressesLoading,
    refetch: refetchAddresses,
  } = useQuery({
    queryKey: ["admin", "customers", id, "addresses"],
    queryFn: () => apiClient.customers.listAddressesAdmin(id!),
    enabled: !!id,
  });

  // 3. Fetch Orders History
  const {
    data: ordersData,
    isLoading: ordersLoading,
    refetch: refetchOrders,
  } = useQuery({
    queryKey: ["admin", "customers", id, "orders"],
    queryFn: () => apiClient.customers.listOrdersAdmin(id!),
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: (values: { fullName?: string; phone?: string; status?: string }) =>
      apiClient.customers.updateAdmin(id!, {
        ...values,
        version: customer!.version,
      }),
    onSuccess: () => {
      message.success("Cập nhật thông tin khách hàng thành công!");
      setEditModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin", "customers", id] });
    },
    onError: (err: unknown) => {
      if (err instanceof ApiClientError) {
        if (err.code === "VERSION_CONFLICT") {
          message.error("Dữ liệu khách hàng đã bị thay đổi bởi người khác. Vui lòng tải lại.");
        } else {
          message.error(err.message || `Lỗi: ${err.code}`);
        }
      } else {
        message.error("Lỗi khi cập nhật khách hàng.");
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiClient.customers.deleteAdmin(id!),
    onSuccess: () => {
      message.success("Đã xóa khách hàng!");
      navigate("/customers");
    },
    onError: (err: unknown) => {
      if (err instanceof ApiClientError) {
        if (err.code === "RESOURCE_IN_USE" || err.status === 409) {
          message.warning("Khách hàng đã phát sinh đơn hàng hoặc giao dịch trong hệ thống, không được phép xóa.");
        } else {
          message.error(err.message || `Lỗi: ${err.code}`);
        }
      } else {
        message.error("Lỗi khi xóa khách hàng.");
      }
    },
  });

  const openEditModal = () => {
    if (!customer) return;
    form.setFieldsValue({
      fullName: customer.fullName,
      phone: customer.phone,
      status: customer.status,
    });
    setEditModalOpen(true);
  };

  const addressColumns = [
    {
      title: "Người nhận",
      dataIndex: "recipientName",
      key: "recipientName",
      render: (name: string, record: CustomerAddress) => (
        <div>
          <Text strong>{name}</Text>
          {record.isDefault && (
            <Tag color="cyan" style={{ marginLeft: 8 }}>
              Mặc định
            </Tag>
          )}
        </div>
      ),
    },
    {
      title: "Số điện thoại",
      dataIndex: "recipientPhone",
      key: "recipientPhone",
    },
    {
      title: "Địa chỉ chi tiết",
      dataIndex: "addressLine",
      key: "addressLine",
    },
    {
      title: "Phường / Xã",
      dataIndex: "wardName",
      key: "wardName",
    },
    {
      title: "Tỉnh / Thành phố",
      dataIndex: "provinceName",
      key: "provinceName",
    },
  ];

  const orderColumns = [
    {
      title: "Mã đơn hàng",
      dataIndex: "orderCode",
      key: "orderCode",
      render: (code: string, r: OrderSummary) => (
        <a onClick={() => navigate(`/orders/${r.id}`)}>
          <code>{code}</code>
        </a>
      ),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      render: (st: string) => <StatusBadge type="order" status={st} />,
    },
    {
      title: "Phương thức thanh toán",
      dataIndex: "paymentMethod",
      key: "paymentMethod",
      render: (m: string) => (m === "COD" ? "Thanh toán khi nhận hàng (COD)" : "Chuyển khoản ngân hàng"),
    },
    {
      title: "Tổng tiền",
      dataIndex: "totalAmount",
      key: "totalAmount",
      render: (t: string) => <Text strong style={{ color: "#c05c74" }}>{formatVnd(t)}</Text>,
    },
    {
      title: "Ngày đặt",
      dataIndex: "createdAt",
      key: "createdAt",
      render: (d: string) => formatDateTime(d),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/customers")}>
            Danh sách khách hàng
          </Button>
          <Title level={4} style={{ margin: 0 }}>
            Hồ sơ khách hàng: {customer?.fullName || "Đang tải..."}
          </Title>
        </div>

        <Space>
          <PermissionGuard permission="customers.update">
            <Button icon={<EditOutlined />} onClick={openEditModal}>
              Chỉnh sửa hồ sơ
            </Button>
          </PermissionGuard>
          <PermissionGuard permission="customers.delete">
            <Popconfirm
              title="Xóa khách hàng"
              description="Chỉ được phép xóa nếu khách hàng chưa có lịch sử mua hàng. Bạn có muốn tiếp tục?"
              okText="Xóa"
              cancelText="Hủy"
              okButtonProps={{ danger: true }}
              onConfirm={() => deleteMutation.mutate()}
            >
              <Button danger icon={<DeleteOutlined />}>
                Xóa khách hàng
              </Button>
            </Popconfirm>
          </PermissionGuard>
        </Space>
      </div>

      <ApiStateWrapper
        isLoading={customerLoading}
        isError={customerError}
        error={cError}
        onRetry={() => refetchCustomer()}
      >
        {customer && (
          <>
            <Card bordered={false} style={{ marginBottom: 24, background: "#fafafa" }}>
              <Descriptions title="Thông tin cơ bản" bordered size="small" column={{ xs: 1, sm: 2, md: 3 }}>
                <Descriptions.Item label="Mã khách hàng">
                  <code>{customer.code}</code>
                </Descriptions.Item>
                <Descriptions.Item label="Họ và tên">
                  <Text strong>{customer.fullName}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Số điện thoại">
                  {customer.phone}
                </Descriptions.Item>
                <Descriptions.Item label="Email">
                  {customer.email}
                </Descriptions.Item>
                <Descriptions.Item label="Trạng thái khách hàng">
                  <StatusBadge type="active" status={customer.status} />
                </Descriptions.Item>
                <Descriptions.Item label="Trạng thái tài khoản">
                  <StatusBadge type="account" status={customer.accountStatus} />
                </Descriptions.Item>
                <Descriptions.Item label="Ngày tạo hồ sơ">
                  {formatDateTime(customer.createdAt)}
                </Descriptions.Item>
                <Descriptions.Item label="Cập nhật lần cuối">
                  {formatDateTime(customer.updatedAt)}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Tabs
              defaultActiveKey="addresses"
              items={[
                {
                  key: "addresses",
                  label: (
                    <span>
                      <EnvironmentOutlined /> Sổ địa chỉ ({addresses?.length || 0})
                    </span>
                  ),
                  children: (
                    <Card
                      title="Danh sách địa chỉ giao hàng"
                      bordered={false}
                      extra={
                        <Button icon={<ReloadOutlined />} onClick={() => refetchAddresses()}>
                          Làm mới
                        </Button>
                      }
                    >
                      <Table
                        dataSource={addresses || []}
                        columns={addressColumns}
                        rowKey="id"
                        loading={addressesLoading}
                        pagination={false}
                      />
                    </Card>
                  ),
                },
                {
                  key: "orders",
                  label: (
                    <span>
                      <ShoppingCartOutlined /> Lịch sử đơn hàng ({ordersData?.meta?.total || 0})
                    </span>
                  ),
                  children: (
                    <Card
                      title="Đơn hàng đã đặt"
                      bordered={false}
                      extra={
                        <Button icon={<ReloadOutlined />} onClick={() => refetchOrders()}>
                          Làm mới
                        </Button>
                      }
                    >
                      <Table
                        dataSource={ordersData?.data || []}
                        columns={orderColumns}
                        rowKey="id"
                        loading={ordersLoading}
                        pagination={{
                          current: ordersData?.meta?.page,
                          pageSize: ordersData?.meta?.limit,
                          total: ordersData?.meta?.total,
                        }}
                      />
                    </Card>
                  ),
                },
              ]}
            />
          </>
        )}
      </ApiStateWrapper>

      <Modal
        title="Cập nhật hồ sơ khách hàng"
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={updateMutation.isPending}
        okText="Lưu thay đổi"
        cancelText="Hủy"
        okButtonProps={{ style: { backgroundColor: "#c05c74", borderColor: "#c05c74" } }}
      >
        <Form form={form} layout="vertical" onFinish={(vals) => updateMutation.mutate(vals)}>
          <Form.Item
            name="fullName"
            label="Họ và tên"
            rules={[{ required: true, message: "Vui lòng nhập họ tên" }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="phone"
            label="Số điện thoại"
            rules={[{ required: true, message: "Vui lòng nhập số điện thoại" }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="status"
            label="Trạng thái khách hàng"
            rules={[{ required: true, message: "Vui lòng chọn trạng thái" }]}
          >
            <Select
              options={[
                { value: "ACTIVE", label: "Đang hoạt động" },
                { value: "INACTIVE", label: "Ngừng hoạt động" },
              ]}
            />
          </Form.Item>

          <Text type="secondary" style={{ fontSize: 12 }}>
            Lưu ý: Email tài khoản không được phép thay đổi qua form hồ sơ theo quy định bảo mật hệ thống.
          </Text>
        </Form>
      </Modal>
    </div>
  );
};
