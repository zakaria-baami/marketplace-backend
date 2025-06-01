// models/message.js
module.exports = (sequelize, DataTypes) => {
  const Message = sequelize.define('Message', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    expediteur_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'utilisateurs',
        key: 'id'
      }
    },
    destinataire_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'utilisateurs',
        key: 'id'
      }
    },
    contenu: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 5000]
      }
    },
    date_envoi: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    lu: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    date_lecture: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Date à laquelle le message a été lu'
    },
    type: {
      type: DataTypes.ENUM('message', 'notification', 'systeme'),
      allowNull: false,
      defaultValue: 'message'
    },
    priorite: {
      type: DataTypes.ENUM('basse', 'normale', 'haute', 'urgente'),
      allowNull: false,
      defaultValue: 'normale'
    },
    // Référence à un objet spécifique (produit, commande, etc.)
    objet_type: {
      type: DataTypes.ENUM('produit', 'commande', 'boutique', 'general'),
      allowNull: true,
      comment: 'Type d\'objet associé au message'
    },
    objet_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'ID de l\'objet associé'
    },
    sujet: {
      type: DataTypes.STRING(200),
      allowNull: true,
      comment: 'Sujet du message'
    },
    // Statut du message
    statut: {
      type: DataTypes.ENUM('brouillon', 'envoye', 'livre', 'lu', 'archive'),
      allowNull: false,
      defaultValue: 'envoye'
    },
    // Pour les conversations en groupe ou les réponses
    conversation_id: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'ID de conversation pour regrouper les messages'
    },
    message_parent_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'messages',
        key: 'id'
      },
      comment: 'ID du message parent pour les réponses'
    }
  }, {
    tableName: 'messages',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ['expediteur_id']
      },
      {
        fields: ['destinataire_id']
      },
      {
        fields: ['conversation_id']
      },
      {
        fields: ['lu', 'destinataire_id']
      },
      {
        fields: ['date_envoi']
      },
      {
        fields: ['objet_type', 'objet_id']
      }
    ],
    hooks: {
      // Générer un ID de conversation automatiquement
      beforeCreate: (message) => {
        if (!message.conversation_id && !message.message_parent_id) {
          // Créer un ID de conversation unique basé sur les participants
          const participants = [message.expediteur_id, message.destinataire_id].sort();
          message.conversation_id = `conv_${participants[0]}_${participants[1]}_${Date.now()}`;
        }
      }
    }
  });

  // ==================== MÉTHODES D'INSTANCE ====================
  
  /**
   * Envoyer le message
   * @returns {Object} - Résultat de l'envoi
   */
  Message.prototype.envoyer = async function() {
    try {
      await this.update({ 
        date_envoi: new Date(),
        statut: 'envoye'
      });
      
      return {
        success: true,
        message: 'Message envoyé avec succès',
        message_id: this.id
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  };

  /**
   * Marquer comme lu
   * @returns {Object} - Résultat
   */
  Message.prototype.marquerCommeLu = async function() {
    try {
      if (this.lu) {
        return {
          success: true,
          message: 'Message déjà marqué comme lu'
        };
      }

      await this.update({ 
        lu: true,
        date_lecture: new Date(),
        statut: 'lu'
      });
      
      return {
        success: true,
        message: 'Message marqué comme lu'
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  };

  /**
   * Archiver le message
   * @returns {Object} - Résultat
   */
  Message.prototype.archiver = async function() {
    try {
      await this.update({ statut: 'archive' });
      
      return {
        success: true,
        message: 'Message archivé avec succès'
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  };

  /**
   * Répondre à ce message
   * @param {Object} donnees - Données de la réponse
   * @returns {Object} - Message de réponse créé
   */
  Message.prototype.repondre = async function(donnees) {
    try {
      const reponse = await sequelize.models.Message.create({
        expediteur_id: donnees.expediteur_id,
        destinataire_id: this.expediteur_id, // Inverser expéditeur/destinataire
        contenu: donnees.contenu,
        sujet: donnees.sujet || `Re: ${this.sujet || 'Message'}`,
        type: donnees.type || 'message',
        priorite: donnees.priorite || 'normale',
        conversation_id: this.conversation_id,
        message_parent_id: this.id,
        objet_type: this.objet_type,
        objet_id: this.objet_id
      });

      return {
        success: true,
        message: 'Réponse envoyée avec succès',
        reponse
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  };

  /**
   * Obtenir la conversation complète
   * @returns {Object} - Messages de la conversation
   */
  Message.prototype.obtenirConversation = async function() {
    try {
      if (!this.conversation_id) {
        return {
          success: false,
          message: 'Aucune conversation associée'
        };
      }

      const messages = await sequelize.models.Message.findAll({
        where: { conversation_id: this.conversation_id },
        include: [
          { model: sequelize.models.Utilisateur, as: 'expediteur', attributes: ['id', 'nom', 'email'] },
          { model: sequelize.models.Utilisateur, as: 'destinataire', attributes: ['id', 'nom', 'email'] }
        ],
        order: [['date_envoi', 'ASC']]
      });

      return {
        success: true,
        conversation: messages,
        conversation_id: this.conversation_id
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  };

  /**
   * Vérifier si l'utilisateur peut lire ce message
   * @param {number} utilisateurId - ID de l'utilisateur
   * @returns {boolean} - True si autorisé
   */
  Message.prototype.peutEtreLuPar = function(utilisateurId) {
    return this.expediteur_id === utilisateurId || this.destinataire_id === utilisateurId;
  };

  /**
   * Vérifier si l'utilisateur peut supprimer ce message
   * @param {number} utilisateurId - ID de l'utilisateur
   * @returns {boolean} - True si autorisé
   */
  Message.prototype.peutEtreSupprimePar = function(utilisateurId) {
    return this.expediteur_id === utilisateurId;
  };

  /**
   * Obtenir un résumé du message
   * @returns {Object} - Résumé formaté
   */
  Message.prototype.obtenirResume = function() {
    return {
      id: this.id,
      sujet: this.sujet || 'Sans sujet',
      contenu_apercu: this.contenu.length > 100 
        ? this.contenu.substring(0, 100) + '...' 
        : this.contenu,
      expediteur_id: this.expediteur_id,
      destinataire_id: this.destinataire_id,
      date_envoi: this.date_envoi,
      lu: this.lu,
      type: this.type,
      priorite: this.priorite,
      statut: this.statut
    };
  };

  // ==================== MÉTHODES STATIQUES ====================

  /**
   * Envoyer un message entre deux utilisateurs
   * @param {Object} donnees - Données du message
   * @returns {Object} - Message créé
   */
  Message.envoyerMessage = async function(donnees) {
    try {
      const message = await this.create({
        expediteur_id: donnees.expediteur_id,
        destinataire_id: donnees.destinataire_id,
        contenu: donnees.contenu,
        sujet: donnees.sujet,
        type: donnees.type || 'message',
        priorite: donnees.priorite || 'normale',
        objet_type: donnees.objet_type,
        objet_id: donnees.objet_id,
        conversation_id: donnees.conversation_id
      });

      return {
        success: true,
        message: 'Message envoyé avec succès',
        data: message
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  };

  /**
   * Obtenir les conversations d'un utilisateur
   * @param {number} utilisateurId - ID de l'utilisateur
   * @param {Object} options - Options de filtrage
   * @returns {Object} - Conversations
   */
  Message.obtenirConversations = async function(utilisateurId, options = {}) {
    try {
      // Obtenir les conversations uniques
      const conversations = await this.findAll({
        where: {
          [sequelize.Sequelize.Op.or]: [
            { expediteur_id: utilisateurId },
            { destinataire_id: utilisateurId }
          ],
          statut: { [sequelize.Sequelize.Op.ne]: 'archive' }
        },
        attributes: [
          'conversation_id',
          [sequelize.fn('MAX', sequelize.col('date_envoi')), 'derniere_activite'],
          [sequelize.fn('COUNT', sequelize.col('id')), 'nombre_messages']
        ],
        group: ['conversation_id'],
        order: [[sequelize.literal('derniere_activite'), 'DESC']],
        limit: options.limit || 20
      });

      // Pour chaque conversation, obtenir le dernier message et les participants
      const conversationsDetaillees = await Promise.all(
        conversations.map(async (conv) => {
          const dernierMessage = await this.findOne({
            where: { conversation_id: conv.conversation_id },
            include: [
              { model: sequelize.models.Utilisateur, as: 'expediteur', attributes: ['id', 'nom'] },
              { model: sequelize.models.Utilisateur, as: 'destinataire', attributes: ['id', 'nom'] }
            ],
            order: [['date_envoi', 'DESC']]
          });

          const messagesNonLus = await this.count({
            where: {
              conversation_id: conv.conversation_id,
              destinataire_id: utilisateurId,
              lu: false
            }
          });

          return {
            conversation_id: conv.conversation_id,
            dernier_message: dernierMessage,
            nombre_messages: parseInt(conv.get('nombre_messages')),
            messages_non_lus: messagesNonLus,
            derniere_activite: conv.get('derniere_activite')
          };
        })
      );

      return {
        success: true,
        conversations: conversationsDetaillees
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  };

  /**
   * Compter les messages non lus d'un utilisateur
   * @param {number} utilisateurId - ID de l'utilisateur
   * @returns {number} - Nombre de messages non lus
   */
  Message.compterMessagesNonLus = async function(utilisateurId) {
    try {
      return await this.count({
        where: {
          destinataire_id: utilisateurId,
          lu: false,
          statut: { [sequelize.Sequelize.Op.ne]: 'archive' }
        }
      });
    } catch (error) {
      return 0;
    }
  };

  /**
   * Marquer tous les messages d'une conversation comme lus
   * @param {string} conversationId - ID de la conversation
   * @param {number} utilisateurId - ID de l'utilisateur
   * @returns {Object} - Résultat
   */
  Message.marquerConversationLue = async function(conversationId, utilisateurId) {
    try {
      const [nombreMisAJour] = await this.update(
        { 
          lu: true,
          date_lecture: new Date(),
          statut: 'lu'
        },
        {
          where: {
            conversation_id: conversationId,
            destinataire_id: utilisateurId,
            lu: false
          }
        }
      );

      return {
        success: true,
        messages_marques: nombreMisAJour
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  };

  // ==================== ASSOCIATIONS ====================
  Message.associate = function(models) {
    // Un message a un expéditeur
    Message.belongsTo(models.Utilisateur, {
      foreignKey: 'expediteur_id',
      as: 'expediteur'
    });

    // Un message a un destinataire
    Message.belongsTo(models.Utilisateur, {
      foreignKey: 'destinataire_id',
      as: 'destinataire'
    });

    // Relations pour les réponses (auto-référence)
    Message.belongsTo(models.Message, {
      foreignKey: 'message_parent_id',
      as: 'messageParent'
    });

    Message.hasMany(models.Message, {
      foreignKey: 'message_parent_id',
      as: 'reponses'
    });
  };

  return Message;
};