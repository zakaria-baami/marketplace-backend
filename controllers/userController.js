// controllers/userController.js
const { Utilisateur, Client, Vendeur } = require('../models');
const ApiResponse = require('../utils/apiResponse');
const { Op } = require('sequelize');

class UserController {
  /**
   * Mettre à jour le profil utilisateur
   */
  static async mettreAJourProfil(req, res) {
    try {
      const { nom, email, donnees_specifiques } = req.body;

      const utilisateur = await Utilisateur.findByPk(req.user.id);
      if (!utilisateur) {
        return ApiResponse.notFound(res, 'Utilisateur non trouvé');
      }

      // Mettre à jour les données de base
      const result = await utilisateur.mettreAJourProfil({ nom, email });
      
      if (!result.success) {
        return ApiResponse.error(res, result.message, 400);
      }

      // Mettre à jour les données spécifiques selon le rôle
      if (donnees_specifiques) {
        if (utilisateur.role === 'client') {
          const client = await Client.findByPk(utilisateur.id);
          if (client) {
            await client.update({
              adresse: donnees_specifiques.adresse,
              telephone: donnees_specifiques.telephone
            });
          }
        } else if (utilisateur.role === 'vendeur') {
          const vendeur = await Vendeur.findByPk(utilisateur.id);
          if (vendeur && donnees_specifiques.numero_fiscal) {
            await vendeur.update({
              numero_fiscal: donnees_specifiques.numero_fiscal
            });
          }
        }
      }

      // Récupérer l'utilisateur mis à jour
      const utilisateurMisAJour = await Utilisateur.findByPk(req.user.id, {
        include: [
          { model: Client, as: 'client' },
          { model: Vendeur, as: 'vendeur', include: ['grade'] }
        ]
      });

      return ApiResponse.updated(res, {
        id: utilisateurMisAJour.id,
        nom: utilisateurMisAJour.nom,
        email: utilisateurMisAJour.email,
        role: utilisateurMisAJour.role,
        profil: utilisateurMisAJour.client || utilisateurMisAJour.vendeur
      });

    } catch (error) {
      console.error('Erreur mise à jour profil:', error);
      return ApiResponse.error(res, 'Erreur lors de la mise à jour du profil', 500);
    }
  }

  /**
   * Supprimer le compte utilisateur
   */
  static async supprimerCompte(req, res) {
    try {
      const utilisateur = await Utilisateur.findByPk(req.user.id);
      if (!utilisateur) {
        return ApiResponse.notFound(res, 'Utilisateur non trouvé');
      }

      await utilisateur.destroy();
      return ApiResponse.deleted(res, 'Compte supprimé avec succès');

    } catch (error) {
      console.error('Erreur suppression compte:', error);
      return ApiResponse.error(res, 'Erreur lors de la suppression du compte', 500);
    }
  }

  /**
   * Lister tous les utilisateurs (admin uniquement)
   */
  static async listerUtilisateurs(req, res) {
    try {
      const { page = 1, limit = 10, role, search } = req.query;
      const offset = (page - 1) * limit;

      const whereClause = {};
      if (role) whereClause.role = role;
      if (search) {
        whereClause[Op.or] = [
          { nom: { [Op.like]: `%${search}%` } },
          { email: { [Op.like]: `%${search}%` } }
        ];
      }

      const { count, rows } = await Utilisateur.findAndCountAll({
        where: whereClause,
        include: [
          { model: Client, as: 'client' },
          { model: Vendeur, as: 'vendeur', include: ['grade'] }
        ],
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['createdAt', 'DESC']],
        attributes: { exclude: ['password'] } // Exclure le mot de passe
      });

      const utilisateurs = rows.map(user => ({
        id: user.id,
        nom: user.nom,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        profil: user.client || user.vendeur
      }));

      return ApiResponse.paginated(res, utilisateurs, {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count
      });

    } catch (error) {
      console.error('Erreur liste utilisateurs:', error);
      return ApiResponse.error(res, 'Erreur lors de la récupération des utilisateurs', 500);
    }
  }

  /**
   * Obtenir un utilisateur par ID (admin uniquement)
   */
  static async obtenirUtilisateur(req, res) {
    try {
      const { id } = req.params;

      const utilisateur = await Utilisateur.findByPk(id, {
        include: [
          { model: Client, as: 'client' },
          { model: Vendeur, as: 'vendeur', include: ['grade'] }
        ],
        attributes: { exclude: ['password'] }
      });

      if (!utilisateur) {
        return ApiResponse.notFound(res, 'Utilisateur non trouvé');
      }

      return ApiResponse.success(res, {
        id: utilisateur.id,
        nom: utilisateur.nom,
        email: utilisateur.email,
        role: utilisateur.role,
        createdAt: utilisateur.createdAt,
        updatedAt: utilisateur.updatedAt,
        profil: utilisateur.client || utilisateur.vendeur
      });

    } catch (error) {
      console.error('Erreur récupération utilisateur:', error);
      return ApiResponse.error(res, 'Erreur lors de la récupération de l\'utilisateur', 500);
    }
  }

  /**
   * Suspendre/Activer un utilisateur (admin uniquement)
   */
  static async changerStatutUtilisateur(req, res) {
    try {
      const { id } = req.params;
      const { actif } = req.body;

      const utilisateur = await Utilisateur.findByPk(id);
      if (!utilisateur) {
        return ApiResponse.notFound(res, 'Utilisateur non trouvé');
      }

      // Ici vous pourriez ajouter un champ 'actif' à votre modèle Utilisateur
      // Pour l'instant, on simule avec une mise à jour simple
      await utilisateur.update({ 
        // actif: actif 
        updatedAt: new Date()
      });

      const message = actif ? 'Utilisateur activé' : 'Utilisateur suspendu';
      return ApiResponse.updated(res, { id: utilisateur.id, actif }, message);

    } catch (error) {
      console.error('Erreur changement statut:', error);
      return ApiResponse.error(res, 'Erreur lors du changement de statut', 500);
    }
  }

  /**
   * Statistiques des utilisateurs (admin uniquement)
   */
  static async statistiquesUtilisateurs(req, res) {
    try {
      const totalUtilisateurs = await Utilisateur.count();
      const totalClients = await Utilisateur.count({ where: { role: 'client' } });
      const totalVendeurs = await Utilisateur.count({ where: { role: 'vendeur' } });
      const totalAdmins = await Utilisateur.count({ where: { role: 'admin' } });

      // Utilisateurs créés les 30 derniers jours
      const dateLimite = new Date();
      dateLimite.setDate(dateLimite.getDate() - 30);
      
      const nouveauxUtilisateurs = await Utilisateur.count({
        where: {
          createdAt: {
            [Op.gte]: dateLimite
          }
        }
      });

      return ApiResponse.success(res, {
        total: totalUtilisateurs,
        clients: totalClients,
        vendeurs: totalVendeurs,
        admins: totalAdmins,
        nouveaux_30_jours: nouveauxUtilisateurs
      });

    } catch (error) {
      console.error('Erreur statistiques utilisateurs:', error);
      return ApiResponse.error(res, 'Erreur lors de la récupération des statistiques', 500);
    }
  }
}

module.exports = UserController;