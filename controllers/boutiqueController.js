// controllers/boutiqueController.js
const { Boutique, Vendeur, Template, Produit, Categorie, ImageProduit } = require('../models');
const ApiResponse = require('../utils/apiResponse');
const { Op } = require('sequelize');

class BoutiqueController {
  /**
   * Créer une nouvelle boutique
   */
  static async creerBoutique(req, res) {
    try {
      const { nom, description, template_id } = req.body;

      // Validation
      if (!nom) {
        return ApiResponse.validationError(res, [
          { field: 'nom', message: 'Le nom de la boutique est requis' }
        ]);
      }

      // Vérifier si le vendeur a déjà une boutique
      const boutiqueExistante = await Boutique.findOne({
        where: { vendeur_id: req.user.id }
      });

      if (boutiqueExistante) {
        return ApiResponse.error(res, 'Vous avez déjà une boutique', 409);
      }

      // Vérifier que le template existe et est compatible avec le grade du vendeur
      const vendeur = await Vendeur.findByPk(req.user.id, {
        include: ['grade']
      });

      if (template_id) {
        const template = await Template.findByPk(template_id);
        if (!template) {
          return ApiResponse.notFound(res, 'Template non trouvé');
        }

        if (template.grade_requis_id > vendeur.grade_id) {
          return ApiResponse.forbidden(res, 'Ce template nécessite un grade supérieur');
        }
      }

      // Créer la boutique
      const boutique = await Boutique.create({
        vendeur_id: req.user.id,
        nom,
        description,
        template_id: template_id || 1 // Template par défaut
      });

      // Récupérer la boutique avec ses relations
      const boutiqueComplete = await Boutique.findByPk(boutique.id, {
        include: [
          { model: Template, as: 'template' },
          { model: Vendeur, as: 'vendeur', include: ['grade'] }
        ]
      });

      return ApiResponse.created(res, boutiqueComplete, 'Boutique créée avec succès');

    } catch (error) {
      console.error('Erreur création boutique:', error);
      return ApiResponse.error(res, 'Erreur lors de la création de la boutique', 500);
    }
  }

  /**
   * Récupérer sa propre boutique (vendeur)
   */
  static async obtenirMaBoutique(req, res) {
    try {
      const boutique = await Boutique.findOne({
        where: { vendeur_id: req.user.id },
        include: [
          { model: Template, as: 'template' },
          { model: Vendeur, as: 'vendeur', include: ['grade'] },
          { 
            model: Produit, 
            as: 'produits',
            include: [
              { model: Categorie, as: 'categorie' },
              { model: ImageProduit, as: 'images' }
            ]
          }
        ]
      });

      if (!boutique) {
        return ApiResponse.notFound(res, 'Aucune boutique trouvée');
      }

      return ApiResponse.success(res, boutique);

    } catch (error) {
      console.error('Erreur récupération boutique:', error);
      return ApiResponse.error(res, 'Erreur lors de la récupération de la boutique', 500);
    }
  }

  /**
   * Récupérer une boutique publique par ID
   */
  static async obtenirBoutique(req, res) {
    try {
      const { id } = req.params;

      const boutique = await Boutique.findByPk(id, {
        include: [
          { model: Template, as: 'template' },
          { model: Vendeur, as: 'vendeur', include: ['grade'] },
          { 
            model: Produit, 
            as: 'produits',
            where: { stock: { [Op.gt]: 0 } }, // Seulement les produits en stock
            required: false,
            include: [
              { model: Categorie, as: 'categorie' },
              { model: ImageProduit, as: 'images' }
            ]
          }
        ]
      });

      if (!boutique) {
        return ApiResponse.notFound(res, 'Boutique non trouvée');
      }

      return ApiResponse.success(res, boutique);

    } catch (error) {
      console.error('Erreur récupération boutique:', error);
      return ApiResponse.error(res, 'Erreur lors de la récupération de la boutique', 500);
    }
  }

  /**
   * Lister toutes les boutiques publiques
   */
  static async listerBoutiques(req, res) {
    try {
      const { page = 1, limit = 12, search, grade } = req.query;
      const offset = (page - 1) * limit;

      const whereClause = {};
      if (search) {
        whereClause[Op.or] = [
          { nom: { [Op.like]: `%${search}%` } },
          { description: { [Op.like]: `%${search}%` } }
        ];
      }

      const includeClause = [
        { model: Template, as: 'template' },
        { 
          model: Vendeur, 
          as: 'vendeur', 
          include: ['grade'],
          ...(grade && { where: { grade_id: grade } })
        }
      ];

      const { count, rows } = await Boutique.findAndCountAll({
        where: whereClause,
        include: includeClause,
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['createdAt', 'DESC']]
      });

      return ApiResponse.paginated(res, rows, {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count
      });

    } catch (error) {
      console.error('Erreur liste boutiques:', error);
      return ApiResponse.error(res, 'Erreur lors de la récupération des boutiques', 500);
    }
  }

  /**
   * Mettre à jour sa boutique
   */
  static async mettreAJourBoutique(req, res) {
    try {
      const { nom, description, template_id } = req.body;

      const boutique = await Boutique.findOne({
        where: { vendeur_id: req.user.id }
      });

      if (!boutique) {
        return ApiResponse.notFound(res, 'Aucune boutique trouvée');
      }

      // Vérifier le template si fourni
      if (template_id) {
        const vendeur = await Vendeur.findByPk(req.user.id, {
          include: ['grade']
        });

        const template = await Template.findByPk(template_id);
        if (!template) {
          return ApiResponse.notFound(res, 'Template non trouvé');
        }

        if (template.grade_requis_id > vendeur.grade_id) {
          return ApiResponse.forbidden(res, 'Ce template nécessite un grade supérieur');
        }
      }

      // Mettre à jour la boutique
      await boutique.update({
        nom: nom || boutique.nom,
        description: description || boutique.description,
        template_id: template_id || boutique.template_id
      });

      // Récupérer la boutique mise à jour
      const boutiqueMiseAJour = await Boutique.findByPk(boutique.id, {
        include: [
          { model: Template, as: 'template' },
          { model: Vendeur, as: 'vendeur', include: ['grade'] }
        ]
      });

      return ApiResponse.updated(res, boutiqueMiseAJour);

    } catch (error) {
      console.error('Erreur mise à jour boutique:', error);
      return ApiResponse.error(res, 'Erreur lors de la mise à jour de la boutique', 500);
    }
  }

  /**
   * Supprimer sa boutique
   */
  static async supprimerBoutique(req, res) {
    try {
      const boutique = await Boutique.findOne({
        where: { vendeur_id: req.user.id }
      });

      if (!boutique) {
        return ApiResponse.notFound(res, 'Aucune boutique trouvée');
      }

      await boutique.destroy();
      return ApiResponse.deleted(res, 'Boutique supprimée avec succès');

    } catch (error) {
      console.error('Erreur suppression boutique:', error);
      return ApiResponse.error(res, 'Erreur lors de la suppression de la boutique', 500);
    }
  }

  /**
   * Changer le template de sa boutique
   */
  static async changerTemplate(req, res) {
    try {
      const { template_id } = req.body;

      if (!template_id) {
        return ApiResponse.validationError(res, [
          { field: 'template_id', message: 'L\'ID du template est requis' }
        ]);
      }

      const boutique = await Boutique.findOne({
        where: { vendeur_id: req.user.id }
      });

      if (!boutique) {
        return ApiResponse.notFound(res, 'Aucune boutique trouvée');
      }

      // Vérifier le grade requis pour le template
      const vendeur = await Vendeur.findByPk(req.user.id, {
        include: ['grade']
      });

      const template = await Template.findByPk(template_id);
      if (!template) {
        return ApiResponse.notFound(res, 'Template non trouvé');
      }

      if (template.grade_requis_id > vendeur.grade_id) {
        return ApiResponse.forbidden(res, 'Ce template nécessite un grade supérieur');
      }

      await boutique.update({ template_id });

      const boutiqueMiseAJour = await Boutique.findByPk(boutique.id, {
        include: [{ model: Template, as: 'template' }]
      });

      return ApiResponse.updated(res, boutiqueMiseAJour, 'Template mis à jour avec succès');

    } catch (error) {
      console.error('Erreur changement template:', error);
      return ApiResponse.error(res, 'Erreur lors du changement de template', 500);
    }
  }

  /**
   * Obtenir les statistiques de sa boutique
   */
  static async statistiquesBoutique(req, res) {
    try {
      const boutique = await Boutique.findOne({
        where: { vendeur_id: req.user.id }
      });

      if (!boutique) {
        return ApiResponse.notFound(res, 'Aucune boutique trouvée');
      }

      // Compter les produits
      const totalProduits = await Produit.count({
        where: { boutique_id: boutique.id }
      });

      const produitsEnStock = await Produit.count({
        where: { 
          boutique_id: boutique.id,
          stock: { [Op.gt]: 0 }
        }
      });

      const produitsRupture = totalProduits - produitsEnStock;

      // Calculer la valeur totale du stock
      const produits = await Produit.findAll({
        where: { boutique_id: boutique.id },
        attributes: ['prix', 'stock']
      });

      const valeurStock = produits.reduce((total, produit) => {
        return total + (produit.prix * produit.stock);
      }, 0);

      return ApiResponse.success(res, {
        total_produits: totalProduits,
        produits_en_stock: produitsEnStock,
        produits_rupture: produitsRupture,
        valeur_stock: valeurStock,
        boutique: {
          id: boutique.id,
          nom: boutique.nom,
          date_creation: boutique.createdAt
        }
      });

    } catch (error) {
      console.error('Erreur statistiques boutique:', error);
      return ApiResponse.error(res, 'Erreur lors de la récupération des statistiques', 500);
    }
  }
}

module.exports = BoutiqueController;// controllers/boutiqueController.js
const { Boutique, Vendeur, Template, Produit, Categorie, ImageProduit } = require('../models');
const ApiResponse = require('../utils/apiResponse');
const { Op } = require('sequelize');

class BoutiqueController {
  /**
   * Créer une nouvelle boutique
   */
  static async creerBoutique(req, res) {
    try {
      const { nom, description, template_id } = req.body;

      // Validation
      if (!nom) {
        return ApiResponse.validationError(res, [
          { field: 'nom', message: 'Le nom de la boutique est requis' }
        ]);
      }

      // Vérifier si le vendeur a déjà une boutique
      const boutiqueExistante = await Boutique.findOne({
        where: { vendeur_id: req.user.id }
      });

      if (boutiqueExistante) {
        return ApiResponse.error(res, 'Vous avez déjà une boutique', 409);
      }

      // Vérifier que le template existe et est compatible avec le grade du vendeur
      const vendeur = await Vendeur.findByPk(req.user.id, {
        include: ['grade']
      });

      if (template_id) {
        const template = await Template.findByPk(template_id);
        if (!template) {
          return ApiResponse.notFound(res, 'Template non trouvé');
        }

        if (template.grade_requis_id > vendeur.grade_id) {
          return ApiResponse.forbidden(res, 'Ce template nécessite un grade supérieur');
        }
      }

      // Créer la boutique
      const boutique = await Boutique.create({
        vendeur_id: req.user.id,
        nom,
        description,
        template_id: template_id || 1 // Template par défaut
      });

      // Récupérer la boutique avec ses relations
      const boutiqueComplete = await Boutique.findByPk(boutique.id, {
        include: [
          { model: Template, as: 'template' },
          { model: Vendeur, as: 'vendeur', include: ['grade'] }
        ]
      });

      return ApiResponse.created(res, boutiqueComplete, 'Boutique créée avec succès');

    } catch (error) {
      console.error('Erreur création boutique:', error);
      return ApiResponse.error(res, 'Erreur lors de la création de la boutique', 500);
    }
  }

  /**
   * Récupérer sa propre boutique (vendeur)
   */
  static async obtenirMaBoutique(req, res) {
    try {
      const boutique = await Boutique.findOne({
        where: { vendeur_id: req.user.id },
        include: [
          { model: Template, as: 'template' },
          { model: Vendeur, as: 'vendeur', include: ['grade'] },
          { 
            model: Produit, 
            as: 'produits',
            include: [
              { model: Categorie, as: 'categorie' },
              { model: ImageProduit, as: 'images' }
            ]
          }
        ]
      });

      if (!boutique) {
        return ApiResponse.notFound(res, 'Aucune boutique trouvée');
      }

      return ApiResponse.success(res, boutique);

    } catch (error) {
      console.error('Erreur récupération boutique:', error);
      return ApiResponse.error(res, 'Erreur lors de la récupération de la boutique', 500);
    }
  }

  /**
   * Récupérer une boutique publique par ID
   */
  static async obtenirBoutique(req, res) {
    try {
      const { id } = req.params;

      const boutique = await Boutique.findByPk(id, {
        include: [
          { model: Template, as: 'template' },
          { model: Vendeur, as: 'vendeur', include: ['grade'] },
          { 
            model: Produit, 
            as: 'produits',
            where: { stock: { [Op.gt]: 0 } }, // Seulement les produits en stock
            required: false,
            include: [
              { model: Categorie, as: 'categorie' },
              { model: ImageProduit, as: 'images' }
            ]
          }
        ]
      });

      if (!boutique) {
        return ApiResponse.notFound(res, 'Boutique non trouvée');
      }

      return ApiResponse.success(res, boutique);

    } catch (error) {
      console.error('Erreur récupération boutique:', error);
      return ApiResponse.error(res, 'Erreur lors de la récupération de la boutique', 500);
    }
  }

  /**
   * Lister toutes les boutiques publiques
   */
  static async listerBoutiques(req, res) {
    try {
      const { page = 1, limit = 12, search, grade } = req.query;
      const offset = (page - 1) * limit;

      const whereClause = {};
      if (search) {
        whereClause[Op.or] = [
          { nom: { [Op.like]: `%${search}%` } },
          { description: { [Op.like]: `%${search}%` } }
        ];
      }

      const includeClause = [
        { model: Template, as: 'template' },
        { 
          model: Vendeur, 
          as: 'vendeur', 
          include: ['grade'],
          ...(grade && { where: { grade_id: grade } })
        }
      ];

      const { count, rows } = await Boutique.findAndCountAll({
        where: whereClause,
        include: includeClause,
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['createdAt', 'DESC']]
      });

      return ApiResponse.paginated(res, rows, {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count
      });

    } catch (error) {
      console.error('Erreur liste boutiques:', error);
      return ApiResponse.error(res, 'Erreur lors de la récupération des boutiques', 500);
    }
  }

  /**
   * Mettre à jour sa boutique
   */
  static async mettreAJourBoutique(req, res) {
    try {
      const { nom, description, template_id } = req.body;

      const boutique = await Boutique.findOne({
        where: { vendeur_id: req.user.id }
      });

      if (!boutique) {
        return ApiResponse.notFound(res, 'Aucune boutique trouvée');
      }

      // Vérifier le template si fourni
      if (template_id) {
        const vendeur = await Vendeur.findByPk(req.user.id, {
          include: ['grade']
        });

        const template = await Template.findByPk(template_id);
        if (!template) {
          return ApiResponse.notFound(res, 'Template non trouvé');
        }

        if (template.grade_requis_id > vendeur.grade_id) {
          return ApiResponse.forbidden(res, 'Ce template nécessite un grade supérieur');
        }
      }

      // Mettre à jour la boutique
      await boutique.update({
        nom: nom || boutique.nom,
        description: description || boutique.description,
        template_id: template_id || boutique.template_id
      });

      // Récupérer la boutique mise à jour
      const boutiqueMiseAJour = await Boutique.findByPk(boutique.id, {
        include: [
          { model: Template, as: 'template' },
          { model: Vendeur, as: 'vendeur', include: ['grade'] }
        ]
      });

      return ApiResponse.updated(res, boutiqueMiseAJour);

    } catch (error) {
      console.error('Erreur mise à jour boutique:', error);
      return ApiResponse.error(res, 'Erreur lors de la mise à jour de la boutique', 500);
    }
  }

  /**
   * Supprimer sa boutique
   */
  static async supprimerBoutique(req, res) {
    try {
      const boutique = await Boutique.findOne({
        where: { vendeur_id: req.user.id }
      });

      if (!boutique) {
        return ApiResponse.notFound(res, 'Aucune boutique trouvée');
      }

      await boutique.destroy();
      return ApiResponse.deleted(res, 'Boutique supprimée avec succès');

    } catch (error) {
      console.error('Erreur suppression boutique:', error);
      return ApiResponse.error(res, 'Erreur lors de la suppression de la boutique', 500);
    }
  }

  /**
   * Changer le template de sa boutique
   */
  static async changerTemplate(req, res) {
    try {
      const { template_id } = req.body;

      if (!template_id) {
        return ApiResponse.validationError(res, [
          { field: 'template_id', message: 'L\'ID du template est requis' }
        ]);
      }

      const boutique = await Boutique.findOne({
        where: { vendeur_id: req.user.id }
      });

      if (!boutique) {
        return ApiResponse.notFound(res, 'Aucune boutique trouvée');
      }

      // Vérifier le grade requis pour le template
      const vendeur = await Vendeur.findByPk(req.user.id, {
        include: ['grade']
      });

      const template = await Template.findByPk(template_id);
      if (!template) {
        return ApiResponse.notFound(res, 'Template non trouvé');
      }

      if (template.grade_requis_id > vendeur.grade_id) {
        return ApiResponse.forbidden(res, 'Ce template nécessite un grade supérieur');
      }

      await boutique.update({ template_id });

      const boutiqueMiseAJour = await Boutique.findByPk(boutique.id, {
        include: [{ model: Template, as: 'template' }]
      });

      return ApiResponse.updated(res, boutiqueMiseAJour, 'Template mis à jour avec succès');

    } catch (error) {
      console.error('Erreur changement template:', error);
      return ApiResponse.error(res, 'Erreur lors du changement de template', 500);
    }
  }

  /**
   * Obtenir les statistiques de sa boutique
   */
  static async statistiquesBoutique(req, res) {
    try {
      const boutique = await Boutique.findOne({
        where: { vendeur_id: req.user.id }
      });

      if (!boutique) {
        return ApiResponse.notFound(res, 'Aucune boutique trouvée');
      }

      // Compter les produits
      const totalProduits = await Produit.count({
        where: { boutique_id: boutique.id }
      });

      const produitsEnStock = await Produit.count({
        where: { 
          boutique_id: boutique.id,
          stock: { [Op.gt]: 0 }
        }
      });

      const produitsRupture = totalProduits - produitsEnStock;

      // Calculer la valeur totale du stock
      const produits = await Produit.findAll({
        where: { boutique_id: boutique.id },
        attributes: ['prix', 'stock']
      });

      const valeurStock = produits.reduce((total, produit) => {
        return total + (produit.prix * produit.stock);
      }, 0);

      return ApiResponse.success(res, {
        total_produits: totalProduits,
        produits_en_stock: produitsEnStock,
        produits_rupture: produitsRupture,
        valeur_stock: valeurStock,
        boutique: {
          id: boutique.id,
          nom: boutique.nom,
          date_creation: boutique.createdAt
        }
      });

    } catch (error) {
      console.error('Erreur statistiques boutique:', error);
      return ApiResponse.error(res, 'Erreur lors de la récupération des statistiques', 500);
    }
  }
}

module.exports = BoutiqueController;// controllers/boutiqueController.js
const { Boutique, Vendeur, Template, Produit, Categorie, ImageProduit } = require('../models');
const ApiResponse = require('../utils/apiResponse');
const { Op } = require('sequelize');

class BoutiqueController {
  /**
   * Créer une nouvelle boutique
   */
  static async creerBoutique(req, res) {
    try {
      const { nom, description, template_id } = req.body;

      // Validation
      if (!nom) {
        return ApiResponse.validationError(res, [
          { field: 'nom', message: 'Le nom de la boutique est requis' }
        ]);
      }

      // Vérifier si le vendeur a déjà une boutique
      const boutiqueExistante = await Boutique.findOne({
        where: { vendeur_id: req.user.id }
      });

      if (boutiqueExistante) {
        return ApiResponse.error(res, 'Vous avez déjà une boutique', 409);
      }

      // Vérifier que le template existe et est compatible avec le grade du vendeur
      const vendeur = await Vendeur.findByPk(req.user.id, {
        include: ['grade']
      });

      if (template_id) {
        const template = await Template.findByPk(template_id);
        if (!template) {
          return ApiResponse.notFound(res, 'Template non trouvé');
        }

        if (template.grade_requis_id > vendeur.grade_id) {
          return ApiResponse.forbidden(res, 'Ce template nécessite un grade supérieur');
        }
      }

      // Créer la boutique
      const boutique = await Boutique.create({
        vendeur_id: req.user.id,
        nom,
        description,
        template_id: template_id || 1 // Template par défaut
      });

      // Récupérer la boutique avec ses relations
      const boutiqueComplete = await Boutique.findByPk(boutique.id, {
        include: [
          { model: Template, as: 'template' },
          { model: Vendeur, as: 'vendeur', include: ['grade'] }
        ]
      });

      return ApiResponse.created(res, boutiqueComplete, 'Boutique créée avec succès');

    } catch (error) {
      console.error('Erreur création boutique:', error);
      return ApiResponse.error(res, 'Erreur lors de la création de la boutique', 500);
    }
  }

  /**
   * Récupérer sa propre boutique (vendeur)
   */
  static async obtenirMaBoutique(req, res) {
    try {
      const boutique = await Boutique.findOne({
        where: { vendeur_id: req.user.id },
        include: [
          { model: Template, as: 'template' },
          { model: Vendeur, as: 'vendeur', include: ['grade'] },
          { 
            model: Produit, 
            as: 'produits',
            include: [
              { model: Categorie, as: 'categorie' },
              { model: ImageProduit, as: 'images' }
            ]
          }
        ]
      });

      if (!boutique) {
        return ApiResponse.notFound(res, 'Aucune boutique trouvée');
      }

      return ApiResponse.success(res, boutique);

    } catch (error) {
      console.error('Erreur récupération boutique:', error);
      return ApiResponse.error(res, 'Erreur lors de la récupération de la boutique', 500);
    }
  }

  /**
   * Récupérer une boutique publique par ID
   */
  static async obtenirBoutique(req, res) {
    try {
      const { id } = req.params;

      const boutique = await Boutique.findByPk(id, {
        include: [
          { model: Template, as: 'template' },
          { model: Vendeur, as: 'vendeur', include: ['grade'] },
          { 
            model: Produit, 
            as: 'produits',
            where: { stock: { [Op.gt]: 0 } }, // Seulement les produits en stock
            required: false,
            include: [
              { model: Categorie, as: 'categorie' },
              { model: ImageProduit, as: 'images' }
            ]
          }
        ]
      });

      if (!boutique) {
        return ApiResponse.notFound(res, 'Boutique non trouvée');
      }

      return ApiResponse.success(res, boutique);

    } catch (error) {
      console.error('Erreur récupération boutique:', error);
      return ApiResponse.error(res, 'Erreur lors de la récupération de la boutique', 500);
    }
  }

  /**
   * Lister toutes les boutiques publiques
   */
  static async listerBoutiques(req, res) {
    try {
      const { page = 1, limit = 12, search, grade } = req.query;
      const offset = (page - 1) * limit;

      const whereClause = {};
      if (search) {
        whereClause[Op.or] = [
          { nom: { [Op.like]: `%${search}%` } },
          { description: { [Op.like]: `%${search}%` } }
        ];
      }

      const includeClause = [
        { model: Template, as: 'template' },
        { 
          model: Vendeur, 
          as: 'vendeur', 
          include: ['grade'],
          ...(grade && { where: { grade_id: grade } })
        }
      ];

      const { count, rows } = await Boutique.findAndCountAll({
        where: whereClause,
        include: includeClause,
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['createdAt', 'DESC']]
      });

      return ApiResponse.paginated(res, rows, {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count
      });

    } catch (error) {
      console.error('Erreur liste boutiques:', error);
      return ApiResponse.error(res, 'Erreur lors de la récupération des boutiques', 500);
    }
  }

  /**
   * Mettre à jour sa boutique
   */
  static async mettreAJourBoutique(req, res) {
    try {
      const { nom, description, template_id } = req.body;

      const boutique = await Boutique.findOne({
        where: { vendeur_id: req.user.id }
      });

      if (!boutique) {
        return ApiResponse.notFound(res, 'Aucune boutique trouvée');
      }

      // Vérifier le template si fourni
      if (template_id) {
        const vendeur = await Vendeur.findByPk(req.user.id, {
          include: ['grade']
        });

        const template = await Template.findByPk(template_id);
        if (!template) {
          return ApiResponse.notFound(res, 'Template non trouvé');
        }

        if (template.grade_requis_id > vendeur.grade_id) {
          return ApiResponse.forbidden(res, 'Ce template nécessite un grade supérieur');
        }
      }

      // Mettre à jour la boutique
      await boutique.update({
        nom: nom || boutique.nom,
        description: description || boutique.description,
        template_id: template_id || boutique.template_id
      });

      // Récupérer la boutique mise à jour
      const boutiqueMiseAJour = await Boutique.findByPk(boutique.id, {
        include: [
          { model: Template, as: 'template' },
          { model: Vendeur, as: 'vendeur', include: ['grade'] }
        ]
      });

      return ApiResponse.updated(res, boutiqueMiseAJour);

    } catch (error) {
      console.error('Erreur mise à jour boutique:', error);
      return ApiResponse.error(res, 'Erreur lors de la mise à jour de la boutique', 500);
    }
  }

  /**
   * Supprimer sa boutique
   */
  static async supprimerBoutique(req, res) {
    try {
      const boutique = await Boutique.findOne({
        where: { vendeur_id: req.user.id }
      });

      if (!boutique) {
        return ApiResponse.notFound(res, 'Aucune boutique trouvée');
      }

      await boutique.destroy();
      return ApiResponse.deleted(res, 'Boutique supprimée avec succès');

    } catch (error) {
      console.error('Erreur suppression boutique:', error);
      return ApiResponse.error(res, 'Erreur lors de la suppression de la boutique', 500);
    }
  }

  /**
   * Changer le template de sa boutique
   */
  static async changerTemplate(req, res) {
    try {
      const { template_id } = req.body;

      if (!template_id) {
        return ApiResponse.validationError(res, [
          { field: 'template_id', message: 'L\'ID du template est requis' }
        ]);
      }

      const boutique = await Boutique.findOne({
        where: { vendeur_id: req.user.id }
      });

      if (!boutique) {
        return ApiResponse.notFound(res, 'Aucune boutique trouvée');
      }

      // Vérifier le grade requis pour le template
      const vendeur = await Vendeur.findByPk(req.user.id, {
        include: ['grade']
      });

      const template = await Template.findByPk(template_id);
      if (!template) {
        return ApiResponse.notFound(res, 'Template non trouvé');
      }

      if (template.grade_requis_id > vendeur.grade_id) {
        return ApiResponse.forbidden(res, 'Ce template nécessite un grade supérieur');
      }

      await boutique.update({ template_id });

      const boutiqueMiseAJour = await Boutique.findByPk(boutique.id, {
        include: [{ model: Template, as: 'template' }]
      });

      return ApiResponse.updated(res, boutiqueMiseAJour, 'Template mis à jour avec succès');

    } catch (error) {
      console.error('Erreur changement template:', error);
      return ApiResponse.error(res, 'Erreur lors du changement de template', 500);
    }
  }

  /**
   * Obtenir les statistiques de sa boutique
   */
  static async statistiquesBoutique(req, res) {
    try {
      const boutique = await Boutique.findOne({
        where: { vendeur_id: req.user.id }
      });

      if (!boutique) {
        return ApiResponse.notFound(res, 'Aucune boutique trouvée');
      }

      // Compter les produits
      const totalProduits = await Produit.count({
        where: { boutique_id: boutique.id }
      });

      const produitsEnStock = await Produit.count({
        where: { 
          boutique_id: boutique.id,
          stock: { [Op.gt]: 0 }
        }
      });

      const produitsRupture = totalProduits - produitsEnStock;

      // Calculer la valeur totale du stock
      const produits = await Produit.findAll({
        where: { boutique_id: boutique.id },
        attributes: ['prix', 'stock']
      });

      const valeurStock = produits.reduce((total, produit) => {
        return total + (produit.prix * produit.stock);
      }, 0);

      return ApiResponse.success(res, {
        total_produits: totalProduits,
        produits_en_stock: produitsEnStock,
        produits_rupture: produitsRupture,
        valeur_stock: valeurStock,
        boutique: {
          id: boutique.id,
          nom: boutique.nom,
          date_creation: boutique.createdAt
        }
      });

    } catch (error) {
      console.error('Erreur statistiques boutique:', error);
      return ApiResponse.error(res, 'Erreur lors de la récupération des statistiques', 500);
    }
  }
}

module.exports = BoutiqueController;// controllers/boutiqueController.js
const { Boutique, Vendeur, Template, Produit, Categorie, ImageProduit } = require('../models');
const ApiResponse = require('../utils/apiResponse');
const { Op } = require('sequelize');

class BoutiqueController {
  /**
   * Créer une nouvelle boutique
   */
  static async creerBoutique(req, res) {
    try {
      const { nom, description, template_id } = req.body;

      // Validation
      if (!nom) {
        return ApiResponse.validationError(res, [
          { field: 'nom', message: 'Le nom de la boutique est requis' }
        ]);
      }

      // Vérifier si le vendeur a déjà une boutique
      const boutiqueExistante = await Boutique.findOne({
        where: { vendeur_id: req.user.id }
      });

      if (boutiqueExistante) {
        return ApiResponse.error(res, 'Vous avez déjà une boutique', 409);
      }

      // Vérifier que le template existe et est compatible avec le grade du vendeur
      const vendeur = await Vendeur.findByPk(req.user.id, {
        include: ['grade']
      });

      if (template_id) {
        const template = await Template.findByPk(template_id);
        if (!template) {
          return ApiResponse.notFound(res, 'Template non trouvé');
        }

        if (template.grade_requis_id > vendeur.grade_id) {
          return ApiResponse.forbidden(res, 'Ce template nécessite un grade supérieur');
        }
      }

      // Créer la boutique
      const boutique = await Boutique.create({
        vendeur_id: req.user.id,
        nom,
        description,
        template_id: template_id || 1 // Template par défaut
      });

      // Récupérer la boutique avec ses relations
      const boutiqueComplete = await Boutique.findByPk(boutique.id, {
        include: [
          { model: Template, as: 'template' },
          { model: Vendeur, as: 'vendeur', include: ['grade'] }
        ]
      });

      return ApiResponse.created(res, boutiqueComplete, 'Boutique créée avec succès');

    } catch (error) {
      console.error('Erreur création boutique:', error);
      return ApiResponse.error(res, 'Erreur lors de la création de la boutique', 500);
    }
  }

  /**
   * Récupérer sa propre boutique (vendeur)
   */
  static async obtenirMaBoutique(req, res) {
    try {
      const boutique = await Boutique.findOne({
        where: { vendeur_id: req.user.id },
        include: [
          { model: Template, as: 'template' },
          { model: Vendeur, as: 'vendeur', include: ['grade'] },
          { 
            model: Produit, 
            as: 'produits',
            include: [
              { model: Categorie, as: 'categorie' },
              { model: ImageProduit, as: 'images' }
            ]
          }
        ]
      });

      if (!boutique) {
        return ApiResponse.notFound(res, 'Aucune boutique trouvée');
      }

      return ApiResponse.success(res, boutique);

    } catch (error) {
      console.error('Erreur récupération boutique:', error);
      return ApiResponse.error(res, 'Erreur lors de la récupération de la boutique', 500);
    }
  }

  /**
   * Récupérer une boutique publique par ID
   */
  static async obtenirBoutique(req, res) {
    try {
      const { id } = req.params;

      const boutique = await Boutique.findByPk(id, {
        include: [
          { model: Template, as: 'template' },
          { model: Vendeur, as: 'vendeur', include: ['grade'] },
          { 
            model: Produit, 
            as: 'produits',
            where: { stock: { [Op.gt]: 0 } }, // Seulement les produits en stock
            required: false,
            include: [
              { model: Categorie, as: 'categorie' },
              { model: ImageProduit, as: 'images' }
            ]
          }
        ]
      });

      if (!boutique) {
        return ApiResponse.notFound(res, 'Boutique non trouvée');
      }

      return ApiResponse.success(res, boutique);

    } catch (error) {
      console.error('Erreur récupération boutique:', error);
      return ApiResponse.error(res, 'Erreur lors de la récupération de la boutique', 500);
    }
  }

  /**
   * Lister toutes les boutiques publiques
   */
  static async listerBoutiques(req, res) {
    try {
      const { page = 1, limit = 12, search, grade } = req.query;
      const offset = (page - 1) * limit;

      const whereClause = {};
      if (search) {
        whereClause[Op.or] = [
          { nom: { [Op.like]: `%${search}%` } },
          { description: { [Op.like]: `%${search}%` } }
        ];
      }

      const includeClause = [
        { model: Template, as: 'template' },
        { 
          model: Vendeur, 
          as: 'vendeur', 
          include: ['grade'],
          ...(grade && { where: { grade_id: grade } })
        }
      ];

      const { count, rows } = await Boutique.findAndCountAll({
        where: whereClause,
        include: includeClause,
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['createdAt', 'DESC']]
      });

      return ApiResponse.paginated(res, rows, {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count
      });

    } catch (error) {
      console.error('Erreur liste boutiques:', error);
      return ApiResponse.error(res, 'Erreur lors de la récupération des boutiques', 500);
    }
  }

  /**
   * Mettre à jour sa boutique
   */
  static async mettreAJourBoutique(req, res) {
    try {
      const { nom, description, template_id } = req.body;

      const boutique = await Boutique.findOne({
        where: { vendeur_id: req.user.id }
      });

      if (!boutique) {
        return ApiResponse.notFound(res, 'Aucune boutique trouvée');
      }

      // Vérifier le template si fourni
      if (template_id) {
        const vendeur = await Vendeur.findByPk(req.user.id, {
          include: ['grade']
        });

        const template = await Template.findByPk(template_id);
        if (!template) {
          return ApiResponse.notFound(res, 'Template non trouvé');
        }

        if (template.grade_requis_id > vendeur.grade_id) {
          return ApiResponse.forbidden(res, 'Ce template nécessite un grade supérieur');
        }
      }

      // Mettre à jour la boutique
      await boutique.update({
        nom: nom || boutique.nom,
        description: description || boutique.description,
        template_id: template_id || boutique.template_id
      });

      // Récupérer la boutique mise à jour
      const boutiqueMiseAJour = await Boutique.findByPk(boutique.id, {
        include: [
          { model: Template, as: 'template' },
          { model: Vendeur, as: 'vendeur', include: ['grade'] }
        ]
      });

      return ApiResponse.updated(res, boutiqueMiseAJour);

    } catch (error) {
      console.error('Erreur mise à jour boutique:', error);
      return ApiResponse.error(res, 'Erreur lors de la mise à jour de la boutique', 500);
    }
  }

  /**
   * Supprimer sa boutique
   */
  static async supprimerBoutique(req, res) {
    try {
      const boutique = await Boutique.findOne({
        where: { vendeur_id: req.user.id }
      });

      if (!boutique) {
        return ApiResponse.notFound(res, 'Aucune boutique trouvée');
      }

      await boutique.destroy();
      return ApiResponse.deleted(res, 'Boutique supprimée avec succès');

    } catch (error) {
      console.error('Erreur suppression boutique:', error);
      return ApiResponse.error(res, 'Erreur lors de la suppression de la boutique', 500);
    }
  }

  /**
   * Changer le template de sa boutique
   */
  static async changerTemplate(req, res) {
    try {
      const { template_id } = req.body;

      if (!template_id) {
        return ApiResponse.validationError(res, [
          { field: 'template_id', message: 'L\'ID du template est requis' }
        ]);
      }

      const boutique = await Boutique.findOne({
        where: { vendeur_id: req.user.id }
      });

      if (!boutique) {
        return ApiResponse.notFound(res, 'Aucune boutique trouvée');
      }

      // Vérifier le grade requis pour le template
      const vendeur = await Vendeur.findByPk(req.user.id, {
        include: ['grade']
      });

      const template = await Template.findByPk(template_id);
      if (!template) {
        return ApiResponse.notFound(res, 'Template non trouvé');
      }

      if (template.grade_requis_id > vendeur.grade_id) {
        return ApiResponse.forbidden(res, 'Ce template nécessite un grade supérieur');
      }

      await boutique.update({ template_id });

      const boutiqueMiseAJour = await Boutique.findByPk(boutique.id, {
        include: [{ model: Template, as: 'template' }]
      });

      return ApiResponse.updated(res, boutiqueMiseAJour, 'Template mis à jour avec succès');

    } catch (error) {
      console.error('Erreur changement template:', error);
      return ApiResponse.error(res, 'Erreur lors du changement de template', 500);
    }
  }

  /**
   * Obtenir les statistiques de sa boutique
   */
  static async statistiquesBoutique(req, res) {
    try {
      const boutique = await Boutique.findOne({
        where: { vendeur_id: req.user.id }
      });

      if (!boutique) {
        return ApiResponse.notFound(res, 'Aucune boutique trouvée');
      }

      // Compter les produits
      const totalProduits = await Produit.count({
        where: { boutique_id: boutique.id }
      });

      const produitsEnStock = await Produit.count({
        where: { 
          boutique_id: boutique.id,
          stock: { [Op.gt]: 0 }
        }
      });

      const produitsRupture = totalProduits - produitsEnStock;

      // Calculer la valeur totale du stock
      const produits = await Produit.findAll({
        where: { boutique_id: boutique.id },
        attributes: ['prix', 'stock']
      });

      const valeurStock = produits.reduce((total, produit) => {
        return total + (produit.prix * produit.stock);
      }, 0);

      return ApiResponse.success(res, {
        total_produits: totalProduits,
        produits_en_stock: produitsEnStock,
        produits_rupture: produitsRupture,
        valeur_stock: valeurStock,
        boutique: {
          id: boutique.id,
          nom: boutique.nom,
          date_creation: boutique.createdAt
        }
      });

    } catch (error) {
      console.error('Erreur statistiques boutique:', error);
      return ApiResponse.error(res, 'Erreur lors de la récupération des statistiques', 500);
    }
  }
}

module.exports = BoutiqueController;// controllers/boutiqueController.js
const { Boutique, Vendeur, Template, Produit, Categorie, ImageProduit } = require('../models');
const ApiResponse = require('../utils/apiResponse');
const { Op } = require('sequelize');

class BoutiqueController {
  /**
   * Créer une nouvelle boutique
   */
  static async creerBoutique(req, res) {
    try {
      const { nom, description, template_id } = req.body;

      // Validation
      if (!nom) {
        return ApiResponse.validationError(res, [
          { field: 'nom', message: 'Le nom de la boutique est requis' }
        ]);
      }

      // Vérifier si le vendeur a déjà une boutique
      const boutiqueExistante = await Boutique.findOne({
        where: { vendeur_id: req.user.id }
      });

      if (boutiqueExistante) {
        return ApiResponse.error(res, 'Vous avez déjà une boutique', 409);
      }

      // Vérifier que le template existe et est compatible avec le grade du vendeur
      const vendeur = await Vendeur.findByPk(req.user.id, {
        include: ['grade']
      });

      if (template_id) {
        const template = await Template.findByPk(template_id);
        if (!template) {
          return ApiResponse.notFound(res, 'Template non trouvé');
        }

        if (template.grade_requis_id > vendeur.grade_id) {
          return ApiResponse.forbidden(res, 'Ce template nécessite un grade supérieur');
        }
      }

      // Créer la boutique
      const boutique = await Boutique.create({
        vendeur_id: req.user.id,
        nom,
        description,
        template_id: template_id || 1 // Template par défaut
      });

      // Récupérer la boutique avec ses relations
      const boutiqueComplete = await Boutique.findByPk(boutique.id, {
        include: [
          { model: Template, as: 'template' },
          { model: Vendeur, as: 'vendeur', include: ['grade'] }
        ]
      });

      return ApiResponse.created(res, boutiqueComplete, 'Boutique créée avec succès');

    } catch (error) {
      console.error('Erreur création boutique:', error);
      return ApiResponse.error(res, 'Erreur lors de la création de la boutique', 500);
    }
  }

  /**
   * Récupérer sa propre boutique (vendeur)
   */
  static async obtenirMaBoutique(req, res) {
    try {
      const boutique = await Boutique.findOne({
        where: { vendeur_id: req.user.id },
        include: [
          { model: Template, as: 'template' },
          { model: Vendeur, as: 'vendeur', include: ['grade'] },
          { 
            model: Produit, 
            as: 'produits',
            include: [
              { model: Categorie, as: 'categorie' },
              { model: ImageProduit, as: 'images' }
            ]
          }
        ]
      });

      if (!boutique) {
        return ApiResponse.notFound(res, 'Aucune boutique trouvée');
      }

      return ApiResponse.success(res, boutique);

    } catch (error) {
      console.error('Erreur récupération boutique:', error);
      return ApiResponse.error(res, 'Erreur lors de la récupération de la boutique', 500);
    }
  }

  /**
   * Récupérer une boutique publique par ID
   */
  static async obtenirBoutique(req, res) {
    try {
      const { id } = req.params;

      const boutique = await Boutique.findByPk(id, {
        include: [
          { model: Template, as: 'template' },
          { model: Vendeur, as: 'vendeur', include: ['grade'] },
          { 
            model: Produit, 
            as: 'produits',
            where: { stock: { [Op.gt]: 0 } }, // Seulement les produits en stock
            required: false,
            include: [
              { model: Categorie, as: 'categorie' },
              { model: ImageProduit, as: 'images' }
            ]
          }
        ]
      });

      if (!boutique) {
        return ApiResponse.notFound(res, 'Boutique non trouvée');
      }

      return ApiResponse.success(res, boutique);

    } catch (error) {
      console.error('Erreur récupération boutique:', error);
      return ApiResponse.error(res, 'Erreur lors de la récupération de la boutique', 500);
    }
  }

  /**
   * Lister toutes les boutiques publiques
   */
  static async listerBoutiques(req, res) {
    try {
      const { page = 1, limit = 12, search, grade } = req.query;
      const offset = (page - 1) * limit;

      const whereClause = {};
      if (search) {
        whereClause[Op.or] = [
          { nom: { [Op.like]: `%${search}%` } },
          { description: { [Op.like]: `%${search}%` } }
        ];
      }

      const includeClause = [
        { model: Template, as: 'template' },
        { 
          model: Vendeur, 
          as: 'vendeur', 
          include: ['grade'],
          ...(grade && { where: { grade_id: grade } })
        }
      ];

      const { count, rows } = await Boutique.findAndCountAll({
        where: whereClause,
        include: includeClause,
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['createdAt', 'DESC']]
      });

      return ApiResponse.paginated(res, rows, {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count
      });

    } catch (error) {
      console.error('Erreur liste boutiques:', error);
      return ApiResponse.error(res, 'Erreur lors de la récupération des boutiques', 500);
    }
  }

  /**
   * Mettre à jour sa boutique
   */
  static async mettreAJourBoutique(req, res) {
    try {
      const { nom, description, template_id } = req.body;

      const boutique = await Boutique.findOne({
        where: { vendeur_id: req.user.id }
      });

      if (!boutique) {
        return ApiResponse.notFound(res, 'Aucune boutique trouvée');
      }

      // Vérifier le template si fourni
      if (template_id) {
        const vendeur = await Vendeur.findByPk(req.user.id, {
          include: ['grade']
        });

        const template = await Template.findByPk(template_id);
        if (!template) {
          return ApiResponse.notFound(res, 'Template non trouvé');
        }

        if (template.grade_requis_id > vendeur.grade_id) {
          return ApiResponse.forbidden(res, 'Ce template nécessite un grade supérieur');
        }
      }

      // Mettre à jour la boutique
      await boutique.update({
        nom: nom || boutique.nom,
        description: description || boutique.description,
        template_id: template_id || boutique.template_id
      });

      // Récupérer la boutique mise à jour
      const boutiqueMiseAJour = await Boutique.findByPk(boutique.id, {
        include: [
          { model: Template, as: 'template' },
          { model: Vendeur, as: 'vendeur', include: ['grade'] }
        ]
      });

      return ApiResponse.updated(res, boutiqueMiseAJour);

    } catch (error) {
      console.error('Erreur mise à jour boutique:', error);
      return ApiResponse.error(res, 'Erreur lors de la mise à jour de la boutique', 500);
    }
  }

  /**
   * Supprimer sa boutique
   */
  static async supprimerBoutique(req, res) {
    try {
      const boutique = await Boutique.findOne({
        where: { vendeur_id: req.user.id }
      });

      if (!boutique) {
        return ApiResponse.notFound(res, 'Aucune boutique trouvée');
      }

      await boutique.destroy();
      return ApiResponse.deleted(res, 'Boutique supprimée avec succès');

    } catch (error) {
      console.error('Erreur suppression boutique:', error);
      return ApiResponse.error(res, 'Erreur lors de la suppression de la boutique', 500);
    }
  }

  /**
   * Changer le template de sa boutique
   */
  static async changerTemplate(req, res) {
    try {
      const { template_id } = req.body;

      if (!template_id) {
        return ApiResponse.validationError(res, [
          { field: 'template_id', message: 'L\'ID du template est requis' }
        ]);
      }

      const boutique = await Boutique.findOne({
        where: { vendeur_id: req.user.id }
      });

      if (!boutique) {
        return ApiResponse.notFound(res, 'Aucune boutique trouvée');
      }

      // Vérifier le grade requis pour le template
      const vendeur = await Vendeur.findByPk(req.user.id, {
        include: ['grade']
      });

      const template = await Template.findByPk(template_id);
      if (!template) {
        return ApiResponse.notFound(res, 'Template non trouvé');
      }

      if (template.grade_requis_id > vendeur.grade_id) {
        return ApiResponse.forbidden(res, 'Ce template nécessite un grade supérieur');
      }

      await boutique.update({ template_id });

      const boutiqueMiseAJour = await Boutique.findByPk(boutique.id, {
        include: [{ model: Template, as: 'template' }]
      });

      return ApiResponse.updated(res, boutiqueMiseAJour, 'Template mis à jour avec succès');

    } catch (error) {
      console.error('Erreur changement template:', error);
      return ApiResponse.error(res, 'Erreur lors du changement de template', 500);
    }
  }

  /**
   * Obtenir les statistiques de sa boutique
   */
  static async statistiquesBoutique(req, res) {
    try {
      const boutique = await Boutique.findOne({
        where: { vendeur_id: req.user.id }
      });

      if (!boutique) {
        return ApiResponse.notFound(res, 'Aucune boutique trouvée');
      }

      // Compter les produits
      const totalProduits = await Produit.count({
        where: { boutique_id: boutique.id }
      });

      const produitsEnStock = await Produit.count({
        where: { 
          boutique_id: boutique.id,
          stock: { [Op.gt]: 0 }
        }
      });

      const produitsRupture = totalProduits - produitsEnStock;

      // Calculer la valeur totale du stock
      const produits = await Produit.findAll({
        where: { boutique_id: boutique.id },
        attributes: ['prix', 'stock']
      });

      const valeurStock = produits.reduce((total, produit) => {
        return total + (produit.prix * produit.stock);
      }, 0);

      return ApiResponse.success(res, {
        total_produits: totalProduits,
        produits_en_stock: produitsEnStock,
        produits_rupture: produitsRupture,
        valeur_stock: valeurStock,
        boutique: {
          id: boutique.id,
          nom: boutique.nom,
          date_creation: boutique.createdAt
        }
      });

    } catch (error) {
      console.error('Erreur statistiques boutique:', error);
      return ApiResponse.error(res, 'Erreur lors de la récupération des statistiques', 500);
    }
  }
}

module.exports = BoutiqueController;