import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Input, Select, Table, Button, Space, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { FileOutlined } from '@ant-design/icons';
import api from '../../services/api';

const { Text } = Typography;

export type FilePickerTypeFilter = 'all' | 'image' | 'pdf' | 'mp4' | string; // allow custom mime

export interface PickedFile {
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
}

interface FilePickerProps {
  // Mode d'affichage: modal (par défaut) ou inline
  mode?: 'modal' | 'inline';
  // Props pour le mode modal
  open?: boolean;
  onClose?: () => void;
  // Callback lors de la sélection
  onSelect: (file: PickedFile) => void;
  defaultType?: FilePickerTypeFilter;
}

interface FileRow extends PickedFile {
  key: string;
}

const PAGE_SIZE = 10;

function useDebounced<T>(value: T, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

const FilePicker: React.FC<FilePickerProps> = ({ mode = 'modal', open = false, onClose = () => {}, onSelect, defaultType = 'all' }) => {
  const [query, setQuery] = useState('');
  const [type, setType] = useState<FilePickerTypeFilter>(defaultType);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<FileRow[]>([]);

  const debouncedQ = useDebounced(query);
  // Mapping mp4 -> video/mp4 pour le filtre API
  const effectiveType = useMemo(() => {
    if (type === 'all') return '';
    if (type === 'mp4') return 'video/mp4';
    return type;
  }, [type]);

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: PAGE_SIZE };
      if (debouncedQ) params.q = debouncedQ;
      if (effectiveType) params.type = effectiveType;
      const res = await api.get('/files', { params });
      const items = (res?.data?.data?.items || []) as Array<PickedFile>;
      const mapped: FileRow[] = items.map((it) => ({
        key: it.fileName,
        ...it,
      }));
      setRows(mapped);
      setTotal(Number(res?.data?.data?.total || 0));
    } catch {
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (mode === 'inline' || open) fetchFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode]);

  useEffect(() => {
    if ((mode === 'inline') || open) fetchFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ, effectiveType, page, mode, open]);

  const columns: ColumnsType<FileRow> = [
    {
      title: 'Nom du fichier',
      dataIndex: 'originalName',
      key: 'originalName',
      render: (text, record) => (
        <Space>
          <FileOutlined />
          <a onClick={() => onSelect(record)}>{text}</a>
        </Space>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'mimeType',
      key: 'mimeType',
    },
    {
      title: 'Taille',
      dataIndex: 'size',
      key: 'size',
      render: (size: number) => {
        if (size < 1024) return `${size} B`;
        if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
        return `${(size / (1024 * 1024)).toFixed(1)} MB`;
      },
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Button type="primary" onClick={() => onSelect(record)}>
          Sélectionner
        </Button>
      ),
    },
  ];

  const body = (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <Space wrap>
        <Input
          placeholder="Rechercher par nom..."
          value={query}
          onChange={(e) => {
            setPage(1);
            setQuery(e.target.value);
          }}
          allowClear
          style={{ width: 300 }}
        />
        <Select
          value={type}
          onChange={(val) => {
            setPage(1);
            setType(val as FilePickerTypeFilter);
          }}
          style={{ width: 200 }}
          options={[
            { value: 'all', label: 'Tous les types' },
            { value: 'image', label: 'Images' },
            { value: 'pdf', label: 'PDF' },
            { value: 'mp4', label: 'MP4' },
          ]}
        />
      </Space>

      <Table
        columns={columns}
        dataSource={rows}
        loading={loading}
        pagination={{
          current: page,
          pageSize: PAGE_SIZE,
          total,
          showSizeChanger: false,
          onChange: (p) => setPage(p),
        }}
        locale={{ emptyText: <Text>Aucun fichier trouvé</Text> }}
        rowKey="key"
      />
    </Space>
  );

  if (mode === 'inline') return body;

  return (
    <Modal open={open} title="Sélectionner un fichier" onCancel={onClose} footer={null} width={800} destroyOnClose>
      {body}
    </Modal>
  );
};

export default FilePicker;
