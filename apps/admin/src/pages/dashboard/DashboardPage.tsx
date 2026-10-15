import React, { useState } from "react";
import { Typography, Row, Col, Card, Statistic, DatePicker, Table, Space, Button } from "antd";
import { ReloadOutlined, DollarOutlined, ShoppingCartOutlined, InboxOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../api";
import { ApiStateWrapper } from "../../components/common/ApiStateWrapper";
import { formatVnd, formatDateTime } from "../../utils/format";
import type { ReportData } from "@halora/api-client";
import dayjs from "dayjs";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

export const DashboardPage: React.FC = () => {
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([
    dayjs().startOf("month"),
    dayjs().endOf("month"),
  ]);

  const from = dateRange[0] ? dateRange[0].toISOString() : undefined;
  const to = dateRange[1] ? dateRange[1].toISOString() : undefined;

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<ReportData>({
    queryKey: ["admin", "dashboard", from, to],
    queryFn: () => apiClient.dashboard.getAdmin({ from, to }),
  });

  const getMetricIcon = (unit: string) => {
    switch (unit) {
      case "VND":
        return <DollarOutlined style={{ color: "#c05c74" }} />;
      case "COUNT":
        return <ShoppingCartOutlined style={{ color: "#1890ff" }} />;
      case "QUANTITY":
        return <InboxOutlined style={{ color: "#52c41a" }} />;
      default:
        return null;
    }
  };

  const formatMetricValue = (value: string, unit: string) => {
    if (unit === "VND") {
      return formatVnd(value);
    }
    return new Intl.NumberFormat("vi-VN").format(parseInt(value, 10) || 0);
  };

  return (
    <div>
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>
            Tổng quan hệ thống
          </Title>
          <Text type="secondary">Số liệu kinh doanh, đơn hàng và biến động kho theo thời gian thực từ API</Text>
        </div>

        <Space>
          <RangePicker
            value={dateRange}
            onChange={(dates) => {
              if (dates) {
                setDateRange([dates[0], dates[1]]);
              }
            }}
          />
          <Button
            icon={<ReloadOutlined spin={isFetching} />}
            onClick={() => refetch()}
          >
            Làm mới
          </Button>
        </Space>
      </div>

      <ApiStateWrapper
        isLoading={isLoading}
        isError={isError}
        error={error}
        isEmpty={!data || (!data.metrics.length && !data.rows.length)}
        emptyDescription="Chưa có dữ liệu thống kê từ hệ thống"
        onRetry={() => refetch()}
      >
        {data && (
          <>
            {/* Metrics Cards */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
              {data.metrics.map((metric) => (
                <Col xs={24} sm={12} lg={6} key={metric.key}>
                  <Card bordered={false} style={{ background: "#fafafa" }}>
                    <Statistic
                      title={<Text type="secondary">{metric.label}</Text>}
                      value={formatMetricValue(metric.value, metric.unit)}
                      prefix={getMetricIcon(metric.unit)}
                      valueStyle={{ fontSize: 22, fontWeight: 700 }}
                    />
                  </Card>
                </Col>
              ))}
            </Row>

            {/* Time Series Data */}
            {data.series && data.series.length > 0 && (
              <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                {data.series.map((s) => (
                  <Col xs={24} lg={12} key={s.key}>
                    <Card title={s.name} size="small" bordered={false} style={{ background: "#fafafa" }}>
                      <Table
                        size="small"
                        pagination={false}
                        dataSource={s.points.map((pt, idx) => ({ ...pt, key: idx }))}
                        columns={[
                          { title: "Thời gian", dataIndex: "period", key: "period" },
                          {
                            title: `Giá trị (${s.unit === "VND" ? "₫" : s.unit})`,
                            dataIndex: "value",
                            key: "value",
                            render: (val: string) => (s.unit === "VND" ? formatVnd(val) : val),
                          },
                        ]}
                      />
                    </Card>
                  </Col>
                ))}
              </Row>
            )}

            {/* Recent Dynamic Rows */}
            {data.columns && data.columns.length > 0 && data.rows && (
              <Card title="Giao dịch và dữ liệu gần đây" bordered={false}>
                <Table
                  dataSource={data.rows.map((row) => ({ ...row.values, key: row.key }))}
                  columns={data.columns.map((col) => ({
                    title: col.label,
                    dataIndex: col.key,
                    key: col.key,
                    render: (val: unknown) => {
                      if (val === null || val === undefined) return "—";
                      if (col.type === "MONEY") return formatVnd(val as string);
                      if (col.type === "DATETIME") return formatDateTime(val as string);
                      return String(val);
                    },
                  }))}
                  pagination={{
                    current: data.meta.page,
                    pageSize: data.meta.limit,
                    total: data.meta.total,
                  }}
                />
              </Card>
            )}
          </>
        )}
      </ApiStateWrapper>
    </div>
  );
};
