// controllers/panierController.js
const { Panier, LignePanier, Produit, Boutique, Vendeur, Client, Categorie, ImageProduit } = require('../models');
const ApiResponse = require('../utils/apiResponse');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');

class PanierController {
  /**
   * Récupérer le panier actuel du client
   */
  static async obtenirPanier(req, res) {
    try {
      let panier = await Panier.findOne({
        where: { client_id: req.user.id },
        include: [{
          model: LignePanier,
          as: 'lignes',
          include: [{
            model: Produit,
            as: 'produit',
            include: [
              { model: Categorie, as: 'categorie' },
              { model: ImageProduit, as: 'images' },
              { 
                model: Boutique, 
                as: 'boutique',
                include: [{ model: Vendeur, as: 'vendeur' }]
              }
            ]
          }]
        }],
        order: [[{ model: LignePanier, as: 'lignes' }, 'createdAt', 'DESC']]
      });

      // Créer un panier s'il n'existe pas
      if (!panier) {
        panier = await Panier.create({
          client_id: req.user.id
        });
        panier.lignes = [];
      }

      // Calculer le total
      const total = panier.lignes.reduce((sum, ligne) => {
        return sum + (ligne.produit.prix * ligne.quantite);
      }, 0);

      const panierAvecTotal = {
        ...panier.toJSON(),
        total,
        nombre_articles: panier.lignes.reduce((sum, ligne) => sum + ligne.quantite, 0)
      };

      return ApiResponse.success(res, panierAvecTotal);

    } catch (error) {
      console.error('Erreur récupération panier:', error);
      return ApiResponse.error(res, 'Erreur lors de la récupération du panier', 500);
    }
  }

  /**
   * Ajouter un produit au panier
   */
  static async ajouterProduit(req, res) {
    try {
      const { produit_id, quantite = 1 } = req.body;

      if (!produit_id || quantite <= 0) {
        return ApiResponse.validationError(res, [
          { field: 'produit_id', message: 'L\'ID du produit est requis' },
          { field: 'quantite', message: 'La quantité doit être supérieure à 0' }
        ]);
      }

      // Vérifier que le produit existe et est en stock
      const produit = await Produit.findByPk(produit_id);
      if (!produit) {
        return ApiResponse.notFound(res, 'Produit non trouvé');
      }

      if (produit.stock < quantite) {
        return ApiResponse.error(res, `Stock insuffisant. Stock disponible: ${produit.stock}`, 400);
      }

      // Récupérer ou créer le panier
      let panier = await Panier.findOne({
        where: { client_id: req.user.id }
      });

      if (!panier) {
        panier = await Panier.create({
          client_id: req.user.id
        });
      }

      // Vérifier si le produit est déjà dans le panier
      const ligneExistante = await LignePanier.findOne({
        where: { 
          panier_id: panier.id, 
          produit_id 
        }
      });

      if (ligneExistante) {
        // Vérifier le stock pour la nouvelle quantité totale
        const nouvelleQuantite = ligneExistante.quantite + quantite;
        if (produit.stock < nouvelleQuantite) {
          return ApiResponse.error(res, `Stock insuffisant. Vous avez déjà ${ligneExistante.quantite} de ce produit dans votre panier. Stock disponible: ${produit.stock}`, 400);
        }

        await ligneExistante.update({ 
          quantite: nouvelleQuantite 
        });
      } else {
        // Créer une nouvelle ligne
        await LignePanier.create({
          panier_id: panier.id,
          produit_id,
          quantite
        });
      }

      // Récupérer le panier mis à jour
      const panierMisAJour = await Panier.findByPk(panier.id, {
        include: [{
          model: LignePanier,
          as: 'lignes',
          include: [{
            model: Produit,
            as: 'produit',
            include: [
              { model: ImageProduit, as: 'images' },
              { model: Boutique, as: 'boutique' }
            ]
          }]
        }]
      });

      const total = panierMisAJour.lignes.reduce((sum, ligne) => {
        return sum + (ligne.produit.prix * ligne.quantite);
      }, 0);

      return ApiResponse.success(res, {
        ...panierMisAJour.toJSON(),
        total
      }, 'Produit ajouté au panier avec succès');

    } catch (error) {
      console.error('Erreur ajout produit panier:', error);
      return ApiResponse.error(res, 'Erreur lors de l\'ajout du produit au panier', 500);
    }
  }

  /**
   * Mettre à jour la quantité d'un produit dans le panier
   */
  static async mettreAJourQuantite(req, res) {
    try {
      const { ligne_id } = req.params;
      const { nouvelle_quantite } = req.body;

      if (nouvelle_quantite <= 0) {
        return ApiResponse.validationError(res, [
          { field: 'quantite', message: 'La quantité doit être supérieure à 0' }
        ]);
      }

      // Récupérer la ligne du panier
      const lignePanier = await LignePanier.findOne({
        where: { id: ligne_id },
        include: [
          { 
            model: Panier, 
            as: 'panier',
            where: { client_id: req.user.id }
          },
          { model: Produit, as: 'produit' }
        ]
      });

      if (!lignePanier) {
        return ApiResponse.notFound(res, 'Ligne de panier non trouvée');
      }

      // Vérifier le stock
      if (lignePanier.produit.stock < nouvelle_quantite) {
        return ApiResponse.error(res, `Stock insuffisant. Stock disponible: ${lignePanier.produit.stock}`, 400);
      }

      await lignePanier.update({ quantite: nouvelle_quantite });

      // Récupérer le panier mis à jour
      const panierMisAJour = await Panier.findOne({
        where: { client_id: req.user.id },
        include: [{
          model: LignePanier,
          as: 'lignes',
          include: [{
            model: Produit,
            as: 'produit',
            include: [{ model: ImageProduit, as: 'images' }]
          }]
        }]
      });

      const total = panierMisAJour.lignes.reduce((sum, ligne) => {
        return sum + (ligne.produit.prix * ligne.quantite);
      }, 0);

      return ApiResponse.updated(res, {
        ...panierMisAJour.toJSON(),
        total
      }, 'Quantité mise à jour avec succès');

    } catch (error) {
      console.error('Erreur mise à jour quantité:', error);
      return ApiResponse.error(res, 'Erreur lors de la mise à jour de la quantité', 500);
    }
  }

  /**
   * Retirer un produit du panier
   */
  static async retirerProduit(req, res) {
    try {
      const { ligne_id } = req.params;

      const lignePanier = await LignePanier.findOne({
        where: { id: ligne_id },
        include: [{
          model: Panier,
          as: 'panier',
          where: { client_id: req.user.id }
        }]
      });

      if (!lignePanier) {
        return ApiResponse.notFound(res, 'Ligne de panier non trouvée');
      }

      await lignePanier.destroy();

      // Récupérer le panier mis à jour
      const panierMisAJour = await Panier.findOne({
        where: { client_id: req.user.id },
        include: [{
          model: LignePanier,
          as: 'lignes',
          include: [{
            model: Produit,
            as: 'produit',
            include: [{ model: ImageProduit, as: 'images' }]
          }]
        }]
      });

      const total = panierMisAJour.lignes.reduce((sum, ligne) => {
        return sum + (ligne.produit.prix * ligne.quantite);
      }, 0);

      return ApiResponse.success(res, {
        ...panierMisAJour.toJSON(),
        total
      }, 'Produit retiré du panier avec succès');

    } catch (error) {
      console.error('Erreur retrait produit:', error);
      return ApiResponse.error(res, 'Erreur lors du retrait du produit', 500);
    }
  }

  /**
   * Vider complètement le panier
   */
  static async viderPanier(req, res) {
    try {
      const panier = await Panier.findOne({
        where: { client_id: req.user.id }
      });

      if (!panier) {
        return ApiResponse.notFound(res, 'Panier non trouvé');
      }

      await LignePanier.destroy({
        where: { panier_id: panier.id }
      });

      return ApiResponse.success(res, {
        id: panier.id,
        client_id: panier.client_id,
        lignes: [],
        total: 0,
        nombre_articles: 0
      }, 'Panier vidé avec succès');

    } catch (error) {
      console.error('Erreur vidage panier:', error);
      return ApiResponse.error(res, 'Erreur lors du vidage du panier', 500);
    }
  }

  /**
   * Valider le panier (passer commande)
   */
  static async validerPanier(req, res) {
    const transaction = await sequelize.transaction();

    try {
      const { adresse_livraison, methode_paiement, notes } = req.body;

      if (!adresse_livraison) {
        return ApiResponse.validationError(res, [
          { field: 'adresse_livraison', message: 'L\'adresse de livraison est requise' }
        ]);
      }

      // Récupérer le panier avec ses lignes
      const panier = await Panier.findOne({
        where: { client_id: req.user.id },
        include: [{
          model: LignePanier,
          as: 'lignes',
          include: [{
            model: Produit,
            as: 'produit'
          }]
        }]
      });

      if (!panier || !panier.lignes || panier.lignes.length === 0) {
        await transaction.rollback();
        return ApiResponse.error(res, 'Votre panier est vide', 400);
      }

      // Vérifier la disponibilité des produits
      const produitsIndisponibles = [];
      let total = 0;

      for (const ligne of panier.lignes) {
        if (ligne.produit.stock < ligne.quantite) {
          produitsIndisponibles.push({
            nom: ligne.produit.nom,
            stock_disponible: ligne.produit.stock,
            quantite_demandee: ligne.quantite
          });
        }
        total += ligne.produit.prix * ligne.quantite;
      }

      if (produitsIndisponibles.length > 0) {
        await transaction.rollback();
        return ApiResponse.error(res, 'Certains produits ne sont plus disponibles en quantité suffisante', 400, produitsIndisponibles);
      }

      // Mettre à jour le panier avec les informations de commande
      await panier.update({
        statut: 'validé',
        adresse_livraison,
        methode_paiement,
        notes,
        total,
        date_validation: new Date()
      }, { transaction });

      // Mettre à jour les stocks des produits
      for (const ligne of panier.lignes) {
        await ligne.produit.update({
          stock: ligne.produit.stock - ligne.quantite
        }, { transaction });
      }

      // Créer un nouveau panier vide pour le client
      await Panier.create({
        client_id: req.user.id
      }, { transaction });

      await transaction.commit();

      // Récupérer le panier validé avec toutes ses informations
      const panierValide = await Panier.findByPk(panier.id, {
        include: [{
          model: LignePanier,
          as: 'lignes',
          include: [{
            model: Produit,
            as: 'produit',
            include: [
              { model: Boutique, as: 'boutique' },
              { model: ImageProduit, as: 'images' }
            ]
          }]
        }]
      });

      return ApiResponse.success(res, panierValide, 'Commande validée avec succès');

    } catch (error) {
      await transaction.rollback();
      console.error('Erreur validation panier:', error);
      return ApiResponse.error(res, 'Erreur lors de la validation de la commande', 500);
    }
  }

  /**
   * Consulter l'historique des commandes (paniers validés)
   */
  static async historiqueCommandes(req, res) {
    try {
      const { page = 1, limit = 10, statut } = req.query;
      const offset = (page - 1) * limit;

      const whereClause = { 
        client_id: req.user.id,
        statut: { [Op.ne]: null } // Paniers validés uniquement
      };

      if (statut) whereClause.statut = statut;

      const { count, rows } = await Panier.findAndCountAll({
        where: whereClause,
        include: [{
          model: LignePanier,
          as: 'lignes',
          include: [{
            model: Produit,
            as: 'produit',
            include: [
              { model: Boutique, as: 'boutique' },
              { model: ImageProduit, as: 'images' }
            ]
          }]
        }],
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['date_validation', 'DESC']]
      });

      return ApiResponse.paginated(res, rows, {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count
      });

    } catch (error) {
      console.error('Erreur historique commandes:', error);
      return ApiResponse.error(res, 'Erreur lors de la récupération de l\'historique', 500);
    }
  }

  /**
   * Récupérer une commande spécifique (panier validé)
   */
  static async obtenirCommande(req, res) {
    try {
      const { id } = req.params;

      const commande = await Panier.findOne({
        where: { 
          id,
          client_id: req.user.id,
          statut: { [Op.ne]: null }
        },
        include: [{
          model: LignePanier,
          as: 'lignes',
          include: [{
            model: Produit,
            as: 'produit',
            include: [
              { model: Boutique, as: 'boutique', include: [{ model: Vendeur, as: 'vendeur' }] },
              { model: ImageProduit, as: 'images' },
              { model: Categorie, as: 'categorie' }
            ]
          }]
        }]
      });

      if (!commande) {
        return ApiResponse.notFound(res, 'Commande non trouvée');
      }

      return ApiResponse.success(res, commande);

    } catch (error) {
      console.error('Erreur récupération commande:', error);
      return ApiResponse.error(res, 'Erreur lors de la récupération de la commande', 500);
    }
  }

  /**
   * Calculer le total du panier
   */
  static async calculerTotal(req, res) {
    try {
      const panier = await Panier.findOne({
        where: { client_id: req.user.id },
        include: [{
          model: LignePanier,
          as: 'lignes',
          include: [{
            model: Produit,
            as: 'produit'
          }]
        }]
      });

      if (!panier) {
        return ApiResponse.success(res, { total: 0, nombre_articles: 0 });
      }

      const total = panier.lignes.reduce((sum, ligne) => {
        return sum + (ligne.produit.prix * ligne.quantite);
      }, 0);

      const nombre_articles = panier.lignes.reduce((sum, ligne) => {
        return sum + ligne.quantite;
      }, 0);

      return ApiResponse.success(res, { total, nombre_articles });

    } catch (error) {
      console.error('Erreur calcul total:', error);
      return ApiResponse.error(res, 'Erreur lors du calcul du total', 500);
    }
  }
}

module.exports = PanierController;