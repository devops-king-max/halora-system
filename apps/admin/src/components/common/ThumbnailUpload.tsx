import React, { useState } from 'react';
import { Alert, Button, Image, Modal, Space, Typography, Upload, message } from 'antd';
import { PictureOutlined, UploadOutlined } from '@ant-design/icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiClientError, Brand, Product } from '@halora/api-client';
import { apiClient } from '../../api';

interface UploadProps {
  value?: string | null;
  onChange?: (id: string | null) => void;
  initialUrl?: string | null;
  onUploadingChange?: (uploading: boolean) => void;
}
export const ThumbnailUpload: React.FC<UploadProps> = ({ value, onChange, initialUrl, onUploadingChange }) => {
  const [uploaded, setUploaded] = useState<{ id: string; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const url = uploaded && uploaded.id === value ? uploaded.url : initialUrl || null;
  const upload = async (file: File) => {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) {
      setError('Chọn ảnh PNG, JPEG hoặc WebP, dung lượng tối đa 8 MB.');
      return false;
    }
    setBusy(true); onUploadingChange?.(true); setError(null);
    try {
      const body = new FormData(); body.append('file', file);
      const media = await apiClient.media.upload(body);
      setUploaded(media); onChange?.(media.id);
    } catch (error) {
      setError(error instanceof ApiClientError ? error.message : 'Không tải được ảnh. Vui lòng thử lại.');
    } finally { setBusy(false); onUploadingChange?.(false); }
    return false;
  };
  return <Space direction="vertical" style={{ width: '100%' }}>
    {url ? <Image src={url} alt="Ảnh đại diện" width={120} height={120} style={{ objectFit: 'cover', borderRadius: 8 }} /> :
      <div style={{ width: 120, height: 120, display: 'grid', placeItems: 'center', background: '#fafafa', border: '1px dashed #d9d9d9', borderRadius: 8 }}><PictureOutlined style={{ fontSize: 28, color: '#999' }} /></div>}
    <Upload accept="image/png,image/jpeg,image/webp" showUploadList={false} beforeUpload={upload} disabled={busy}>
      <Button icon={<UploadOutlined />} loading={busy}>{url ? 'Thay ảnh đại diện' : 'Tải ảnh đại diện'}</Button>
    </Upload>
    <Typography.Text type="secondary">PNG, JPEG hoặc WebP · tối đa 8 MB. Nhấn lưu để áp dụng ảnh.</Typography.Text>
    {error && <Alert type="error" showIcon message={error} />}
  </Space>;
};

export const ThumbnailModal: React.FC<{ record: Product | Brand; resource: 'products' | 'brands'; onClose: () => void }> = ({ record, resource, onClose }) => {
  const client = useQueryClient();
  const [mediaId, setMediaId] = useState<string | null>(record.thumbnailMediaId);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () => apiClient[resource].setThumbnail(record.id, { mediaId, version: record.version }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['admin', resource] });
      if (resource === 'brands') client.invalidateQueries({ queryKey: ['admin', 'brands-select'] });
      message.success('Đã lưu ảnh đại diện.'); onClose();
    },
    onError: (error: unknown) => {
      setError(error instanceof ApiClientError && error.code === 'VERSION_CONFLICT' ? 'Thông tin đã thay đổi. Đóng cửa sổ và mở lại để tải phiên bản mới.' : error instanceof ApiClientError ? error.message : 'Không lưu được ảnh. Vui lòng thử lại.');
      client.invalidateQueries({ queryKey: ['admin', resource] });
    },
  });
  return <Modal title={`Ảnh đại diện: ${record.name}`} open onCancel={() => { if (!uploading && !save.isPending) onClose(); }} onOk={() => save.mutate()} okText="Lưu ảnh đại diện" cancelText="Hủy" confirmLoading={save.isPending} okButtonProps={{ disabled: uploading || mediaId === record.thumbnailMediaId }} cancelButtonProps={{ disabled: uploading || save.isPending }} maskClosable={!uploading && !save.isPending}>
    <ThumbnailUpload value={mediaId} onChange={setMediaId} initialUrl={record.thumbnailUrl} onUploadingChange={setUploading} />
    {error && <Alert type="error" showIcon message={error} style={{ marginTop: 12 }} />}
  </Modal>;
};
