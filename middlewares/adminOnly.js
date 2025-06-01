// middlewares/adminOnly.js
const ApiResponse = require('../utils/apiResponse');

/**
 * Middleware pour vérifier le rôle administrateur
 * Doit être utilisé après le middleware auth
 */
const adminOnly = (req, res, next) => {
  try {
    // Vérifier que l'utilisateur est authentifié
    if (!req.user) {
      return ApiResponse.unauthorized(res, 'Authentification requise');
    }
    
    // Vérifier le rôle admin
    if (req.user.role !== 'admin') {
      return ApiResponse.forbidden(res, 'Accès réservé aux administrateurs uniquement');
    }
    
    // Ajouter des métadonnées pour le logging
    req.adminAction = true;
    req.adminUser = req.user.id;
    
    next();
  } catch (error) {
    console.error('Erreur dans le middleware adminOnly:', error);
    return ApiResponse.error(res, 'Erreur de vérification des permissions', 500);
  }
};

/**
 * Middleware pour les actions critiques d'admin
 * Nécessite une vérification supplémentaire
 */
const superAdminOnly = (req, res, next) => {
  try {
    if (!req.user) {
      return ApiResponse.unauthorized(res, 'Authentification requise');
    }
    
    if (req.user.role !== 'admin') {
      return ApiResponse.forbidden(res, 'Accès réservé aux super administrateurs');
    }
    
    // Vérification supplémentaire - peut être étendue selon vos besoins
    // Par exemple, vérifier un niveau d'admin ou des permissions spéciales
    
    req.superAdminAction = true;
    req.adminUser = req.user.id;
    
    next();
  } catch (error) {
    console.error('Erreur dans le middleware superAdminOnly:', error);
    return ApiResponse.error(res, 'Erreur de vérification des permissions', 500);
  }
};

/**
 * Middleware pour autoriser admin OU propriétaire de la ressource
 * Utile pour les routes où l'admin peut tout faire, mais l'utilisateur peut gérer ses propres données
 */
const adminOrOwner = (ownerField = 'user_id') => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return ApiResponse.unauthorized(res, 'Authentification requise');
      }
      
      // Si c'est un admin, autoriser
      if (req.user.role === 'admin') {
        req.isAdmin = true;
        return next();
      }
      
      // Sinon, vérifier que c'est le propriétaire
      // Cette vérification peut être faite ici ou déléguée au contrôleur
      req.isOwner = true;
      req.ownerField = ownerField;
      
      next();
    } catch (error) {
      console.error('Erreur dans le middleware adminOrOwner:', error);
      return ApiResponse.error(res, 'Erreur de vérification des permissions', 500);
    }
  };
};

module.exports = {
  adminOnly,
  superAdminOnly,
  adminOrOwner
};