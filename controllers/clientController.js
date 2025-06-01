// controllers/clientController.js
const { Client, Utilisateur, Panier, LignePanier, Produit, Boutique, Vendeur } = require('../models');
const ApiResponse = require('../utils/apiResponse');
const { Op } = require('sequelize');

class ClientController {
  /**
   * Récupérer le profil complet du client connecté
   */
  static async obtenirMonProfil(req, res) {
    try {
      const client = await Client.findByPk(req.user.id, {
        include: [
          { 
            model: Utilisateur, 
            as: 'utilisateur',
            attributes: { exclude: ['password'] }
          },
          { 
            model: Panier, 
            as: 'panier',
            include: [{
              model: LignePanier,
              as: 'lignes',
              include: [{
                model: Produit,
                as: 'produit'
              }]
            }]
          }
        ]
      });

      if (!client) {
        return ApiResponse.notFound(res, 'Profil client non trouvé');
      }

      // Calculer le total du panier
      const totalPanier = await client.calculerTotalPanier();

      const profilComplet = {
        ...client.toJSON(),
        total_panier: totalPanier,
        nombre_articles_panier: client.panier?.lignes?.reduce((sum, ligne) => sum + ligne.quantite, 0) || 0
      };

      return ApiResponse.success(res, profilComplet);

    } catch (error) {
      console.error('Erreur récupération profil client:', error);
      return ApiResponse.error(res, 'Erreur lors de la récupération du profil', 500);
    }
  }

  /**
   * Mettre à jour les informations du client
   */
  static async mettreAJourInformations(req, res) {
    try {
      const { adresse, telephone, nom, prenom, date_naissance } = req.body;

      const client = await Client.findByPk(req.user.id);
      if (!client) {
        return ApiResponse.notFound(res, 'Profil client non trouvé');
      }

      const resultat = await client.mettreAJourInformations({
        adresse,
        telephone,
        nom,
        prenom,
        date_naissance
      });

      if (!resultat.success) {
        return ApiResponse.error(res, resultat.message, 400);
      }

      // Récupérer le client mis à jour
      const clientMisAJour = await Client.findByPk(req.user.id, {
        include: [
          { 
            model: Utilisateur, 
            as: 'utilisateur',
            attributes: { exclude: ['password'] }
          }
        ]
      });

      return ApiResponse.updated(res, clientMisAJour, resultat.message);

    } catch (error) {
      console.error('Erreur mise à jour informations client:', error);
      return ApiResponse.error(res, 'Erreur lors de la mise à jour des informations', 500);
    }
  }

  /**
   * Ajouter un produit au panier
   */
  static async ajouterAuPanier(req, res) {
    try {
      const { produit_id, quantite = 1 } = req.body;

      if (!produit_id) {
        return ApiResponse.validationError(res, [
          { field: 'produit_id', message: 'L\'ID du produit est requis' }
        ]);
      }

      if (quantite <= 0) {
        return ApiResponse.validationError(res, [
          { field: 'quantite', message: 'La quantité doit être positive' }
        ]);
      }

      // Récupérer le produit
      const produit = await Produit.findByPk(produit_id);
      if (!produit) {
        return ApiResponse.notFound(res, 'Produit non trouvé');
      }

      const client = await Client.findByPk(req.user.id);
      if (!client) {
        return ApiResponse.notFound(res, 'Profil client non trouvé');
      }

      const resultat = await client.ajouterLignePanier(produit, quantite);

      if (!resultat.success) {
        return ApiResponse.error(res, resultat.message, 400);
      }

      // Récupérer le panier mis à jour
      const panier = await client.getPanier({
        include: [{
          model: LignePanier,
          as: 'lignes',
          include: [{
            model: Produit,
            as: 'produit'
          }]
        }]
      });

      const totalPanier = await client.calculerTotalPanier();

      return ApiResponse.success(res, {
        message: resultat.message,
        ligne_ajoutee: resultat.ligne,
        panier: {
          ...panier.toJSON(),
          total: totalPanier
        }
      });

    } catch (error) {
      console.error('Erreur ajout au panier:', error);
      return ApiResponse.error(res, 'Erreur lors de l\'ajout au panier', 500);
    }
  }

  /**
   * Retirer un produit du panier
   */
  static async retirerDuPanier(req, res) {
    try {
      const { ligne_id } = req.params;

      if (!ligne_id) {
        return ApiResponse.validationError(res, [
          { field: 'ligne_id', message: 'L\'ID de la ligne de panier est requis' }
        ]);
      }

      const lignePanier = await LignePanier.findByPk(ligne_id);
      if (!lignePanier) {
        return ApiResponse.notFound(res, 'Ligne de panier non trouvée');
      }

      const client = await Client.findByPk(req.user.id);
      if (!client) {
        return ApiResponse.notFound(res, 'Profil client non trouvé');
      }

      const resultat = await client.retirerDuPanier(lignePanier);

      if (!resultat.success) {
        return ApiResponse.error(res, resultat.message, 400);
      }

      // Récupérer le panier mis à jour
      const panier = await client.getPanier({
        include: [{
          model: LignePanier,
          as: 'lignes',
          include: [{
            model: Produit,
            as: 'produit'
          }]
        }]
      });

      const totalPanier = await client.calculerTotalPanier();

      return ApiResponse.success(res, {
        message: resultat.message,
        panier: {
          ...panier?.toJSON() || null,
          total: totalPanier
        }
      });

    } catch (error) {
      console.error('Erreur retrait du panier:', error);
      return ApiResponse.error(res, 'Erreur lors du retrait du panier', 500);
    }
  }

  /**
   * Récupérer le panier actuel
   */
  static async obtenirPanier(req, res) {
    try {
      const client = await Client.findByPk(req.user.id);
      if (!client) {
        return ApiResponse.notFound(res, 'Profil client non trouvé');
      }

      const panier = await client.getPanier({
        include: [{
          model: LignePanier,
          as: 'lignes',
          include: [{
            model: Produit,
            as: 'produit',
            include: [{
              model: Boutique,
              as: 'boutique',
              include: [{
                model: Vendeur,
                as: 'vendeur'
              }]
            }]
          }]
        }]
      });

      if (!panier) {
        return ApiResponse.success(res, {
          panier: null,
          total: 0,
          nombre_articles: 0
        });
      }

      const totalPanier = await client.calculerTotalPanier();
      const nombreArticles = panier.lignes?.reduce((sum, ligne) => sum + ligne.quantite, 0) || 0;

      return ApiResponse.success(res, {
        panier,
        total: totalPanier,
        nombre_articles: nombreArticles
      });

    } catch (error) {
      console.error('Erreur récupération panier:', error);
      return ApiResponse.error(res, 'Erreur lors de la récupération du panier', 500);
    }
  }

  /**
   * Vider complètement le panier
   */
  static async viderPanier(req, res) {
    try {
      const client = await Client.findByPk(req.user.id);
      if (!client) {
        return ApiResponse.notFound(res, 'Profil client non trouvé');
      }

      const panier = await client.getPanier();
      if (!panier) {
        return ApiResponse.success(res, null, 'Panier déjà vide');
      }

      // Supprimer toutes les lignes du panier
      await LignePanier.destroy({
        where: { panier_id: panier.id }
      });

      return ApiResponse.success(res, {
        panier: {
          id: panier.id,
          client_id: panier.client_id,
          lignes: []
        },
        total: 0,
        nombre_articles: 0
      }, 'Panier vidé avec succès');

    } catch (error) {
      console.error('Erreur vidage panier:', error);
      return ApiResponse.error(res, 'Erreur lors du vidage du panier', 500);
    }
  }

  /**
   * Passer une commande à partir du panier
   */
  static async passerCommande(req, res) {
    try {
      const { informations_livraison, methode_paiement, notes } = req.body;

      const client = await Client.findByPk(req.user.id);
      if (!client) {
        return ApiResponse.notFound(res, 'Profil client non trouvé');
      }

      // Vérifier les informations de livraison
      if (!informations_livraison || !informations_livraison.adresse) {
        return ApiResponse.validationError(res, [
          { field: 'adresse', message: 'L\'adresse de livraison est requise' }
        ]);
      }

      const resultat = await client.passerCommande();

      if (!resultat.success) {
        return ApiResponse.error(res, resultat.message, 400);
      }

      // Note: Ici vous pourriez ajouter la logique de traitement du paiement
      // et la mise à jour avec les informations de livraison

      return ApiResponse.created(res, {
        commande: resultat.commande,
        informations_livraison,
        methode_paiement,
        notes
      }, resultat.message);

    } catch (error) {
      console.error('Erreur passage commande:', error);
      return ApiResponse.error(res, 'Erreur lors du passage de la commande', 500);
    }
  }

  /**
   * Consulter l'historique des commandes
   */
  static async consulterHistorique(req, res) {
    try {
      const { 
        statut, 
        date_debut, 
        date_fin, 
        limit = 20, 
        page = 1 
      } = req.query;

      const client = await Client.findByPk(req.user.id);
      if (!client) {
        return ApiResponse.notFound(res, 'Profil client non trouvé');
      }

      const options = {
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit)
      };

      if (statut) options.statut = statut;
      if (date_debut && date_fin) {
        options.dateDebut = date_debut;
        options.dateFin = date_fin;
      }

      const resultat = await client.consulterHistoriqueCommandes(options);

      if (!resultat.success) {
        return ApiResponse.error(res, resultat.message, 400);
      }

      return ApiResponse.paginated(res, resultat.commandes, {
        page: parseInt(page),
        limit: parseInt(limit),
        total: resultat.commandes.length
      });

    } catch (error) {
      console.error('Erreur consultation historique:', error);
      return ApiResponse.error(res, 'Erreur lors de la consultation de l\'historique', 500);
    }
  }

  /**
   * Calculer le total du panier
   */
  static async calculerTotalPanier(req, res) {
    try {
      const client = await Client.findByPk(req.user.id);
      if (!client) {
        return ApiResponse.notFound(res, 'Profil client non trouvé');
      }

      const total = await client.calculerTotalPanier();

      const panier = await client.getPanier({
        include: [{
          model: LignePanier,
          as: 'lignes'
        }]
      });

      const nombreArticles = panier?.lignes?.reduce((sum, ligne) => sum + ligne.quantite, 0) || 0;

      return ApiResponse.success(res, {
        total_panier: total,
        nombre_articles: nombreArticles,
        panier_vide: total === 0
      });

    } catch (error) {
      console.error('Erreur calcul total panier:', error);
      return ApiResponse.error(res, 'Erreur lors du calcul du total du panier', 500);
    }
  }

  /**
   * Mettre à jour la quantité d'un produit dans le panier
   */
  static async mettreAJourQuantitePanier(req, res) {
    try {
      const { ligne_id } = req.params;
      const { nouvelle_quantite } = req.body;

      if (!nouvelle_quantite || nouvelle_quantite <= 0) {
        return ApiResponse.validationError(res, [
          { field: 'nouvelle_quantite', message: 'La nouvelle quantité doit être positive' }
        ]);
      }

      const lignePanier = await LignePanier.findByPk(ligne_id, {
        include: [{
          model: Produit,
          as: 'produit'
        }, {
          model: Panier,
          as: 'panier'
        }]
      });

      if (!lignePanier) {
        return ApiResponse.notFound(res, 'Ligne de panier non trouvée');
      }

      // Vérifier que cette ligne appartient au client connecté
      if (lignePanier.panier.client_id !== req.user.id) {
        return ApiResponse.forbidden(res, 'Cette ligne de panier ne vous appartient pas');
      }

      // Vérifier le stock disponible
      if (lignePanier.produit.stock < nouvelle_quantite) {
        return ApiResponse.error(res, `Stock insuffisant. Stock disponible: ${lignePanier.produit.stock}`, 400);
      }

      // Mettre à jour la quantité
      const resultat = await lignePanier.mettreAJourQuantite(nouvelle_quantite);

      if (!resultat.success) {
        return ApiResponse.error(res, resultat.message, 400);
      }

      // Récupérer le client pour calculer le nouveau total
      const client = await Client.findByPk(req.user.id);
      const totalPanier = await client.calculerTotalPanier();

      return ApiResponse.updated(res, {
        ligne_mise_a_jour: lignePanier,
        nouveau_total_panier: totalPanier
      }, 'Quantité mise à jour avec succès');

    } catch (error) {
      console.error('Erreur mise à jour quantité:', error);
      return ApiResponse.error(res, 'Erreur lors de la mise à jour de la quantité', 500);
    }
  }

  /**
   * Lister tous les clients (admin uniquement)
   */
  static async listerClients(req, res) {
    try {
      const { page = 1, limit = 10, search, avec_commandes } = req.query;
      const offset = (page - 1) * limit;

      const whereClause = {};
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
        }
      ];

      // Si on veut inclure les informations de commandes
      if (avec_commandes === 'true') {
        includeClause.push({
          model: Panier,
          as: 'panier',
          include: [{
            model: LignePanier,
            as: 'lignes'
          }]
        });
      }

      const { count, rows } = await Client.findAndCountAll({
        where: whereClause,
        include: includeClause,
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['createdAt', 'DESC']]
      });

      // Calculer des statistiques pour chaque client si demandé
      let clientsAvecStats = rows;
      if (avec_commandes === 'true') {
        clientsAvecStats = await Promise.all(
          rows.map(async (client) => {
            const totalPanier = await client.calculerTotalPanier();
            return {
              ...client.toJSON(),
              statistiques: {
                total_panier_actuel: totalPanier,
                articles_dans_panier: client.panier?.lignes?.reduce((sum, ligne) => sum + ligne.quantite, 0) || 0
              }
            };
          })
        );
      }

      return ApiResponse.paginated(res, clientsAvecStats, {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count
      });

    } catch (error) {
      console.error('Erreur liste clients:', error);
      return ApiResponse.error(res, 'Erreur lors de la récupération des clients', 500);
    }
  }

  /**
   * Obtenir un client par ID (admin uniquement)
   */
  static async obtenirClient(req, res) {
    try {
      const { id } = req.params;

      const client = await Client.findByPk(id, {
        include: [
          { 
            model: Utilisateur, 
            as: 'utilisateur',
            attributes: { exclude: ['password'] }
          },
          { 
            model: Panier, 
            as: 'panier',
            include: [{
              model: LignePanier,
              as: 'lignes',
              include: [{
                model: Produit,
                as: 'produit'
              }]
            }]
          }
        ]
      });

      if (!client) {
        return ApiResponse.notFound(res, 'Client non trouvé');
      }

      const totalPanier = await client.calculerTotalPanier();

      return ApiResponse.success(res, {
        ...client.toJSON(),
        statistiques: {
          total_panier_actuel: totalPanier,
          articles_dans_panier: client.panier?.lignes?.reduce((sum, ligne) => sum + ligne.quantite, 0) || 0
        }
      });

    } catch (error) {
      console.error('Erreur récupération client:', error);
      return ApiResponse.error(res, 'Erreur lors de la récupération du client', 500);
    }
  }

  /**
   * Statistiques générales des clients (admin uniquement)
   */
  static async statistiquesClients(req, res) {
    try {
      const totalClients = await Client.count();
      
      // Clients avec panier non vide
      const clientsAvecPanier = await Client.count({
        include: [{
          model: Panier,
          as: 'panier',
          include: [{
            model: LignePanier,
            as: 'lignes',
            required: true
          }],
          required: true
        }]
      });

      // Nouveaux clients des 30 derniers jours
      const dateLimite = new Date();
      dateLimite.setDate(dateLimite.getDate() - 30);
      
      const nouveauxClients = await Client.count({
        where: {
          createdAt: {
            [Op.gte]: dateLimite
          }
        }
      });

      // Clients avec informations complètes
      const clientsComplets = await Client.count({
        where: {
          adresse: { [Op.ne]: null },
          telephone: { [Op.ne]: null }
        }
      });

      return ApiResponse.success(res, {
        total_clients: totalClients,
        clients_avec_panier_actif: clientsAvecPanier,
        clients_panier_vide: totalClients - clientsAvecPanier,
        nouveaux_clients_30j: nouveauxClients,
        clients_informations_completes: clientsComplets,
        taux_completion_profil: totalClients > 0 ? Math.round((clientsComplets / totalClients) * 100) : 0
      });

    } catch (error) {
      console.error('Erreur statistiques clients:', error);
      return ApiResponse.error(res, 'Erreur lors de la récupération des statistiques', 500);
    }
  }
}

module.exports = ClientController;