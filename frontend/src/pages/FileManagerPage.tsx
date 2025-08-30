import React from 'react';
import { Card, Typography } from 'antd';
import FileManager from '../components/FileManager/FileManager';
import { useAuth } from '../hooks/useAuth';
import { Navigate } from 'react-router-dom';

const { Title } = Typography;

const FileManagerPage: React.FC = () => {
  const { user } = useAuth();

  // Vérifier si l'utilisateur a les droits d'accès
  if (!user || (user.role !== 'instructor' && user.role !== 'admin')) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="container" style={{ marginTop: 12, marginBottom: 12 }}>
      <Card style={{ padding: '1rem' }}>
        <Title level={2} style={{ marginTop: 0 }}>Gestion des fichiers</Title>
        <p style={{ color: '#475569', marginTop: 6, marginBottom: 12 }}>
          Gérez vos fichiers multimédias (images, PDF, vidéos) dans OVH Object Storage.
          Téléversez, prévisualisez et supprimez des fichiers facilement.
        </p>

        <div style={{ width: '100%' }}>
          <FileManager />
        </div>
      </Card>
    </div>
  );
};

export default FileManagerPage;
