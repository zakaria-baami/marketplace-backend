// middlewares/auth.js
const jwt = require('jsonwebtoken');
const { Utilisateur, Client, Vendeur } = require('../models/db');
const apiResponse = require('../utils/apiResponse');

/**
 * Middleware d'authentification JWT
 * Vérifie la validité du token et charge les informations utilisateur
 */
const auth = async (req, res, next) => {
  try {
    // Récupérer le token depuis l'en-tête Authorization
    // Dans middlewares/auth.js, autour de la ligne 25-30
const authHeader = req.headers['authorization'];
const token = authHeader && authHeader.split(' ')[1];

console.log('🔍 Debug token:');
console.log('- authHeader:', authHeader);
console.log('- token extrait:', token);
console.log('- token length:', token ? token.length : 'undefined');
console.log('- JWT_SECRET présent:', !!process.env.JWT_SECRET);

if (!token) {
  return apiResponse.unauthorizedResponse(res, 'Token d\'accès requis');
}

// Avant jwt.verify, ajoutez :
console.log('🔍 Tentative de vérification du token...');

jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
  if (err) {
    console.log('❌ Erreur JWT complète:', err);
    console.log('❌ Type erreur:', err.name);
    console.log('❌ Message erreur:', err.message);
    // ... rest of your error handling
  }
  // ... rest of your code
});

    // Vérifier et décoder le token JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Récupérer l'utilisateur depuis la base de données
    const utilisateur = await Utilisateur.findByPk(decoded.id, {
      include: [
        { 
          model: Client, 
          as: 'client',
          required: false 
        },
        { 
          model: Vendeur, 
          as: 'vendeur',
          required: false 
        }
      ],
      attributes: { exclude: ['password'] } // Exclure le mot de passe
    });

    if (!utilisateur) {
      return apiResponse.unauthorizedResponse(res, 'Utilisateur non trouvé');
    }

    // Ajouter les informations utilisateur à la requête
    req.user = {
      id: utilisateur.id,
      nom: utilisateur.nom,
      email: utilisateur.email,
      role: utilisateur.role,
      client: utilisateur.client,
      vendeur: utilisateur.vendeur
    };

    next();
  } catch (error) {
    console.error('Erreur d\'authentification:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return apiResponse.unauthorizedResponse(res, 'Token invalide');
    }
    
    if (error.name === 'TokenExpiredError') {
      return apiResponse.unauthorizedResponse(res, 'Token expiré');
    }
    
    return apiResponse.ErrorResponse(res, 'Erreur lors de l\'authentification');
  }
};

/**
 * Middleware d'authentification optionnel
 * Charge les informations utilisateur si un token est présent, sinon continue
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    
    if (!authHeader) {
      return next(); // Pas de token, continuer sans authentification
    }

    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : authHeader;

    if (!token) {
      return next(); // Token invalide, continuer sans authentification
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const utilisateur = await Utilisateur.findByPk(decoded.id, {
      include: [
        { 
          model: Client, 
          as: 'client',
          required: false 
        },
        { 
          model: Vendeur, 
          as: 'vendeur',
          required: false 
        }
      ],
      attributes: { exclude: ['password'] }
    });

    if (utilisateur) {
      req.user = {
        id: utilisateur.id,
        nom: utilisateur.nom,
        email: utilisateur.email,
        role: utilisateur.role,
        client: utilisateur.client,
        vendeur: utilisateur.vendeur
      };
    }

    next();
  } catch (error) {
    // En cas d'erreur, continuer sans authentification
    next();
  }
};

/**
 * Générer un token JWT pour un utilisateur
 * @param {Object} utilisateur - Données utilisateur
 * @returns {string} - Token JWT
 */
const generateToken = (utilisateur) => {
  const payload = {
    id: utilisateur.id,
    email: utilisateur.email,
    role: utilisateur.role
  };

  return jwt.sign(
    payload,
    process.env.JWT_SECRET,
    { 
      expiresIn: process.env.JWT_EXPIRES_IN || '24h',
      issuer: 'ecommerce-api'
    }
  );
};

/**
 * Générer un token de rafraîchissement
 * @param {Object} utilisateur - Données utilisateur
 * @returns {string} - Refresh token
 */
const generateRefreshToken = (utilisateur) => {
  const payload = {
    id: utilisateur.id,
    type: 'refresh'
  };

  return jwt.sign(
    payload,
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { 
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
      issuer: 'ecommerce-api'
    }
  );
};

/**
 * Vérifier un token de rafraîchissement
 * @param {string} token - Refresh token
 * @returns {Object} - Données décodées
 */
const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
  } catch (error) {
    throw new Error('Token de rafraîchissement invalide');
  }
};

/**
 * Middleware pour vérifier si l'utilisateur est propriétaire de la ressource
 * @param {string} paramName - Nom du paramètre contenant l'ID utilisateur
 */
const checkOwnership = (paramName = 'userId') => {
  return (req, res, next) => {
    const resourceUserId = parseInt(req.params[paramName]);
    const currentUserId = req.user.id;

    if (req.user.role === 'admin') {
      return next(); // Les admins peuvent accéder à toutes les ressources
    }

    if (resourceUserId !== currentUserId) {
      return apiResponse.forbiddenResponse(res, 'Accès non autorisé à cette ressource');
    }

    next();
  };
};

/**
 * Middleware pour vérifier les permissions basées sur le rôle et la propriété
 */
const checkPermission = (allowedRoles = [], checkOwner = false, ownerParam = 'userId') => {
  return (req, res, next) => {
    const userRole = req.user.role;
    
    // Vérifier si le rôle est autorisé
    if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
      return apiResponse.forbiddenResponse(res, 'Permission insuffisante');
    }

    // Vérifier la propriété si demandé
    if (checkOwner && userRole !== 'admin') {
      const resourceUserId = parseInt(req.params[ownerParam]);
      if (resourceUserId !== req.user.id) {
        return apiResponse.forbiddenResponse(res, 'Accès non autorisé à cette ressource');
      }
    }

    next();
  };
};

module.exports = {
  auth,
  optionalAuth,
  generateToken,
  generateRefreshToken,
  verifyRefreshToken,
  checkOwnership,
  checkPermission
};