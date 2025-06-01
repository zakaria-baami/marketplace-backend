// models/client.js
module.exports = (sequelize, DataTypes) => {
  const Client = sequelize.define('Client', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false
    },
    adresse: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    telephone: {
      type: DataTypes.STRING(20),
      allowNull: true
    }
  }, {
    tableName: 'clients',
    timestamps: true,
    underscored: true
  });

  // ==================== MÉTHODES D'INSTANCE ====================

  /**
   * Récupérer le panier actuel du client
   * @returns {Object} - Panier avec ses lignes
   */
  Client.prototype.obtenirPanierActuel = async function() {
    try {
      const panier = await this.getPanier({
        where: { statut: 'actif' },
        include: [{
          model: sequelize.models.LignePanier,
          as: 'lignes',
          include: [{
            model: sequelize.models.Produit,
            as: 'produit',
            include: ['images']
          }]
        }]
      });

      if (!panier) {
        return {
          success: true,
          panier: null
        };
      }

      const total = await this.calculerTotalPanier();

      return {
        success: true,
        panier: {
          id: panier.id,
          date_creation: panier.date_creation,
          total: total,
          lignes: panier.lignes.map(ligne => ({
            id: ligne.id,
            quantite: ligne.quantite,
            sous_total: ligne.sous_total,
            produit: ligne.produit
          }))
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
   * Ajouter un produit au panier
   * @param {Object} produit - Le produit à ajouter
   * @param {number} quantite - Quantité à ajouter
   * @returns {Object} - Résultat de l'ajout
   */
  Client.prototype.ajouterLignePanier = async function(produit, quantite = 1) {
    try {
      // Vérifier que le produit existe et est disponible
      if (!produit || !produit.id) {
        throw new Error('Produit invalide');
      }

      if (quantite <= 0) {
        throw new Error('La quantité doit être positive');
      }

      if (produit.stock < quantite) {
        throw new Error('Stock insuffisant');
      }

      // Récupérer ou créer le panier actif
      let panier = await sequelize.models.Panier.findOne({
        where: {
          client_id: this.id,
          statut: 'actif'
        }
      });

      if (!panier) {
        panier = await sequelize.models.Panier.create({
          client_id: this.id,
          date_creation: new Date(),
          statut: 'actif'
        });
      }

      // Vérifier si le produit est déjà dans le panier
      const ligneExistante = await sequelize.models.LignePanier.findOne({
        where: {
          panier_id: panier.id,
          produit_id: produit.id
        }
      });

      if (ligneExistante) {
        // Mettre à jour la quantité existante
        const nouvelleQuantite = ligneExistante.quantite + quantite;
        
        if (produit.stock < nouvelleQuantite) {
          throw new Error('Stock insuffisant pour cette quantité');
        }

        await ligneExistante.update({
          quantite: nouvelleQuantite,
          sous_total: produit.prix * nouvelleQuantite
        });
        
        return {
          success: true,
          message: 'Quantité mise à jour dans le panier',
          ligne: ligneExistante
        };
      } else {
        // Créer une nouvelle ligne de panier
        const lignePanier = await sequelize.models.LignePanier.create({
          panier_id: panier.id,
          produit_id: produit.id,
          quantite: quantite,
          sous_total: produit.prix * quantite
        });

        return {
          success: true,
          message: 'Produit ajouté au panier',
          ligne: lignePanier
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  };

  /**
   * Modifier la quantité d'une ligne de panier
   * @param {number} ligneId - ID de la ligne de panier
   * @param {number} nouvelleQuantite - Nouvelle quantité
   * @returns {Object} - Résultat de la modification
   */
  Client.prototype.modifierQuantitePanier = async function(ligneId, nouvelleQuantite) {
    try {
      if (nouvelleQuantite <= 0) {
        throw new Error('La quantité doit être positive');
      }

      // Vérifier que cette ligne appartient bien au client
      const panier = await sequelize.models.Panier.findOne({
        where: {
          client_id: this.id,
          statut: 'actif'
        }
      });

      if (!panier) {
        throw new Error('Aucun panier actif trouvé');
      }

      const ligne = await sequelize.models.LignePanier.findOne({
        where: {
          id: ligneId,
          panier_id: panier.id
        },
        include: [{
          model: sequelize.models.Produit,
          as: 'produit'
        }]
      });

      if (!ligne) {
        throw new Error('Ligne de panier non trouvée');
      }

      // Vérifier le stock
      if (ligne.produit.stock < nouvelleQuantite) {
        throw new Error('Stock insuffisant');
      }

      await ligne.update({
        quantite: nouvelleQuantite,
        sous_total: ligne.produit.prix * nouvelleQuantite
      });

      return {
        success: true,
        message: 'Quantité mise à jour',
        ligne: ligne
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  };

  /**
   * Retirer un produit du panier
   * @param {number} ligneId - ID de la ligne de panier à supprimer
   * @returns {Object} - Résultat de la suppression
   */
  Client.prototype.retirerDuPanier = async function(ligneId) {
    try {
      if (!ligneId) {
        throw new Error('ID de ligne invalide');
      }

      // Vérifier que cette ligne appartient bien au client
      const panier = await sequelize.models.Panier.findOne({
        where: {
          client_id: this.id,
          statut: 'actif'
        }
      });

      if (!panier) {
        throw new Error('Aucun panier actif trouvé');
      }

      const ligne = await sequelize.models.LignePanier.findOne({
        where: {
          id: ligneId,
          panier_id: panier.id
        }
      });

      if (!ligne) {
        throw new Error('Ligne de panier non trouvée');
      }

      await ligne.destroy();

      return {
        success: true,
        message: 'Produit retiré du panier'
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  };

  /**
   * Vider le panier actuel
   * @returns {Object} - Résultat de l'opération
   */
  Client.prototype.viderPanier = async function() {
    try {
      const panier = await sequelize.models.Panier.findOne({
        where: {
          client_id: this.id,
          statut: 'actif'
        }
      });
      
      if (!panier) {
        return {
          success: true,
          message: 'Aucun panier à vider'
        };
      }

      await sequelize.models.LignePanier.destroy({
        where: { panier_id: panier.id }
      });

      return {
        success: true,
        message: 'Panier vidé avec succès'
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  };

  /**
   * Valider le panier (passer commande)
   * @param {Object} infosLivraison - Informations de livraison
   * @returns {Object} - Résultat de la validation
   */
  Client.prototype.validerPanier = async function(infosLivraison = {}) {
    const transaction = await sequelize.transaction();
    
    try {
      // Récupérer le panier actif avec ses lignes et produits
      const panier = await sequelize.models.Panier.findOne({
        where: {
          client_id: this.id,
          statut: 'actif'
        },
        include: [{
          model: sequelize.models.LignePanier,
          as: 'lignes',
          include: [{
            model: sequelize.models.Produit,
            as: 'produit'
          }]
        }]
      });

      if (!panier || !panier.lignes || panier.lignes.length === 0) {
        throw new Error('Panier vide');
      }

      // Vérifier la disponibilité des produits et calculer le total
      let total = 0;

      for (const ligne of panier.lignes) {
        const produit = ligne.produit;
        
        if (!produit) {
          throw new Error('Produit introuvable');
        }

        if (produit.stock < ligne.quantite) {
          throw new Error(`Stock insuffisant pour ${produit.nom}`);
        }

        total += ligne.sous_total;
      }

      // Mettre à jour le stock des produits
      for (const ligne of panier.lignes) {
        const produit = ligne.produit;
        await produit.update({
          stock: produit.stock - ligne.quantite
        }, { transaction });
      }

      // Marquer le panier comme validé
      await panier.update({
        statut: 'valide',
        date_validation: new Date(),
        total: total,
        adresse_livraison: infosLivraison.adresse_livraison,
        mode_paiement: infosLivraison.mode_paiement
      }, { transaction });

      // Créer un nouveau panier actif pour les futurs achats
      await sequelize.models.Panier.create({
        client_id: this.id,
        date_creation: new Date(),
        statut: 'actif'
      }, { transaction });

      await transaction.commit();

      return {
        success: true,
        message: 'Panier validé avec succès',
        panier_valide: {
          id: panier.id,
          total: total,
          statut: 'valide',
          date_validation: new Date(),
          adresse_livraison: infosLivraison.adresse_livraison
        }
      };
    } catch (error) {
      await transaction.rollback();
      return {
        success: false,
        message: error.message
      };
    }
  };

  /**
   * Consulter l'historique des paniers validés
   * @param {Object} options - Options de filtrage
   * @returns {Array} - Liste des paniers validés
   */
  Client.prototype.consulterHistoriquePaniers = async function(options = {}) {
    try {
      const whereClause = { 
        client_id: this.id,
        statut: ['valide', 'expedie', 'livre', 'annule'] // Paniers qui ne sont plus actifs
      };
      
      // Filtrer par statut si spécifié
      if (options.statut) {
        whereClause.statut = options.statut;
      }

      // Filtrer par période si spécifié
      if (options.dateDebut && options.dateFin) {
        whereClause.date_validation = {
          [sequelize.Sequelize.Op.between]: [options.dateDebut, options.dateFin]
        };
      }

      const paniers = await sequelize.models.Panier.findAll({
        where: whereClause,
        include: [{
          model: sequelize.models.LignePanier,
          as: 'lignes',
          include: [{
            model: sequelize.models.Produit,
            as: 'produit',
            include: ['images']
          }]
        }],
        order: [['date_validation', 'DESC']],
        limit: options.limit || 50
      });

      return {
        success: true,
        paniers_historique: paniers.map(panier => ({
          id: panier.id,
          date_validation: panier.date_validation,
          total: panier.total,
          statut: panier.statut,
          adresse_livraison: panier.adresse_livraison,
          mode_paiement: panier.mode_paiement,
          nombre_articles: panier.lignes.length,
          lignes: panier.lignes.map(ligne => ({
            id: ligne.id,
            quantite: ligne.quantite,
            sous_total: ligne.sous_total,
            produit: {
              id: ligne.produit.id,
              nom: ligne.produit.nom,
              prix: ligne.produit.prix,
              images: ligne.produit.images
            }
          }))
        }))
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  };

  /**
   * Récupérer un panier spécifique par ID
   * @param {number} panierId - ID du panier
   * @returns {Object} - Panier trouvé
   */
  Client.prototype.obtenirPanier = async function(panierId) {
    try {
      const panier = await sequelize.models.Panier.findOne({
        where: {
          id: panierId,
          client_id: this.id
        },
        include: [{
          model: sequelize.models.LignePanier,
          as: 'lignes',
          include: [{
            model: sequelize.models.Produit,
            as: 'produit',
            include: ['images']
          }]
        }]
      });

      if (!panier) {
        return {
          success: false,
          message: 'Panier non trouvé'
        };
      }

      return {
        success: true,
        panier: {
          id: panier.id,
          statut: panier.statut,
          date_creation: panier.date_creation,
          date_validation: panier.date_validation,
          total: panier.total,
          adresse_livraison: panier.adresse_livraison,
          mode_paiement: panier.mode_paiement,
          lignes: panier.lignes.map(ligne => ({
            id: ligne.id,
            quantite: ligne.quantite,
            sous_total: ligne.sous_total,
            produit: ligne.produit
          }))
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
   * Annuler un panier validé
   * @param {number} panierId - ID du panier à annuler
   * @returns {Object} - Résultat de l'annulation
   */
  Client.prototype.annulerPanier = async function(panierId) {
    const transaction = await sequelize.transaction();
    
    try {
      const panier = await sequelize.models.Panier.findOne({
        where: {
          id: panierId,
          client_id: this.id,
          statut: ['valide', 'expedie'] // Seuls ces statuts peuvent être annulés
        },
        include: [{
          model: sequelize.models.LignePanier,
          as: 'lignes',
          include: [{
            model: sequelize.models.Produit,
            as: 'produit'
          }]
        }]
      });

      if (!panier) {
        throw new Error('Panier non trouvé ou impossible à annuler');
      }

      // Remettre en stock les produits
      for (const ligne of panier.lignes) {
        const produit = ligne.produit;
        await produit.update({
          stock: produit.stock + ligne.quantite
        }, { transaction });
      }

      // Marquer le panier comme annulé
      await panier.update({
        statut: 'annule',
        date_annulation: new Date()
      }, { transaction });

      await transaction.commit();

      return {
        success: true,
        message: 'Panier annulé avec succès'
      };
    } catch (error) {
      await transaction.rollback();
      return {
        success: false,
        message: error.message
      };
    }
  };

  /**
   * Mettre à jour les informations du client
   * @param {Object} donnees - Nouvelles données
   * @returns {Object} - Résultat de la mise à jour
   */
  Client.prototype.mettreAJourInformations = async function(donnees) {
    try {
      const champsAutorises = ['adresse', 'telephone'];
      const donneesFiltered = {};

      champsAutorises.forEach(champ => {
        if (donnees[champ] !== undefined) {
          donneesFiltered[champ] = donnees[champ];
        }
      });

      // Mettre à jour aussi les données utilisateur si présentes
      const donneesUtilisateur = {};
      const champsUtilisateur = ['nom', 'email'];
      
      champsUtilisateur.forEach(champ => {
        if (donnees[champ] !== undefined) {
          donneesUtilisateur[champ] = donnees[champ];
        }
      });

      // Mettre à jour les données client
      if (Object.keys(donneesFiltered).length > 0) {
        await this.update(donneesFiltered);
      }

      // Mettre à jour les données utilisateur si nécessaires
      if (Object.keys(donneesUtilisateur).length > 0) {
        const utilisateur = await this.getUtilisateur();
        if (utilisateur) {
          await utilisateur.update(donneesUtilisateur);
        }
      }

      return {
        success: true,
        message: 'Informations mises à jour avec succès'
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  };

  /**
   * Calculer le total du panier actuel
   * @returns {number} - Total du panier
   */
  Client.prototype.calculerTotalPanier = async function() {
    try {
      const panier = await sequelize.models.Panier.findOne({
        where: {
          client_id: this.id,
          statut: 'actif'
        },
        include: [{
          model: sequelize.models.LignePanier,
          as: 'lignes'
        }]
      });

      if (!panier || !panier.lignes) {
        return 0;
      }

      return panier.lignes.reduce((total, ligne) => total + (ligne.sous_total || 0), 0);
    } catch (error) {
      console.error('Erreur calcul total panier:', error);
      return 0;
    }
  };

  /**
   * Obtenir le profil complet du client
   * @returns {Object} - Profil complet avec données utilisateur
   */
  Client.prototype.obtenirProfilComplet = async function() {
    try {
      const utilisateur = await this.getUtilisateur();
      
      return {
        success: true,
        profil: {
          id: this.id,
          nom: utilisateur.nom,
          email: utilisateur.email,
          adresse: this.adresse,
          telephone: this.telephone,
          role: utilisateur.role,
          date_creation: this.created_at
        }
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  };

  // ==================== ASSOCIATIONS ====================
  Client.associate = function(models) {
    // Héritage d'Utilisateur
    Client.belongsTo(models.Utilisateur, {
      foreignKey: 'id',
      targetKey: 'id',
      as: 'utilisateur'
    });

    // Un client possède plusieurs paniers
    Client.hasMany(models.Panier, {
      foreignKey: 'client_id',
      as: 'paniers'
    });

    // Relation pour obtenir le panier actif
    Client.hasOne(models.Panier, {
      foreignKey: 'client_id',
      as: 'panier',
      scope: {
        statut: 'actif'
      }
    });
  };

  return Client;
};