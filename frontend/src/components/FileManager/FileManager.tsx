import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Button, Table, Space, message, Upload, Modal, Typography, Card, Progress } from 'antd';
import { UploadOutlined, DeleteOutlined, EyeOutlined, FileOutlined, LinkOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd/es/upload/interface';
import type { RcFile } from 'antd/es/upload';
import type {
  UploadRequestOption as RcUploadRequestOption,
  UploadProgressEvent,
  UploadRequestFile,
  UploadRequestError,
} from 'rc-upload/lib/interface';
import api from '../../services/api';
import axios from 'axios';
import './FileManager.css';
import ConfirmDialog from '../ConfirmDialog';

const { Title, Text } = Typography;

// Limites configurables via variables d'environnement Vite
const MAX_UPLOAD_MB = Number(import.meta.env.VITE_MAX_UPLOAD_MB || 500); // 500 Mo par défaut
const UPLOAD_TIMEOUT_MS = Number(import.meta.env.VITE_UPLOAD_TIMEOUT_MS || 10 * 60 * 1000); // 10 min

interface FileItem {
  uid: string;
  name: string;
  url: string;
  size: number;
  type: string;
  lastModified?: number;
  // Nom de fichier unique côté stockage (clé objet). Utile pour les URLs signées (modèle privé)
  fileName?: string;
}

const FileManager: React.FC = () => {
  const { user } = useAuth();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<FileItem | null>(null);
  // Typage pour rc-upload (utilisé par AntD Upload)
  type CustomRequestOptions = RcUploadRequestOption<unknown>;

  // Récupérer la liste des fichiers
  const fetchFiles = async () => {
    try {
      const res = await api.get('/files', { params: { page: 1, limit: 200 } });
      const items = (res?.data?.data?.items || []) as Array<{
        fileName: string;
        originalName: string;
        mimeType: string;
        size: number;
        createdAt?: string;
      }>;

      const mapped: FileItem[] = items.map((it) => ({
        uid: it.fileName,
        name: it.originalName,
        url: '', // bucket privé: les URL seront demandées via /files/signed-url
        size: it.size,
        type: it.mimeType,
        fileName: it.fileName,
      }));
      setFiles(mapped);
    } catch (error) {
      console.error('Erreur lors du chargement des fichiers:', error);
      message.error("Impossible de charger la liste des fichiers");
      setFiles([]);
    }
  };

  const confirmDelete = async () => {
    const file = pendingDelete;
    if (!file) {
      setDeleteOpen(false);
      return;
    }
    await handleDelete(file);
    setDeleteOpen(false);
    setPendingDelete(null);
  };

  useEffect(() => {
    if (user && (user.role === 'instructor' || user.role === 'admin')) {
      fetchFiles();
    }
  }, [user]);

  // Vérifier si l'utilisateur a les droits d'administration
  if (!user || (user.role !== 'instructor' && user.role !== 'admin')) {
    return (
      <div className="unauthorized-access">
        <Title level={4}>Accès refusé</Title>
        <Text>Vous n'avez pas les autorisations nécessaires pour accéder à cette page.</Text>
      </div>
    );
  }

  // Gérer la suppression d'un fichier
  const handleDelete = async (file: FileItem) => {
    try {
      await api.delete('/files/delete', { data: file.fileName ? { fileName: file.fileName } : { fileUrl: file.url } });
      message.success('Fichier supprimé avec succès');
      fetchFiles(); // Rafraîchir la liste
    } catch (error) {
      console.error('Erreur lors de la suppression du fichier:', error);
      message.error('Échec de la suppression du fichier');
    }
  };

  // Gérer l'aperçu d'un fichier (ouvre un modal avec un player/iframe le cas échéant)
  const handlePreview = async (file: FileItem) => {
    try {
      // Pour les fichiers privés, demande d'URL signée via fileName
      const body: { fileName?: string } = { fileName: file.fileName || file.name };
      const response = await api.post('/files/signed-url', body);
      const signedUrl = response?.data?.data?.signedUrl ?? response?.data?.signedUrl;
      if (!signedUrl) throw new Error('Aucune URL signée retournée');
      setPreviewUrl(signedUrl);
      setPreviewVisible(true);
    } catch (error) {
      console.error('Erreur lors de la récupération de l\'URL signée:', error);
      message.error('Impossible d\'afficher le fichier');
    }
  };

  // Ouvrir le fichier dans un nouvel onglet via une URL signée (download/voir)
  const handleOpenInNewTab = async (file: FileItem) => {
    try {
      const body: { fileName?: string } = { fileName: file.fileName || file.name };
      const response = await api.post('/files/signed-url', body);
      const signedUrl = response?.data?.data?.signedUrl ?? response?.data?.signedUrl;
      if (!signedUrl) throw new Error('Aucune URL signée retournée');
      window.open(signedUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('Erreur lors de l\'ouverture du fichier:', error);
      message.error('Impossible d\'ouvrir le fichier');
    }
  };

  // Propriétés du composant Upload
  const uploadProps: UploadProps = {
    name: 'file',
    multiple: false,
    showUploadList: false,
    beforeUpload: (file: RcFile) => {
      // Vérifier le type de fichier
      const isAllowed = ['image/jpeg', 'image/png', 'application/pdf', 'video/mp4'].includes(file.type);
      if (!isAllowed) {
        message.error('Type de fichier non autorisé');
        return Upload.LIST_IGNORE;
      }

      // Vérifier la taille du fichier (MAX_UPLOAD_MB)
      const isUnderMax = file.size / 1024 / 1024 <= MAX_UPLOAD_MB;
      if (!isUnderMax) {
        message.error(`La taille du fichier ne doit pas dépasser ${MAX_UPLOAD_MB} Mo`);
        return Upload.LIST_IGNORE;
      }

      return true;
    },
    customRequest: (opts: CustomRequestOptions) => {
      const file = opts.file as RcFile;

      (async () => {
        try {
          setIsUploading(true);
          setUploadProgress(0);

          // 1) Demande d'URL pré-signée au backend
          const presignRes = await api.post('/files/presign', {
            mimeType: file.type,
            size: file.size,
            originalName: file.name,
          }, {
            timeout: 30_000,
          });

          const { url, fileName } = presignRes.data?.data as { url: string; fileName: string };

          // 2) Upload direct vers OVH via PUT
          await axios.put(url, file, {
            headers: {
              'Content-Type': file.type || 'application/octet-stream',
            },
            timeout: UPLOAD_TIMEOUT_MS,
            onUploadProgress: (progressEvent) => {
              const percentCompleted = Math.round(
                (progressEvent.loaded * 100) / (progressEvent.total || 1)
              );
              setUploadProgress(percentCompleted);
              const ev: UploadProgressEvent = { percent: percentCompleted } as UploadProgressEvent;
              opts.onProgress?.(ev, file as unknown as UploadRequestFile);
            },
          });

          // 3) Enregistrer les métadonnées en base (modèle privé)
          await api.post('/files/record', {
            fileName,
            originalName: file.name,
            mimeType: file.type,
            size: file.size,
          });

          // Succès (modèle privé): nous ne disposons pas d'URL publique. Utiliser /files/signed-url à l'affichage.
          opts.onSuccess?.({ fileName } as unknown, file as unknown as UploadRequestFile);
          message.success('Fichier téléversé avec succès');
          fetchFiles();
        } catch (error) {
          console.error('Erreur lors du téléversement direct OVH:', error);
          opts.onError?.(error as UploadRequestError);
          message.error('Échec du téléversement du fichier');
        } finally {
          setIsUploading(false);
          setUploadProgress(0);
        }
      })();
    },
  };

  // Colonnes pour le tableau des fichiers
  const columns = [
    {
      title: 'Nom du fichier',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: FileItem) => (
        <Space>
          <FileOutlined style={{ fontSize: '18px' }} />
          <a onClick={() => handlePreview(record)}>{text}</a>
        </Space>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => {
        const typeMap: Record<string, string> = {
          'image/jpeg': 'Image',
          'image/png': 'Image',
          'application/pdf': 'PDF',
          'video/mp4': 'Vidéo',
        };
        return typeMap[type] || type;
      },
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
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, record: FileItem) => (
        <div
          onPointerDownCapture={(e) => e.stopPropagation()}
          onMouseDownCapture={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStartCapture={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
        >
        <Space size="middle">
          <Button 
            type="text" 
            htmlType="button"
            icon={<EyeOutlined />} 
            onPointerDownCapture={(e) => e.stopPropagation()}
            onMouseDownCapture={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); handlePreview(record); }}
            title="Aperçu"
            onMouseUp={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onTouchStartCapture={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
          />
          <Button
            type="text"
            htmlType="button"
            icon={<LinkOutlined />}
            onPointerDownCapture={(e) => e.stopPropagation()}
            onMouseDownCapture={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); handleOpenInNewTab(record); }}
            title="Voir (nouvel onglet)"
            onMouseUp={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onTouchStartCapture={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
          />
          <Button 
            type="text" 
            htmlType="button"
            danger 
            icon={<DeleteOutlined />} 
            onPointerDownCapture={(e) => e.stopPropagation()}
            onMouseDownCapture={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setPendingDelete(record);
              setDeleteOpen(true);
            }}
            title="Supprimer"
            onMouseUp={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onTouchStartCapture={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
          />
        </Space>
        </div>
      ),
    },
  ];

  return (
    <div className="file-manager">
      <Card 
        title="Gestion des fichiers" 
        bordered={false} 
        extra={
          <Upload {...uploadProps}>
            <Button type="primary" icon={<UploadOutlined />}>
              Téléverser un fichier
            </Button>
          </Upload>
        }
      >
        {isUploading && (
          <div style={{ marginBottom: 16 }}>
            <Text>Téléversement en cours...</Text>
            <Progress percent={uploadProgress} status="active" />
          </div>
        )}
        
        <Table 
          columns={columns} 
          dataSource={files} 
          rowKey="uid"
          loading={loading}
          locale={{ emptyText: 'Aucun fichier trouvé' }}
        />
        <ConfirmDialog
          open={deleteOpen}
          title="Supprimer le fichier"
          message={<span>Êtes-vous sûr de vouloir supprimer <strong>{pendingDelete?.name}</strong> ? Cette action est irréversible.</span>}
          confirmLabel="Supprimer"
          cancelLabel="Annuler"
          onConfirm={confirmDelete}
          onCancel={() => { setDeleteOpen(false); setPendingDelete(null); }}
        />
      </Card>

      <Modal
        open={previewVisible}
        title="Aperçu du fichier"
        footer={null}
        onCancel={() => setPreviewVisible(false)}
        width={800}
      >
        {previewUrl && (
          <div style={{ textAlign: 'center' }}>
            {previewUrl.match(/\.(jpeg|jpg|gif|png)$/) ? (
              <img 
                alt="Aperçu" 
                src={previewUrl} 
                style={{ maxWidth: '100%', maxHeight: '70vh' }} 
              />
            ) : previewUrl.match(/\.(mp4|webm|ogg)$/) ? (
              <video 
                controls 
                autoPlay 
                style={{ maxWidth: '100%', maxHeight: '70vh' }}
              >
                <source src={previewUrl} type="video/mp4" />
                Votre navigateur ne prend pas en charge la lecture de vidéos.
              </video>
            ) : previewUrl.match(/\.(pdf)$/) ? (
              <iframe 
                src={`${previewUrl}#view=fit`} 
                style={{ width: '100%', height: '70vh', border: 'none' }} 
                title="Aperçu PDF"
              />
            ) : (
              <div>
                <FileOutlined style={{ fontSize: '48px' }} />
                <p>Ce type de fichier ne peut pas être prévisualisé.</p>
                <a href={previewUrl} target="_blank" rel="noopener noreferrer">
                  <Button type="primary">Télécharger le fichier</Button>
                </a>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default FileManager;
