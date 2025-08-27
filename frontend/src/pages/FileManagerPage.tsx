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
    <div className="file-manager-page">
      <Card className="file-manager-card">
        <Title level={2} className="page-title">Gestion des fichiers</Title>
        <p className="page-description">
          Gérez vos fichiers multimédias (images, PDF, vidéos) dans OVH Object Storage.
          Téléversez, prévisualisez et supprimez des fichiers facilement.
        </p>
        
        <div className="file-manager-container">
          <FileManager />
        </div>
      </Card>
    </div>
  );
};

export default FileManagerPage;
