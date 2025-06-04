// controllers/vendeurController.js - Contrôleur pour les vendeurs
const { Vendeur, Boutique, Produit, Utilisateur, GradeVendeur ,
 StatistiqueVente } = require('../models/db');
const apiResponse = require('../utils/apiResponse');
const { validationResult } = require('express-validator');

class VendeurController {

  // ==================== GESTION DU PROFIL ====================

  /**
   * @desc    Obtenir le profil complet du vendeur
   * @route   GET /api/vendeur/profil
   * @access  Private (Vendeur)
   */
  static async obtenirProfilComplet(req, res) {
    try {
      console.log(`🔍 Récupération profil vendeur ${req.vendeur.id}`);

      const result = await req.vendeur.obtenirProfilComplet();

      if (!result.success) {
        return apiResponse.ErrorResponse(res, result.message);
      }

      return apiResponse.successResponseWithData(res, 'Profil récupéré avec succès', {
        profil: result.profil
      });

    } catch (error) {
      console.error('❌ Erreur récupération profil:', error.message);
      return apiResponse.ErrorResponse(res, 'Erreur lors de la récupération du profil');
    }
  }

  /**
   * @desc    Mettre à jour les informations du vendeur
   * @route   PUT /api/vendeur/profil
   * @access  Private (Vendeur)
   */
  static async mettreAJourInformations(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return apiResponse.validationErrorWithData(res, 'Erreurs de validation', errors.array());
      }

      console.log(`🔄 Mise à jour profil vendeur ${req.vendeur.id}:`, req.body);

      const result = await req.vendeur.mettreAJourInformations(req.body);

      if (!result.success) {
        return apiResponse.ErrorResponse(res, result.message);
      }

      return apiResponse.successResponse(res, result.message);

    } catch (error) {
      console.error('❌ Erreur mise à jour profil:', error.message);
      return apiResponse.ErrorResponse(res, 'Erreur lors de la mise à jour du profil');
    }
  }

  /**
 * @desc    Obtenir le tableau de bord du vendeur
 * @route   GET /api/vendeur/dashboard
 * @access  Private (Vendeur)
 */
static async obtenirTableauDeBord(req, res) {
  try {
    console.log(`📊 Récupération dashboard vendeur ${req.vendeur.id}`);

    // Récupérer les données avec Sequelize directement
    const [boutiquesCount, produitsCount, statistiques] = await Promise.all([
      // Compter les boutiques du vendeur
      Boutique.count({
        where: { vendeur_id: req.vendeur.id }
      }),
      
      // Compter les produits du vendeur
      Produit.count({
        include: [{
          model: Boutique,
          as: 'boutique',
          where: { vendeur_id: req.vendeur.id }
        }]
      }),
      
      // Récupérer les statistiques récentes
      StatistiqueVente.findAll({
        where: { vendeur_id: req.vendeur.id },
        order: [['date', 'DESC']],
        limit: 30
      })
    ]);

    // Calculer les données du dashboard
    const dashboard = {
      statistiques_generales: {
        boutiques: boutiquesCount,
        produits: produitsCount,
        commandes_totales: statistiques.reduce((sum, stat) => sum + stat.ventes, 0),
        chiffre_affaires_total: statistiques.reduce((sum, stat) => sum + parseFloat(stat.chiffre_affaires), 0)
      },
      vendeur: {
        id: req.vendeur.id,
        nom: req.vendeur.utilisateur?.nom || req.user.nom,
        email: req.vendeur.utilisateur?.email || req.user.email,
        grade: req.vendeur.grade?.nom || 'Débutant'
      },
      statistiques_recentes: statistiques.slice(0, 7), // 7 derniers jours
      alertes: {
        nouvelles_commandes: 0, // À calculer selon vos besoins
        stock_faible: 0 // À calculer selon vos besoins
      }
    };

    return apiResponse.successResponseWithData(res, 'Tableau de bord récupéré avec succès', {
      dashboard
    });

  } catch (error) {
    console.error('❌ Erreur récupération dashboard:', error.message);
    return apiResponse.ErrorResponse(res, 'Erreur lors de la récupération du tableau de bord');
  }
}
  // ==================== GESTION DES BOUTIQUES ====================
static async creerBoutique(req, res) {
  try {
    const { nom, description } = req.body;
    console.log(`🏪 Création boutique par vendeur ${req.vendeur.id}:`, req.body);

    // Créer avec seulement les champs essentiels
    const nouvelleBoutique = await Boutique.create({
      vendeur_id: req.vendeur.id,
      nom: nom,
      description: description || '',
      template_id: 1,           // Template qui existe
      statut: 'active',         // Statut par défaut
      nombre_visites: 0,        // Valeur par défaut
      note_moyenne: 0.00,       // Valeur par défaut
      nombre_ventes: 0          // Valeur par défaut
    }, {
      // Spécifier explicitement les champs à insérer
      fields: ['vendeur_id', 'nom', 'description', 'template_id', 'statut', 'nombre_visites', 'note_moyenne', 'nombre_ventes']
    });

    console.log('✅ Boutique créée avec ID:', nouvelleBoutique.id);

    return apiResponse.successResponseWithData(res, 'Boutique créée avec succès', {
      boutique: nouvelleBoutique
    });

  } catch (error) {
    console.error('❌ Erreur création boutique:', error.message);
    console.error('❌ Stack:', error.stack);
    return apiResponse.ErrorResponse(res, 'Erreur lors de la création de la boutique');
  }
}

  /**
   * @desc    Lister toutes les boutiques du vendeur
   * @route   GET /api/vendeur/boutiques
   * @access  Private (Vendeur)
   */
  static async listerBoutiques(req, res) {
    try {
      console.log(`📋 Liste boutiques vendeur ${req.vendeur.id}`);

      const boutiques = await req.vendeur.getBoutiques({
        include: [
          {
            model: Produit,
            as: 'produits',
            attributes: ['id', 'nom', 'prix', 'stock']
          }
        ],
        order: [['created_at', 'DESC']]
      });

      const boutiquesFormatted = boutiques.map(boutique => ({
        id: boutique.id,
        nom: boutique.nom,
        description: boutique.description,
        template_id: boutique.template_id,
        nombre_produits: boutique.produits.length,
        produits_en_stock: boutique.produits.filter(p => p.stock > 0).length,
        created_at: boutique.created_at,
        updated_at: boutique.updated_at
      }));

      return apiResponse.successResponseWithData(res, 'Boutiques récupérées avec succès', {
        boutiques: boutiquesFormatted,
        total: boutiques.length
      });

    } catch (error) {
      console.error('❌ Erreur liste boutiques:', error.message);
      return apiResponse.ErrorResponse(res, 'Erreur lors de la récupération des boutiques');
    }
  }

  /**
   * @desc    Obtenir une boutique spécifique
   * @route   GET /api/vendeur/boutiques/:boutiqueId
   * @access  Private (Vendeur)
   */
  static async obtenirBoutique(req, res) {
    try {
      const { boutiqueId } = req.params;
      console.log(`🔍 Récupération boutique ${boutiqueId} par vendeur ${req.vendeur.id}`);

      const result = await req.vendeur.obtenirBoutique(parseInt(boutiqueId));

      if (!result.success) {
        return apiResponse.notFoundResponse(res, result.message);
      }

      return apiResponse.successResponseWithData(res, 'Boutique récupérée avec succès', {
        boutique: result.boutique
      });

    } catch (error) {
      console.error('❌ Erreur récupération boutique:', error.message);
      return apiResponse.ErrorResponse(res, 'Erreur lors de la récupération de la boutique');
    }
  }

  /**
   * @desc    Modifier une boutique
   * @route   PUT /api/vendeur/boutiques/:boutiqueId
   * @access  Private (Vendeur)
   */
  static async modifierBoutique(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return apiResponse.validationErrorWithData(res, 'Erreurs de validation', errors.array());
      }

      const { boutiqueId } = req.params;
      console.log(`🔄 Modification boutique ${boutiqueId}:`, req.body);

      const result = await req.vendeur.modifierBoutique(parseInt(boutiqueId), req.body);

      if (!result.success) {
        return apiResponse.ErrorResponse(res, result.message);
      }

      return apiResponse.successResponseWithData(res, result.message, {
        boutique: result.boutique
      });

    } catch (error) {
      console.error('❌ Erreur modification boutique:', error.message);
      return apiResponse.ErrorResponse(res, 'Erreur lors de la modification de la boutique');
    }
  }

  /**
   * @desc    Supprimer une boutique
   * @route   DELETE /api/vendeur/boutiques/:boutiqueId
   * @access  Private (Vendeur)
   */
  static async supprimerBoutique(req, res) {
    try {
      const { boutiqueId } = req.params;
      console.log(`🗑️ Suppression boutique ${boutiqueId} par vendeur ${req.vendeur.id}`);

      // Vérifier que la boutique appartient au vendeur
      const boutique = await Boutique.findOne({
        where: {
          id: boutiqueId,
          vendeur_id: req.vendeur.id
        },
        include: [{
          model: Produit,
          as: 'produits'
        }]
      });

      if (!boutique) {
        return apiResponse.notFoundResponse(res, 'Boutique non trouvée');
      }

      // Vérifier s'il y a des produits
      if (boutique.produits.length > 0) {
        return apiResponse.ErrorResponse(res, 'Impossible de supprimer une boutique contenant des produits');
      }

      await boutique.destroy();

      return apiResponse.successResponse(res, 'Boutique supprimée avec succès');

    } catch (error) {
      console.error('❌ Erreur suppression boutique:', error.message);
      return apiResponse.ErrorResponse(res, 'Erreur lors de la suppression de la boutique');
    }
  }

  // ==================== GESTION DES PRODUITS ====================

  /**
   * @desc    Ajouter un produit à une boutique
   * @route   POST /api/vendeur/produits
   * @access  Private (Vendeur)
   */
  static async ajouterProduit(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return apiResponse.validationErrorWithData(res, 'Erreurs de validation', errors.array());
      }

      console.log(`📦 Ajout produit par vendeur ${req.vendeur.id}:`, req.body);

      const result = await req.vendeur.ajouterProduit(req.body);

      if (!result.success) {
        return apiResponse.ErrorResponse(res, result.message);
      }

      return apiResponse.createdResponse(res, result.message, {
        produit: result.produit
      });

    } catch (error) {
      console.error('❌ Erreur ajout produit:', error.message);
      return apiResponse.ErrorResponse(res, 'Erreur lors de l\'ajout du produit');
    }
  }

  /**
   * @desc    Lister tous les produits du vendeur
   * @route   GET /api/vendeur/produits
   * @access  Private (Vendeur)
   */
  static async listerProduits(req, res) {
    try {
      const { boutique_id, limit = 50, offset = 0 } = req.query;
      
      console.log(`📋 Liste produits vendeur ${req.vendeur.id}`, { boutique_id, limit, offset });

      const whereClause = {};
      if (boutique_id) {
        whereClause.boutique_id = boutique_id;
      }

      const produits = await Produit.findAndCountAll({
        where: whereClause,
        include: [{
          model: Boutique,
          as: 'boutique',
          where: { vendeur_id: req.vendeur.id },
          attributes: ['id', 'nom']
        }],
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['created_at', 'DESC']]
      });

      return apiResponse.successResponseWithData(res, 'Produits récupérés avec succès', {
        produits: produits.rows,
        pagination: {
          total: produits.count,
          limit: parseInt(limit),
          offset: parseInt(offset),
          pages: Math.ceil(produits.count / limit)
        }
      });

    } catch (error) {
      console.error('❌ Erreur liste produits:', error.message);
      return apiResponse.ErrorResponse(res, 'Erreur lors de la récupération des produits');
    }
  }

  /**
   * @desc    Obtenir un produit spécifique
   * @route   GET /api/vendeur/produits/:produitId
   * @access  Private (Vendeur)
   */
  static async obtenirProduit(req, res) {
    try {
      const { produitId } = req.params;
      console.log(`🔍 Récupération produit ${produitId} par vendeur ${req.vendeur.id}`);

      const produit = await Produit.findOne({
        where: { id: produitId },
        include: [{
          model: Boutique,
          as: 'boutique',
          where: { vendeur_id: req.vendeur.id }
        }]
      });

      if (!produit) {
        return apiResponse.notFoundResponse(res, 'Produit non trouvé');
      }

      return apiResponse.successResponseWithData(res, 'Produit récupéré avec succès', {
        produit
      });

    } catch (error) {
      console.error('❌ Erreur récupération produit:', error.message);
      return apiResponse.ErrorResponse(res, 'Erreur lors de la récupération du produit');
    }
  }

  /**
   * @desc    Modifier un produit
   * @route   PUT /api/vendeur/produits/:produitId
   * @access  Private (Vendeur)
   */
  static async modifierProduit(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return apiResponse.validationErrorWithData(res, 'Erreurs de validation', errors.array());
      }

      const { produitId } = req.params;
      console.log(`🔄 Modification produit ${produitId}:`, req.body);

      const result = await req.vendeur.modifierProduit(parseInt(produitId), req.body);

      if (!result.success) {
        return apiResponse.ErrorResponse(res, result.message);
      }

      return apiResponse.successResponseWithData(res, result.message, {
        produit: result.produit
      });

    } catch (error) {
      console.error('❌ Erreur modification produit:', error.message);
      return apiResponse.ErrorResponse(res, 'Erreur lors de la modification du produit');
    }
  }

  /**
   * @desc    Supprimer un produit
   * @route   DELETE /api/vendeur/produits/:produitId
   * @access  Private (Vendeur)
   */
  static async supprimerProduit(req, res) {
    try {
      const { produitId } = req.params;
      console.log(`🗑️ Suppression produit ${produitId} par vendeur ${req.vendeur.id}`);

      const result = await req.vendeur.supprimerProduit(parseInt(produitId));

      if (!result.success) {
        return apiResponse.ErrorResponse(res, result.message);
      }

      return apiResponse.successResponse(res, result.message);

    } catch (error) {
      console.error('❌ Erreur suppression produit:', error.message);
      return apiResponse.ErrorResponse(res, 'Erreur lors de la suppression du produit');
    }
  }

  /**
   * @desc    Vérifier le stock de tous les produits
   * @route   GET /api/vendeur/stock
   * @access  Private (Vendeur)
   */
  static async verifierStock(req, res) {
    try {
      const { seuil_critique = 5 } = req.query;
      console.log(`📊 Vérification stock vendeur ${req.vendeur.id}, seuil: ${seuil_critique}`);

      const result = await req.vendeur.verifierStock(parseInt(seuil_critique));

      if (!result.success) {
        return apiResponse.ErrorResponse(res, result.message);
      }

      return apiResponse.successResponseWithData(res, 'Rapport de stock généré avec succès', {
        rapport: result.rapport
      });

    } catch (error) {
      console.error('❌ Erreur vérification stock:', error.message);
      return apiResponse.ErrorResponse(res, 'Erreur lors de la vérification du stock');
    }
  }

  // ==================== GESTION DES COMMANDES ====================

  /**
   * @desc    Lister les paniers validés (commandes)
   * @route   GET /api/vendeur/commandes
   * @access  Private (Vendeur)
   */
  static async listerCommandes(req, res) {
    try {
      const { statut, date_debut, date_fin, limit = 50 } = req.query;
      
      console.log(`📋 Liste commandes vendeur ${req.vendeur.id}`, { statut, date_debut, date_fin });

      const options = {
        limit: parseInt(limit)
      };

      if (statut) options.statut = statut;
      if (date_debut && date_fin) {
        options.dateDebut = date_debut;
        options.dateFin = date_fin;
      }

      const result = await req.vendeur.listerPaniersValidés(options);

      if (!result.success) {
        return apiResponse.ErrorResponse(res, result.message);
      }

      return apiResponse.successResponseWithData(res, 'Commandes récupérées avec succès', {
        commandes: result.paniers,
        total: result.paniers.length
      });

    } catch (error) {
      console.error('❌ Erreur liste commandes:', error.message);
      return apiResponse.ErrorResponse(res, 'Erreur lors de la récupération des commandes');
    }
  }

  /**
   * @desc    Modifier le statut d'une commande
   * @route   PUT /api/vendeur/commandes/:panierId/statut
   * @access  Private (Vendeur)
   */
  static async modifierStatutCommande(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return apiResponse.validationErrorWithData(res, 'Erreurs de validation', errors.array());
      }

      const { panierId } = req.params;
      const { statut } = req.body;
      
      console.log(`🔄 Modification statut commande ${panierId} vers ${statut}`);

      const result = await req.vendeur.modifierStatutPanier(parseInt(panierId), statut);

      if (!result.success) {
        return apiResponse.ErrorResponse(res, result.message);
      }

      return apiResponse.successResponse(res, result.message);

    } catch (error) {
      console.error('❌ Erreur modification statut:', error.message);
      return apiResponse.ErrorResponse(res, 'Erreur lors de la modification du statut');
    }
  }

  // ==================== GRADES ET STATISTIQUES ====================
// À ajouter à la fin de votre fichier controllers/vendeurController.js

  /**
   * @desc    Demander une promotion de grade
   * @route   POST /api/vendeur/grade/promotion
   * @access  Private (Vendeur)
   */
  static async demanderPromotionGrade(req, res) {
    try {
      console.log(`⭐ Demande promotion grade vendeur ${req.vendeur.id}`);

      const result = await req.vendeur.demanderPromotionGrade();

      if (!result.success) {
        return apiResponse.ErrorResponse(res, result.message);
      }

      return apiResponse.successResponseWithData(res, result.message, {
        demande: result.demande
      });

    } catch (error) {
      console.error('❌ Erreur demande promotion:', error.message);
      return apiResponse.ErrorResponse(res, 'Erreur lors de la demande de promotion');
    }
  }

  /**
   * @desc    Obtenir les statistiques de vente
   * @route   GET /api/vendeur/statistiques
   * @access  Private (Vendeur)
   */
  static async obtenirStatistiques(req, res) {
    try {
      const { periode = 'mois', date_debut, date_fin } = req.query;
      
      console.log(`📊 Statistiques vendeur ${req.vendeur.id}`, { periode, date_debut, date_fin });

      const options = { periode };
      if (date_debut && date_fin) {
        options.dateDebut = date_debut;
        options.dateFin = date_fin;
      }

      const result = await req.vendeur.obtenirStatistiques(options);

      if (!result.success) {
        return apiResponse.ErrorResponse(res, result.message);
      }

      return apiResponse.successResponseWithData(res, 'Statistiques récupérées avec succès', {
        statistiques: result.statistiques
      });

    } catch (error) {
      console.error('❌ Erreur récupération statistiques:', error.message);
      return apiResponse.ErrorResponse(res, 'Erreur lors de la récupération des statistiques');
    }
  }

  /**
   * @desc    Obtenir les informations sur le grade actuel
   * @route   GET /api/vendeur/grade
   * @access  Private (Vendeur)
   */
  static async obtenirInfosGrade(req, res) {
    try {
      console.log(`⭐ Infos grade vendeur ${req.vendeur.id}`);

      const result = await req.vendeur.obtenirInfosGrade();

      if (!result.success) {
        return apiResponse.ErrorResponse(res, result.message);
      }

      return apiResponse.successResponseWithData(res, 'Informations de grade récupérées avec succès', {
        grade: result.grade
      });

    } catch (error) {
      console.error('❌ Erreur récupération grade:', error.message);
      return apiResponse.ErrorResponse(res, 'Erreur lors de la récupération des informations de grade');
    }
  }
}

// ==================== EXPORT CORRIGÉ ====================

// Export comme objet avec méthodes (compatible avec vos routes)
const vendeurController = {
  obtenirProfilComplet: VendeurController.obtenirProfilComplet,
  mettreAJourInformations: VendeurController.mettreAJourInformations,
  obtenirTableauDeBord: VendeurController.obtenirTableauDeBord,
  creerBoutique: VendeurController.creerBoutique,
  listerBoutiques: VendeurController.listerBoutiques,
  obtenirBoutique: VendeurController.obtenirBoutique,
  modifierBoutique: VendeurController.modifierBoutique,
  supprimerBoutique: VendeurController.supprimerBoutique,
  ajouterProduit: VendeurController.ajouterProduit,
  listerProduits: VendeurController.listerProduits,
  obtenirProduit: VendeurController.obtenirProduit,
  modifierProduit: VendeurController.modifierProduit,
  supprimerProduit: VendeurController.supprimerProduit,
  verifierStock: VendeurController.verifierStock,
  listerCommandes: VendeurController.listerCommandes,
  modifierStatutCommande: VendeurController.modifierStatutCommande,
  demanderPromotionGrade: VendeurController.demanderPromotionGrade,
  obtenirStatistiques: VendeurController.obtenirStatistiques,
  obtenirInfosGrade: VendeurController.obtenirInfosGrade
};

module.exports = vendeurController;