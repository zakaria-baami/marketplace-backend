// middlewares/vendeurOnly.js
const ApiResponse = require('../utils/apiResponse');
const { Vendeur, GradeVendeur } = require('../models');

/**
 * Middleware pour vérifier le rôle vendeur
 * Doit être utilisé après le middleware auth
 */
const vendeurOnly = (req, res, next) => {
  try {
    // Vérifier que l'utilisateur est authentifié
    if (!req.user) {
      return ApiResponse.unauthorized(res, 'Authentification requise');
    }
    
    // Vérifier le rôle vendeur
    if (req.user.role !== 'vendeur') {
      return ApiResponse.forbidden(res, 'Accès réservé aux vendeurs uniquement');
    }
    
    // Ajouter des métadonnées pour le logging
    req.vendeurAction = true;
    req.vendeurId = req.user.id;
    
    next();
  } catch (error) {
    console.error('Erreur dans le middleware vendeurOnly:', error);
    return ApiResponse.error(res, 'Erreur de vérification des permissions', 500);
  }
};

/**
 * Middleware pour autoriser vendeur OU admin
 * Utile pour les routes où l'admin peut gérer les vendeurs
 */
const vendeurOrAdmin = (req, res, next) => {
  try {
    if (!req.user) {
      return ApiResponse.unauthorized(res, 'Authentification requise');
    }
    
    if (req.user.role !== 'vendeur' && req.user.role !== 'admin') {
      return ApiResponse.forbidden(res, 'Accès réservé aux vendeurs et administrateurs');
    }
    
    // Marquer le type d'utilisateur pour le contrôleur
    req.isVendeur = req.user.role === 'vendeur';
    req.isAdmin = req.user.role === 'admin';
    
    next();
  } catch (error) {
    console.error('Erreur dans le middleware vendeurOrAdmin:', error);
    return ApiResponse.error(res, 'Erreur de vérification des permissions', 500);
  }
};

/**
 * Middleware pour vérifier qu'un vendeur peut accéder à ses propres données
 * Le paramètre vendeurIdField indique quel champ contient l'ID du vendeur
 */
const ownVendeurDataOnly = (vendeurIdField = 'vendeur_id') => {
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
      
      // Vérifier que c'est un vendeur
      if (req.user.role !== 'vendeur') {
        return ApiResponse.forbidden(res, 'Accès réservé aux vendeurs');
      }
      
      // Le contrôleur devra vérifier que le vendeur_id correspond à req.user.id
      req.vendeurIdField = vendeurIdField;
      req.mustCheckOwnership = true;
      
      next();
    } catch (error) {
      console.error('Erreur dans le middleware ownVendeurDataOnly:', error);
      return ApiResponse.error(res, 'Erreur de vérification des permissions', 500);
    }
  };
};

/**
 * Middleware pour vérifier le grade minimum requis d'un vendeur
 * @param {number} gradeMinimum - Grade minimum requis (1=Amateur, 2=Professionnel, 3=Premium)
 */
const requireVendeurGrade = (gradeMinimum = 1) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return ApiResponse.unauthorized(res, 'Authentification requise');
      }
      
      if (req.user.role !== 'vendeur') {
        return ApiResponse.forbidden(res, 'Accès réservé aux vendeurs');
      }
      
      // Récupérer les informations du vendeur avec son grade
      const vendeur = await Vendeur.findByPk(req.user.id, {
        include: [{
          model: GradeVendeur,
          as: 'grade'
        }]
      });
      
      if (!vendeur) {
        return ApiResponse.notFound(res, 'Profil vendeur non trouvé');
      }
      
      // Vérifier le grade
      if (vendeur.grade_id < gradeMinimum) {
        const gradeRequis = await GradeVendeur.findByPk(gradeMinimum);
        return ApiResponse.forbidden(res, 
          `Cette action nécessite le grade ${gradeRequis?.nom || 'supérieur'} ou plus élevé`
        );
      }
      
      // Ajouter les informations du grade à la requête
      req.vendeurGrade = {
        id: vendeur.grade_id,
        nom: vendeur.grade?.nom,
        niveau: vendeur.grade_id
      };
      
      next();
    } catch (error) {
      console.error('Erreur dans le middleware requireVendeurGrade:', error);
      return ApiResponse.error(res, 'Erreur de vérification du grade vendeur', 500);
    }
  };
};

/**
 * Middleware pour les actions sensibles des vendeurs
 * Peut inclure des vérifications supplémentaires comme le statut du compte
 */
const vendeurSensitiveAction = async (req, res, next) => {
  try {
    if (!req.user) {
      return ApiResponse.unauthorized(res, 'Authentification requise');
    }
    
    if (req.user.role !== 'vendeur') {
      return ApiResponse.forbidden(res, 'Accès réservé aux vendeurs');
    }
    
    // Vérifier que le vendeur existe et est actif
    const vendeur = await Vendeur.findByPk(req.user.id, {
      include: [{
        model: GradeVendeur,
        as: 'grade'
      }]
    });
    
    if (!vendeur) {
      return ApiResponse.notFound(res, 'Profil vendeur non trouvé');
    }
    
    // Ajouter des vérifications supplémentaires si nécessaire
    // Par exemple : vérifier que le compte vendeur est vérifié, actif, etc.
    
    // Marquer comme action sensible pour le logging
    req.sensitiveVendeurAction = true;
    req.vendeurId = req.user.id;
    req.vendeurGrade = vendeur.grade;
    
    next();
  } catch (error) {
    console.error('Erreur dans le middleware vendeurSensitiveAction:', error);
    return ApiResponse.error(res, 'Erreur de vérification des permissions', 500);
  }
};

/**
 * Middleware pour vérifier qu'une boutique appartient au vendeur connecté
 * Utilisé pour les routes qui manipulent des ressources liées à une boutique
 */
const ownBoutiqueOnly = async (req, res, next) => {
  try {
    if (!req.user) {
      return ApiResponse.unauthorized(res, 'Authentification requise');
    }
    
    // Si c'est un admin, autoriser
    if (req.user.role === 'admin') {
      req.isAdmin = true;
      return next();
    }
    
    if (req.user.role !== 'vendeur') {
      return ApiResponse.forbidden(res, 'Accès réservé aux vendeurs');
    }
    
    // Le contrôleur devra vérifier que la boutique appartient bien au vendeur
    req.mustCheckBoutiqueOwnership = true;
    req.vendeurId = req.user.id;
    
    next();
  } catch (error) {
    console.error('Erreur dans le middleware ownBoutiqueOnly:', error);
    return ApiResponse.error(res, 'Erreur de vérification des permissions', 500);
  }
};

module.exports = {
  vendeurOnly,
  vendeurOrAdmin,
  ownVendeurDataOnly,
  requireVendeurGrade,
  vendeurSensitiveAction,
  ownBoutiqueOnly
};