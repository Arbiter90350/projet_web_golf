import { z } from 'zod';
import type { TFunction } from 'i18next';

// Schémas Zod pour la validation des formulaires d'authentification
// Les messages utilisent i18n avec des valeurs par défaut en français (fallback)

export const makeLoginSchema = (t: TFunction) =>
  z.object({
    email: z
      .string()
      .min(1, { message: t('common:errors.required', { defaultValue: 'Ce champ est obligatoire' }) })
      .email({ message: t('common:errors.invalid_email', { defaultValue: "Adresse e-mail invalide" }) }),
    password: z
      .string()
      .min(1, { message: t('common:errors.required', { defaultValue: 'Ce champ est obligatoire' }) }),
  });

export const makeRegisterSchema = (t: TFunction) =>
  {
    const base = z.object({
      firstName: z
        .string()
        .min(1, { message: t('common:errors.required', { defaultValue: 'Ce champ est obligatoire' }) }),
      lastName: z
        .string()
        .min(1, { message: t('common:errors.required', { defaultValue: 'Ce champ est obligatoire' }) }),
      email: z
        .string()
        .min(1, { message: t('common:errors.required', { defaultValue: 'Ce champ est obligatoire' }) })
        .email({ message: t('common:errors.invalid_email', { defaultValue: "Adresse e-mail invalide" }) }),
      password: z
        .string()
        .min(8, { message: t('common:errors.password_min', { count: 8, defaultValue: 'Le mot de passe doit contenir au moins 8 caractères' }) }),
      confirmPassword: z
        .string()
        .min(1, { message: t('common:errors.required', { defaultValue: 'Ce champ est obligatoire' }) }),
    });
    return base.refine((data: z.infer<typeof base>) => data.password === data.confirmPassword, {
      path: ['confirmPassword'],
      message: t('auth:messages.passwords_mismatch', { defaultValue: 'Les mots de passe ne correspondent pas' }),
    });
  };

export const makeForgotSchema = (t: TFunction) =>
  z.object({
    email: z
      .string()
      .min(1, { message: t('common:errors.required', { defaultValue: 'Ce champ est obligatoire' }) })
      .email({ message: t('common:errors.invalid_email', { defaultValue: "Adresse e-mail invalide" }) }),
  });

export const makeResetSchema = (t: TFunction) =>
  {
    const base = z.object({
      password: z
        .string()
        .min(8, { message: t('common:errors.password_min', { count: 8, defaultValue: 'Le mot de passe doit contenir au moins 8 caractères' }) }),
      confirmPassword: z
        .string()
        .min(1, { message: t('common:errors.required', { defaultValue: 'Ce champ est obligatoire' }) }),
    });
    return base.refine((data: z.infer<typeof base>) => data.password === data.confirmPassword, {
      path: ['confirmPassword'],
      message: t('auth:messages.passwords_mismatch', { defaultValue: 'Les mots de passe ne correspondent pas' }),
    });
  };
