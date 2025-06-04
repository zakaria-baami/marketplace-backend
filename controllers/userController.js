// controllers/userController.js - Gestion des utilisateurs
const bcrypt = require('bcryptjs');
const { 
  Utilisateur, 
  Client, 
  Vendeur, 
  GradeVendeur,
  Boutique,
  Produit,
  Commande,
  StatistiqueVente
} = require('../models/db');
const { Op } = require('sequelize');

class UserController {

  // ==================== GESTION PROFIL UTILISATEUR ====================

  /**
   * @desc    Récupérer le profil de l'utilisateur connecté
   * @route   GET /api/users/profile
   * @access  Private
   */
  static async getProfile(req, res) {
    try {
      console.log('👤 Récupération profil utilisateur:', req.user.id);

      const utilisateur = await Utilisateur.findByPk(req.user.id, {
        attributes: { exclude: ['password'] },
        include: [
          {
            model: Client,
            as: 'client',
            required: false
          },
          {
            model: Vendeur,
            as: 'vendeur',
            required: false,
            include: [{
              model: GradeVendeur,
              as: 'grade',
              attributes: ['id', 'nom']
            }]
          }
        ]
      });

      if (!utilisateur) {
        return res.status(404).json({
          success: false,
          message: 'Utilisateur non trouvé'
        });
      }

      // Enrichir avec des statistiques selon le rôle
      let statistiques = {};
      
      if (utilisateur.role === 'vendeur' && utilisateur.vendeur) {
        // Statistiques vendeur
        const boutique = await Boutique.findOne({
          where: { vendeur_id: utilisateur.vendeur.id }
        });

        const nombreProduits = await Produit.count({
          include: [{
            model: Boutique,
            as: 'boutique',
            where: { vendeur_id: utilisateur.vendeur.id }
          }]
        });

        const statsVentes = await StatistiqueVente.findAll({
          where: { vendeur_id: utilisateur.vendeur.id },
          attributes: [
            [require('sequelize').fn('SUM', require('sequelize').col('ventes')), 'total_ventes'],
            [require('sequelize').fn('SUM', require('sequelize').col('chiffre_affaires')), 'total_ca']
          ],
          raw: true
        });

        const stats = statsVentes[0] || { total_ventes: 0, total_ca: 0 };

        statistiques = {
          type: 'vendeur',
          boutique: boutique ? {
            id: boutique.id,
            nom: boutique.nom,
            nombre_produits: nombreProduits
          } : null,
          ventes: {
            total_ventes: parseInt(stats.total_ventes) || 0,
            total_chiffre_affaires: parseFloat(stats.total_ca) || 0
          }
        };

      } else if (utilisateur.role === 'client' && utilisateur.client) {
        // Statistiques client
        const nombreCommandes = await Commande.count({
          where: { client_id: utilisateur.client.id }
        });

        const totalDepense = await Commande.sum('total', {
          where: { 
            client_id: utilisateur.client.id,
            statut: { [Op.in]: ['validée', 'expédiée', 'livrée'] }
          }
        });

        statistiques = {
          type: 'client',
          commandes: {
            nombre_total: nombreCommandes,
            total_depense: parseFloat(totalDepense) || 0
          }
        };
      }

      const profil = {
        id: utilisateur.id,
        nom: utilisateur.nom,
        email: utilisateur.email,
        role: utilisateur.role,
        date_inscription: utilisateur.createdAt,
        ...(utilisateur.client && {
          donnees_client: {
            adresse: utilisateur.client.adresse,
            telephone: utilisateur.client.telephone
          }
        }),
        ...(utilisateur.vendeur && {
          donnees_vendeur: {
            numero_fiscal: utilisateur.vendeur.numero_fiscal,
            grade: utilisateur.vendeur.grade
          }
        }),
        statistiques
      };

      return res.json({
        success: true,
        profil
      });

    } catch (error) {
      console.error('❌ Erreur récupération profil:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération du profil'
      });
    }
  }

  /**
   * @desc    Mettre à jour le profil utilisateur
   * @route   PUT /api/users/profile
   * @access  Private
   */
  static async updateProfile(req, res) {
    try {
      console.log('✏️ Mise à jour profil utilisateur:', req.user.id);

      const { nom, email, adresse, telephone, numero_fiscal } = req.body;

      // Validation : au moins un champ à modifier
      if (!nom && !email && !adresse && !telephone && !numero_fiscal) {
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

      // Mettre à jour l'utilisateur principal
      const updateUserData = {};
      if (nom) updateUserData.nom = nom;
      if (email) updateUserData.email = email;

      if (Object.keys(updateUserData).length > 0) {
        await Utilisateur.update(updateUserData, {
          where: { id: req.user.id }
        });
      }

      // Mettre à jour selon le rôle
      if (req.user.role === 'client' && (adresse || telephone)) {
        const clientUpdateData = {};
        if (adresse) clientUpdateData.adresse = adresse;
        if (telephone) clientUpdateData.telephone = telephone;

        await Client.update(clientUpdateData, {
          where: { id: req.user.id }
        });

      } else if (req.user.role === 'vendeur' && numero_fiscal) {
        await Vendeur.update(
          { numero_fiscal },
          { where: { id: req.user.id } }
        );
      }

      // Récupérer le profil mis à jour
      const utilisateurMisAJour = await Utilisateur.findByPk(req.user.id, {
        attributes: { exclude: ['password'] },
        include: [
          {
            model: Client,
            as: 'client',
            required: false
          },
          {
            model: Vendeur,
            as: 'vendeur',
            required: false,
            include: [{
              model: GradeVendeur,
              as: 'grade'
            }]
          }
        ]
      });

      console.log('✅ Profil utilisateur mis à jour:', req.user.id);

      return res.json({
        success: true,
        message: 'Profil mis à jour avec succès',
        utilisateur: {
          id: utilisateurMisAJour.id,
          nom: utilisateurMisAJour.nom,
          email: utilisateurMisAJour.email,
          role: utilisateurMisAJour.role,
          ...(utilisateurMisAJour.client && {
            adresse: utilisateurMisAJour.client.adresse,
            telephone: utilisateurMisAJour.client.telephone
          }),
          ...(utilisateurMisAJour.vendeur && {
            numero_fiscal: utilisateurMisAJour.vendeur.numero_fiscal,
            grade: utilisateurMisAJour.vendeur.grade?.nom
          })
        }
      });

    } catch (error) {
      console.error('❌ Erreur mise à jour profil:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la mise à jour du profil'
      });
    }
  }

  /**
   * @desc    Changer le mot de passe
   * @route   PUT /api/users/change-password
   * @access  Private
   */
  static async changePassword(req, res) {
    try {
      console.log('🔑 Changement mot de passe:', req.user.id);

      const { ancien_mot_de_passe, nouveau_mot_de_passe, confirmation } = req.body;

      // Validation des champs
      if (!ancien_mot_de_passe || !nouveau_mot_de_passe) {
        return res.status(400).json({
          success: false,
          message: 'Ancien et nouveau mot de passe requis'
        });
      }

      if (nouveau_mot_de_passe !== confirmation) {
        return res.status(400).json({
          success: false,
          message: 'La confirmation ne correspond pas au nouveau mot de passe'
        });
      }

      // Validation force du nouveau mot de passe
      if (nouveau_mot_de_passe.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Le nouveau mot de passe doit contenir au moins 6 caractères'
        });
      }

      // Récupérer l'utilisateur avec le mot de passe
      const utilisateur = await Utilisateur.findByPk(req.user.id);
      if (!utilisateur) {
        return res.status(404).json({
          success: false,
          message: 'Utilisateur non trouvé'
        });
      }

      // Vérifier l'ancien mot de passe
      const ancienMotDePasseValide = await bcrypt.compare(ancien_mot_de_passe, utilisateur.password);
      if (!ancienMotDePasseValide) {
        return res.status(401).json({
          success: false,
          message: 'Ancien mot de passe incorrect'
        });
      }

      // Hacher le nouveau mot de passe
      const nouveauMotDePasseHache = await bcrypt.hash(nouveau_mot_de_passe, 12);

      // Mettre à jour
      await utilisateur.update({ password: nouveauMotDePasseHache });

      console.log('✅ Mot de passe changé:', req.user.id);

      return res.json({
        success: true,
        message: 'Mot de passe changé avec succès'
      });

    } catch (error) {
      console.error('❌ Erreur changement mot de passe:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors du changement de mot de passe'
      });
    }
  }

  /**
   * @desc    Supprimer le compte utilisateur
   * @route   DELETE /api/users/account
   * @access  Private
   */
  static async deleteAccount(req, res) {
    try {
      console.log('🗑️ Suppression compte utilisateur:', req.user.id);

      const { mot_de_passe_confirmation } = req.body;

      if (!mot_de_passe_confirmation) {
        return res.status(400).json({
          success: false,
          message: 'Mot de passe de confirmation requis'
        });
      }

      // Récupérer l'utilisateur
      const utilisateur = await Utilisateur.findByPk(req.user.id);
      if (!utilisateur) {
        return res.status(404).json({
          success: false,
          message: 'Utilisateur non trouvé'
        });
      }

      // Vérifier le mot de passe
      const motDePasseValide = await bcrypt.compare(mot_de_passe_confirmation, utilisateur.password);
      if (!motDePasseValide) {
        return res.status(401).json({
          success: false,
          message: 'Mot de passe incorrect'
        });
      }

      // Vérifications avant suppression
      if (utilisateur.role === 'vendeur') {
        // Vérifier s'il y a des commandes en cours
        const commandesEnCours = await Commande.count({
          include: [{
            model: require('../models/db').CommandeProduit,
            as: 'produits',
            include: [{
              model: Produit,
              as: 'produit',
              include: [{
                model: Boutique,
                as: 'boutique',
                where: { vendeur_id: req.user.id }
              }]
            }]
          }],
          where: {
            statut: { [Op.in]: ['en attente', 'validée', 'expédiée'] }
          }
        });

        if (commandesEnCours > 0) {
          return res.status(400).json({
            success: false,
            message: 'Impossible de supprimer le compte : commandes en cours',
            commandes_en_cours: commandesEnCours
          });
        }
      }

      // Supprimer l'utilisateur (CASCADE supprimera les données liées)
      await utilisateur.destroy();

      console.log('✅ Compte utilisateur supprimé:', req.user.id);

      return res.json({
        success: true,
        message: 'Compte supprimé avec succès'
      });

    } catch (error) {
      console.error('❌ Erreur suppression compte:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la suppression du compte'
      });
    }
  }

  // ==================== GESTION DES PRÉFÉRENCES ====================

  /**
   * @desc    Récupérer les préférences utilisateur
   * @route   GET /api/users/preferences
   * @access  Private
   */
  static async getPreferences(req, res) {
    try {
      console.log('⚙️ Récupération préférences:', req.user.id);

      // Préférences par défaut (à stocker en BDD si nécessaire)
      const preferences = {
        notifications: {
          email_commandes: true,
          email_promotions: false,
          sms_commandes: false
        },
        affichage: {
          theme: 'clair',
          langue: 'fr',
          produits_par_page: 12
        },
        confidentialite: {
          profil_public: false,
          afficher_statistiques: req.user.role === 'vendeur'
        }
      };

      return res.json({
        success: true,
        preferences
      });

    } catch (error) {
      console.error('❌ Erreur préférences:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des préférences'
      });
    }
  }

  /**
   * @desc    Mettre à jour les préférences
   * @route   PUT /api/users/preferences
   * @access  Private
   */
  static async updatePreferences(req, res) {
    try {
      console.log('⚙️ Mise à jour préférences:', req.user.id);

      const { notifications, affichage, confidentialite } = req.body;

      // En production, sauvegarder en base de données
      // Ici, on simule la sauvegarde

      const preferencesMAJ = {
        notifications: notifications || {},
        affichage: affichage || {},
        confidentialite: confidentialite || {},
        derniere_modification: new Date()
      };

      console.log('✅ Préférences mises à jour');

      return res.json({
        success: true,
        message: 'Préférences mises à jour',
        preferences: preferencesMAJ
      });

    } catch (error) {
      console.error('❌ Erreur mise à jour préférences:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la mise à jour des préférences'
      });
    }
  }

  // ==================== ACTIVITÉ UTILISATEUR ====================

  /**
   * @desc    Historique d'activité de l'utilisateur
   * @route   GET /api/users/activity
   * @access  Private
   */
  static async getActivity(req, res) {
    try {
      console.log('📊 Historique activité:', req.user.id);

      const { page = 1, limit = 20, type } = req.query;
      const offset = (page - 1) * limit;

      let activites = [];

      if (req.user.role === 'client') {
        // Activités client : commandes
        const commandes = await Commande.findAll({
          where: { client_id: req.user.id },
          limit: parseInt(limit),
          offset: offset,
          order: [['date', 'DESC']]
        });

        activites = commandes.map(commande => ({
          id: commande.id,
          type: 'commande',
          action: `Commande #${commande.id}`,
          statut: commande.statut,
          montant: parseFloat(commande.total),
          date: commande.date
        }));

      } else if (req.user.role === 'vendeur') {
        // Activités vendeur : ventes et produits
        const statsVentes = await StatistiqueVente.findAll({
          where: { vendeur_id: req.user.id },
          limit: parseInt(limit),
          offset: offset,
          order: [['date', 'DESC']]
        });

        activites = statsVentes.map(stat => ({
          id: stat.id,
          type: 'vente',
          action: `${stat.ventes} vente(s)`,
          montant: parseFloat(stat.chiffre_affaires),
          date: stat.date
        }));
      }

      return res.json({
        success: true,
        activites,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: activites.length
        }
      });

    } catch (error) {
      console.error('❌ Erreur activité:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération de l\'activité'
      });
    }
  }

  // ==================== STATISTIQUES UTILISATEUR ====================

  /**
   * @desc    Statistiques de l'utilisateur
   * @route   GET /api/users/stats
   * @access  Private
   */
  static async getStats(req, res) {
    try {
      console.log('📈 Statistiques utilisateur:', req.user.id);

      let statistiques = {
        role: req.user.role,
        membre_depuis: null,
        activite_recente: false
      };

      // Récupérer la date d'inscription
      const utilisateur = await Utilisateur.findByPk(req.user.id, {
        attributes: ['createdAt']
      });

      if (utilisateur) {
        const dateInscription = new Date(utilisateur.createdAt);
        const maintenant = new Date();
        const joursDepuisInscription = Math.floor((maintenant - dateInscription) / (1000 * 60 * 60 * 24));
        
        statistiques.membre_depuis = {
          date: dateInscription,
          jours: joursDepuisInscription
        };

        // Activité récente (derniers 7 jours)
        const dateLimite = new Date();
        dateLimite.setDate(dateLimite.getDate() - 7);
        statistiques.activite_recente = dateInscription > dateLimite;
      }

      // Statistiques spécifiques au rôle
      if (req.user.role === 'client') {
        const client = await Client.findByPk(req.user.id);
        if (client) {
          const nombreCommandes = await Commande.count({
            where: { client_id: client.id }
          });

          const totalDepense = await Commande.sum('total', {
            where: { 
              client_id: client.id,
              statut: { [Op.in]: ['validée', 'expédiée', 'livrée'] }
            }
          }) || 0;

          statistiques.client = {
            commandes_total: nombreCommandes,
            montant_total_depense: parseFloat(totalDepense),
            commande_moyenne: nombreCommandes > 0 ? parseFloat(totalDepense) / nombreCommandes : 0
          };
        }

      } else if (req.user.role === 'vendeur') {
        const vendeur = await Vendeur.findByPk(req.user.id, {
          include: [{
            model: GradeVendeur,
            as: 'grade'
          }]
        });

        if (vendeur) {
          const boutique = await Boutique.findOne({
            where: { vendeur_id: vendeur.id }
          });

          const nombreProduits = await Produit.count({
            include: [{
              model: Boutique,
              as: 'boutique',
              where: { vendeur_id: vendeur.id }
            }]
          });

          const statsVentes = await StatistiqueVente.findAll({
            where: { vendeur_id: vendeur.id },
            attributes: [
              [require('sequelize').fn('SUM', require('sequelize').col('ventes')), 'total_ventes'],
              [require('sequelize').fn('SUM', require('sequelize').col('chiffre_affaires')), 'total_ca']
            ],
            raw: true
          });

          const stats = statsVentes[0] || { total_ventes: 0, total_ca: 0 };

          statistiques.vendeur = {
            grade: vendeur.grade?.nom || 'Amateur',
            boutique_creee: !!boutique,
            nombre_produits: nombreProduits,
            total_ventes: parseInt(stats.total_ventes) || 0,
            chiffre_affaires: parseFloat(stats.total_ca) || 0,
            vente_moyenne: stats.total_ventes > 0 ? parseFloat(stats.total_ca) / parseInt(stats.total_ventes) : 0
          };
        }
      }

      return res.json({
        success: true,
        statistiques
      });

    } catch (error) {
      console.error('❌ Erreur statistiques utilisateur:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des statistiques'
      });
    }
  }

  // ==================== RECHERCHE ET LISTING ====================

  /**
   * @desc    Rechercher des utilisateurs (Admin uniquement)
   * @route   GET /api/users/search
   * @access  Private (Admin)
   */
  static async searchUsers(req, res) {
    try {
      // Vérification admin
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Accès réservé aux administrateurs'
        });
      }

      console.log('🔍 Recherche utilisateurs (admin)');

      const { nom, email, role, page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      const whereClause = {};
      if (nom) whereClause.nom = { [Op.like]: `%${nom}%` };
      if (email) whereClause.email = { [Op.like]: `%${email}%` };
      if (role) whereClause.role = role;

      const { count, rows: utilisateurs } = await Utilisateur.findAndCountAll({
        where: whereClause,
        attributes: { exclude: ['password'] },
        include: [
          {
            model: Client,
            as: 'client',
            required: false
          },
          {
            model: Vendeur,
            as: 'vendeur',
            required: false,
            include: [{
              model: GradeVendeur,
              as: 'grade'
            }]
          }
        ],
        limit: parseInt(limit),
        offset: offset,
        order: [['createdAt', 'DESC']]
      });

      const utilisateursFormates = utilisateurs.map(user => ({
        id: user.id,
        nom: user.nom,
        email: user.email,
        role: user.role,
        date_inscription: user.createdAt,
        ...(user.client && {
          donnees_client: {
            telephone: user.client.telephone,
            adresse: user.client.adresse
          }
        }),
        ...(user.vendeur && {
          donnees_vendeur: {
            numero_fiscal: user.vendeur.numero_fiscal,
            grade: user.vendeur.grade?.nom
          }
        })
      }));

      return res.json({
        success: true,
        utilisateurs: utilisateursFormates,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          totalPages: Math.ceil(count / limit)
        }
      });

    } catch (error) {
      console.error('❌ Erreur recherche utilisateurs:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la recherche d\'utilisateurs'
      });
    }
  }

  // ==================== UTILITAIRES ====================

  /**
   * @desc    Vérifier la santé du module utilisateur
   * @route   GET /api/users/health
   * @access  Public
   */
  static async healthCheck(req, res) {
    try {
      // Statistiques générales
      const totalUtilisateurs = await Utilisateur.count();
      const totalClients = await Client.count();
      const totalVendeurs = await Vendeur.count();

      const repartitionRoles = await Utilisateur.findAll({
        attributes: [
          'role',
          [require('sequelize').fn('COUNT', require('sequelize').col('role')), 'nombre']
        ],
        group: ['role'],
        raw: true
      });

      return res.json({
        success: true,
        message: 'Module utilisateur opérationnel',
        statistiques: {
          total_utilisateurs: totalUtilisateurs,
          total_clients: totalClients,
          total_vendeurs: totalVendeurs,
          repartition_roles: repartitionRoles
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Erreur health check:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur du module utilisateur',
        timestamp: new Date().toISOString()
      });
    }
  }
}

module.exports = UserController;