// controllers/authController.js
const { Utilisateur, Client, Vendeur } = require('../models/db');
const { 
  generateToken, 
  generateRefreshToken, 
  verifyRefreshToken 
} = require('../middlewares/auth');
const apiResponse = require('../utils/apiResponse');
const { validationResult } = require('express-validator');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

// Stockage temporaire des tokens de réinitialisation et vérification (à remplacer par Redis en production)
const resetTokens = new Map();
const verificationTokens = new Map();
const activeSessions = new Map();

class AuthController {

  // ==================== ROUTES PUBLIQUES ====================

  /**
   * @desc    Inscription d'un nouvel utilisateur
   * @route   POST /api/auth/register
   * @access  Public
   */
  static async register(req, res) {
    try {
      // Vérifier les erreurs de validation
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return apiResponse.validationErrorWithData(res, 'Erreurs de validation', errors.array());
      }

      const { nom, email, password, role = 'client' } = req.body;

      // Vérifier si l'utilisateur existe déjà
      const existingUser = await Utilisateur.findOne({ where: { email } });
      if (existingUser) {
        return apiResponse.ErrorResponse(res, 'Un utilisateur avec cet email existe déjà');
      }

      // Créer l'utilisateur
      const utilisateur = await Utilisateur.create({
        nom: nom.trim(),
        email: email.toLowerCase(),
        password,
        role
      });

      // Créer le profil spécifique selon le rôle
      if (role === 'client') {
        await Client.create({ id: utilisateur.id });
      } else if (role === 'vendeur') {
        await Vendeur.create({ id: utilisateur.id });
      }

      // Générer les tokens
      const accessToken = generateToken(utilisateur);
      const refreshToken = generateRefreshToken(utilisateur);

      // Stocker la session
      const sessionId = crypto.randomUUID();
      activeSessions.set(sessionId, {
        userId: utilisateur.id,
        refreshToken,
        createdAt: new Date(),
        lastActivity: new Date()
      });

      // Générer un token de vérification d'email
      const verificationToken = crypto.randomBytes(32).toString('hex');
      verificationTokens.set(verificationToken, {
        userId: utilisateur.id,
        email: utilisateur.email,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h
      });

      return apiResponse.successResponseWithData(res, 'Inscription réussie', {
        user: {
          id: utilisateur.id,
          nom: utilisateur.nom,
          email: utilisateur.email,
          role: utilisateur.role
        },
        tokens: {
          accessToken,
          refreshToken,
          sessionId
        },
        verificationToken // En production, envoyer par email
      });

    } catch (error) {
      console.error('Erreur lors de l\'inscription:', error);
      return apiResponse.ErrorResponse(res, 'Erreur lors de l\'inscription');
    }
  }

  /**
   * @desc    Connexion utilisateur
   * @route   POST /api/auth/login
   * @access  Public
   */
  static async login(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return apiResponse.validationErrorWithData(res, 'Erreurs de validation', errors.array());
      }

      const { email, password } = req.body;

      // Utiliser la méthode d'authentification du modèle
      const authResult = await Utilisateur.authentifier(email.toLowerCase(), password);

      if (!authResult.success) {
        return apiResponse.unauthorizedResponse(res, authResult.message);
      }

      // Récupérer l'utilisateur complet
      const utilisateur = await Utilisateur.findOne({
        where: { email: email.toLowerCase() },
        include: [
          { model: Client, as: 'client', required: false },
          { model: Vendeur, as: 'vendeur', required: false }
        ],
        attributes: { exclude: ['password'] }
      });

      // Générer les tokens
      const accessToken = generateToken(utilisateur);
      const refreshToken = generateRefreshToken(utilisateur);

      // Créer une nouvelle session
      const sessionId = crypto.randomUUID();
      activeSessions.set(sessionId, {
        userId: utilisateur.id,
        refreshToken,
        createdAt: new Date(),
        lastActivity: new Date(),
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });

      return apiResponse.successResponseWithData(res, 'Connexion réussie', {
        user: {
          id: utilisateur.id,
          nom: utilisateur.nom,
          email: utilisateur.email,
          role: utilisateur.role,
          client: utilisateur.client,
          vendeur: utilisateur.vendeur
        },
        tokens: {
          accessToken,
          refreshToken,
          sessionId
        }
      });

    } catch (error) {
      console.error('Erreur lors de la connexion:', error);
      return apiResponse.ErrorResponse(res, 'Erreur lors de la connexion');
    }
  }

  /**
   * @desc    Déconnexion utilisateur
   * @route   POST /api/auth/logout
   * @access  Private
   */
  static async logout(req, res) {
    try {
      const sessionId = req.headers['x-session-id'];
      
      // Supprimer la session si elle existe
      if (sessionId && activeSessions.has(sessionId)) {
        activeSessions.delete(sessionId);
      }

      // Utiliser la méthode de déconnexion du modèle
      const utilisateur = await Utilisateur.findByPk(req.user.id);
      const logoutResult = await utilisateur.seDeconnecter();

      return apiResponse.successResponse(res, logoutResult.message);

    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
      return apiResponse.ErrorResponse(res, 'Erreur lors de la déconnexion');
    }
  }

  /**
   * @desc    Rafraîchir le token d'accès
   * @route   POST /api/auth/refresh
   * @access  Public
   */
  static async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return apiResponse.unauthorizedResponse(res, 'Token de rafraîchissement manquant');
      }

      // Vérifier le refresh token
      const decoded = verifyRefreshToken(refreshToken);
      
      // Vérifier que la session existe
      const session = Array.from(activeSessions.values())
        .find(s => s.userId === decoded.id && s.refreshToken === refreshToken);

      if (!session) {
        return apiResponse.unauthorizedResponse(res, 'Session invalide');
      }

      // Récupérer l'utilisateur
      const utilisateur = await Utilisateur.findByPk(decoded.id, {
        attributes: { exclude: ['password'] }
      });

      if (!utilisateur) {
        return apiResponse.unauthorizedResponse(res, 'Utilisateur non trouvé');
      }

      // Générer un nouveau token d'accès
      const newAccessToken = generateToken(utilisateur);

      // Mettre à jour l'activité de la session
      session.lastActivity = new Date();

      return apiResponse.successResponseWithData(res, 'Token rafraîchi avec succès', {
        accessToken: newAccessToken
      });

    } catch (error) {
      console.error('Erreur lors du rafraîchissement:', error);
      return apiResponse.unauthorizedResponse(res, 'Token de rafraîchissement invalide');
    }
  }

  // ==================== ROUTES PROTÉGÉES ====================

  /**
   * @desc    Obtenir le profil utilisateur
   * @route   GET /api/auth/me
   * @access  Private
   */
  static async getProfile(req, res) {
    try {
      const utilisateur = await Utilisateur.findByPk(req.user.id, {
        include: [
          { model: Client, as: 'client', required: false },
          { model: Vendeur, as: 'vendeur', required: false }
        ],
        attributes: { exclude: ['password'] }
      });

      if (!utilisateur) {
        return apiResponse.notFoundResponse(res, 'Utilisateur non trouvé');
      }

      return apiResponse.successResponseWithData(res, 'Profil récupéré avec succès', {
        user: {
          id: utilisateur.id,
          nom: utilisateur.nom,
          email: utilisateur.email,
          role: utilisateur.role,
          client: utilisateur.client,
          vendeur: utilisateur.vendeur,
          createdAt: utilisateur.createdAt,
          updatedAt: utilisateur.updatedAt
        }
      });

    } catch (error) {
      console.error('Erreur lors de la récupération du profil:', error);
      return apiResponse.ErrorResponse(res, 'Erreur lors de la récupération du profil');
    }
  }

  /**
   * @desc    Mettre à jour le profil utilisateur
   * @route   PUT /api/auth/profile
   * @access  Private
   */
  static async updateProfile(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return apiResponse.validationErrorWithData(res, 'Erreurs de validation', errors.array());
      }

      const utilisateur = await Utilisateur.findByPk(req.user.id);
      
      if (!utilisateur) {
        return apiResponse.notFoundResponse(res, 'Utilisateur non trouvé');
      }

      // Utiliser la méthode du modèle pour mettre à jour le profil
      const updateResult = await utilisateur.mettreAJourProfil(req.body);

      if (!updateResult.success) {
        return apiResponse.ErrorResponse(res, updateResult.message);
      }

      // Récupérer l'utilisateur mis à jour
      const updatedUser = await Utilisateur.findByPk(req.user.id, {
        attributes: { exclude: ['password'] }
      });

      return apiResponse.successResponseWithData(res, updateResult.message, {
        user: {
          id: updatedUser.id,
          nom: updatedUser.nom,
          email: updatedUser.email,
          role: updatedUser.role
        }
      });

    } catch (error) {
      console.error('Erreur lors de la mise à jour du profil:', error);
      return apiResponse.ErrorResponse(res, 'Erreur lors de la mise à jour du profil');
    }
  }

  /**
   * @desc    Changer le mot de passe
   * @route   PUT /api/auth/change-password
   * @access  Private
   */
  static async changePassword(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return apiResponse.validationErrorWithData(res, 'Erreurs de validation', errors.array());
      }

      const { ancienPassword, nouveauPassword } = req.body;

      const utilisateur = await Utilisateur.findByPk(req.user.id);
      
      if (!utilisateur) {
        return apiResponse.notFoundResponse(res, 'Utilisateur non trouvé');
      }

      // Utiliser la méthode du modèle pour changer le mot de passe
      const changeResult = await utilisateur.changerMotDePasse(ancienPassword, nouveauPassword);

      if (!changeResult.success) {
        return apiResponse.ErrorResponse(res, changeResult.message);
      }

      // Révoquer toutes les sessions actives pour forcer une reconnexion
      const userSessions = Array.from(activeSessions.entries())
        .filter(([, session]) => session.userId === req.user.id);
      
      userSessions.forEach(([sessionId]) => {
        activeSessions.delete(sessionId);
      });

      return apiResponse.successResponse(res, changeResult.message);

    } catch (error) {
      console.error('Erreur lors du changement de mot de passe:', error);
      return apiResponse.ErrorResponse(res, 'Erreur lors du changement de mot de passe');
    }
  }

  // ==================== GESTION DES SESSIONS ====================

  /**
   * @desc    Obtenir les sessions actives
   * @route   GET /api/auth/sessions
   * @access  Private
   */
  static async getActiveSessions(req, res) {
    try {
      const userSessions = Array.from(activeSessions.entries())
        .filter(([, session]) => session.userId === req.user.id)
        .map(([sessionId, session]) => ({
          id: sessionId,
          createdAt: session.createdAt,
          lastActivity: session.lastActivity,
          userAgent: session.userAgent,
          ip: session.ip
        }));

      return apiResponse.successResponseWithData(res, 'Sessions récupérées avec succès', {
        sessions: userSessions
      });

    } catch (error) {
      console.error('Erreur lors de la récupération des sessions:', error);
      return apiResponse.ErrorResponse(res, 'Erreur lors de la récupération des sessions');
    }
  }

  /**
   * @desc    Révoquer une session spécifique
   * @route   DELETE /api/auth/sessions/:sessionId
   * @access  Private
   */
  static async revokeSession(req, res) {
    try {
      const { sessionId } = req.params;
      const session = activeSessions.get(sessionId);

      if (!session || session.userId !== req.user.id) {
        return apiResponse.notFoundResponse(res, 'Session non trouvée');
      }

      activeSessions.delete(sessionId);
      
      return apiResponse.successResponse(res, 'Session révoquée avec succès');

    } catch (error) {
      console.error('Erreur lors de la révocation de session:', error);
      return apiResponse.ErrorResponse(res, 'Erreur lors de la révocation de session');
    }
  }

  /**
   * @desc    Révoquer toutes les sessions
   * @route   DELETE /api/auth/sessions
   * @access  Private
   */
  static async revokeAllSessions(req, res) {
    try {
      const userSessions = Array.from(activeSessions.entries())
        .filter(([, session]) => session.userId === req.user.id);
      
      userSessions.forEach(([sessionId]) => {
        activeSessions.delete(sessionId);
      });

      return apiResponse.successResponse(res, 'Toutes les sessions ont été révoquées');

    } catch (error) {
      console.error('Erreur lors de la révocation des sessions:', error);
      return apiResponse.ErrorResponse(res, 'Erreur lors de la révocation des sessions');
    }
  }

  // ==================== UTILITAIRES ====================

  /**
   * @desc    Vérifier la disponibilité d'un email
   * @route   GET /api/auth/check-email/:email
   * @access  Public
   */
  static async checkEmailAvailability(req, res) {
    try {
      const { email } = req.params;
      
      const existingUser = await Utilisateur.findOne({ 
        where: { email: email.toLowerCase() } 
      });

      return apiResponse.successResponseWithData(res, 'Vérification effectuée', {
        available: !existingUser,
        email: email.toLowerCase()
      });

    } catch (error) {
      console.error('Erreur lors de la vérification de l\'email:', error);
      return apiResponse.ErrorResponse(res, 'Erreur lors de la vérification');
    }
  }

  /**
   * @desc    Valider un token JWT
   * @route   GET /api/auth/validate-token
   * @access  Private
   */
  static async validateToken(req, res) {
    try {
      // Si on arrive ici, c'est que le token est valide (middleware auth)
      return apiResponse.successResponseWithData(res, 'Token valide', {
        user: req.user,
        tokenValid: true
      });

    } catch (error) {
      console.error('Erreur lors de la validation du token:', error);
      return apiResponse.ErrorResponse(res, 'Erreur lors de la validation');
    }
  }

  // ==================== MÉTHODES PLACEHOLDER ====================
  // (À implémenter selon vos besoins spécifiques)

  static async forgotPassword(req, res) {
    return apiResponse.successResponse(res, 'Fonctionnalité à implémenter');
  }

  static async resetPassword(req, res) {
    return apiResponse.successResponse(res, 'Fonctionnalité à implémenter');
  }

  static async verifyEmail(req, res) {
    return apiResponse.successResponse(res, 'Fonctionnalité à implémenter');
  }

  static async resendVerificationEmail(req, res) {
    return apiResponse.successResponse(res, 'Fonctionnalité à implémenter');
  }

  static async deleteAccount(req, res) {
    return apiResponse.successResponse(res, 'Fonctionnalité à implémenter');
  }
}

module.exports = AuthController;