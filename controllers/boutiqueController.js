// controllers/boutiqueController.js - Conforme aux web services
const fs = require('fs').promises;
const path = require('path');
const { 
  Boutique,
  Vendeur, 
  Utilisateur,
  GradeVendeur,
  Template,
  Produit,
  Categorie,
  ImageProduit,
  Commande,
  CommandeProduit,
  StatistiqueVente,
  Client
} = require('../models/db');
const { Op } = require('sequelize');

class BoutiqueController {

  // ==================== ROUTES PRINCIPALES WEB SERVICES ====================

  /**
   * @desc    Créer une boutique
   * @route   POST /api/boutiques
   * @access  Private (Vendeur uniquement)
   * @body    { nom, description, template_id }
   * @response { success, message, boutique }
   */
  static async createBoutique(req, res) {
    try {
      console.log('🏪 Création boutique par vendeur:', req.user.id);

      const { nom, description, template_id } = req.body;

      // Validation des données
      if (!nom || !template_id) {
        return res.status(400).json({
          success: false,
          message: 'Nom et template sont requis'
        });
      }

      // Vérifier si le vendeur a déjà une boutique
      const boutiqueExistante = await Boutique.findOne({
        where: { vendeur_id: req.user.id }
      });

      if (boutiqueExistante) {
        return res.status(409).json({
          success: false,
          message: 'Vous avez déjà une boutique',
          boutique_existante: {
            id: boutiqueExistante.id,
            nom: boutiqueExistante.nom
          }
        });
      }

      // Vérifier que le template existe et est accessible
      const template = await Template.findByPk(template_id, {
        include: [{
          model: GradeVendeur,
          as: 'gradeRequis'
        }]
      });

      if (!template) {
        return res.status(404).json({
          success: false,
          message: 'Template non trouvé'
        });
      }

      // Vérifier le grade du vendeur
      const vendeur = await Vendeur.findByPk(req.user.id, {
        include: [{
          model: GradeVendeur,
          as: 'grade'
        }]
      });

      if (!template.estAccessiblePourGrade(vendeur.grade_id)) {
        return res.status(403).json({
          success: false,
          message: 'Ce template nécessite un grade supérieur',
          grade_requis: template.gradeRequis?.nom,
          grade_actuel: vendeur.grade?.nom
        });
      }

      // Créer la boutique
      const boutique = await Boutique.create({
        vendeur_id: req.user.id,
        nom: nom.trim(),
        description: description?.trim() || '',
        template_id
      });

      console.log('✅ Boutique créée:', boutique.id);

      return res.status(201).json({
        success: true,
        message: 'Boutique créée avec succès',
        boutique: {
          id: boutique.id,
          nom: boutique.nom,
          description: boutique.description,
          template_id: boutique.template_id,
          vendeur_id: boutique.vendeur_id,
          date_creation: boutique.createdAt
        }
      });

    } catch (error) {
      console.error('❌ Erreur création boutique:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la création de la boutique'
      });
    }
  }

  /**
   * @desc    Récupérer une boutique par ID
   * @route   GET /api/boutiques/:id
   * @access  Public
   * @response { success, boutique }
   */
  static async getBoutiqueById(req, res) {
    try {
      const { id } = req.params;
      console.log('🔍 Récupération boutique:', id);

      const boutique = await Boutique.findByPk(id, {
        include: [
          {
            model: Vendeur,
            as: 'vendeur',
            include: [
              {
                model: Utilisateur,
                as: 'utilisateur',
                attributes: ['nom']
              },
              {
                model: GradeVendeur,
                as: 'grade',
                attributes: ['id', 'nom']
              }
            ]
          },
          {
            model: Template,
            as: 'template',
            attributes: ['id', 'nom']
          },
          {
            model: Produit,
            as: 'produits',
            limit: 6,
            include: [{
              model: ImageProduit,
              as: 'images',
              where: { est_principale: true },
              required: false,
              attributes: ['url']
            }]
          }
        ]
      });

      if (!boutique) {
        return res.status(404).json({
          success: false,
          message: 'Boutique non trouvée'
        });
      }

      // Enrichir avec des statistiques publiques
      const nombreProduits = await Produit.count({
        where: { boutique_id: boutique.id }
      });

      const statistiquesVentes = await StatistiqueVente.findAll({
        where: { vendeur_id: boutique.vendeur_id },
        attributes: [
          [require('sequelize').fn('SUM', require('sequelize').col('ventes')), 'total_ventes']
        ],
        raw: true
      });

      const totalVentes = parseInt(statistiquesVentes[0]?.total_ventes) || 0;

      const boutiqueComplete = {
        id: boutique.id,
        nom: boutique.nom,
        description: boutique.description,
        logo_url: boutique.logo_url,
        banniere_url: boutique.banniere_url,
        template: boutique.template,
        vendeur: {
          nom: boutique.vendeur.utilisateur.nom,
          grade: boutique.vendeur.grade
        },
        statistiques_publiques: {
          nombre_produits: nombreProduits,
          total_ventes: totalVentes
        },
        produits_apercu: boutique.produits.map(produit => ({
          id: produit.id,
          nom: produit.nom,
          prix: parseFloat(produit.prix),
          image: produit.images[0]?.url || null,
          stock: produit.stock
        })),
        date_creation: boutique.createdAt
      };

      return res.json({
        success: true,
        boutique: boutiqueComplete
      });

    } catch (error) {
      console.error('❌ Erreur récupération boutique:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération de la boutique'
      });
    }
  }

  /**
   * @desc    Mettre à jour une boutique
   * @route   PUT /api/boutiques/:id
   * @access  Private (Propriétaire ou Admin)
   * @body    { nom, description, template_id }
   * @response { success, message, boutique }
   */
  static async updateBoutique(req, res) {
    try {
      const { id } = req.params;
      const { nom, description, template_id } = req.body;
      console.log('✏️ Mise à jour boutique:', id);

      const boutique = await Boutique.findByPk(id, {
        include: [{
          model: Vendeur,
          as: 'vendeur'
        }]
      });

      if (!boutique) {
        return res.status(404).json({
          success: false,
          message: 'Boutique non trouvée'
        });
      }

      // Vérifier les droits (propriétaire ou admin)
      if (req.user.role !== 'admin' && boutique.vendeur_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Vous n\'êtes pas autorisé à modifier cette boutique'
        });
      }

      // Validation des données
      if (!nom && !description && !template_id) {
        return res.status(400).json({
          success: false,
          message: 'Aucune donnée à mettre à jour'
        });
      }

      const updateData = {};
      if (nom) updateData.nom = nom.trim();
      if (description !== undefined) updateData.description = description.trim();

      // Vérifier le template si changement
      if (template_id && template_id !== boutique.template_id) {
        const template = await Template.findByPk(template_id);
        if (!template) {
          return res.status(404).json({
            success: false,
            message: 'Template non trouvé'
          });
        }

        // Vérifier le grade pour le nouveau template
        const vendeur = await Vendeur.findByPk(boutique.vendeur_id, {
          include: [{
            model: GradeVendeur,
            as: 'grade'
          }]
        });

        if (!template.estAccessiblePourGrade(vendeur.grade_id)) {
          return res.status(403).json({
            success: false,
            message: 'Ce template nécessite un grade supérieur'
          });
        }

        updateData.template_id = template_id;
      }

      // Mettre à jour
      await boutique.update(updateData);

      console.log('✅ Boutique mise à jour:', id);

      return res.json({
        success: true,
        message: 'Boutique mise à jour avec succès',
        boutique: {
          id: boutique.id,
          nom: boutique.nom,
          description: boutique.description,
          template_id: boutique.template_id
        }
      });

    } catch (error) {
      console.error('❌ Erreur mise à jour boutique:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la mise à jour de la boutique'
      });
    }
  }

  /**
   * @desc    Récupérer la boutique d'un vendeur
   * @route   GET /api/boutiques/vendeur/:vendeurId
   * @access  Public
   * @response { success, boutique }
   */
  static async getBoutiqueByVendeur(req, res) {
    try {
      const { vendeurId } = req.params;
      console.log('👤 Boutique du vendeur:', vendeurId);

      const boutique = await Boutique.findOne({
        where: { vendeur_id: vendeurId },
        include: [
          {
            model: Vendeur,
            as: 'vendeur',
            include: [
              {
                model: Utilisateur,
                as: 'utilisateur',
                attributes: ['nom']
              },
              {
                model: GradeVendeur,
                as: 'grade',
                attributes: ['nom']
              }
            ]
          },
          {
            model: Template,
            as: 'template',
            attributes: ['nom']
          }
        ]
      });

      if (!boutique) {
        return res.status(404).json({
          success: false,
          message: 'Aucune boutique trouvée pour ce vendeur'
        });
      }

      // Statistiques publiques
      const nombreProduits = await Produit.count({
        where: { boutique_id: boutique.id }
      });

      return res.json({
        success: true,
        boutique: {
          id: boutique.id,
          nom: boutique.nom,
          description: boutique.description,
          logo_url: boutique.logo_url,
          banniere_url: boutique.banniere_url,
          template: boutique.template?.nom,
          vendeur: {
            id: boutique.vendeur_id,
            nom: boutique.vendeur.utilisateur.nom,
            grade: boutique.vendeur.grade?.nom
          },
          nombre_produits: nombreProduits,
          date_creation: boutique.createdAt
        }
      });

    } catch (error) {
      console.error('❌ Erreur boutique par vendeur:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération de la boutique'
      });
    }
  }

  /**
   * @desc    Uploader le logo de la boutique
   * @route   POST /api/boutiques/:id/logo
   * @access  Private (Propriétaire ou Admin)
   * @response { success, message, logoUrl }
   */
  static async uploadLogo(req, res) {
    try {
      const { id } = req.params;
      console.log('📷 Upload logo boutique:', id);

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Aucun fichier fourni'
        });
      }

      const boutique = await Boutique.findByPk(id);
      if (!boutique) {
        return res.status(404).json({
          success: false,
          message: 'Boutique non trouvée'
        });
      }

      // Vérifier les droits
      if (req.user.role !== 'admin' && boutique.vendeur_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Vous n\'êtes pas autorisé à modifier cette boutique'
        });
      }

      // Générer nom de fichier unique
      const timestamp = Date.now();
      const extension = path.extname(req.file.originalname);
      const nomFichier = `logo_boutique_${id}_${timestamp}${extension}`;
      const dossierUpload = process.env.UPLOAD_PATH || 'uploads/boutiques';
      const cheminComplet = path.join(dossierUpload, nomFichier);

      // Créer le dossier s'il n'existe pas
      await fs.mkdir(path.dirname(cheminComplet), { recursive: true });

      // Sauvegarder le fichier
      await fs.writeFile(cheminComplet, req.file.buffer);

      // Supprimer l'ancien logo s'il existe
      if (boutique.logo_url) {
        try {
          const ancienLogo = path.join(dossierUpload, path.basename(boutique.logo_url));
          await fs.unlink(ancienLogo);
        } catch (error) {
          console.log('Ancien logo non trouvé:', boutique.logo_url);
        }
      }

      // Mettre à jour la boutique
      const logoUrl = `/uploads/boutiques/${nomFichier}`;
      await boutique.update({ logo_url: logoUrl });

      console.log('✅ Logo uploadé:', logoUrl);

      return res.json({
        success: true,
        message: 'Logo uploadé avec succès',
        logoUrl
      });

    } catch (error) {
      console.error('❌ Erreur upload logo:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de l\'upload du logo'
      });
    }
  }

  /**
   * @desc    Uploader la bannière de la boutique
   * @route   POST /api/boutiques/:id/banniere
   * @access  Private (Propriétaire ou Admin)
   * @response { success, message, banniereUrl }
   */
  static async uploadBanniere(req, res) {
    try {
      const { id } = req.params;
      console.log('🖼️ Upload bannière boutique:', id);

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Aucun fichier fourni'
        });
      }

      const boutique = await Boutique.findByPk(id);
      if (!boutique) {
        return res.status(404).json({
          success: false,
          message: 'Boutique non trouvée'
        });
      }

      // Vérifier les droits
      if (req.user.role !== 'admin' && boutique.vendeur_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Vous n\'êtes pas autorisé à modifier cette boutique'
        });
      }

      // Générer nom de fichier unique
      const timestamp = Date.now();
      const extension = path.extname(req.file.originalname);
      const nomFichier = `banniere_boutique_${id}_${timestamp}${extension}`;
      const dossierUpload = process.env.UPLOAD_PATH || 'uploads/boutiques';
      const cheminComplet = path.join(dossierUpload, nomFichier);

      // Créer le dossier s'il n'existe pas
      await fs.mkdir(path.dirname(cheminComplet), { recursive: true });

      // Sauvegarder le fichier
      await fs.writeFile(cheminComplet, req.file.buffer);

      // Supprimer l'ancienne bannière s'il existe
      if (boutique.banniere_url) {
        try {
          const ancienneBanniere = path.join(dossierUpload, path.basename(boutique.banniere_url));
          await fs.unlink(ancienneBanniere);
        } catch (error) {
          console.log('Ancienne bannière non trouvée:', boutique.banniere_url);
        }
      }

      // Mettre à jour la boutique
      const banniereUrl = `/uploads/boutiques/${nomFichier}`;
      await boutique.update({ banniere_url: banniereUrl });

      console.log('✅ Bannière uploadée:', banniereUrl);

      return res.json({
        success: true,
        message: 'Bannière uploadée avec succès',
        banniereUrl
      });

    } catch (error) {
      console.error('❌ Erreur upload bannière:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de l\'upload de la bannière'
      });
    }
  }

  // ==================== ROUTES ADDITIONNELLES ====================

  /**
   * @desc    Lister toutes les boutiques avec filtres
   * @route   GET /api/boutiques
   * @access  Public
   */
  static async getAllBoutiques(req, res) {
    try {
      const { nom, categorie, grade, page = 1, limit = 12, tri = 'recent' } = req.query;
      console.log('📋 Liste boutiques avec filtres');

      const whereClause = {};
      const includeClause = [
        {
          model: Vendeur,
          as: 'vendeur',
          include: [
            {
              model: Utilisateur,
              as: 'utilisateur',
              attributes: ['nom'],
              where: nom ? { nom: { [Op.like]: `%${nom}%` } } : {}
            },
            {
              model: GradeVendeur,
              as: 'grade',
              attributes: ['nom'],
              where: grade ? { nom: grade } : {}
            }
          ]
        },
        {
          model: Template,
          as: 'template',
          attributes: ['nom']
        }
      ];

      // Filtrer par catégorie de produits
      if (categorie) {
        includeClause.push({
          model: Produit,
          as: 'produits',
          include: [{
            model: Categorie,
            as: 'categorie',
            where: { nom: categorie }
          }],
          required: true
        });
      }

      const offset = (page - 1) * limit;

      // Définir l'ordre
      let orderClause = [];
      switch (tri) {
        case 'nom':
          orderClause = [['nom', 'ASC']];
          break;
        case 'ancien':
          orderClause = [['createdAt', 'ASC']];
          break;
        case 'recent':
        default:
          orderClause = [['createdAt', 'DESC']];
      }

      const { count, rows: boutiques } = await Boutique.findAndCountAll({
        where: whereClause,
        include: includeClause,
        limit: parseInt(limit),
        offset: offset,
        order: orderClause,
        distinct: true
      });

      // Enrichir avec statistiques
      const boutiquesEnrichies = await Promise.all(
        boutiques.map(async (boutique) => {
          const nombreProduits = await Produit.count({
            where: { boutique_id: boutique.id }
          });

          return {
            id: boutique.id,
            nom: boutique.nom,
            description: boutique.description,
            logo_url: boutique.logo_url,
            vendeur: {
              nom: boutique.vendeur.utilisateur.nom,
              grade: boutique.vendeur.grade?.nom
            },
            template: boutique.template?.nom,
            nombre_produits: nombreProduits,
            date_creation: boutique.createdAt
          };
        })
      );

      return res.json({
        success: true,
        boutiques: boutiquesEnrichies,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          totalPages: Math.ceil(count / limit)
        },
        filtres_appliques: {
          nom: nom || null,
          categorie: categorie || null,
          grade: grade || null,
          tri
        }
      });

    } catch (error) {
      console.error('❌ Erreur liste boutiques:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des boutiques'
      });
    }
  }

  /**
   * @desc    Récupérer les produits d'une boutique
   * @route   GET /api/boutiques/:id/produits
   * @access  Public
   */
  static async getBoutiqueProduits(req, res) {
    try {
      const { id } = req.params;
      const { categorie, prix_min, prix_max, page = 1, limit = 12, tri = 'recent' } = req.query;
      console.log('🛍️ Produits boutique:', id);

      const boutique = await Boutique.findByPk(id);
      if (!boutique) {
        return res.status(404).json({
          success: false,
          message: 'Boutique non trouvée'
        });
      }

      const whereClause = { boutique_id: id };

      // Filtres prix
      if (prix_min || prix_max) {
        whereClause.prix = {};
        if (prix_min) whereClause.prix[Op.gte] = parseFloat(prix_min);
        if (prix_max) whereClause.prix[Op.lte] = parseFloat(prix_max);
      }

      const includeClause = [
        {
          model: ImageProduit,
          as: 'images',
          where: { est_principale: true },
          required: false,
          attributes: ['url']
        },
        {
          model: Categorie,
          as: 'categorie',
          attributes: ['id', 'nom'],
          where: categorie ? { nom: categorie } : {}
        }
      ];

      const offset = (page - 1) * limit;

      // Ordre
      let orderClause = [];
      switch (tri) {
        case 'prix_asc':
          orderClause = [['prix', 'ASC']];
          break;
        case 'prix_desc':
          orderClause = [['prix', 'DESC']];
          break;
        case 'nom':
          orderClause = [['nom', 'ASC']];
          break;
        case 'recent':
        default:
          orderClause = [['createdAt', 'DESC']];
      }

      const { count, rows: produits } = await Produit.findAndCountAll({
        where: whereClause,
        include: includeClause,
        limit: parseInt(limit),
        offset: offset,
        order: orderClause
      });

      const produitsFormates = produits.map(produit => ({
        id: produit.id,
        nom: produit.nom,
        prix: parseFloat(produit.prix),
        stock: produit.stock,
        image: produit.images[0]?.url || null,
        categorie: produit.categorie?.nom || 'Sans catégorie',
        disponible: produit.stock > 0
      }));

      return res.json({
        success: true,
        produits: produitsFormates,
        boutique: {
          id: boutique.id,
          nom: boutique.nom
        },
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          totalPages: Math.ceil(count / limit)
        },
        filtres_appliques: {
          categorie: categorie || null,
          prix_min: prix_min || null,
          prix_max: prix_max || null,
          tri
        }
      });

    } catch (error) {
      console.error('❌ Erreur produits boutique:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des produits'
      });
    }
  }

  /**
   * @desc    Statistiques de la boutique
   * @route   GET /api/boutiques/:id/statistiques
   * @access  Private (Propriétaire ou Admin)
   */
  static async getBoutiqueStatistiques(req, res) {
    try {
      const { id } = req.params;
      const { periode = '30j' } = req.query;
      console.log('📊 Statistiques boutique:', id);

      const boutique = await Boutique.findByPk(id);
      if (!boutique) {
        return res.status(404).json({
          success: false,
          message: 'Boutique non trouvée'
        });
      }

      // Vérifier les droits
      if (req.user.role !== 'admin' && boutique.vendeur_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Accès non autorisé'
        });
      }

      // Calculer la date limite selon la période
      let dateLimite = new Date();
      switch (periode) {
        case '7j':
          dateLimite.setDate(dateLimite.getDate() - 7);
          break;
        case '30j':
          dateLimite.setDate(dateLimite.getDate() - 30);
          break;
        case '90j':
          dateLimite.setDate(dateLimite.getDate() - 90);
          break;
        case '1an':
          dateLimite.setFullYear(dateLimite.getFullYear() - 1);
          break;
        default:
          dateLimite.setDate(dateLimite.getDate() - 30);
      }

      // Statistiques générales
      const nombreProduits = await Produit.count({
        where: { boutique_id: id }
      });

      const produitsEnStock = await Produit.count({
        where: { 
          boutique_id: id,
          stock: { [Op.gt]: 0 }
        }
      });

      // Statistiques de ventes
      const statsVentes = await StatistiqueVente.findAll({
        where: { 
          vendeur_id: boutique.vendeur_id,
          date: { [Op.gte]: dateLimite }
        },
        attributes: [
          [require('sequelize').fn('SUM', require('sequelize').col('ventes')), 'total_ventes'],
          [require('sequelize').fn('SUM', require('sequelize').col('chiffre_affaires')), 'total_ca']
        ],
        raw: true
      });

      const stats = statsVentes[0] || { total_ventes: 0, total_ca: 0 };

      // Commandes récentes
      const nombreCommandes = await Commande.count({
        include: [{
          model: CommandeProduit,
          as: 'produits',
          include: [{
            model: Produit,
            as: 'produit',
            where: { boutique_id: id }
          }]
        }],
        where: { date: { [Op.gte]: dateLimite } }
      });

      // Produits les plus vendus
      const produitsPopulaires = await Produit.findAll({
        where: { boutique_id: id },
        include: [{
          model: CommandeProduit,
          as: 'commandes',
          attributes: []
        }],
        attributes: [
          'id', 'nom', 'prix',
          [require('sequelize').fn('SUM', require('sequelize').col('commandes.quantite')), 'total_vendu']
        ],
        group: ['Produit.id'],
        order: [[require('sequelize').fn('SUM', require('sequelize').col('commandes.quantite')), 'DESC']],
        limit: 5,
        raw: false
      });

      return res.json({
        success: true,
        statistiques: {
          periode: periode,
          boutique: {
            id: boutique.id,
            nom: boutique.nom
          },
          produits: {
            total: nombreProduits,
            en_stock: produitsEnStock,
            rupture_stock: nombreProduits - produitsEnStock
          },
          ventes: {
            nombre_ventes: parseInt(stats.total_ventes) || 0,
            chiffre_affaires: parseFloat(stats.total_ca) || 0,
            nombre_commandes: nombreCommandes,
            vente_moyenne: stats.total_ventes > 0 ? parseFloat(stats.total_ca) / parseInt(stats.total_ventes) : 0
          },
          produits_populaires: produitsPopulaires.map(p => ({
            id: p.id,
            nom: p.nom,
            prix: parseFloat(p.prix),
            total_vendu: parseInt(p.get('total_vendu')) || 0
          }))
        }
      });

    } catch (error) {
      console.error('❌ Erreur statistiques boutique:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des statistiques'
      });
    }
  }

  /**
   * @desc    Rechercher des boutiques
   * @route   GET /api/boutiques/search
   * @access  Public
   */
  static async searchBoutiques(req, res) {
    try {
      const { q, localisation, grade, categorie, page = 1, limit = 12 } = req.query;
      console.log('🔍 Recherche boutiques:', q);

      const whereClause = {};
      const includeClause = [
        {
          model: Vendeur,
          as: 'vendeur',
          include: [
            {
              model: Utilisateur,
              as: 'utilisateur',
              attributes: ['nom']
            },
            {
              model: GradeVendeur,
              as: 'grade',
              attributes: ['nom'],
              where: grade ? { nom: grade } : {}
            }
          ]
        }
      ];

      // Recherche textuelle
      if (q) {
        whereClause[Op.or] = [
          { nom: { [Op.like]: `%${q}%` } },
          { description: { [Op.like]: `%${q}%` } }
        ];
      }

      const offset = (page - 1) * limit;

      const { count, rows: boutiques } = await Boutique.findAndCountAll({
        where: whereClause,
        include: includeClause,
        limit: parseInt(limit),
        offset: offset,
        order: [['createdAt', 'DESC']],
        distinct: true
      });

      const boutiquesFormatees = boutiques.map(boutique => ({
        id: boutique.id,
        nom: boutique.nom,
        description: boutique.description,
        logo_url: boutique.logo_url,
        vendeur: {
          nom: boutique.vendeur.utilisateur.nom,
          grade: boutique.vendeur.grade?.nom
        }
      }));

      return res.json({
        success: true,
        boutiques: boutiquesFormatees,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          totalPages: Math.ceil(count / limit)
        },
        recherche: {
          terme: q || null,
          nombre_resultats: count
        }
      });

    } catch (error) {
      console.error('❌ Erreur recherche boutiques:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la recherche'
      });
    }
  }

  /**
   * @desc    Boutiques les plus populaires
   * @route   GET /api/boutiques/populaires
   * @access  Public
   */
  static async getBoutiquesPopulaires(req, res) {
    try {
      const { limite = 8, periode = '30j' } = req.query;
      console.log('🌟 Boutiques populaires');

      // Calculer date limite
      let dateLimite = new Date();
      switch (periode) {
        case '7j':
          dateLimite.setDate(dateLimite.getDate() - 7);
          break;
        case '30j':
          dateLimite.setDate(dateLimite.getDate() - 30);
          break;
        case '90j':
          dateLimite.setDate(dateLimite.getDate() - 90);
          break;
        default:
          dateLimite.setDate(dateLimite.getDate() - 30);
      }

      // Récupérer les boutiques avec leurs ventes
      const boutiques = await Boutique.findAll({
        include: [
          {
            model: Vendeur,
            as: 'vendeur',
            include: [
              {
                model: Utilisateur,
                as: 'utilisateur',
                attributes: ['nom']
              },
              {
                model: StatistiqueVente,
                as: 'statistiques',
                where: { date: { [Op.gte]: dateLimite } },
                required: false,
                attributes: []
              }
            ]
          }
        ],
        attributes: [
          'id', 'nom', 'description', 'logo_url',
          [require('sequelize').fn('SUM', require('sequelize').col('vendeur.statistiques.ventes')), 'total_ventes']
        ],
        group: ['Boutique.id'],
        order: [[require('sequelize').fn('SUM', require('sequelize').col('vendeur.statistiques.ventes')), 'DESC']],
        limit: parseInt(limite),
        raw: false
      });

      const boutiquesPopulaires = await Promise.all(
        boutiques.map(async (boutique) => {
          const nombreProduits = await Produit.count({
            where: { boutique_id: boutique.id }
          });

          return {
            id: boutique.id,
            nom: boutique.nom,
            description: boutique.description,
            logo_url: boutique.logo_url,
            vendeur: boutique.vendeur.utilisateur.nom,
            nombre_produits: nombreProduits,
            total_ventes: parseInt(boutique.get('total_ventes')) || 0
          };
        })
      );

      return res.json({
        success: true,
        boutiques: boutiquesPopulaires,
        criteres: {
          periode: periode,
          base_sur: 'nombre_ventes'
        }
      });

    } catch (error) {
      console.error('❌ Erreur boutiques populaires:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des boutiques populaires'
      });
    }
  }

  /**
   * @desc    Supprimer une boutique
   * @route   DELETE /api/boutiques/:id
   * @access  Private (Propriétaire ou Admin)
   */
  static async deleteBoutique(req, res) {
    try {
      const { id } = req.params;
      console.log('🗑️ Suppression boutique:', id);

      const boutique = await Boutique.findByPk(id);
      if (!boutique) {
        return res.status(404).json({
          success: false,
          message: 'Boutique non trouvée'
        });
      }

      // Vérifier les droits
      if (req.user.role !== 'admin' && boutique.vendeur_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Vous n\'êtes pas autorisé à supprimer cette boutique'
        });
      }

      // Vérifier s'il y a des commandes en cours
      const commandesEnCours = await Commande.count({
        include: [{
          model: CommandeProduit,
          as: 'produits',
          include: [{
            model: Produit,
            as: 'produit',
            where: { boutique_id: id }
          }]
        }],
        where: {
          statut: { [Op.in]: ['en attente', 'validée', 'expédiée'] }
        }
      });

      if (commandesEnCours > 0) {
        return res.status(400).json({
          success: false,
          message: 'Impossible de supprimer : commandes en cours',
          commandes_en_cours: commandesEnCours
        });
      }

      // Supprimer les fichiers associés
      if (boutique.logo_url) {
        try {
          const logoPath = path.join(process.env.UPLOAD_PATH || 'uploads/boutiques', path.basename(boutique.logo_url));
          await fs.unlink(logoPath);
        } catch (error) {
          console.log('Logo non trouvé:', boutique.logo_url);
        }
      }

      if (boutique.banniere_url) {
        try {
          const bannierePath = path.join(process.env.UPLOAD_PATH || 'uploads/boutiques', path.basename(boutique.banniere_url));
          await fs.unlink(bannierePath);
        } catch (error) {
          console.log('Bannière non trouvée:', boutique.banniere_url);
        }
      }

      // Supprimer la boutique (CASCADE supprimera les produits)
      await boutique.destroy();

      console.log('✅ Boutique supprimée:', id);

      return res.json({
        success: true,
        message: 'Boutique supprimée avec succès'
      });

    } catch (error) {
      console.error('❌ Erreur suppression boutique:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la suppression de la boutique'
      });
    }
  }

  // ==================== UTILITAIRES ====================

  /**
   * @desc    Templates disponibles pour création de boutique
   * @route   GET /api/boutiques/templates/disponibles
   * @access  Public
   */
  static async getTemplatesDisponibles(req, res) {
    try {
      const { grade } = req.query;
      console.log('🎨 Templates disponibles, grade:', grade);

      const whereClause = {};
      if (grade) {
        const gradeObj = await GradeVendeur.findOne({ where: { nom: grade } });
        if (gradeObj) {
          whereClause.grade_requis_id = { [Op.lte]: gradeObj.id };
        }
      }

      const templates = await Template.findAll({
        where: whereClause,
        include: [{
          model: GradeVendeur,
          as: 'gradeRequis',
          attributes: ['nom']
        }],
        order: [['grade_requis_id', 'ASC'], ['nom', 'ASC']]
      });

      return res.json({
        success: true,
        templates: templates.map(template => ({
          id: template.id,
          nom: template.nom,
          grade_requis: template.gradeRequis?.nom || 'Amateur',
          accessible: true
        }))
      });

    } catch (error) {
      console.error('❌ Erreur templates disponibles:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des templates'
      });
    }
  }
}

module.exports = BoutiqueController;