import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Box, Typography, TextField, Button, Paper, Divider, Alert } from '@mui/material';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import api from '../services/api';
import { toast } from 'react-toastify';
import ConfirmDialog from '../components/ConfirmDialog';

interface FormValues {
  firstName: string;
  lastName: string;
  email: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

const ProfilePage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const validationSchema = Yup.object({
    firstName: Yup.string().required('Le prénom est requis'),
    lastName: Yup.string().required('Le nom est requis'),
    email: Yup.string().email('Email invalide'), // Toujours valider le format mais pas requis car non modifiable
    currentPassword: Yup.string()
      .when('newPassword', {
        is: (val: string) => val && val.length > 0,
        then: (schema) => schema.required('Le mot de passe actuel est requis pour modifier le mot de passe'),
      }),
    newPassword: Yup.string()
      .min(8, 'Le mot de passe doit contenir au moins 8 caractères')
      .matches(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        'Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre'
      ),
    confirmPassword: Yup.string()
      .oneOf([Yup.ref('newPassword')], 'Les mots de passe ne correspondent pas')
  });

  // Mettre à jour les valeurs du formulaire lorsque l'utilisateur est chargé
  useEffect(() => {
    if (user) {
      formik.setValues({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const formik = useFormik<FormValues>({
    initialValues: {
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      email: user?.email || '',
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
    validationSchema,
    onSubmit: async (values) => {
      setIsLoading(true);
      setError('');

      try {
        const updateData = {
          firstName: values.firstName,
          lastName: values.lastName,
          // Ne pas inclure l'email dans les données de mise à jour
        } as {
          firstName: string;
          lastName: string;
          currentPassword?: string;
          newPassword?: string;
        };

        if (values.newPassword) {
          updateData.currentPassword = values.currentPassword;
          updateData.newPassword = values.newPassword;
        }

        await api.put('/auth/me', updateData);
        
        // Mettre à jour les données utilisateur localement
        if (user) {
          user.firstName = values.firstName;
          user.lastName = values.lastName;
        }
        
        toast.success('Profil mis à jour avec succès');
        setIsEditing(false);
      } catch (error: unknown) {
        if (error && typeof error === 'object' && 'response' in error) {
          const response = (error as { response: { data?: { message?: string } } }).response;
          setError(response?.data?.message || 'Une erreur est survenue lors de la mise à jour du profil');
        } else {
          setError('Une erreur inattendue est survenue');
        }
      } finally {
        setIsLoading(false);
      }
    },
  });

  const handleDeleteAccount = () => {
    if (user?.role === 'admin' || user?.role === 'instructor') {
      toast.error('Les administrateurs et instructeurs ne peuvent pas supprimer leur compte depuis l\'interface. Contactez le support.');
      return;
    }
    setConfirmOpen(true);
  };

  const confirmDeleteAccount = async () => {
    try {
      await api.delete('/auth/me');
      logout();
      navigate('/');
      toast.success('Votre compte a été supprimé avec succès');
    } catch (error) {
      console.error('Erreur lors de la suppression du compte:', error);
      setError('Impossible de supprimer le compte');
    } finally {
      setConfirmOpen(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
      <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
        <Box mb={4}>
          <Typography variant="h4" component="h1" gutterBottom>
            Mon compte
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            {user?.email}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Compte {user?.role}
          </Typography>
        </Box>

        <Divider sx={{ my: 3 }} />

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <form onSubmit={formik.handleSubmit}>
          <Box display="grid" gap={3}>
            <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: '1fr 1fr' }} gap={3}>
              <TextField
                fullWidth
                id="firstName"
                name="firstName"
                label="Prénom"
                value={formik.values.firstName}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.touched.firstName && Boolean(formik.errors.firstName)}
                helperText={formik.touched.firstName && formik.errors.firstName}
                disabled={!isEditing || isLoading}
                autoComplete="given-name"
              />
              <TextField
                fullWidth
                id="lastName"
                name="lastName"
                label="Nom"
                value={formik.values.lastName}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.touched.lastName && Boolean(formik.errors.lastName)}
                helperText={formik.touched.lastName && formik.errors.lastName}
                disabled={!isEditing || isLoading}
                autoComplete="family-name"
              />
            </Box>

            <Box mb={2}>
              <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                Email
              </Typography>
              <Typography variant="body1" sx={{ 
                p: 1.5, 
                bgcolor: 'action.hover', 
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider'
              }}>
                {user?.email}
              </Typography>
            </Box>

            {/* Section de changement de mot de passe */}
            <Box sx={{ mt: 4, mb: 4, p: 3, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="h6" gutterBottom>
                Changer de mot de passe
              </Typography>
              <Box display="grid" gap={2}>
                <TextField
                  fullWidth
                  id="currentPassword"
                  name="currentPassword"
                  label="Mot de passe actuel"
                  type="password"
                  autoComplete="current-password"
                  value={formik.values.currentPassword}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={formik.touched.currentPassword && Boolean(formik.errors.currentPassword)}
                  helperText={formik.touched.currentPassword && formik.errors.currentPassword}
                  disabled={!isEditing || isLoading}
                />
                <TextField
                  fullWidth
                  id="newPassword"
                  name="newPassword"
                  label="Nouveau mot de passe"
                  type="password"
                  autoComplete="new-password"
                  value={formik.values.newPassword}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={formik.touched.newPassword && Boolean(formik.errors.newPassword)}
                  helperText={formik.touched.newPassword && formik.errors.newPassword}
                  disabled={!isEditing || isLoading}
                />
                <TextField
                  fullWidth
                  id="confirmPassword"
                  name="confirmPassword"
                  label="Confirmer le nouveau mot de passe"
                  type="password"
                  autoComplete="new-password"
                  value={formik.values.confirmPassword}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={formik.touched.confirmPassword && Boolean(formik.errors.confirmPassword)}
                  helperText={formik.touched.confirmPassword && formik.errors.confirmPassword}
                  disabled={!isEditing || isLoading}
                />
              </Box>
            </Box>

            <Box display="flex" justifyContent="space-between" mt={4}>
              <div>
                {isEditing ? (
                  <>
                    <Button 
                      variant="outlined" 
                      color="error"
                      onClick={() => {
                        formik.resetForm();
                        setIsEditing(false);
                      }}
                      disabled={isLoading}
                      sx={{ mr: 2 }}
                    >
                      Annuler
                    </Button>
                    <Button 
                      type="submit" 
                      variant="contained"
                      disabled={isLoading || !formik.dirty || !formik.isValid}
                    >
                      {isLoading ? 'Enregistrement...' : 'Enregistrer les modifications'}
                    </Button>
                  </>
                ) : (
                  <Button 
                    variant="contained"
                    onClick={() => setIsEditing(true)}
                  >
                    Modifier le profil
                  </Button>
                )}
              </div>
              
              <Button 
                variant="outlined" 
                color="error"
                onClick={handleDeleteAccount}
                disabled={isLoading || user?.role === 'admin' || user?.role === 'instructor'}
                title={user?.role === 'admin' || user?.role === 'instructor' 
                  ? 'Les administrateurs et instructeurs doivent contacter le support pour supprimer leur compte' 
                  : 'Supprimer mon compte'}
                onPointerDownCapture={(e) => e.stopPropagation()}
                onMouseDownCapture={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              >
                Supprimer mon compte
              </Button>
              <ConfirmDialog
                open={confirmOpen}
                title="Supprimer le compte"
                message="Êtes-vous sûr de vouloir supprimer votre compte ? Cette action est irréversible."
                confirmLabel="Supprimer"
                cancelLabel="Annuler"
                onConfirm={confirmDeleteAccount}
                onCancel={() => setConfirmOpen(false)}
              />
            </Box>
          </Box>
        </form>
      </Paper>
    </Box>
  );
};

export default ProfilePage;
