// controllers/clientController.js - Conforme aux web services
const { 
  Utilisateur, 
  Client, 
  Panier,
  LignePanier,
  Commande,
  CommandeProduit,
  Produit,
  Boutique,
  Vendeur,
  Categorie,
  ImageProduit
} = require('../models/db');
const { Op } = require('sequelize');

class ClientController {

  // ==================== ROUTES PRINCIPALES WEB SERVICES ====================

  /**
   * @desc    Récupérer le profil client
   * @route   GET /api/clients/profile
   * @access  Private (Client uniquement)
   * @response { success, client }
   */
  static async getProfile(req, res) {
    try {
      console.log('👤 Récupération profil client:', req.user.id);

      const client = await Client.findByPk(req.user.id, {
        include: [{
          model: Utilisateur,
          as: 'utilisateur',
          attributes: ['id', 'nom', 'email', 'role']
        }]
      });

      if (!client) {
        return res.status(404).json({
          success: false,
          message: 'Profil client non trouvé'
        });
      }

      // Enrichir avec des statistiques
      const nombreCommandes = await Commande.count({
        where: { client_id: client.id }
      });

      const totalDepense = await Commande.sum('total', {
        where: { 
          client_id: client.id,
          statut: { [Op.in]: ['validée', 'expédiée', 'livrée'] }
        }
      }) || 0;

      const derniereCommande = await Commande.findOne({
        where: { client_id: client.id },
        order: [['date', 'DESC']],
        attributes: ['id', 'date', 'statut', 'total']
      });

      return res.json({
        success: true,
        client: {
          id: client.id,
          nom: client.utilisateur.nom,
          email: client.utilisateur.email,
          adresse: client.adresse,
          telephone: client.telephone,
          date_inscription: client.createdAt,
          statistiques: {
            nombre_commandes: nombreCommandes,
            total_depense: parseFloat(totalDepense),
            panier_moyen: nombreCommandes > 0 ? parseFloat(totalDepense) / nombreCommandes : 0,
            derniere_commande: derniereCommande ? {
              id: derniereCommande.id,
              date: derniereCommande.date,
              statut: derniereCommande.statut,
              montant: parseFloat(derniereCommande.total)
            } : null
          }
        }
      });

    } catch (error) {
      console.error('❌ Erreur récupération profil client:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération du profil client'
      });
    }
  }

  /**
   * @desc    Mettre à jour le profil client
   * @route   PUT /api/clients/profile
   * @access  Private (Client uniquement)
   * @body    { nom, email, adresse, telephone }
   * @response { success, message, client }
   */
  static async updateProfile(req, res) {
    try {
      console.log('✏️ Mise à jour profil client:', req.user.id);

      const { nom, email, adresse, telephone } = req.body;

      // Validation des données
      if (!nom && !email && !adresse && !telephone) {
        return res.status(400).json({
          success: false,
          message: 'Aucune donnée à mettre à jour'
        });
      }

      // Vérifier unicité de l'email si modifié
      if (email && email !== req.user.email) {
        const emailExistant = await Utilisateur.findOne({
          where: {
            email,
            id: { [Op.ne]: req.user.id }
          }
        });

        if (emailExistant) {
          return res.status(409).json({
            success: false,
            message: 'Cet email est déjà utilisé'
          });
        }
      }

      // Mettre à jour l'utilisateur
      const updateUserData = {};
      if (nom) updateUserData.nom = nom;
      if (email) updateUserData.email = email;

      if (Object.keys(updateUserData).length > 0) {
        await Utilisateur.update(updateUserData, {
          where: { id: req.user.id }
        });
      }

      // Mettre à jour les données client
      const updateClientData = {};
      if (adresse) updateClientData.adresse = adresse;
      if (telephone) updateClientData.telephone = telephone;

      if (Object.keys(updateClientData).length > 0) {
        await Client.update(updateClientData, {
          where: { id: req.user.id }
        });
      }

      // Récupérer le profil mis à jour
      const clientMisAJour = await Client.findByPk(req.user.id, {
        include: [{
          model: Utilisateur,
          as: 'utilisateur',
          attributes: ['id', 'nom', 'email']
        }]
      });

      console.log('✅ Profil client mis à jour:', req.user.id);

      return res.json({
        success: true,
        message: 'Profil mis à jour avec succès',
        client: {
          id: clientMisAJour.id,
          nom: clientMisAJour.utilisateur.nom,
          email: clientMisAJour.utilisateur.email,
          adresse: clientMisAJour.adresse,
          telephone: clientMisAJour.telephone
        }
      });

    } catch (error) {
      console.error('❌ Erreur mise à jour profil client:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la mise à jour du profil'
      });
    }
  }

  /**
   * @desc    Historique des paniers validés du client
   * @route   GET /api/clients/historique-paniers
   * @access  Private (Client uniquement)
   * @response { success, paniers_historique }
   */
  static async getHistoriquePaniers(req, res) {
    try {
      console.log('🛒 Historique paniers client:', req.user.id);

      // Les paniers validés sont maintenant des commandes
      const commandes = await Commande.findAll({
        where: { client_id: req.user.id },
        include: [
          {
            model: CommandeProduit,
            as: 'produits',
            include: [{
              model: Produit,
              as: 'produit',
              attributes: ['id', 'nom'],
              include: [{
                model: Boutique,
                as: 'boutique',
                attributes: ['nom'],
                include: [{
                  model: Vendeur,
                  as: 'vendeur',
                  include: [{
                    model: Utilisateur,
                    as: 'utilisateur',
                    attributes: ['nom']
                  }]
                }]
              }]
            }]
          }
        ],
        order: [['date', 'DESC']],
        limit: 50 // Limiter aux 50 dernières commandes
      });

      const paniers_historique = commandes.map(commande => ({
        id: commande.id,
        date_validation: commande.date,
        statut: commande.statut,
        total: parseFloat(commande.total),
        nombre_articles: commande.produits.reduce((sum, cp) => sum + cp.quantite, 0),
        produits: commande.produits.map(cp => ({
          nom: cp.produit.nom,
          quantite: cp.quantite,
          prix_unitaire: parseFloat(cp.prix_unitaire),
          sous_total: parseFloat(cp.prix_unitaire) * cp.quantite,
          vendeur: cp.produit.boutique?.vendeur?.utilisateur?.nom || 'Inconnu'
        })),
        peut_annuler: commande.statut === 'en attente'
      }));

      return res.json({
        success: true,
        paniers_historique,
        resume: {
          nombre_total: paniers_historique.length,
          montant_total: paniers_historique.reduce((sum, panier) => sum + panier.total, 0),
          statuts: {
            en_attente: paniers_historique.filter(p => p.statut === 'en attente').length,
            validees: paniers_historique.filter(p => p.statut === 'validée').length,
            livrees: paniers_historique.filter(p => p.statut === 'livrée').length
          }
        }
      });

    } catch (error) {
      console.error('❌ Erreur historique paniers:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération de l\'historique des paniers'
      });
    }
  }

  // ==================== ROUTES ADDITIONNELLES ====================

  /**
   * @desc    Tableau de bord du client
   * @route   GET /api/clients/dashboard
   * @access  Private (Client uniquement)
   */
  static async getDashboard(req, res) {
    try {
      console.log('📊 Dashboard client:', req.user.id);

      // Statistiques générales
      const nombreCommandes = await Commande.count({
        where: { client_id: req.user.id }
      });

      const totalDepense = await Commande.sum('total', {
        where: { 
          client_id: req.user.id,
          statut: { [Op.in]: ['validée', 'expédiée', 'livrée'] }
        }
      }) || 0;

      // Commandes récentes
      const commandesRecentes = await Commande.findAll({
        where: { client_id: req.user.id },
        order: [['date', 'DESC']],
        limit: 5,
        attributes: ['id', 'date', 'statut', 'total']
      });

      // Panier actuel
      const panierActuel = await Panier.findOne({
        where: { client_id: req.user.id },
        include: [{
          model: LignePanier,
          as: 'lignes',
          include: [{
            model: Produit,
            as: 'produit',
            attributes: ['nom', 'prix']
          }]
        }]
      });

      const panierInfo = panierActuel ? {
        id: panierActuel.id,
        nombre_articles: panierActuel.lignes.length,
        total_estime: panierActuel.lignes.reduce((sum, ligne) => 
          sum + (parseFloat(ligne.produit.prix) * ligne.quantite), 0
        )
      } : null;

      // Commandes en cours
      const commandesEnCours = await Commande.count({
        where: { 
          client_id: req.user.id,
          statut: { [Op.in]: ['en attente', 'validée', 'expédiée'] }
        }
      });

      return res.json({
        success: true,
        dashboard: {
          resume: {
            commandes_total: nombreCommandes,
            total_depense: parseFloat(totalDepense),
            panier_moyen: nombreCommandes > 0 ? parseFloat(totalDepense) / nombreCommandes : 0,
            commandes_en_cours: commandesEnCours
          },
          commandes_recentes: commandesRecentes.map(cmd => ({
            id: cmd.id,
            date: cmd.date,
            statut: cmd.statut,
            montant: parseFloat(cmd.total)
          })),
          panier_actuel: panierInfo,
          activite_recente: commandesRecentes.length > 0
        }
      });

    } catch (error) {
      console.error('❌ Erreur dashboard client:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération du dashboard'
      });
    }
  }

  /**
   * @desc    Liste des commandes du client
   * @route   GET /api/clients/commandes
   * @access  Private (Client uniquement)
   */
  static async getCommandes(req, res) {
    try {
      const { statut, page = 1, limit = 10, date_debut, date_fin } = req.query;
      console.log('📦 Commandes client:', req.user.id);

      const whereClause = { client_id: req.user.id };
      
      if (statut) whereClause.statut = statut;
      
      if (date_debut || date_fin) {
        whereClause.date = {};
        if (date_debut) whereClause.date[Op.gte] = new Date(date_debut);
        if (date_fin) whereClause.date[Op.lte] = new Date(date_fin);
      }

      const offset = (page - 1) * limit;

      const { count, rows: commandes } = await Commande.findAndCountAll({
        where: whereClause,
        include: [{
          model: CommandeProduit,
          as: 'produits',
          include: [{
            model: Produit,
            as: 'produit',
            attributes: ['id', 'nom'],
            include: [{
              model: ImageProduit,
              as: 'images',
              where: { est_principale: true },
              required: false,
              attributes: ['url']
            }]
          }]
        }],
        limit: parseInt(limit),
        offset: offset,
        order: [['date', 'DESC']]
      });

      const commandesFormatees = commandes.map(commande => ({
        id: commande.id,
        date: commande.date,
        statut: commande.statut,
        total: parseFloat(commande.total),
        nombre_articles: commande.produits.reduce((sum, cp) => sum + cp.quantite, 0),
        peut_annuler: commande.statut === 'en attente',
        produits_apercu: commande.produits.slice(0, 3).map(cp => ({
          nom: cp.produit.nom,
          quantite: cp.quantite,
          image: cp.produit.images[0]?.url || null
        }))
      }));

      return res.json({
        success: true,
        commandes: commandesFormatees,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          totalPages: Math.ceil(count / limit)
        },
        filtres_appliques: {
          statut: statut || 'tous',
          periode: date_debut && date_fin ? `${date_debut} à ${date_fin}` : 'toutes'
        }
      });

    } catch (error) {
      console.error('❌ Erreur commandes client:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des commandes'
      });
    }
  }

  /**
   * @desc    Détails d'une commande spécifique
   * @route   GET /api/clients/commandes/:commandeId
   * @access  Private (Client uniquement)
   */
  static async getCommandeDetails(req, res) {
    try {
      const { commandeId } = req.params;
      console.log('🔍 Détails commande:', commandeId, 'client:', req.user.id);

      const commande = await Commande.findOne({
        where: { 
          id: commandeId,
          client_id: req.user.id 
        },
        include: [{
          model: CommandeProduit,
          as: 'produits',
          include: [{
            model: Produit,
            as: 'produit',
            include: [
              {
                model: ImageProduit,
                as: 'images',
                where: { est_principale: true },
                required: false,
                attributes: ['url']
              },
              {
                model: Boutique,
                as: 'boutique',
                attributes: ['nom'],
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
          }]
        }]
      });

      if (!commande) {
        return res.status(404).json({
          success: false,
          message: 'Commande non trouvée'
        });
      }

      const commandeDetails = {
        id: commande.id,
        date: commande.date,
        statut: commande.statut,
        total: parseFloat(commande.total),
        peut_annuler: commande.statut === 'en attente',
        produits: commande.produits.map(cp => ({
          id: cp.produit.id,
          nom: cp.produit.nom,
          quantite: cp.quantite,
          prix_unitaire: parseFloat(cp.prix_unitaire),
          sous_total: parseFloat(cp.prix_unitaire) * cp.quantite,
          image: cp.produit.images[0]?.url || null,
          vendeur: {
            nom: cp.produit.boutique?.vendeur?.utilisateur?.nom || 'Inconnu',
            email: cp.produit.boutique?.vendeur?.utilisateur?.email || null,
            boutique: cp.produit.boutique?.nom || 'Boutique inconnue'
          }
        })),
        resume: {
          nombre_articles: commande.produits.reduce((sum, cp) => sum + cp.quantite, 0),
          sous_total: commande.produits.reduce((sum, cp) => 
            sum + (parseFloat(cp.prix_unitaire) * cp.quantite), 0
          ),
          total: parseFloat(commande.total)
        }
      };

      return res.json({
        success: true,
        commande: commandeDetails
      });

    } catch (error) {
      console.error('❌ Erreur détails commande:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des détails de la commande'
      });
    }
  }

  /**
   * @desc    Annuler une commande
   * @route   POST /api/clients/commandes/:commandeId/annuler
   * @access  Private (Client uniquement)
   */
  static async annulerCommande(req, res) {
    try {
      const { commandeId } = req.params;
      console.log('❌ Annulation commande:', commandeId, 'client:', req.user.id);

      const commande = await Commande.findOne({
        where: { 
          id: commandeId,
          client_id: req.user.id 
        }
      });

      if (!commande) {
        return res.status(404).json({
          success: false,
          message: 'Commande non trouvée'
        });
      }

      // Vérifier si la commande peut être annulée
      if (commande.statut !== 'en attente') {
        return res.status(400).json({
          success: false,
          message: 'Cette commande ne peut plus être annulée',
          statut_actuel: commande.statut,
          raison: 'Seules les commandes en attente peuvent être annulées'
        });
      }

      // Annuler la commande
      await commande.update({ statut: 'annulée' });

      // Remettre les produits en stock (optionnel)
      const produitsCommande = await CommandeProduit.findAll({
        where: { commande_id: commande.id },
        include: [{
          model: Produit,
          as: 'produit'
        }]
      });

      for (const cp of produitsCommande) {
        await cp.produit.update({
          stock: cp.produit.stock + cp.quantite
        });
      }

      console.log('✅ Commande annulée:', commandeId);

      return res.json({
        success: true,
        message: 'Commande annulée avec succès',
        commande: {
          id: commande.id,
          ancien_statut: 'en attente',
          nouveau_statut: 'annulée',
          date_annulation: new Date()
        }
      });

    } catch (error) {
      console.error('❌ Erreur annulation commande:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de l\'annulation de la commande'
      });
    }
  }

  /**
   * @desc    Récupérer le panier actuel du client
   * @route   GET /api/clients/panier-actuel
   * @access  Private (Client uniquement)
   */
  static async getPanierActuel(req, res) {
    try {
      console.log('🛒 Panier actuel client:', req.user.id);

      const panier = await Panier.findOne({
        where: { client_id: req.user.id },
        include: [{
          model: LignePanier,
          as: 'lignes',
          include: [{
            model: Produit,
            as: 'produit',
            include: [
              {
                model: ImageProduit,
                as: 'images',
                where: { est_principale: true },
                required: false,
                attributes: ['url']
              },
              {
                model: Boutique,
                as: 'boutique',
                attributes: ['nom']
              }
            ]
          }]
        }]
      });

      if (!panier) {
        return res.json({
          success: true,
          panier: {
            id: null,
            lignes: [],
            total: 0,
            nombre_articles: 0,
            est_vide: true
          }
        });
      }

      const panierFormate = {
        id: panier.id,
        date_creation: panier.date_creation,
        lignes: panier.lignes.map(ligne => ({
          id: ligne.id,
          produit: {
            id: ligne.produit.id,
            nom: ligne.produit.nom,
            prix: parseFloat(ligne.produit.prix),
            stock: ligne.produit.stock,
            image: ligne.produit.images[0]?.url || null,
            boutique: ligne.produit.boutique?.nom || 'Boutique inconnue'
          },
          quantite: ligne.quantite,
          sous_total: parseFloat(ligne.produit.prix) * ligne.quantite,
          disponible: ligne.produit.stock >= ligne.quantite
        })),
        resume: {
          nombre_articles: panier.lignes.reduce((sum, ligne) => sum + ligne.quantite, 0),
          total: panier.lignes.reduce((sum, ligne) => 
            sum + (parseFloat(ligne.produit.prix) * ligne.quantite), 0
          ),
          articles_indisponibles: panier.lignes.filter(ligne => 
            ligne.produit.stock < ligne.quantite
          ).length
        },
        est_vide: panier.lignes.length === 0
      };

      return res.json({
        success: true,
        panier: panierFormate
      });

    } catch (error) {
      console.error('❌ Erreur panier actuel:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération du panier'
      });
    }
  }

  /**
   * @desc    Liste des produits favoris du client
   * @route   GET /api/clients/favoris
   * @access  Private (Client uniquement)
   */
  static async getFavoris(req, res) {
    try {
      const { page = 1, limit = 12 } = req.query;
      console.log('❤️ Favoris client:', req.user.id);

      // Note: Vous devrez créer une table FAVORIS dans votre BDD
      // Pour l'instant, on simule avec une logique basique

      // Simulation des favoris (remplacer par vraie logique)
      const favorisSimules = [];

      return res.json({
        success: true,
        favoris: favorisSimules,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: favorisSimules.length,
          totalPages: Math.ceil(favorisSimules.length / limit)
        },
        message: 'Fonctionnalité favoris à implémenter avec table FAVORIS'
      });

    } catch (error) {
      console.error('❌ Erreur favoris:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des favoris'
      });
    }
  }

  /**
   * @desc    Ajouter un produit aux favoris
   * @route   POST /api/clients/favoris/:produitId
   * @access  Private (Client uniquement)
   */
  static async ajouterAuxFavoris(req, res) {
    try {
      const { produitId } = req.params;
      console.log('❤️ Ajout aux favoris:', produitId, 'client:', req.user.id);

      // Vérifier que le produit existe
      const produit = await Produit.findByPk(produitId);
      if (!produit) {
        return res.status(404).json({
          success: false,
          message: 'Produit non trouvé'
        });
      }

      // Note: Implémenter la logique d'ajout aux favoris
      // avec une table FAVORIS (client_id, produit_id, date_ajout)

      return res.json({
        success: true,
        message: 'Produit ajouté aux favoris',
        produit: {
          id: produit.id,
          nom: produit.nom
        },
        note: 'Fonctionnalité à implémenter avec table FAVORIS'
      });

    } catch (error) {
      console.error('❌ Erreur ajout favoris:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de l\'ajout aux favoris'
      });
    }
  }

  /**
   * @desc    Retirer un produit des favoris
   * @route   DELETE /api/clients/favoris/:produitId
   * @access  Private (Client uniquement)
   */
  static async retirerDesFavoris(req, res) {
    try {
      const { produitId } = req.params;
      console.log('💔 Retrait des favoris:', produitId, 'client:', req.user.id);

      // Note: Implémenter la logique de suppression des favoris

      return res.json({
        success: true,
        message: 'Produit retiré des favoris',
        produit_id: produitId,
        note: 'Fonctionnalité à implémenter avec table FAVORIS'
      });

    } catch (error) {
      console.error('❌ Erreur retrait favoris:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors du retrait des favoris'
      });
    }
  }

  /**
   * @desc    Recommandations personnalisées pour le client
   * @route   GET /api/clients/recommandations
   * @access  Private (Client uniquement)
   */
  static async getRecommandations(req, res) {
    try {
      const { limite = 8, categorie } = req.query;
      console.log('🎯 Recommandations client:', req.user.id);

      // Récupérer l'historique d'achat du client
      const historique = await Commande.findAll({
        where: { 
          client_id: req.user.id,
          statut: { [Op.in]: ['validée', 'expédiée', 'livrée'] }
        },
        include: [{
          model: CommandeProduit,
          as: 'produits',
          include: [{
            model: Produit,
            as: 'produit',
            include: [{
              model: Categorie,
              as: 'categorie',
              attributes: ['id', 'nom']
            }]
          }]
        }],
        limit: 10,
        order: [['date', 'DESC']]
      });

      // Extraire les catégories préférées
      const categoriesAchetees = new Set();
      historique.forEach(commande => {
        commande.produits.forEach(cp => {
          if (cp.produit.categorie) {
            categoriesAchetees.add(cp.produit.categorie.id);
          }
        });
      });

      // Recommandations basées sur les catégories préférées
      const whereClause = {
        stock: { [Op.gt]: 0 }
      };

      if (categoriesAchetees.size > 0) {
        whereClause.categorie_id = { [Op.in]: Array.from(categoriesAchetees) };
      }

      if (categorie) {
        whereClause.categorie_id = categorie;
      }

      const recommandations = await Produit.findAll({
        where: whereClause,
        include: [
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
            attributes: ['nom']
          },
          {
            model: Boutique,
            as: 'boutique',
            attributes: ['nom']
          }
        ],
        limit: parseInt(limite),
        order: [
          [require('sequelize').fn('RAND')] // Ordre aléatoire
        ]
      });

      const recommandationsFormatees = recommandations.map(produit => ({
        id: produit.id,
        nom: produit.nom,
        prix: parseFloat(produit.prix),
        image: produit.images[0]?.url || null,
        categorie: produit.categorie?.nom || 'Sans catégorie',
        boutique: produit.boutique?.nom || 'Boutique inconnue',
        stock: produit.stock,
        disponible: produit.stock > 0
      }));

      return res.json({
        success: true,
        recommandations: recommandationsFormatees,
        contexte: {
          basees_sur: categoriesAchetees.size > 0 ? 'historique_achats' : 'produits_populaires',
          categories_preferees: Array.from(categoriesAchetees),
          nombre_commandes_analysees: historique.length
        }
      });

    } catch (error) {
      console.error('❌ Erreur recommandations:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la génération des recommandations'
      });
    }
  }

  /**
   * @desc    Statistiques d'achat du client
   * @route   GET /api/clients/statistiques
   * @access  Private (Client uniquement)
   */
  static async getStatistiques(req, res) {
    try {
      const { periode = '1an' } = req.query;
      console.log('📈 Statistiques client:', req.user.id, 'période:', periode);

      let dateLimite = new Date();
      switch (periode) {
        case '1mois':
          dateLimite.setMonth(dateLimite.getMonth() - 1);
          break;
        case '3mois':
          dateLimite.setMonth(dateLimite.getMonth() - 3);
          break;
        case '6mois':
          dateLimite.setMonth(dateLimite.getMonth() - 6);
          break;
        case '1an':
          dateLimite.setFullYear(dateLimite.getFullYear() - 1);
          break;
        default:
          dateLimite.setFullYear(dateLimite.getFullYear() - 1);
      }

      // Statistiques générales
      const commandes = await Commande.findAll({
        where: { 
          client_id: req.user.id,
          date: { [Op.gte]: dateLimite }
        },
        include: [{
          model: CommandeProduit,
          as: 'produits',
          include: [{
            model: Produit,
            as: 'produit',
            include: [{
              model: Categorie,
              as: 'categorie',
              attributes: ['nom']
            }]
          }]
        }]
      });

      const totalDepense = commandes
        .filter(cmd => ['validée', 'expédiée', 'livrée'].includes(cmd.statut))
        .reduce((sum, cmd) => sum + parseFloat(cmd.total), 0);

      const nombreArticles = commandes.reduce((sum, cmd) => 
        sum + cmd.produits.reduce((sum2, cp) => sum2 + cp.quantite, 0), 0
      );

      // Répartition par statut
      const repartitionStatuts = commandes.reduce((acc, cmd) => {
        acc[cmd.statut] = (acc[cmd.statut] || 0) + 1;
        return acc;
      }, {});

      // Catégories préférées
      const categoriesStats = {};
      commandes.forEach(cmd => {
        cmd.produits.forEach(cp => {
          const categorie = cp.produit.categorie?.nom || 'Sans catégorie';
          categoriesStats[categorie] = (categoriesStats[categorie] || 0) + cp.quantite;
        });
      });

      // Évolution mensuelle
      const evolutionMensuelle = commandes.reduce((acc, cmd) => {
        const mois = cmd.date.toISOString().substring(0, 7); // YYYY-MM
        if (!acc[mois]) {
          acc[mois] = { commandes: 0, montant: 0 };
        }
        acc[mois].commandes += 1;
        if (['validée', 'expédiée', 'livrée'].includes(cmd.statut)) {
          acc[mois].montant += parseFloat(cmd.total);
        }
        return acc;
      }, {});

      return res.json({
        success: true,
        statistiques: {
          periode: periode,
          resume: {
            nombre_commandes: commandes.length,
            total_depense: totalDepense,
            nombre_articles: nombreArticles,
            panier_moyen: commandes.length > 0 ? totalDepense / commandes.length : 0
          },
          repartition_statuts: repartitionStatuts,
          categories_preferees: Object.entries(categoriesStats)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([categorie, quantite]) => ({ categorie, quantite })),
          evolution_mensuelle: Object.entries(evolutionMensuelle)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([mois, stats]) => ({ mois, ...stats }))
        }
      });

    } catch (error) {
      console.error('❌ Erreur statistiques client:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des statistiques'
      });
    }
  }

  /**
   * @desc    Gestion des adresses du client
   * @route   GET /api/clients/adresses
   * @access  Private (Client uniquement)
   */
  static async getAdresses(req, res) {
    try {
      console.log('🏠 Adresses client:', req.user.id);

      // Note: Retourner l'adresse principale pour l'instant
      // Dans une vraie app, vous auriez une table ADRESSES
      
      const client = await Client.findByPk(req.user.id);
      
      const adresses = client.adresse ? [{
        id: 1,
        nom: 'Adresse principale',
        adresse: client.adresse,
        ville: 'Non spécifiée',
        code_postal: 'Non spécifié',
        pays: 'Non spécifié',
        est_principale: true,
        telephone: client.telephone
      }] : [];

      return res.json({
        success: true,
        adresses,
        message: 'Système multi-adresses à implémenter avec table ADRESSES'
      });

    } catch (error) {
      console.error('❌ Erreur adresses:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des adresses'
      });
    }
  }

  /**
   * @desc    Ajouter une nouvelle adresse
   * @route   POST /api/clients/adresses
   * @access  Private (Client uniquement)
   */
  static async ajouterAdresse(req, res) {
    try {
      const { nom, adresse, ville, code_postal, pays, est_principale } = req.body;
      console.log('🏠➕ Ajout adresse client:', req.user.id);

      // Validation
      if (!nom || !adresse || !ville || !code_postal) {
        return res.status(400).json({
          success: false,
          message: 'Nom, adresse, ville et code postal sont requis'
        });
      }

      // Note: Implémenter avec une vraie table ADRESSES
      
      return res.json({
        success: true,
        message: 'Adresse ajoutée avec succès',
        adresse: {
          id: Date.now(), // ID temporaire
          nom,
          adresse,
          ville,
          code_postal,
          pays: pays || 'France',
          est_principale: est_principale || false
        },
        note: 'Fonctionnalité à implémenter avec table ADRESSES'
      });

    } catch (error) {
      console.error('❌ Erreur ajout adresse:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de l\'ajout de l\'adresse'
      });
    }
  }

  /**
   * @desc    Modifier une adresse
   * @route   PUT /api/clients/adresses/:adresseId
   * @access  Private (Client uniquement)
   */
  static async modifierAdresse(req, res) {
    try {
      const { adresseId } = req.params;
      const { nom, adresse, ville, code_postal, pays, est_principale } = req.body;
      console.log('🏠✏️ Modification adresse:', adresseId, 'client:', req.user.id);

      // Note: Implémenter avec une vraie table ADRESSES

      return res.json({
        success: true,
        message: 'Adresse modifiée avec succès',
        adresse: {
          id: adresseId,
          nom,
          adresse,
          ville,
          code_postal,
          pays,
          est_principale
        },
        note: 'Fonctionnalité à implémenter avec table ADRESSES'
      });

    } catch (error) {
      console.error('❌ Erreur modification adresse:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la modification de l\'adresse'
      });
    }
  }

  /**
   * @desc    Supprimer une adresse
   * @route   DELETE /api/clients/adresses/:adresseId
   * @access  Private (Client uniquement)
   */
  static async supprimerAdresse(req, res) {
    try {
      const { adresseId } = req.params;
      console.log('🏠🗑️ Suppression adresse:', adresseId, 'client:', req.user.id);

      // Note: Implémenter avec une vraie table ADRESSES

      return res.json({
        success: true,
        message: 'Adresse supprimée avec succès',
        adresse_id: adresseId,
        note: 'Fonctionnalité à implémenter avec table ADRESSES'
      });

    } catch (error) {
      console.error('❌ Erreur suppression adresse:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la suppression de l\'adresse'
      });
    }
  }

  // ==================== ADMINISTRATION ====================

  /**
   * @desc    Rechercher des clients (Admin uniquement)
   * @route   GET /api/clients/search
   * @access  Private (Admin uniquement)
   */
  static async searchClients(req, res) {
    try {
      // Vérification admin
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Accès réservé aux administrateurs'
        });
      }

      const { nom, email, ville, page = 1, limit = 20 } = req.query;
      console.log('🔍 Recherche clients (admin)');

      const whereClauseUser = {};
      const whereClauseClient = {};

      if (nom) whereClauseUser.nom = { [Op.like]: `%${nom}%` };
      if (email) whereClauseUser.email = { [Op.like]: `%${email}%` };
      if (ville) whereClauseClient.adresse = { [Op.like]: `%${ville}%` };

      const offset = (page - 1) * limit;

      const { count, rows: clients } = await Client.findAndCountAll({
        where: whereClauseClient,
        include: [{
          model: Utilisateur,
          as: 'utilisateur',
          where: { ...whereClauseUser, role: 'client' },
          attributes: ['nom', 'email']
        }],
        limit: parseInt(limit),
        offset: offset,
        order: [['id', 'DESC']]
      });

      // Enrichir avec statistiques
      const clientsAvecStats = await Promise.all(
        clients.map(async (client) => {
          const nombreCommandes = await Commande.count({
            where: { client_id: client.id }
          });

          const totalDepense = await Commande.sum('total', {
            where: { 
              client_id: client.id,
              statut: { [Op.in]: ['validée', 'expédiée', 'livrée'] }
            }
          }) || 0;

          return {
            id: client.id,
            nom: client.utilisateur.nom,
            email: client.utilisateur.email,
            adresse: client.adresse,
            telephone: client.telephone,
            date_inscription: client.createdAt,
            statistiques: {
              nombre_commandes: nombreCommandes,
              total_depense: parseFloat(totalDepense)
            }
          };
        })
      );

      return res.json({
        success: true,
        clients: clientsAvecStats,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          totalPages: Math.ceil(count / limit)
        }
      });

    } catch (error) {
      console.error('❌ Erreur recherche clients:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la recherche de clients'
      });
    }
  }
}

module.exports = ClientController;