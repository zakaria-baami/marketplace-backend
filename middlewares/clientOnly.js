// middlewares/clientOnly.js
const ApiResponse = require('../utils/apiResponse');

/**
 * Middleware pour vérifier le rôle client
 * Doit être utilisé après le middleware auth
 */
const clientOnly = (req, res, next) => {
  try {
    // Vérifier que l'utilisateur est authentifié
    if (!req.user) {
      return ApiResponse.unauthorized(res, 'Authentification requise');
    }
    
    // Vérifier le rôle client
    if (req.user.role !== 'client') {
      return ApiResponse.forbidden(res, 'Accès réservé aux clients uniquement');
    }
    
    // Ajouter des métadonnées pour le logging
    req.clientAction = true;
    req.clientId = req.user.id;
    
    next();
  } catch (error) {
    console.error('Erreur dans le middleware clientOnly:', error);
    return ApiResponse.error(res, 'Erreur de vérification des permissions', 500);
  }
};

/**
 * Middleware pour autoriser client OU admin
 * Utile pour les routes où l'admin peut aider les clients
 */
const clientOrAdmin = (req, res, next) => {
  try {
    if (!req.user) {
      return ApiResponse.unauthorized(res, 'Authentification requise');
    }
    
    if (req.user.role !== 'client' && req.user.role !== 'admin') {
      return ApiResponse.forbidden(res, 'Accès réservé aux clients et administrateurs');
    }
    
    // Marquer le type d'utilisateur pour le contrôleur
    req.isClient = req.user.role === 'client';
    req.isAdmin = req.user.role === 'admin';
    
    next();
  } catch (error) {
    console.error('Erreur dans le middleware clientOrAdmin:', error);
    return ApiResponse.error(res, 'Erreur de vérification des permissions', 500);
  }
};

/**
 * Middleware pour vérifier qu'un client peut accéder à ses propres données
 * Le paramètre clientIdField indique quel champ contient l'ID du client
 */
const ownClientDataOnly = (clientIdField = 'client_id') => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return ApiResponse.unauthorized(res, 'Authentification requise');
      }
      
      // Si c'est un admin, autoriser l'accès
      if (req.user.role === 'admin') {
        req.isAdmin = true;
        return next();
      }
      
      // Vérifier que c'est un client
      if (req.user.role !== 'client') {
        return ApiResponse.forbidden(res, 'Accès réservé aux clients');
      }
      
      // Le contrôleur devra vérifier que le client_id correspond à req.user.id
      req.clientIdField = clientIdField;
      req.mustCheckOwnership = true;
      
      next();
    } catch (error) {
      console.error('Erreur dans le middleware ownClientDataOnly:', error);
      return ApiResponse.error(res, 'Erreur de vérification des permissions', 500);
    }
  };
};

/**
 * Middleware pour les actions sensibles des clients (comme passer commande)
 * Peut inclure des vérifications supplémentaires
 */
const clientSensitiveAction = (req, res, next) => {
  try {
    if (!req.user) {
      return ApiResponse.unauthorized(res, 'Authentification requise');
    }
    
    if (req.user.role !== 'client') {
      return ApiResponse.forbidden(res, 'Accès réservé aux clients');
    }
    
    // Ajouter des vérifications supplémentaires si nécessaire
    // Par exemple : vérifier que le compte client est activé, vérifié, etc.
    
    // Marquer comme action sensible pour le logging
    req.sensitiveClientAction = true;
    req.clientId = req.user.id;
    
    next();
  } catch (error) {
    console.error('Erreur dans le middleware clientSensitiveAction:', error);
    return ApiResponse.error(res, 'Erreur de vérification des permissions', 500);
  }
};

module.exports = {
  clientOnly,
  clientOrAdmin,
  ownClientDataOnly,
  clientSensitiveAction
};