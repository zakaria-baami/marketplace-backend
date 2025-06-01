// controllers/vendeurController.js
const { Vendeur, Utilisateur, GradeVendeur, Boutique, Produit, StatistiqueVente, Panier, LignePanier } = require('../models');
const ApiResponse = require('../utils/apiResponse');
const { Op } = require('sequelize');

class VendeurController {
  /**
   * Récupérer le profil complet du vendeur connecté
   */
  static async obtenirMonProfil(req, res) {
    try {
      const vendeur = await Vendeur.findByPk(req.user.id, {
        include: [
          { 
            model: Utilisateur, 
            as: 'utilisateur',
            attributes: { exclude: ['password'] }
          },
          { model: GradeVendeur, as: 'grade' },
          { 
            model: Boutique, 
            as: 'boutiques',
            include: [{ model: Produit, as: 'produits' }]
          }
        ]
      });

      if (!vendeur) {
        return ApiResponse.notFound(res, 'Profil vendeur non trouvé');
      }

      return ApiResponse.success(res, vendeur);

    } catch (error) {
      console.error('Erreur récupération profil vendeur:', error);
      return ApiResponse.error(res, 'Erreur lors de la récupération du profil', 500);
    }
  }

  /**
   * Mettre à jour les informations du vendeur
   */
  static async mettreAJourProfil(req, res) {
    try {
      const { numero_fiscal } = req.body;

      const vendeur = await Vendeur.findByPk(req.user.id);
      if (!vendeur) {
        return ApiResponse.notFound(res, 'Profil vendeur non trouvé');
      }

      await vendeur.update({ numero_fiscal });

      const vendeurMisAJour = await Vendeur.findByPk(req.user.id, {
        include: [
          { 
            model: Utilisateur, 
            as: 'utilisateur',
            attributes: { exclude: ['password'] }
          },
          { model: GradeVendeur, as: 'grade' }
        ]
      });

      return ApiResponse.updated(res, vendeurMisAJour);

    } catch (error) {
      console.error('Erreur mise à jour profil vendeur:', error);
      return ApiResponse.error(res, 'Erreur lors de la mise à jour du profil', 500);
    }
  }

  /**
   * Créer une nouvelle boutique
   */
  static async genererBoutique(req, res) {
    try {
      const { nom, description, logo, banniere, template_id } = req.body;

      const vendeur = await Vendeur.findByPk(req.user.id);
      if (!vendeur) {
        return ApiResponse.notFound(res, 'Profil vendeur non trouvé');
      }

      const resultat = await vendeur.genererBoutique({
        nom,
        description,
        logo,
        banniere,
        template_id
      });

      if (!resultat.success) {
        return ApiResponse.error(res, resultat.message, 400);
      }

      return ApiResponse.created(res, resultat.boutique, resultat.message);

    } catch (error) {
      console.error('Erreur création boutique:', error);
      return ApiResponse.error(res, 'Erreur lors de la création de la boutique', 500);
    }
  }

  /**
   * Ajouter un produit dans une boutique
   */
  static async ajouterProduit(req, res) {
    try {
      const { boutique_id, nom, description, prix, stock, categorie_id, images } = req.body;

      const vendeur = await Vendeur.findByPk(req.user.id);
      if (!vendeur) {
        return ApiResponse.notFound(res, 'Profil vendeur non trouvé');
      }

      const resultat = await vendeur.ajouterProduit({
        boutique_id,
        nom,
        description,
        prix,
        stock,
        categorie_id,
        images
      });

      if (!resultat.success) {
        return ApiResponse.error(res, resultat.message, 400);
      }

      return ApiResponse.created(res, resultat.produit, resultat.message);

    } catch (error) {
      console.error('Erreur ajout produit:', error);
      return ApiResponse.error(res, 'Erreur lors de l\'ajout du produit', 500);
    }
  }

  /**
   * Modifier un produit
   */
  static async modifierProduit(req, res) {
    try {
      const { produit_id } = req.params;
      const { nom, description, prix, stock, categorie_id, images } = req.body;

      const vendeur = await Vendeur.findByPk(req.user.id);
      if (!vendeur) {
        return ApiResponse.notFound(res, 'Profil vendeur non trouvé');
      }

      const resultat = await vendeur.modifierProduit(produit_id, {
        nom,
        description,
        prix,
        stock,
        categorie_id,
        images
      });

      if (!resultat.success) {
        return ApiResponse.error(res, resultat.message, 400);
      }

      return ApiResponse.updated(res, resultat.produit, resultat.message);

    } catch (error) {
      console.error('Erreur modification produit:', error);
      return ApiResponse.error(res, 'Erreur lors de la modification du produit', 500);
    }
  }

  /**
   * Supprimer un produit
   */
  static async supprimerProduit(req, res) {
    try {
      const { produit_id } = req.params;

      const vendeur = await Vendeur.findByPk(req.user.id);
      if (!vendeur) {
        return ApiResponse.notFound(res, 'Profil vendeur non trouvé');
      }

      const resultat = await vendeur.supprimerProduit(produit_id);

      if (!resultat.success) {
        return ApiResponse.error(res, resultat.message, 400);
      }

      return ApiResponse.deleted(res, resultat.message);

    } catch (error) {
      console.error('Erreur suppression produit:', error);
      return ApiResponse.error(res, 'Erreur lors de la suppression du produit', 500);
    }
  }

  /**
   * Vérifier le stock de tous les produits
   */
  static async verifierStock(req, res) {
    try {
      const { seuil_critique = 5 } = req.query;

      const vendeur = await Vendeur.findByPk(req.user.id);
      if (!vendeur) {
        return ApiResponse.notFound(res, 'Profil vendeur non trouvé');
      }

      const resultat = await vendeur.verifierStock(parseInt(seuil_critique));

      if (!resultat.success) {
        return ApiResponse.error(res, resultat.message, 400);
      }

      return ApiResponse.success(res, resultat.rapport, 'Rapport de stock généré');

    } catch (error) {
      console.error('Erreur vérification stock:', error);
      return ApiResponse.error(res, 'Erreur lors de la vérification du stock', 500);
    }
  }

  /**
   * Changer de grade
   */
  static async changerGrade(req, res) {
    try {
      const { nouveau_grade_id } = req.body;

      if (!nouveau_grade_id) {
        return ApiResponse.validationError(res, [
          { field: 'nouveau_grade_id', message: 'L\'ID du nouveau grade est requis' }
        ]);
      }

      const vendeur = await Vendeur.findByPk(req.user.id);
      if (!vendeur) {
        return ApiResponse.notFound(res, 'Profil vendeur non trouvé');
      }

      const resultat = await vendeur.changerGradeNouveauGrade(nouveau_grade_id);

      if (!resultat.success) {
        return ApiResponse.error(res, resultat.message, 400);
      }

      return ApiResponse.updated(res, resultat.nouveau_grade, resultat.message);

    } catch (error) {
      console.error('Erreur changement grade:', error);
      return ApiResponse.error(res, 'Erreur lors du changement de grade', 500);
    }
  }

  /**
   * Mettre à jour les statistiques de vente
   */
  static async mettreAJourStatistiques(req, res) {
    try {
      const { montant_vente } = req.body;

      if (!montant_vente || montant_vente <= 0) {
        return ApiResponse.validationError(res, [
          { field: 'montant_vente', message: 'Le montant de vente doit être supérieur à 0' }
        ]);
      }

      const vendeur = await Vendeur.findByPk(req.user.id);
      if (!vendeur) {
        return ApiResponse.notFound(res, 'Profil vendeur non trouvé');
      }

      const resultat = await vendeur.mettreAJourStatistiques(montant_vente);

      if (!resultat.success) {
        return ApiResponse.error(res, resultat.message, 400);
      }

      return ApiResponse.success(res, null, resultat.message);

    } catch (error) {
      console.error('Erreur mise à jour statistiques:', error);
      return ApiResponse.error(res, 'Erreur lors de la mise à jour des statistiques', 500);
    }
  }

  /**
   * Vérifier si le vendeur peut être promu
   */
  static async verifierPromotionGrade(req, res) {
    try {
      const vendeur = await Vendeur.findByPk(req.user.id);
      if (!vendeur) {
        return ApiResponse.notFound(res, 'Profil vendeur non trouvé');
      }

      const resultat = await vendeur.verifierPromotionGrade();

      return ApiResponse.success(res, {
        peut_etre_promu: resultat.success,
        message: resultat.message,
        nouveau_grade: resultat.nouveau_grade || null
      });

    } catch (error) {
      console.error('Erreur vérification promotion:', error);
      return ApiResponse.error(res, 'Erreur lors de la vérification de promotion', 500);
    }
  }

  /**
   * Obtenir le tableau de bord du vendeur
   */
  static async obtenirTableauDeBord(req, res) {
    try {
      const vendeur = await Vendeur.findByPk(req.user.id);
      if (!vendeur) {
        return ApiResponse.notFound(res, 'Profil vendeur non trouvé');
      }

      const resultat = await vendeur.obtenirTableauDeBord();

      if (!resultat.success) {
        return ApiResponse.error(res, resultat.message, 400);
      }

      return ApiResponse.success(res, resultat.tableau_de_bord, 'Tableau de bord récupéré');

    } catch (error) {
      console.error('Erreur tableau de bord:', error);
      return ApiResponse.error(res, 'Erreur lors de la récupération du tableau de bord', 500);
    }
  }

  /**
   * Lister tous les vendeurs (admin uniquement)
   */
  static async listerVendeurs(req, res) {
    try {
      const { page = 1, limit = 10, grade_id, search } = req.query;
      const offset = (page - 1) * limit;

      const whereClause = {};
      if (grade_id) whereClause.grade_id = grade_id;

      const includeClause = [
        { 
          model: Utilisateur, 
          as: 'utilisateur',
          attributes: { exclude: ['password'] },
          ...(search && {
            where: {
              [Op.or]: [
                { nom: { [Op.like]: `%${search}%` } },
                { email: { [Op.like]: `%${search}%` } }
              ]
            }
          })
        },
        { model: GradeVendeur, as: 'grade' },
        { model: Boutique, as: 'boutiques' }
      ];

      const { count, rows } = await Vendeur.findAndCountAll({
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
      console.error('Erreur liste vendeurs:', error);
      return ApiResponse.error(res, 'Erreur lors de la récupération des vendeurs', 500);
    }
  }

  /**
   * Obtenir un vendeur par ID (admin uniquement)
   */
  static async obtenirVendeur(req, res) {
    try {
      const { id } = req.params;

      const vendeur = await Vendeur.findByPk(id, {
        include: [
          { 
            model: Utilisateur, 
            as: 'utilisateur',
            attributes: { exclude: ['password'] }
          },
          { model: GradeVendeur, as: 'grade' },
          { 
            model: Boutique, 
            as: 'boutiques',
            include: [{ model: Produit, as: 'produits' }]
          }
        ]
      });

      if (!vendeur) {
        return ApiResponse.notFound(res, 'Vendeur non trouvé');
      }

      return ApiResponse.success(res, vendeur);

    } catch (error) {
      console.error('Erreur récupération vendeur:', error);
      return ApiResponse.error(res, 'Erreur lors de la récupération du vendeur', 500);
    }
  }

  /**
   * Modifier le grade d'un vendeur (admin uniquement)
   */
  static async modifierGradeVendeur(req, res) {
    try {
      const { id } = req.params;
      const { nouveau_grade_id } = req.body;

      if (!nouveau_grade_id) {
        return ApiResponse.validationError(res, [
          { field: 'nouveau_grade_id', message: 'L\'ID du nouveau grade est requis' }
        ]);
      }

      const vendeur = await Vendeur.findByPk(id);
      if (!vendeur) {
        return ApiResponse.notFound(res, 'Vendeur non trouvé');
      }

      // Vérifier que le grade existe
      const grade = await GradeVendeur.findByPk(nouveau_grade_id);
      if (!grade) {
        return ApiResponse.notFound(res, 'Grade non trouvé');
      }

      await vendeur.update({ grade_id: nouveau_grade_id });

      const vendeurMisAJour = await Vendeur.findByPk(id, {
        include: [
          { model: Utilisateur, as: 'utilisateur', attributes: { exclude: ['password'] } },
          { model: GradeVendeur, as: 'grade' }
        ]
      });

      return ApiResponse.updated(res, vendeurMisAJour, `Grade modifié vers ${grade.nom}`);

    } catch (error) {
      console.error('Erreur modification grade vendeur:', error);
      return ApiResponse.error(res, 'Erreur lors de la modification du grade', 500);
    }
  }

  /**
   * Statistiques générales des vendeurs (admin uniquement)
   */
  static async statistiquesVendeurs(req, res) {
    try {
      const totalVendeurs = await Vendeur.count();
      
      // Répartition par grade
      const vendeurs = await Vendeur.findAll({
        include: [{ model: GradeVendeur, as: 'grade' }]
      });

      const repartitionGrades = {};
      vendeurs.forEach(vendeur => {
        const gradeName = vendeur.grade?.nom || 'Sans grade';
        repartitionGrades[gradeName] = (repartitionGrades[gradeName] || 0) + 1;
      });

      // Vendeurs avec boutiques
      const vendeursAvecBoutique = await Vendeur.count({
        include: [{ model: Boutique, as: 'boutiques', required: true }]
      });

      // Nouveaux vendeurs des 30 derniers jours
      const dateLimite = new Date();
      dateLimite.setDate(dateLimite.getDate() - 30);
      
      const nouveauxVendeurs = await Vendeur.count({
        where: {
          createdAt: {
            [Op.gte]: dateLimite
          }
        }
      });

      return ApiResponse.success(res, {
        total_vendeurs: totalVendeurs,
        vendeurs_avec_boutique: vendeursAvecBoutique,
        vendeurs_sans_boutique: totalVendeurs - vendeursAvecBoutique,
        nouveaux_vendeurs_30j: nouveauxVendeurs,
        repartition_par_grade: repartitionGrades
      });

    } catch (error) {
      console.error('Erreur statistiques vendeurs:', error);
      return ApiResponse.error(res, 'Erreur lors de la récupération des statistiques', 500);
    }
  }
}

module.exports = VendeurController;