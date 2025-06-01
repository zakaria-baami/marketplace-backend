// controllers/produitController.js
const { Produit, Boutique, Categorie, ImageProduit, Vendeur, Utilisateur } = require('../models');
const ApiResponse = require('../utils/apiResponse');
const { Op } = require('sequelize');

class ProduitController {
  /**
   * Créer un nouveau produit
   */
  static async creerProduit(req, res) {
    try {
      const { boutique_id, categorie_id, nom, prix, stock = 0, images } = req.body;

      // Validation des données
      if (!boutique_id || !categorie_id || !nom || !prix) {
        return ApiResponse.validationError(res, [
          { field: 'boutique_id', message: 'L\'ID de la boutique est requis' },
          { field: 'categorie_id', message: 'L\'ID de la catégorie est requis' },
          { field: 'nom', message: 'Le nom du produit est requis' },
          { field: 'prix', message: 'Le prix du produit est requis' }
        ]);
      }

      if (prix <= 0) {
        return ApiResponse.validationError(res, [
          { field: 'prix', message: 'Le prix doit être supérieur à 0' }
        ]);
      }

      // Vérifier que la boutique appartient au vendeur connecté
      const boutique = await Boutique.findOne({
        where: { id: boutique_id, vendeur_id: req.user.id }
      });

      if (!boutique) {
        return ApiResponse.forbidden(res, 'Vous ne pouvez ajouter des produits que dans vos propres boutiques');
      }

      // Vérifier que la catégorie existe
      const categorie = await Categorie.findByPk(categorie_id);
      if (!categorie) {
        return ApiResponse.notFound(res, 'Catégorie non trouvée');
      }

      // Créer le produit
      const produit = await Produit.create({
        boutique_id,
        categorie_id,
        nom: nom.trim(),
        prix,
        stock
      });

      // Ajouter les images si fournies
      if (images && images.length > 0) {
        const imagePromises = images.map((image, index) => 
          ImageProduit.create({
            produit_id: produit.id,
            url: image.url,
            est_principale: index === 0 // La première image est principale
          })
        );
        await Promise.all(imagePromises);
      }

      // Récupérer le produit avec ses relations
      const produitComplet = await Produit.findByPk(produit.id, {
        include: [
          { model: Categorie, as: 'categorie' },
          { model: ImageProduit, as: 'images' },
          { model: Boutique, as: 'boutique' }
        ]
      });

      return ApiResponse.created(res, produitComplet, 'Produit créé avec succès');

    } catch (error) {
      console.error('Erreur création produit:', error);
      return ApiResponse.error(res, 'Erreur lors de la création du produit', 500);
    }
  }

  /**
   * Lister les produits avec filtres et recherche
   */
  static async listerProduits(req, res) {
    try {
      const { 
        page = 1, 
        limit = 12, 
        nom,
        prix_min, 
        prix_max, 
        categorie_id,
        boutique_id,
        disponibles_uniquement = 'false',
        tri = 'nom',
        vendeur_id
      } = req.query;

      const criteres = {
        limite: parseInt(limit),
        tri,
        inclureBoutique: true,
        inclureCategorie: true
      };

      if (nom) criteres.nom = nom;
      if (prix_min) criteres.prixMin = parseFloat(prix_min);
      if (prix_max) criteres.prixMax = parseFloat(prix_max);
      if (categorie_id) criteres.categorie_id = parseInt(categorie_id);
      if (boutique_id) criteres.boutique_id = parseInt(boutique_id);
      if (disponibles_uniquement === 'true') criteres.disponiblesUniquement = true;

      const resultat = await Produit.rechercherProduits(criteres);

      if (!resultat.success) {
        return ApiResponse.error(res, resultat.message, 400);
      }

      // Filtrer par vendeur si spécifié
      let produitsFiltres = resultat.produits;
      if (vendeur_id) {
        const boutiques = await Boutique.findAll({
          where: { vendeur_id: parseInt(vendeur_id) },
          attributes: ['id']
        });
        const boutiquesIds = boutiques.map(b => b.id);
        
        produitsFiltres = resultat.produits.filter(p => 
          boutiquesIds.includes(p.boutique_id)
        );
      }

      // Pagination manuelle
      const offset = (parseInt(page) - 1) * parseInt(limit);
      const produitsPagines = produitsFiltres.slice(offset, offset + parseInt(limit));

      return ApiResponse.paginated(res, produitsPagines, {
        page: parseInt(page),
        limit: parseInt(limit),
        total: produitsFiltres.length
      });

    } catch (error) {
      console.error('Erreur liste produits:', error);
      return ApiResponse.error(res, 'Erreur lors de la récupération des produits', 500);
    }
  }

  /**
   * Récupérer un produit par son ID
   */
  static async obtenirProduit(req, res) {
    try {
      const { id } = req.params;

      const produit = await Produit.findByPk(id, {
        include: [
          { model: Categorie, as: 'categorie' },
          { model: ImageProduit, as: 'images' },
          { 
            model: Boutique, 
            as: 'boutique',
            include: [{
              model: Vendeur,
              as: 'vendeur',
              include: [{
                model: Utilisateur,
                as: 'utilisateur',
                attributes: ['nom', 'email']
              }]
            }]
          }
        ]
      });

      if (!produit) {
        return ApiResponse.notFound(res, 'Produit non trouvé');
      }

      // Ajouter les informations de statut du stock
      const produitAvecStatut = {
        ...produit.toJSON(),
        statut_stock: produit.obtenirStatutStock(),
        disponible: produit.verifierDisponibilite(),
        est_en_rupture: produit.estEnRuptureStock(),
        est_stock_critique: produit.estStockCritique()
      };

      return ApiResponse.success(res, produitAvecStatut);

    } catch (error) {
      console.error('Erreur récupération produit:', error);
      return ApiResponse.error(res, 'Erreur lors de la récupération du produit', 500);
    }
  }

  /**
   * Mettre à jour un produit
   */
  static async mettreAJourProduit(req, res) {
    try {
      const { id } = req.params;
      const { nom, prix, stock, categorie_id, images } = req.body;

      // Vérifier que le produit appartient au vendeur
      const produit = await Produit.findOne({
        where: { id },
        include: [{ model: Boutique, as: 'boutique' }]
      });

      if (!produit) {
        return ApiResponse.notFound(res, 'Produit non trouvé');
      }

      if (produit.boutique.vendeur_id !== req.user.id) {
        return ApiResponse.forbidden(res, 'Vous ne pouvez modifier que vos propres produits');
      }

      // Utiliser la méthode du modèle pour mettre à jour
      const resultat = await produit.mettreAJourInformations({
        nom,
        prix,
        stock,
        categorie_id
      });

      if (!resultat.success) {
        return ApiResponse.error(res, resultat.message, 400);
      }

      // Mettre à jour les images si fournies
      if (images) {
        // Supprimer les anciennes images
        await ImageProduit.destroy({ where: { produit_id: id } });
        
        // Ajouter les nouvelles images
        if (images.length > 0) {
          const imagePromises = images.map((image, index) => 
            ImageProduit.create({
              produit_id: id,
              url: image.url,
              est_principale: index === 0
            })
          );
          await Promise.all(imagePromises);
        }
      }

      // Récupérer le produit mis à jour
      const produitMisAJour = await Produit.findByPk(id, {
        include: [
          { model: Categorie, as: 'categorie' },
          { model: ImageProduit, as: 'images' },
          { model: Boutique, as: 'boutique' }
        ]
      });

      return ApiResponse.updated(res, produitMisAJour, resultat.message);

    } catch (error) {
      console.error('Erreur mise à jour produit:', error);
      return ApiResponse.error(res, 'Erreur lors de la mise à jour du produit', 500);
    }
  }

  /**
   * Supprimer un produit
   */
  static async supprimerProduit(req, res) {
    try {
      const { id } = req.params;

      // Vérifier que le produit appartient au vendeur
      const produit = await Produit.findOne({
        where: { id },
        include: [{ model: Boutique, as: 'boutique' }]
      });

      if (!produit) {
        return ApiResponse.notFound(res, 'Produit non trouvé');
      }

      if (produit.boutique.vendeur_id !== req.user.id) {
        return ApiResponse.forbidden(res, 'Vous ne pouvez supprimer que vos propres produits');
      }

      await produit.destroy();
      return ApiResponse.deleted(res, 'Produit supprimé avec succès');

    } catch (error) {
      console.error('Erreur suppression produit:', error);
      return ApiResponse.error(res, 'Erreur lors de la suppression du produit', 500);
    }
  }

  /**
   * Mettre à jour le stock d'un produit
   */
  static async mettreAJourStock(req, res) {
    try {
      const { id } = req.params;
      const { nouveau_stock } = req.body;

      if (nouveau_stock === undefined || nouveau_stock < 0) {
        return ApiResponse.validationError(res, [
          { field: 'nouveau_stock', message: 'Le nouveau stock doit être un nombre positif ou zéro' }
        ]);
      }

      // Vérifier que le produit appartient au vendeur
      const produit = await Produit.findOne({
        where: { id },
        include: [{ model: Boutique, as: 'boutique' }]
      });

      if (!produit) {
        return ApiResponse.notFound(res, 'Produit non trouvé');
      }

      if (produit.boutique.vendeur_id !== req.user.id) {
        return ApiResponse.forbidden(res, 'Vous ne pouvez modifier que vos propres produits');
      }

      // Utiliser la méthode du modèle
      const resultat = await produit.mettreAJourStock(nouveau_stock);

      if (!resultat.success) {
        return ApiResponse.error(res, resultat.message, 400);
      }

      return ApiResponse.updated(res, {
        id: produit.id,
        nom: produit.nom,
        ancien_stock: resultat.ancien_stock,
        nouveau_stock: resultat.nouveau_stock,
        statut_stock: produit.obtenirStatutStock()
      }, resultat.message);

    } catch (error) {
      console.error('Erreur mise à jour stock:', error);
      return ApiResponse.error(res, 'Erreur lors de la mise à jour du stock', 500);
    }
  }

  /**
   * Réserver du stock pour un produit
   */
  static async reserverStock(req, res) {
    try {
      const { id } = req.params;
      const { quantite } = req.body;

      if (!quantite || quantite <= 0) {
        return ApiResponse.validationError(res, [
          { field: 'quantite', message: 'La quantité doit être supérieure à 0' }
        ]);
      }

      const produit = await Produit.findByPk(id);
      if (!produit) {
        return ApiResponse.notFound(res, 'Produit non trouvé');
      }

      // Utiliser la méthode du modèle
      const resultat = await produit.reserverStock(quantite);

      if (!resultat.success) {
        return ApiResponse.error(res, resultat.message, 400);
      }

      return ApiResponse.success(res, {
        id: produit.id,
        nom: produit.nom,
        quantite_reservee: resultat.quantite_reservee,
        stock_restant: resultat.stock_restant,
        statut_stock: produit.obtenirStatutStock()
      }, resultat.message);

    } catch (error) {
      console.error('Erreur réservation stock:', error);
      return ApiResponse.error(res, 'Erreur lors de la réservation du stock', 500);
    }
  }

  /**
   * Libérer du stock réservé
   */
  static async libererStock(req, res) {
    try {
      const { id } = req.params;
      const { quantite } = req.body;

      if (!quantite || quantite <= 0) {
        return ApiResponse.validationError(res, [
          { field: 'quantite', message: 'La quantité doit être supérieure à 0' }
        ]);
      }

      const produit = await Produit.findByPk(id);
      if (!produit) {
        return ApiResponse.notFound(res, 'Produit non trouvé');
      }

      // Utiliser la méthode du modèle
      const resultat = await produit.libererStock(quantite);

      if (!resultat.success) {
        return ApiResponse.error(res, resultat.message, 400);
      }

      return ApiResponse.success(res, {
        id: produit.id,
        nom: produit.nom,
        quantite_liberee: resultat.quantite_liberee,
        stock_total: resultat.stock_total,
        statut_stock: produit.obtenirStatutStock()
      }, resultat.message);

    } catch (error) {
      console.error('Erreur libération stock:', error);
      return ApiResponse.error(res, 'Erreur lors de la libération du stock', 500);
    }
  }

  /**
   * Vérifier la disponibilité d'un produit
   */
  static async verifierDisponibilite(req, res) {
    try {
      const { id } = req.params;
      const { quantite = 1 } = req.query;

      const produit = await Produit.findByPk(id);
      if (!produit) {
        return ApiResponse.notFound(res, 'Produit non trouvé');
      }

      const disponible = produit.verifierDisponibilite(parseInt(quantite));
      const statutStock = produit.obtenirStatutStock();

      return ApiResponse.success(res, {
        id: produit.id,
        nom: produit.nom,
        stock_actuel: produit.stock,
        quantite_demandee: parseInt(quantite),
        disponible,
        statut_stock: statutStock,
        prix_total: disponible ? produit.calculerPrixTotal(parseInt(quantite)) : null
      });

    } catch (error) {
      console.error('Erreur vérification disponibilité:', error);
      return ApiResponse.error(res, 'Erreur lors de la vérification de disponibilité', 500);
    }
  }

  /**
   * Obtenir les produits populaires
   */
  static async obtenirProduitsPopulaires(req, res) {
    try {
      const { limit = 10 } = req.query;

      const resultat = await Produit.obtenirProduitsPopulaires(parseInt(limit));

      if (!resultat.success) {
        return ApiResponse.error(res, resultat.message, 400);
      }

      return ApiResponse.success(res, resultat.produits_populaires);

    } catch (error) {
      console.error('Erreur produits populaires:', error);
      return ApiResponse.error(res, 'Erreur lors de la récupération des produits populaires', 500);
    }
  }

  /**
   * Lister les produits du vendeur connecté
   */
  static async listerMesProduits(req, res) {
    try {
      const { page = 1, limit = 12, search, categorie_id, statut_stock } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);

      // Récupérer les boutiques du vendeur
      const boutiques = await Boutique.findAll({
        where: { vendeur_id: req.user.id },
        attributes: ['id']
      });

      const boutiquesIds = boutiques.map(b => b.id);

      if (boutiquesIds.length === 0) {
        return ApiResponse.success(res, { produits: [], total: 0 });
      }

      let whereClause = {
        boutique_id: { [Op.in]: boutiquesIds }
      };

      // Filtres
      if (search) {
        whereClause.nom = { [Op.like]: `%${search}%` };
      }

      if (categorie_id) {
        whereClause.categorie_id = parseInt(categorie_id);
      }

      if (statut_stock) {
        switch (statut_stock) {
          case 'epuise':
            whereClause.stock = 0;
            break;
          case 'critique':
            whereClause.stock = { [Op.between]: [1, 5] };
            break;
          case 'disponible':
            whereClause.stock = { [Op.gt]: 5 };
            break;
        }
      }

      const { count, rows } = await Produit.findAndCountAll({
        where: whereClause,
        include: [
          { model: Categorie, as: 'categorie' },
          { model: ImageProduit, as: 'images' },
          { model: Boutique, as: 'boutique' }
        ],
        limit: parseInt(limit),
        offset: offset,
        order: [['created_at', 'DESC']]
      });

      // Ajouter les informations de statut pour chaque produit
      const produitsAvecStatut = rows.map(produit => ({
        ...produit.toJSON(),
        statut_stock: produit.obtenirStatutStock(),
        est_en_rupture: produit.estEnRuptureStock(),
        est_stock_critique: produit.estStockCritique()
      }));

      return ApiResponse.paginated(res, produitsAvecStatut, {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count
      });

    } catch (error) {
      console.error('Erreur liste mes produits:', error);
      return ApiResponse.error(res, 'Erreur lors de la récupération de vos produits', 500);
    }
  }

  /**
   * Obtenir les statistiques des produits du vendeur
   */
  static async obtenirStatistiquesProduits(req, res) {
    try {
      // Récupérer les boutiques du vendeur
      const boutiques = await Boutique.findAll({
        where: { vendeur_id: req.user.id },
        attributes: ['id']
      });

      const boutiquesIds = boutiques.map(b => b.id);

      if (boutiquesIds.length === 0) {
        return ApiResponse.success(res, {
          total_produits: 0,
          produits_en_stock: 0,
          produits_rupture: 0,
          produits_stock_critique: 0,
          valeur_stock_totale: 0
        });
      }

      const [
        totalProduits,
        produitsEnStock,
        produitsRupture,
        produitsStockCritique
      ] = await Promise.all([
        Produit.count({ where: { boutique_id: { [Op.in]: boutiquesIds } } }),
        Produit.count({ 
          where: { 
            boutique_id: { [Op.in]: boutiquesIds },
            stock: { [Op.gt]: 0 }
          } 
        }),
        Produit.count({ 
          where: { 
            boutique_id: { [Op.in]: boutiquesIds },
            stock: 0
          } 
        }),
        Produit.count({ 
          where: { 
            boutique_id: { [Op.in]: boutiquesIds },
            stock: { [Op.between]: [1, 5] }
          } 
        })
      ]);

      // Calculer la valeur totale du stock
      const produits = await Produit.findAll({
        where: { boutique_id: { [Op.in]: boutiquesIds } },
        attributes: ['prix', 'stock']
      });

      const valeurStockTotale = produits.reduce((total, produit) => {
        return total + (parseFloat(produit.prix) * produit.stock);
      }, 0);

      return ApiResponse.success(res, {
        total_produits: totalProduits,
        produits_en_stock: produitsEnStock,
        produits_rupture: produitsRupture,
        produits_stock_critique: produitsStockCritique,
        valeur_stock_totale: Math.round(valeurStockTotale * 100) / 100,
        taux_disponibilite: totalProduits > 0 ? Math.round((produitsEnStock / totalProduits) * 100) : 0
      });

    } catch (error) {
      console.error('Erreur statistiques produits:', error);
      return ApiResponse.error(res, 'Erreur lors de la récupération des statistiques', 500);
    }
  }

  /**
   * Ajouter une image à un produit
   */
  static async ajouterImage(req, res) {
    try {
      const { id } = req.params;
      const { url, est_principale = false } = req.body;

      if (!url) {
        return ApiResponse.validationError(res, [
          { field: 'url', message: 'L\'URL de l\'image est requise' }
        ]);
      }

      // Vérifier que le produit appartient au vendeur
      const produit = await Produit.findOne({
        where: { id },
        include: [{ model: Boutique, as: 'boutique' }]
      });

      if (!produit) {
        return ApiResponse.notFound(res, 'Produit non trouvé');
      }

      if (produit.boutique.vendeur_id !== req.user.id) {
        return ApiResponse.forbidden(res, 'Vous ne pouvez modifier que vos propres produits');
      }

      // Si cette image doit être principale, mettre les autres à false
      if (est_principale) {
        await ImageProduit.update(
          { est_principale: false },
          { where: { produit_id: id } }
        );
      }

      const image = await ImageProduit.create({
        produit_id: id,
        url,
        est_principale
      });

      return ApiResponse.created(res, image, 'Image ajoutée avec succès');

    } catch (error) {
      console.error('Erreur ajout image:', error);
      return ApiResponse.error(res, 'Erreur lors de l\'ajout de l\'image', 500);
    }
  }

  /**
   * Supprimer une image d'un produit
   */
  static async supprimerImage(req, res) {
    try {
      const { id, image_id } = req.params;

      // Vérifier que le produit appartient au vendeur
      const produit = await Produit.findOne({
        where: { id },
        include: [{ model: Boutique, as: 'boutique' }]
      });

      if (!produit) {
        return ApiResponse.notFound(res, 'Produit non trouvé');
      }

      if (produit.boutique.vendeur_id !== req.user.id) {
        return ApiResponse.forbidden(res, 'Vous ne pouvez modifier que vos propres produits');
      }

      const image = await ImageProduit.findOne({
        where: { id: image_id, produit_id: id }
      });

      if (!image) {
        return ApiResponse.notFound(res, 'Image non trouvée');
      }

      await image.destroy();
      return ApiResponse.deleted(res, 'Image supprimée avec succès');

    } catch (error) {
      console.error('Erreur suppression image:', error);
      return ApiResponse.error(res, 'Erreur lors de la suppression de l\'image', 500);
    }
  }

  /**
   * Calculer le prix total pour une quantité
   */
  static async calculerPrixTotal(req, res) {
    try {
      const { id } = req.params;
      const { quantite = 1 } = req.query;

      const produit = await Produit.findByPk(id);
      if (!produit) {
        return ApiResponse.notFound(res, 'Produit non trouvé');
      }

      const quantiteInt = parseInt(quantite);
      if (quantiteInt <= 0) {
        return ApiResponse.validationError(res, [
          { field: 'quantite', message: 'La quantité doit être supérieure à 0' }
        ]);
      }

      const prixTotal = produit.calculerPrixTotal(quantiteInt);
      const disponible = produit.verifierDisponibilite(quantiteInt);

      return ApiResponse.success(res, {
        id: produit.id,
        nom: produit.nom,
        prix_unitaire: parseFloat(produit.prix),
        quantite: quantiteInt,
        prix_total: prixTotal,
        disponible,
        stock_actuel: produit.stock
      });

    } catch (error) {
      console.error('Erreur calcul prix total:', error);
      return ApiResponse.error(res, 'Erreur lors du calcul du prix total', 500);
    }
  }
}

module.exports = ProduitController;