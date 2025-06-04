// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { auth, optionalAuth } = require('../middlewares/auth');
const { body, validationResult } = require('express-validator');

// ==================== VALIDATIONS ====================

/**
 * Validation pour l'inscription
 */
const validateRegistration = [
  body('nom')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Le nom doit contenir entre 2 et 100 caractères'),
  
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email invalide'),
  
  body('password')
    .isLength({ min: 6 })
    .withMessage('Le mot de passe doit contenir au moins 6 caractères'),
  
  body('role')
    .optional()
    .isIn(['client', 'vendeur'])
    .withMessage('Le rôle doit être client ou vendeur')
];

/**
 * Validation pour la connexion
 */
const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email invalide'),
  
  body('password')
    .notEmpty()
    .withMessage('Le mot de passe est requis')
];

/**
 * Validation pour le changement de mot de passe
 */
const validatePasswordChange = [
  body('ancienPassword')
    .notEmpty()
    .withMessage('L\'ancien mot de passe est requis'),
  
  body('nouveauPassword')
    .isLength({ min: 6 })
    .withMessage('Le nouveau mot de passe doit contenir au moins 6 caractères')
];

/**
 * Validation pour la mise à jour du profil
 */
const validateProfileUpdate = [
  body('nom')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Le nom doit contenir entre 2 et 100 caractères'),
  
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Email invalide')
];

/**
 * Validation pour le refresh token
 */
const validateRefreshToken = [
  body('refreshToken')
    .notEmpty()
    .withMessage('Le token de rafraîchissement est requis')
];

// ==================== ROUTES PUBLIQUES ====================

/**
 * @route   POST /api/auth/register
 * @desc    Inscription d'un nouvel utilisateur
 * @access  Public
 */
router.post('/register', validateRegistration, authController.register);

/**
 * @route   POST /api/auth/login
 * @desc    Connexion utilisateur
 * @access  Public
 */
router.post('/login', validateLogin, authController.login);

/**
 * @route   POST /api/auth/refresh
 * @desc    Rafraîchir le token d'accès
 * @access  Public
 */
router.post('/refresh', validateRefreshToken, authController.refreshToken);

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Demande de réinitialisation du mot de passe
 * @access  Public
 */
router.post('/forgot-password', [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email invalide')
], authController.forgotPassword);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Réinitialisation du mot de passe
 * @access  Public
 */
router.post('/reset-password', [
  body('token')
    .notEmpty()
    .withMessage('Token de réinitialisation requis'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Le mot de passe doit contenir au moins 6 caractères')
], authController.resetPassword);

/**
 * @route   POST /api/auth/verify-email
 * @desc    Vérification de l'email
 * @access  Public
 */
router.post('/verify-email', [
  body('token')
    .notEmpty()
    .withMessage('Token de vérification requis')
], authController.verifyEmail);

// ==================== ROUTES PROTÉGÉES ====================

/**
 * @route   POST /api/auth/logout
 * @desc    Déconnexion utilisateur
 * @access  Private
 */
router.post('/logout', auth, authController.logout);

/**
 * @route   GET /api/auth/me
 * @desc    Obtenir les informations de l'utilisateur connecté
 * @access  Private
 */
router.get('/me', auth, authController.getProfile);

/**
 * @route   PUT /api/auth/profile
 * @desc    Mettre à jour le profil utilisateur
 * @access  Private
 */
router.put('/profile', auth, validateProfileUpdate, authController.updateProfile);

/**
 * @route   PUT /api/auth/change-password
 * @desc    Changer le mot de passe
 * @access  Private
 */
router.put('/change-password', auth, validatePasswordChange, authController.changePassword);

/**
 * @route   DELETE /api/auth/delete-account
 * @desc    Supprimer le compte utilisateur
 * @access  Private
 */
router.delete('/delete-account', auth, [
  body('password')
    .notEmpty()
    .withMessage('Le mot de passe est requis pour supprimer le compte')
], authController.deleteAccount);

/**
 * @route   GET /api/auth/sessions
 * @desc    Obtenir les sessions actives
 * @access  Private
 */
router.get('/sessions', auth, authController.getActiveSessions);

/**
 * @route   DELETE /api/auth/sessions/:sessionId
 * @desc    Révoquer une session spécifique
 * @access  Private
 */
router.delete('/sessions/:sessionId', auth, authController.revokeSession);

/**
 * @route   DELETE /api/auth/sessions
 * @desc    Révoquer toutes les sessions (déconnexion globale)
 * @access  Private
 */
router.delete('/sessions', auth, authController.revokeAllSessions);

// ==================== ROUTES DE VÉRIFICATION ====================

/**
 * @route   GET /api/auth/check-email/:email
 * @desc    Vérifier si un email est déjà utilisé
 * @access  Public
 */
router.get('/check-email/:email', authController.checkEmailAvailability);

/**
 * @route   POST /api/auth/resend-verification
 * @desc    Renvoyer l'email de vérification
 * @access  Public
 */
router.post('/resend-verification', [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email invalide')
], authController.resendVerificationEmail);

/**
 * @route   GET /api/auth/validate-token
 * @desc    Valider un token JWT
 * @access  Private
 */
router.get('/validate-token', auth, authController.validateToken);

// ==================== MIDDLEWARE DE GESTION D'ERREURS ====================

/**
 * Middleware pour gérer les erreurs de validation
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Erreurs de validation',
      errors: errors.array()
    });
  }
  next();
};

// Appliquer le middleware de validation à toutes les routes
router.use(handleValidationErrors);

module.exports = router;