// controllers/messageController.js
const { Message, Utilisateur } = require('../models');
const ApiResponse = require('../utils/apiResponse');
const { Op } = require('sequelize');

class MessageController {
  /**
   * Envoyer un nouveau message
   */
  static async envoyerMessage(req, res) {
    try {
      const {
        destinataire_id,
        contenu,
        sujet,
        type = 'message',
        priorite = 'normale',
        objet_type,
        objet_id,
        conversation_id
      } = req.body;

      // Validations
      if (!destinataire_id || !contenu) {
        return ApiResponse.validationError(res, [
          { field: 'destinataire_id', message: 'Le destinataire est requis' },
          { field: 'contenu', message: 'Le contenu du message est requis' }
        ]);
      }

      if (contenu.trim().length === 0) {
        return ApiResponse.validationError(res, [
          { field: 'contenu', message: 'Le contenu ne peut pas être vide' }
        ]);
      }

      // Vérifier que le destinataire existe
      const destinataire = await Utilisateur.findByPk(destinataire_id);
      if (!destinataire) {
        return ApiResponse.notFound(res, 'Destinataire non trouvé');
      }

      // Empêcher l'envoi de message à soi-même
      if (parseInt(destinataire_id) === req.user.id) {
        return ApiResponse.error(res, 'Vous ne pouvez pas vous envoyer un message à vous-même', 400);
      }

      const resultat = await Message.envoyerMessage({
        expediteur_id: req.user.id,
        destinataire_id,
        contenu: contenu.trim(),
        sujet,
        type,
        priorite,
        objet_type,
        objet_id,
        conversation_id
      });

      if (!resultat.success) {
        return ApiResponse.error(res, resultat.message, 400);
      }

      // Récupérer le message complet avec les relations
      const messageComplet = await Message.findByPk(resultat.data.id, {
        include: [
          { model: Utilisateur, as: 'expediteur', attributes: ['id', 'nom', 'email'] },
          { model: Utilisateur, as: 'destinataire', attributes: ['id', 'nom', 'email'] }
        ]
      });

      return ApiResponse.created(res, messageComplet, 'Message envoyé avec succès');

    } catch (error) {
      console.error('Erreur envoi message:', error);
      return ApiResponse.error(res, 'Erreur lors de l\'envoi du message', 500);
    }
  }

  /**
   * Obtenir la liste des conversations de l'utilisateur connecté
   */
  static async obtenirConversations(req, res) {
    try {
      const { limit = 20, avec_messages_non_lus = 'true' } = req.query;

      const options = { limit: parseInt(limit) };
      const resultat = await Message.obtenirConversations(req.user.id, options);

      if (!resultat.success) {
        return ApiResponse.error(res, resultat.message, 400);
      }

      let response = {
        conversations: resultat.conversations
      };

      // Ajouter le compteur global de messages non lus
      if (avec_messages_non_lus === 'true') {
        const totalNonLus = await Message.compterMessagesNonLus(req.user.id);
        response.total_messages_non_lus = totalNonLus;
      }

      return ApiResponse.success(res, response);

    } catch (error) {
      console.error('Erreur récupération conversations:', error);
      return ApiResponse.error(res, 'Erreur lors de la récupération des conversations', 500);
    }
  }

  /**
   * Obtenir les messages d'une conversation spécifique
   */
  static async obtenirMessagesConversation(req, res) {
    try {
      const { conversation_id } = req.params;
      const { page = 1, limit = 20 } = req.query;

      // Vérifier que l'utilisateur fait partie de cette conversation
      const messageVerification = await Message.findOne({
        where: {
          conversation_id,
          [Op.or]: [
            { expediteur_id: req.user.id },
            { destinataire_id: req.user.id }
          ]
        }
      });

      if (!messageVerification) {
        return ApiResponse.forbidden(res, 'Vous n\'avez pas accès à cette conversation');
      }

      const offset = (parseInt(page) - 1) * parseInt(limit);

      const { count, rows } = await Message.findAndCountAll({
        where: { conversation_id },
        include: [
          { model: Utilisateur, as: 'expediteur', attributes: ['id', 'nom', 'email'] },
          { model: Utilisateur, as: 'destinataire', attributes: ['id', 'nom', 'email'] },
          { model: Message, as: 'reponses', required: false }
        ],
        order: [['date_envoi', 'DESC']],
        limit: parseInt(limit),
        offset: offset
      });

      // Marquer les messages reçus comme lus
      await Message.marquerConversationLue(conversation_id, req.user.id);

      return ApiResponse.paginated(res, rows.reverse(), {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        conversation_id
      });

    } catch (error) {
      console.error('Erreur messages conversation:', error);
      return ApiResponse.error(res, 'Erreur lors de la récupération des messages', 500);
    }
  }

  /**
   * Obtenir un message spécifique
   */
  static async obtenirMessage(req, res) {
    try {
      const { id } = req.params;

      const message = await Message.findByPk(id, {
        include: [
          { model: Utilisateur, as: 'expediteur', attributes: ['id', 'nom', 'email'] },
          { model: Utilisateur, as: 'destinataire', attributes: ['id', 'nom', 'email'] },
          { model: Message, as: 'messageParent' },
          { model: Message, as: 'reponses' }
        ]
      });

      if (!message) {
        return ApiResponse.notFound(res, 'Message non trouvé');
      }

      // Vérifier les permissions
      if (!message.peutEtreLuPar(req.user.id)) {
        return ApiResponse.forbidden(res, 'Vous n\'avez pas accès à ce message');
      }

      // Marquer comme lu si c'est le destinataire
      if (message.destinataire_id === req.user.id && !message.lu) {
        await message.marquerCommeLu();
      }

      return ApiResponse.success(res, message);

    } catch (error) {
      console.error('Erreur récupération message:', error);
      return ApiResponse.error(res, 'Erreur lors de la récupération du message', 500);
    }
  }

  /**
   * Répondre à un message
   */
  static async repondreMessage(req, res) {
    try {
      const { id } = req.params;
      const { contenu, sujet } = req.body;

      if (!contenu || contenu.trim().length === 0) {
        return ApiResponse.validationError(res, [
          { field: 'contenu', message: 'Le contenu de la réponse est requis' }
        ]);
      }

      const messageOriginal = await Message.findByPk(id);
      if (!messageOriginal) {
        return ApiResponse.notFound(res, 'Message original non trouvé');
      }

      // Vérifier les permissions
      if (!messageOriginal.peutEtreLuPar(req.user.id)) {
        return ApiResponse.forbidden(res, 'Vous ne pouvez pas répondre à ce message');
      }

      const resultat = await messageOriginal.repondre({
        expediteur_id: req.user.id,
        contenu: contenu.trim(),
        sujet
      });

      if (!resultat.success) {
        return ApiResponse.error(res, resultat.message, 400);
      }

      // Récupérer la réponse avec les relations
      const reponseComplete = await Message.findByPk(resultat.reponse.id, {
        include: [
          { model: Utilisateur, as: 'expediteur', attributes: ['id', 'nom', 'email'] },
          { model: Utilisateur, as: 'destinataire', attributes: ['id', 'nom', 'email'] }
        ]
      });

      return ApiResponse.created(res, reponseComplete, 'Réponse envoyée avec succès');

    } catch (error) {
      console.error('Erreur réponse message:', error);
      return ApiResponse.error(res, 'Erreur lors de l\'envoi de la réponse', 500);
    }
  }

  /**
   * Marquer un message comme lu
   */
  static async marquerCommeLu(req, res) {
    try {
      const { id } = req.params;

      const message = await Message.findByPk(id);
      if (!message) {
        return ApiResponse.notFound(res, 'Message non trouvé');
      }

      // Seul le destinataire peut marquer comme lu
      if (message.destinataire_id !== req.user.id) {
        return ApiResponse.forbidden(res, 'Vous ne pouvez marquer comme lu que vos propres messages');
      }

      const resultat = await message.marquerCommeLu();

      if (!resultat.success) {
        return ApiResponse.error(res, resultat.message, 400);
      }

      return ApiResponse.success(res, { id: message.id, lu: true }, resultat.message);

    } catch (error) {
      console.error('Erreur marquage lecture:', error);
      return ApiResponse.error(res, 'Erreur lors du marquage du message', 500);
    }
  }

  /**
   * Marquer toute une conversation comme lue
   */
  static async marquerConversationLue(req, res) {
    try {
      const { conversation_id } = req.params;

      // Vérifier que l'utilisateur fait partie de cette conversation
      const messageVerification = await Message.findOne({
        where: {
          conversation_id,
          [Op.or]: [
            { expediteur_id: req.user.id },
            { destinataire_id: req.user.id }
          ]
        }
      });

      if (!messageVerification) {
        return ApiResponse.forbidden(res, 'Vous n\'avez pas accès à cette conversation');
      }

      const resultat = await Message.marquerConversationLue(conversation_id, req.user.id);

      if (!resultat.success) {
        return ApiResponse.error(res, resultat.message, 400);
      }

      return ApiResponse.success(res, {
        conversation_id,
        messages_marques: resultat.messages_marques
      }, 'Conversation marquée comme lue');

    } catch (error) {
      console.error('Erreur marquage conversation:', error);
      return ApiResponse.error(res, 'Erreur lors du marquage de la conversation', 500);
    }
  }

  /**
   * Supprimer un message
   */
  static async supprimerMessage(req, res) {
    try {
      const { id } = req.params;

      const message = await Message.findByPk(id);
      if (!message) {
        return ApiResponse.notFound(res, 'Message non trouvé');
      }

      // Vérifier les permissions (seul l'expéditeur peut supprimer)
      if (!message.peutEtreSupprimePar(req.user.id)) {
        return ApiResponse.forbidden(res, 'Vous ne pouvez supprimer que vos propres messages');
      }

      await message.destroy();
      return ApiResponse.deleted(res, 'Message supprimé avec succès');

    } catch (error) {
      console.error('Erreur suppression message:', error);
      return ApiResponse.error(res, 'Erreur lors de la suppression du message', 500);
    }
  }

  /**
   * Archiver un message
   */
  static async archiverMessage(req, res) {
    try {
      const { id } = req.params;

      const message = await Message.findByPk(id);
      if (!message) {
        return ApiResponse.notFound(res, 'Message non trouvé');
      }

      // Vérifier les permissions
      if (!message.peutEtreLuPar(req.user.id)) {
        return ApiResponse.forbidden(res, 'Vous ne pouvez archiver que vos propres messages');
      }

      const resultat = await message.archiver();

      if (!resultat.success) {
        return ApiResponse.error(res, resultat.message, 400);
      }

      return ApiResponse.success(res, { id: message.id, statut: 'archive' }, resultat.message);

    } catch (error) {
      console.error('Erreur archivage message:', error);
      return ApiResponse.error(res, 'Erreur lors de l\'archivage du message', 500);
    }
  }

  /**
   * Rechercher dans les messages
   */
  static async rechercherMessages(req, res) {
    try {
      const { q: terme, type, priorite, page = 1, limit = 20 } = req.query;

      if (!terme || terme.trim().length < 2) {
        return ApiResponse.validationError(res, [
          { field: 'q', message: 'Le terme de recherche doit contenir au moins 2 caractères' }
        ]);
      }

      const offset = (parseInt(page) - 1) * parseInt(limit);
      const whereClause = {
        [Op.or]: [
          { expediteur_id: req.user.id },
          { destinataire_id: req.user.id }
        ],
        [Op.and]: [
          {
            [Op.or]: [
              { contenu: { [Op.like]: `%${terme}%` } },
              { sujet: { [Op.like]: `%${terme}%` } }
            ]
          }
        ],
        statut: { [Op.ne]: 'archive' }
      };

      if (type) whereClause.type = type;
      if (priorite) whereClause.priorite = priorite;

      const { count, rows } = await Message.findAndCountAll({
        where: whereClause,
        include: [
          { model: Utilisateur, as: 'expediteur', attributes: ['id', 'nom', 'email'] },
          { model: Utilisateur, as: 'destinataire', attributes: ['id', 'nom', 'email'] }
        ],
        order: [['date_envoi', 'DESC']],
        limit: parseInt(limit),
        offset: offset
      });

      return ApiResponse.paginated(res, rows, {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        terme_recherche: terme
      });

    } catch (error) {
      console.error('Erreur recherche messages:', error);
      return ApiResponse.error(res, 'Erreur lors de la recherche', 500);
    }
  }

  /**
   * Obtenir les statistiques des messages de l'utilisateur
   */
  static async obtenirStatistiques(req, res) {
    try {
      const userId = req.user.id;

      const [
        totalEnvoyes,
        totalRecus,
        nonLus,
        conversations,
        messagesAujourdhui
      ] = await Promise.all([
        Message.count({ where: { expediteur_id: userId } }),
        Message.count({ where: { destinataire_id: userId } }),
        Message.compterMessagesNonLus(userId),
        Message.count({
          where: {
            [Op.or]: [
              { expediteur_id: userId },
              { destinataire_id: userId }
            ]
          },
          attributes: ['conversation_id'],
          group: ['conversation_id']
        }).then(results => results.length),
        Message.count({
          where: {
            [Op.or]: [
              { expediteur_id: userId },
              { destinataire_id: userId }
            ],
            date_envoi: {
              [Op.gte]: new Date().setHours(0, 0, 0, 0)
            }
          }
        })
      ]);

      // Statistiques par type
      const messagesParType = await Message.findAll({
        where: {
          [Op.or]: [
            { expediteur_id: userId },
            { destinataire_id: userId }
          ]
        },
        attributes: [
          'type',
          [sequelize.fn('COUNT', sequelize.col('id')), 'nombre']
        ],
        group: ['type'],
        raw: true
      });

      const statistiques = {
        messages: {
          total_envoyes: totalEnvoyes,
          total_recus: totalRecus,
          non_lus: nonLus,
          aujourdhui: messagesAujourdhui
        },
        conversations: {
          total: conversations,
          actives: conversations // Approximation
        },
        repartition_par_type: messagesParType.reduce((acc, item) => {
          acc[item.type] = parseInt(item.nombre);
          return acc;
        }, {}),
        taux_lecture: totalRecus > 0 ? Math.round(((totalRecus - nonLus) / totalRecus) * 100) : 0
      };

      return ApiResponse.success(res, statistiques);

    } catch (error) {
      console.error('Erreur statistiques messages:', error);
      return ApiResponse.error(res, 'Erreur lors de la récupération des statistiques', 500);
    }
  }

  /**
   * Envoyer une notification système
   */
  static async envoyerNotification(req, res) {
    try {
      const {
        destinataire_id,
        contenu,
        sujet,
        priorite = 'normale',
        objet_type,
        objet_id
      } = req.body;

      if (!destinataire_id || !contenu) {
        return ApiResponse.validationError(res, [
          { field: 'destinataire_id', message: 'Le destinataire est requis' },
          { field: 'contenu', message: 'Le contenu de la notification est requis' }
        ]);
      }

      const resultat = await Message.envoyerMessage({
        expediteur_id: req.user.id,
        destinataire_id,
        contenu,
        sujet: sujet || 'Notification système',
        type: 'notification',
        priorite,
        objet_type,
        objet_id
      });

      if (!resultat.success) {
        return ApiResponse.error(res, resultat.message, 400);
      }

      return ApiResponse.created(res, resultat.data, 'Notification envoyée avec succès');

    } catch (error) {
      console.error('Erreur envoi notification:', error);
      return ApiResponse.error(res, 'Erreur lors de l\'envoi de la notification', 500);
    }
  }

  /**
   * Obtenir les messages non lus
   */
  static async obtenirMessagesNonLus(req, res) {
    try {
      const { limit = 10, type } = req.query;

      const whereClause = {
        destinataire_id: req.user.id,
        lu: false,
        statut: { [Op.ne]: 'archive' }
      };

      if (type) whereClause.type = type;

      const messages = await Message.findAll({
        where: whereClause,
        include: [
          { model: Utilisateur, as: 'expediteur', attributes: ['id', 'nom', 'email'] }
        ],
        order: [['date_envoi', 'DESC']],
        limit: parseInt(limit)
      });

      const total = await Message.compterMessagesNonLus(req.user.id);

      return ApiResponse.success(res, {
        messages_non_lus: messages,
        total_non_lus: total
      });

    } catch (error) {
      console.error('Erreur messages non lus:', error);
      return ApiResponse.error(res, 'Erreur lors de la récupération des messages non lus', 500);
    }
  }

  /**
   * Obtenir les messages archivés
   */
  static async obtenirMessagesArchives(req, res) {
    try {
      const { page = 1, limit = 20 } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);

      const { count, rows } = await Message.findAndCountAll({
        where: {
          [Op.or]: [
            { expediteur_id: req.user.id },
            { destinataire_id: req.user.id }
          ],
          statut: 'archive'
        },
        include: [
          { model: Utilisateur, as: 'expediteur', attributes: ['id', 'nom', 'email'] },
          { model: Utilisateur, as: 'destinataire', attributes: ['id', 'nom', 'email'] }
        ],
        order: [['date_envoi', 'DESC']],
        limit: parseInt(limit),
        offset: offset
      });

      return ApiResponse.paginated(res, rows, {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count
      });

    } catch (error) {
      console.error('Erreur messages archivés:', error);
      return ApiResponse.error(res, 'Erreur lors de la récupération des messages archivés', 500);
    }
  }

  /**
   * Supprimer une conversation complète (admin uniquement)
   */
  static async supprimerConversation(req, res) {
    try {
      const { conversation_id } = req.params;

      // Vérifier qu'il y a des messages dans cette conversation
      const nombreMessages = await Message.count({
        where: { conversation_id }
      });

      if (nombreMessages === 0) {
        return ApiResponse.notFound(res, 'Conversation non trouvée');
      }

      // Supprimer tous les messages de la conversation
      await Message.destroy({
        where: { conversation_id }
      });

      return ApiResponse.success(res, {
        conversation_id,
        messages_supprimes: nombreMessages
      }, 'Conversation supprimée avec succès');

    } catch (error) {
      console.error('Erreur suppression conversation:', error);
      return ApiResponse.error(res, 'Erreur lors de la suppression de la conversation', 500);
    }
  }

  /**
   * Statistiques globales des messages (admin uniquement)
   */
  static async statistiquesGlobales(req, res) {
    try {
      const [
        totalMessages,
        messagesAujourdhui,
        conversationsActives,
        utilisateursActifs
      ] = await Promise.all([
        Message.count(),
        Message.count({
          where: {
            date_envoi: {
              [Op.gte]: new Date().setHours(0, 0, 0, 0)
            }
          }
        }),
        Message.count({
          attributes: ['conversation_id'],
          group: ['conversation_id'],
          where: {
            date_envoi: {
              [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 derniers jours
            }
          }
        }).then(results => results.length),
        Message.count({
          attributes: ['expediteur_id'],
          group: ['expediteur_id'],
          where: {
            date_envoi: {
              [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 dernières heures
            }
          }
        }).then(results => results.length)
      ]);

      // Messages par type
      const messagesParType = await Message.findAll({
        attributes: [
          'type',
          [sequelize.fn('COUNT', sequelize.col('id')), 'nombre']
        ],
        group: ['type'],
        raw: true
      });

      // Messages par priorité
      const messagesParPriorite = await Message.findAll({
        attributes: [
          'priorite',
          [sequelize.fn('COUNT', sequelize.col('id')), 'nombre']
        ],
        group: ['priorite'],
        raw: true
      });

      const statistiques = {
        global: {
          total_messages: totalMessages,
          messages_aujourdhui: messagesAujourdhui,
          conversations_actives_7j: conversationsActives,
          utilisateurs_actifs_24h: utilisateursActifs
        },
        repartition: {
          par_type: messagesParType.reduce((acc, item) => {
            acc[item.type] = parseInt(item.nombre);
            return acc;
          }, {}),
          par_priorite: messagesParPriorite.reduce((acc, item) => {
            acc[item.priorite] = parseInt(item.nombre);
            return acc;
          }, {})
        }
      };

      return ApiResponse.success(res, statistiques);

    } catch (error) {
      console.error('Erreur statistiques globales messages:', error);
      return ApiResponse.error(res, 'Erreur lors de la récupération des statistiques globales', 500);
    }
  }
}

module.exports = MessageController;