// middlewares/vendeurOnly.js - Middleware pour restreindre l'accès aux vendeurs
const apiResponse = require('../utils/apiResponse');

/**
 * Middleware pour vérifier que l'utilisateur est un vendeur
 * À utiliser après le middleware auth
 */
const vendeurOnly = async (req, res, next) => {
  try {
    // Vérifier que l'utilisateur est authentifié
    if (!req.user) {
      return apiResponse.unauthorizedResponse(res, 'Authentification requise');
    }

    // Vérifier le rôle
    if (req.user.role !== 'vendeur') {
      console.log(`🚫 Accès refusé - Utilisateur ${req.user.email} (rôle: ${req.user.role}) tente d'accéder aux routes vendeur`);
      return apiResponse.forbiddenResponse(res, 'Accès réservé aux vendeurs uniquement');
    }

    // Charger les informations du vendeur depuis la base de données
    try {
      const { Vendeur } = require('../models/db');
      
      const vendeur = await Vendeur.findByPk(req.user.id, {
        include: [
          {
            model: require('../models/db').Utilisateur,
            as: 'utilisateur',
            attributes: ['nom', 'email', 'role']
          },
          {
            model: require('../models/db').GradeVendeur,
            as: 'grade',
            attributes: ['id', 'nom', 'avantages']
          }
        ]
      });

      if (!vendeur) {
        console.log(`🚫 Vendeur non trouvé pour l'utilisateur ${req.user.id}`);
        return apiResponse.notFoundResponse(res, 'Profil vendeur non trouvé');
      }

      // Ajouter les informations du vendeur à la requête
      req.vendeur = vendeur;
      req.user.vendeur = {
        id: vendeur.id,
        numero_fiscal: vendeur.numero_fiscal,
        grade_id: vendeur.grade_id,
        grade: vendeur.grade
      };

      console.log(`✅ Accès autorisé - Vendeur ${vendeur.utilisateur.nom} (ID: ${vendeur.id}, Grade: ${vendeur.grade.nom})`);
      
      next();
      
    } catch (dbError) {
      console.error('❌ Erreur lors de la récupération du vendeur:', dbError.message);
      return apiResponse.ErrorResponse(res, 'Erreur lors de la vérification du profil vendeur');
    }

  } catch (error) {
    console.error('❌ Erreur dans le middleware vendeurOnly:', error.message);
    return apiResponse.ErrorResponse(res, 'Erreur de vérification des permissions');
  }
};

/**
 * Middleware pour vérifier le grade minimum requis
 * @param {number} gradeMinimum - Grade minimum requis (1=Bronze, 2=Argent, 3=Or, 4=Platine)
 */
const gradeMinimum = (gradeMinimum) => {
  return async (req, res, next) => {
    try {
      if (!req.vendeur || !req.vendeur.grade) {
        return apiResponse.forbiddenResponse(res, 'Informations de grade non disponibles');
      }

      if (req.vendeur.grade.id < gradeMinimum) {
        const gradesNoms = {
          1: 'Bronze',
          2: 'Argent', 
          3: 'Or',
          4: 'Platine'
        };

        console.log(`🚫 Grade insuffisant - Vendeur ${req.vendeur.id} (Grade: ${req.vendeur.grade.nom}) requiert ${gradesNoms[gradeMinimum]}`);
        
        return apiResponse.forbiddenResponse(res, 
          `Cette fonctionnalité nécessite le grade ${gradesNoms[gradeMinimum]} minimum. Votre grade actuel: ${req.vendeur.grade.nom}`
        );
      }

      console.log(`✅ Grade suffisant - Vendeur ${req.vendeur.id} (Grade: ${req.vendeur.grade.nom})`);
      next();

    } catch (error) {
      console.error('❌ Erreur dans la vérification du grade:', error.message);
      return apiResponse.ErrorResponse(res, 'Erreur de vérification du grade');
    }
  };
};

/**
 * Middleware pour vérifier la propriété d'une ressource
 * @param {string} resourceModel - Nom du modèle de la ressource
 * @param {string} resourceIdParam - Nom du paramètre contenant l'ID de la ressource
 * @param {string} vendeurIdField - Nom du champ contenant l'ID du vendeur dans la ressource
 */
const checkResourceOwnership = (resourceModel, resourceIdParam = 'id', vendeurIdField = 'vendeur_id') => {
  return async (req, res, next) => {
    try {
      const resourceId = req.params[resourceIdParam];
      
      if (!resourceId) {
        return apiResponse.ErrorResponse(res, `Paramètre ${resourceIdParam} manquant`);
      }

      const { [resourceModel]: Model } = require('../models/db');
      
      if (!Model) {
        return apiResponse.ErrorResponse(res, `Modèle ${resourceModel} non trouvé`);
      }

      const resource = await Model.findByPk(resourceId);
      
      if (!resource) {
        return apiResponse.notFoundResponse(res, 'Ressource non trouvée');
      }

      if (resource[vendeurIdField] !== req.vendeur.id) {
        console.log(`🚫 Propriété refusée - Vendeur ${req.vendeur.id} tente d'accéder à la ressource ${resourceId} du vendeur ${resource[vendeurIdField]}`);
        return apiResponse.forbiddenResponse(res, 'Vous ne pouvez accéder qu\'à vos propres ressources');
      }

      // Ajouter la ressource à la requête pour éviter une nouvelle requête dans le contrôleur
      req.resource = resource;
      
      console.log(`✅ Propriété vérifiée - Vendeur ${req.vendeur.id} accède à sa ressource ${resourceId}`);
      next();

    } catch (error) {
      console.error('❌ Erreur dans la vérification de propriété:', error.message);
      return apiResponse.ErrorResponse(res, 'Erreur de vérification de propriété');
    }
  };
};

/**
 * Middleware pour vérifier si le vendeur peut créer plus de boutiques selon son grade
 */
const checkBoutiqueLimit = async (req, res, next) => {
  try {
    const { Boutique } = require('../models/db');
    
    const boutiquesCount = await Boutique.count({
      where: { vendeur_id: req.vendeur.id }
    });

    const limiteParGrade = {
      1: 1,   // Bronze: 1 boutique
      2: 3,   // Argent: 3 boutiques
      3: 5,   // Or: 5 boutiques
      4: 10   // Platine: 10 boutiques
    };

    const limite = limiteParGrade[req.vendeur.grade.id] || 1;

    if (boutiquesCount >= limite) {
      console.log(`🚫 Limite boutiques atteinte - Vendeur ${req.vendeur.id} (${boutiquesCount}/${limite})`);
      return apiResponse.forbiddenResponse(res, 
        `Votre grade ${req.vendeur.grade.nom} ne permet que ${limite} boutique(s). Vous en avez déjà ${boutiquesCount}.`
      );
    }

    console.log(`✅ Limite boutiques OK - Vendeur ${req.vendeur.id} (${boutiquesCount}/${limite})`);
    next();

  } catch (error) {
    console.error('❌ Erreur dans la vérification des limites de boutiques:', error.message);
    return apiResponse.ErrorResponse(res, 'Erreur de vérification des limites');
  }
};

/**
 * Middleware pour vérifier si le vendeur peut ajouter plus de produits selon son grade
 */
const checkProduitLimit = async (req, res, next) => {
  try {
    const boutiqueId = req.body.boutique_id || req.params.boutiqueId;
    
    if (!boutiqueId) {
      return apiResponse.ErrorResponse(res, 'ID de boutique requis');
    }

    const { Produit } = require('../models/db');
    
    const produitsCount = await Produit.count({
      where: { boutique_id: boutiqueId }
    });

    const limitesParGrade = {
      1: 10,    // Bronze: 10 produits par boutique
      2: 50,    // Argent: 50 produits par boutique  
      3: 200,   // Or: 200 produits par boutique
      4: 1000   // Platine: 1000 produits par boutique
    };

    const limite = limitesParGrade[req.vendeur.grade.id] || 10;

    if (produitsCount >= limite) {
      console.log(`🚫 Limite produits atteinte - Boutique ${boutiqueId} (${produitsCount}/${limite})`);
      return apiResponse.forbiddenResponse(res, 
        `Votre grade ${req.vendeur.grade.nom} limite à ${limite} produits par boutique. Cette boutique en a déjà ${produitsCount}.`
      );
    }

    console.log(`✅ Limite produits OK - Boutique ${boutiqueId} (${produitsCount}/${limite})`);
    next();

  } catch (error) {
    console.error('❌ Erreur dans la vérification des limites de produits:', error.message);
    return apiResponse.ErrorResponse(res, 'Erreur de vérification des limites');
  }
};

module.exports = {
  vendeurOnly,
  gradeMinimum,
  checkResourceOwnership,
  checkBoutiqueLimit,
  checkProduitLimit
};