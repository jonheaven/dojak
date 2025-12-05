import { Button, Form, Input, Modal, Select, Slider, Upload, message } from 'antd';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { LoadingOutlined, UploadOutlined } from '@ant-design/icons';

interface CreateDoginalModalProps {
  visible: boolean;
  onCancel: () => void;
  onCreate: (content: string, feeRate: number) => Promise<void>;
}

const { Option } = Select;
const { TextArea } = Input;

export const CreateDoginalModal: React.FC<CreateDoginalModalProps> = ({ visible, onCancel, onCreate }) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [contentType, setContentType] = useState<'text' | 'image' | 'json'>('text');
  const [feeRate, setFeeRate] = useState(10);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      let content = '';
      if (contentType === 'text') {
        content = values.textContent;
      } else if (contentType === 'json') {
        content = JSON.stringify(values.jsonContent);
      } else if (contentType === 'image') {
        // Handle image upload - for now just use placeholder
        content =
          'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjMDY5NDIwIi8+Cjx0ZXh0IHg9IjEwMCIgeT0iMTEwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMjAiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5QZXBpbmFsPC90ZXh0Pgo8L3N2Zz4=';
      }

      await onCreate(content, feeRate);
      form.resetFields();
      message.success('Doginal created successfully!');
    } catch (error) {
      console.error('Failed to create doginal:', error);
      message.error('Failed to create doginal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="Create New Doginal"
      open={visible}
      onCancel={onCancel}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          Cancel
        </Button>,
        <Button
          key="create"
          type="primary"
          loading={loading}
          onClick={handleSubmit}
          className="bg-[#069420] border-[#069420] hover:bg-[#07a521]"
        >
          {loading ? <LoadingOutlined /> : 'Create Doginal'}
        </Button>
      ]}
      width={600}
    >
      <Form form={form} layout="vertical">
        <Form.Item label="Content Type" name="contentType" initialValue="text">
          <Select onChange={setContentType}>
            <Option value="text">Text</Option>
            <Option value="image">Image</Option>
            <Option value="json">JSON Metadata</Option>
          </Select>
        </Form.Item>

        {contentType === 'text' && (
          <Form.Item
            label="Text Content"
            name="textContent"
            rules={[{ required: true, message: 'Please enter text content' }]}
          >
            <TextArea rows={4} placeholder="Enter your Doginal text content..." maxLength={1000} />
          </Form.Item>
        )}

        {contentType === 'image' && (
          <Form.Item label="Image Upload">
            <Upload
              accept="image/*"
              maxCount={1}
              beforeUpload={() => false} // Prevent auto upload
            >
              <Button icon={<UploadOutlined />}>Select Image</Button>
            </Upload>
            <div className="text-sm text-gray-500 mt-2">Recommended: PNG, JPEG, GIF, SVG (max 1MB)</div>
          </Form.Item>
        )}

        {contentType === 'json' && (
          <Form.Item
            label="JSON Metadata"
            name="jsonContent"
            rules={[{ required: true, message: 'Please enter valid JSON' }]}
          >
            <TextArea
              rows={6}
              placeholder='{"name": "My Doginal", "description": "A unique Doginal", "attributes": {...}}'
            />
          </Form.Item>
        )}

        <Form.Item label={`Fee Rate: ${feeRate} sat/vB`}>
          <Slider
            min={1}
            max={100}
            value={feeRate}
            onChange={setFeeRate}
            marks={{
              1: 'Slow',
              10: 'Normal',
              50: 'Fast',
              100: 'Instant'
            }}
          />
        </Form.Item>

        <div className="text-sm text-gray-500 bg-gray-800 p-3 rounded">
          <strong>Note:</strong> Creating a Doginal requires network fees. Make sure you have sufficient DOGE balance.
        </div>
      </Form>
    </Modal>
  );
};
