// models/utilisateur.js
const bcrypt = require('bcrypt');

module.exports = (sequelize, DataTypes) => {
  const Utilisateur = sequelize.define('Utilisateur', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    nom: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true
      }
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    role: {
      type: DataTypes.ENUM('client', 'vendeur', 'admin'),
      allowNull: false,
      defaultValue: 'client'
    }
  }, {
    tableName: 'utilisateurs',
    timestamps: true,
    underscored: true,
    hooks: {
      // Hasher le mot de passe avant la création
      beforeCreate: async (utilisateur) => {
        if (utilisateur.password) {
          utilisateur.password = await bcrypt.hash(utilisateur.password, 12);
        }
      },
      // Hasher le mot de passe avant la mise à jour
      beforeUpdate: async (utilisateur) => {
        if (utilisateur.changed('password')) {
          utilisateur.password = await bcrypt.hash(utilisateur.password, 12);
        }
      }
    }
  });

  // ==================== MÉTHODES D'INSTANCE ====================

  /**
   * Connecter un utilisateur
   * @param {string} password - Mot de passe en clair
   * @returns {Object} - Informations utilisateur
   */
  Utilisateur.prototype.seConnecter = async function(password) {
    try {
      // Vérifier le mot de passe
      const isValidPassword = await bcrypt.compare(password, this.password);
      
      if (!isValidPassword) {
        throw new Error('Mot de passe incorrect');
      }

      return {
        success: true,
        message: 'Connexion réussie',
        utilisateur: {
          id: this.id,
          nom: this.nom,
          email: this.email,
          role: this.role
        }
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  };

  /**
   * Déconnecter un utilisateur
   * @returns {Object} - Résultat de la déconnexion
   */
  Utilisateur.prototype.seDeconnecter = async function() {
    return {
      success: true,
      message: 'Déconnexion réussie'
    };
  };

  /**
   * Mettre à jour le profil utilisateur
   * @param {Object} donnees - Nouvelles données
   * @returns {Object} - Résultat de la mise à jour
   */
  Utilisateur.prototype.mettreAJourProfil = async function(donnees) {
    try {
      const champsAutorises = ['nom', 'email'];
      const donneesFiltered = {};

      champsAutorises.forEach(champ => {
        if (donnees[champ] !== undefined) {
          donneesFiltered[champ] = donnees[champ];
        }
      });

      await this.update(donneesFiltered);

      return {
        success: true,
        message: 'Profil mis à jour avec succès'
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  };

  /**
   * Changer le mot de passe
   * @param {string} ancienPassword - Ancien mot de passe
   * @param {string} nouveauPassword - Nouveau mot de passe
   * @returns {Object} - Résultat du changement
   */
  Utilisateur.prototype.changerMotDePasse = async function(ancienPassword, nouveauPassword) {
    try {
      // Vérifier l'ancien mot de passe
      const isValidPassword = await bcrypt.compare(ancienPassword, this.password);
      
      if (!isValidPassword) {
        throw new Error('Ancien mot de passe incorrect');
      }

      if (nouveauPassword.length < 6) {
        throw new Error('Le nouveau mot de passe doit contenir au moins 6 caractères');
      }

      await this.update({ password: nouveauPassword });

      return {
        success: true,
        message: 'Mot de passe changé avec succès'
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  };

  // ==================== MÉTHODES STATIQUES ====================

  /**
   * Authentifier un utilisateur par email/password
   * @param {string} email - Email de l'utilisateur
   * @param {string} password - Mot de passe
   * @returns {Object} - Résultat de l'authentification
   */
  Utilisateur.authentifier = async function(email, password) {
    try {
      const utilisateur = await this.findOne({ 
        where: { email },
        include: [
          { model: sequelize.models.Client, as: 'client' },
          { model: sequelize.models.Vendeur, as: 'vendeur' }
        ]
      });

      if (!utilisateur) {
        return {
          success: false,
          message: 'Utilisateur non trouvé'
        };
      }

      return await utilisateur.seConnecter(password);
    } catch (error) {
      return {
        success: false,
        message: 'Erreur lors de l\'authentification'
      };
    }
  };

  // ==================== ASSOCIATIONS ====================
  Utilisateur.associate = function(models) {
    // Relations d'héritage
    Utilisateur.hasOne(models.Client, {
      foreignKey: 'id',
      sourceKey: 'id',
      as: 'client'
    });

    Utilisateur.hasOne(models.Vendeur, {
      foreignKey: 'id',
      sourceKey: 'id',
      as: 'vendeur'
    });

    // Messages envoyés
    Utilisateur.hasMany(models.Message, {
      foreignKey: 'expediteur_id',
      as: 'messagesEnvoyes'
    });

    // Messages reçus
    Utilisateur.hasMany(models.Message, {
      foreignKey: 'destinataire_id',
      as: 'messagesRecus'
    });
  };

  return Utilisateur;
};