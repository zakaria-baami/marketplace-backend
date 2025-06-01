// middlewares/auth.js
const jwt = require('jsonwebtoken');
const { Utilisateur } = require('../models');
const ApiResponse = require('../utils/apiResponse');

/**
 * Middleware d'authentification principale
 * Vérifie le token JWT et charge les informations utilisateur
 */
const auth = async (req, res, next) => {
  try {
    // Récupérer le token depuis le header Authorization
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return ApiResponse.unauthorized(res, 'Token d\'authentification manquant ou invalide');
    }
    
    const token = authHeader.split(' ')[1];
    
    if (!token) {
      return ApiResponse.unauthorized(res, 'Token d\'authentification manquant');
    }
    
    // Vérifier le token JWT
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      if (jwtError.name === 'JsonWebTokenError') {
        return ApiResponse.unauthorized(res, 'Token invalide');
      }
      if (jwtError.name === 'TokenExpiredError') {
        return ApiResponse.unauthorized(res, 'Token expiré');
      }
      throw jwtError;
    }
    
    // Vérifier si l'utilisateur existe toujours dans la base de données
    const utilisateur = await Utilisateur.findByPk(decoded.id, {
      attributes: ['id', 'nom', 'email', 'role']
    });
    
    if (!utilisateur) {
      return ApiResponse.unauthorized(res, 'Utilisateur non trouvé ou compte désactivé');
    }
    
    // Ajouter les informations utilisateur à l'objet request
    req.user = {
      id: decoded.id,
      role: decoded.role,
      email: utilisateur.email,
      nom: utilisateur.nom
    };
    
    // Ajouter des métadonnées utiles
    req.authTime = new Date().toISOString();
    req.tokenExp = new Date(decoded.exp * 1000).toISOString();
    
    next();
  } catch (error) {
    console.error('Erreur dans le middleware d\'authentification:', error);
    return ApiResponse.error(res, 'Erreur d\'authentification', 500);
  }
};

/**
 * Middleware optionnel - n'échoue pas si pas de token
 * Utile pour les routes qui peuvent fonctionner avec ou sans authentification
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // Pas de token, mais on continue
      req.user = null;
      return next();
    }
    
    const token = authHeader.split(' ')[1];
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const utilisateur = await Utilisateur.findByPk(decoded.id, {
        attributes: ['id', 'nom', 'email', 'role']
      });
      
      if (utilisateur) {
        req.user = {
          id: decoded.id,
          role: decoded.role,
          email: utilisateur.email,
          nom: utilisateur.nom
        };
      } else {
        req.user = null;
      }
    } catch (jwtError) {
      // Token invalide ou expiré, mais on continue sans utilisateur
      req.user = null;
    }
    
    next();
  } catch (error) {
    console.error('Erreur dans le middleware d\'authentification optionnelle:', error);
    req.user = null;
    next();
  }
};

module.exports = {
  auth,
  optionalAuth
};