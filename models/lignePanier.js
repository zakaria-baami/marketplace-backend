// models/lignePanier.js
module.exports = (sequelize, DataTypes) => {
  const LignePanier = sequelize.define('LignePanier', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    panier_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    produit_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    quantite: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      validate: {
        min: 1
      }
    },
    // AJOUTÉ: Colonne sous_total pour optimiser les calculs
    sous_total: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.00,
      validate: {
        min: 0
      }
    }
  }, {
    tableName: 'ligne_paniers',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['panier_id', 'produit_id'],
        name: 'unique_panier_produit'
      },
      {
        fields: ['panier_id'],
        name: 'idx_ligne_panier_panier'
      },
      {
        fields: ['produit_id'],
        name: 'idx_ligne_panier_produit'
      }
    ]
  });

  // ==================== MÉTHODES D'INSTANCE ====================

  /**
   * Mettre à jour la quantité de la ligne
   * @param {number} nouvelleQuantite - Nouvelle quantité
   * @returns {Object} - Résultat de la mise à jour
   */
  LignePanier.prototype.mettreAJourQuantite = async function(nouvelleQuantite) {
    try {
      if (nouvelleQuantite < 1) {
        throw new Error('La quantité doit être au moins 1');
      }

      // Vérifier la disponibilité du produit
      const produit = await this.getProduit();
      if (!produit) {
        throw new Error('Produit associé non trouvé');
      }

      if (!produit.verifierDisponibilite(nouvelleQuantite)) {
        throw new Error(`Stock insuffisant. Disponible: ${produit.stock}, Demandé: ${nouvelleQuantite}`);
      }

      const ancienneQuantite = this.quantite;
      const nouveauSousTotal = nouvelleQuantite * parseFloat(produit.prix);
      
      await this.update({ 
        quantite: nouvelleQuantite,
        sous_total: nouveauSousTotal
      });

      return {
        success: true,
        message: 'Quantité mise à jour avec succès',
        ancienne_quantite: ancienneQuantite,
        nouvelle_quantite: nouvelleQuantite,
        sous_total: nouveauSousTotal
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  };

  /**
   * Calculer le sous-total de cette ligne
   * @returns {number} - Sous-total de la ligne
   */
  LignePanier.prototype.calculerSousTotal = async function() {
    try {
      const produit = await this.getProduit();
      if (!produit) {
        return 0;
      }
      
      const sousTotal = this.quantite * parseFloat(produit.prix);
      
      // Mettre à jour le sous_total en base si différent
      if (this.sous_total !== sousTotal) {
        await this.update({ sous_total: sousTotal });
      }
      
      return sousTotal;
    } catch (error) {
      console.error('Erreur calcul sous-total:', error);
      return 0;
    }
  };

  /**
   * Obtenir les détails complets de la ligne
   * @returns {Object} - Détails de la ligne avec produit
   */
  LignePanier.prototype.obtenirDetails = async function() {
    try {
      const produit = await this.getProduit({
        include: [
          {
            model: sequelize.models.Boutique,
            as: 'boutique',
            attributes: ['id', 'nom']
          }, 
          {
            model: sequelize.models.Categorie,
            as: 'categorie',
            attributes: ['id', 'nom']
          },
          {
            model: sequelize.models.ImageProduit,
            as: 'images',
            where: { est_principale: true },
            required: false,
            limit: 1
          }
        ]
      });

      if (!produit) {
        throw new Error('Produit non trouvé');
      }

      // S'assurer que le sous_total est à jour
      const sousTotal = await this.calculerSousTotal();

      return {
        success: true,
        details: {
          ligne_id: this.id,
          produit: {
            id: produit.id,
            nom: produit.nom,
            description: produit.description,
            prix: parseFloat(produit.prix),
            stock: produit.stock,
            boutique: produit.boutique ? {
              id: produit.boutique.id,
              nom: produit.boutique.nom
            } : null,
            categorie: produit.categorie ? {
              id: produit.categorie.id,
              nom: produit.categorie.nom
            } : null,
            image_principale: produit.images && produit.images.length > 0 ? produit.images[0].url : null,
            statut_stock: produit.obtenirStatutStock ? produit.obtenirStatutStock() : null
          },
          quantite: this.quantite,
          sous_total: sousTotal,
          disponible: produit.verifierDisponibilite ? produit.verifierDisponibilite(this.quantite) : false,
          created_at: this.created_at,
          updated_at: this.updated_at
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
   * Vérifier si cette ligne est valide (stock suffisant)
   * @returns {Object} - Résultat de la vérification
   */
  LignePanier.prototype.verifierValidite = async function() {
    try {
      const produit = await this.getProduit();
      if (!produit) {
        return {
          success: false,
          est_valide: false,
          message: 'Produit non trouvé'
        };
      }

      if (produit.statut !== 'actif') {
        return {
          success: true,
          est_valide: false,
          message: `${produit.nom} n'est plus disponible`
        };
      }

      if (produit.stock === 0) {
        return {
          success: true,
          est_valide: false,
          message: `${produit.nom} est en rupture de stock`
        };
      }

      if (produit.stock < this.quantite) {
        return {
          success: true,
          est_valide: false,
          message: `${produit.nom}: stock insuffisant (disponible: ${produit.stock}, demandé: ${this.quantite})`
        };
      }

      return {
        success: true,
        est_valide: true,
        message: 'Ligne valide'
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  };

  /**
   * Augmenter la quantité de 1
   * @returns {Object} - Résultat de l'augmentation
   */
  LignePanier.prototype.incrementerQuantite = async function() {
    return await this.mettreAJourQuantite(this.quantite + 1);
  };

  /**
   * Diminuer la quantité de 1
   * @returns {Object} - Résultat de la diminution
   */
  LignePanier.prototype.decrementerQuantite = async function() {
    if (this.quantite <= 1) {
      return {
        success: false,
        message: 'Impossible de diminuer : quantité minimum atteinte. Supprimez la ligne si nécessaire.'
      };
    }
    
    return await this.mettreAJourQuantite(this.quantite - 1);
  };

  /**
   * Dupliquer cette ligne dans un autre panier
   * @param {number} nouveauPanierId - ID du panier de destination
   * @returns {Object} - Résultat de la duplication
   */
  LignePanier.prototype.dupliquerVers = async function(nouveauPanierId) {
    try {
      // Vérifier si le produit existe déjà dans le panier de destination
      const ligneExistante = await sequelize.models.LignePanier.findOne({
        where: {
          panier_id: nouveauPanierId,
          produit_id: this.produit_id
        }
      });

      if (ligneExistante) {
        // Additionner les quantités
        const nouvelleQuantite = ligneExistante.quantite + this.quantite;
        return await ligneExistante.mettreAJourQuantite(nouvelleQuantite);
      } else {
        // Créer une nouvelle ligne
        const produit = await this.getProduit();
        const sousTotal = this.quantite * parseFloat(produit.prix);
        
        const nouvelleLigne = await sequelize.models.LignePanier.create({
          panier_id: nouveauPanierId,
          produit_id: this.produit_id,
          quantite: this.quantite,
          sous_total: sousTotal
        });

        return {
          success: true,
          message: 'Ligne dupliquée avec succès',
          nouvelle_ligne_id: nouvelleLigne.id
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
   * Obtenir l'historique des modifications de cette ligne
   * @returns {Object} - Historique des modifications
   */
  LignePanier.prototype.obtenirHistorique = function() {
    return {
      success: true,
      historique: {
        ligne_id: this.id,
        panier_id: this.panier_id,
        produit_id: this.produit_id,
        date_creation: this.created_at,
        derniere_modification: this.updated_at,
        quantite_actuelle: this.quantite,
        sous_total_actuel: parseFloat(this.sous_total)
      }
    };
  };

  /**
   * Mettre à jour le sous-total basé sur le prix actuel du produit
   * @returns {Object} - Résultat de la mise à jour
   */
  LignePanier.prototype.actualiserSousTotal = async function() {
    try {
      const produit = await this.getProduit();
      if (!produit) {
        throw new Error('Produit non trouvé');
      }

      const nouveauSousTotal = this.quantite * parseFloat(produit.prix);
      
      if (this.sous_total !== nouveauSousTotal) {
        await this.update({ sous_total: nouveauSousTotal });
        
        return {
          success: true,
          message: 'Sous-total actualisé',
          ancien_sous_total: parseFloat(this.sous_total),
          nouveau_sous_total: nouveauSousTotal
        };
      }

      return {
        success: true,
        message: 'Sous-total déjà à jour',
        sous_total: nouveauSousTotal
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
   * Créer ou mettre à jour une ligne de panier
   * @param {number} panierId - ID du panier
   * @param {number} produitId - ID du produit
   * @param {number} quantite - Quantité
   * @returns {Object} - Ligne créée ou mise à jour
   */
  LignePanier.creerOuMettreAJour = async function(panierId, produitId, quantite) {
    try {
      // Vérifier que le produit existe et est disponible
      const produit = await sequelize.models.Produit.findByPk(produitId);
      if (!produit) {
        throw new Error('Produit non trouvé');
      }

      if (produit.statut !== 'actif') {
        throw new Error(`${produit.nom} n'est plus disponible`);
      }

      if (!produit.verifierDisponibilite(quantite)) {
        throw new Error(`Stock insuffisant pour ${produit.nom}`);
      }

      // Chercher une ligne existante
      let ligne = await this.findOne({
        where: {
          panier_id: panierId,
          produit_id: produitId
        }
      });

      if (ligne) {
        // Mettre à jour la ligne existante
        const nouvelleQuantite = ligne.quantite + quantite;
        
        if (!produit.verifierDisponibilite(nouvelleQuantite)) {
          throw new Error(`Stock insuffisant pour la quantité totale demandée`);
        }

        const nouveauSousTotal = nouvelleQuantite * parseFloat(produit.prix);
        await ligne.update({ 
          quantite: nouvelleQuantite,
          sous_total: nouveauSousTotal
        });
        
        return {
          success: true,
          action: 'mise_a_jour',
          message: 'Quantité mise à jour dans le panier',
          ligne
        };
      } else {
        // Créer une nouvelle ligne
        const sousTotal = quantite * parseFloat(produit.prix);
        ligne = await this.create({
          panier_id: panierId,
          produit_id: produitId,
          quantite: quantite,
          sous_total: sousTotal
        });

        return {
          success: true,
          action: 'creation',
          message: 'Produit ajouté au panier',
          ligne
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
   * Obtenir toutes les lignes d'un panier avec détails
   * @param {number} panierId - ID du panier
   * @returns {Object} - Lignes avec détails complets
   */
  LignePanier.obtenirLignesPanier = async function(panierId) {
    try {
      const lignes = await this.findAll({
        where: { panier_id: panierId },
        include: [{
          model: sequelize.models.Produit,
          as: 'produit',
          include: [
            {
              model: sequelize.models.Boutique,
              as: 'boutique',
              attributes: ['id', 'nom']
            }, 
            {
              model: sequelize.models.Categorie,
              as: 'categorie',
              attributes: ['id', 'nom']
            },
            {
              model: sequelize.models.ImageProduit,
              as: 'images',
              where: { est_principale: true },
              required: false,
              limit: 1
            }
          ]
        }],
        order: [['created_at', 'ASC']]
      });

      const lignesDetaillees = [];
      let totalPanier = 0;
      let lignesValides = 0;

      for (const ligne of lignes) {
        // Actualiser le sous-total si nécessaire
        const sousTotal = ligne.quantite * parseFloat(ligne.produit.prix);
        if (ligne.sous_total !== sousTotal) {
          await ligne.update({ sous_total: sousTotal });
        }

        totalPanier += sousTotal;
        
        const estDisponible = ligne.produit.verifierDisponibilite ? 
          ligne.produit.verifierDisponibilite(ligne.quantite) : false;
        
        if (estDisponible) {
          lignesValides++;
        }

        lignesDetaillees.push({
          id: ligne.id,
          quantite: ligne.quantite,
          sous_total: sousTotal,
          produit: {
            id: ligne.produit.id,
            nom: ligne.produit.nom,
            description: ligne.produit.description,
            prix: parseFloat(ligne.produit.prix),
            stock: ligne.produit.stock,
            statut: ligne.produit.statut,
            boutique: ligne.produit.boutique ? {
              id: ligne.produit.boutique.id,
              nom: ligne.produit.boutique.nom
            } : null,
            categorie: ligne.produit.categorie ? {
              id: ligne.produit.categorie.id,
              nom: ligne.produit.categorie.nom
            } : null,
            image_principale: ligne.produit.images && ligne.produit.images.length > 0 ? 
              ligne.produit.images[0].url : null
          },
          est_disponible: estDisponible,
          statut_stock: ligne.produit.obtenirStatutStock ? ligne.produit.obtenirStatutStock() : null
        });
      }

      return {
        success: true,
        lignes: lignesDetaillees,
        resume: {
          nombre_lignes: lignes.length,
          lignes_valides: lignesValides,
          lignes_invalides: lignes.length - lignesValides,
          total_articles: lignes.reduce((sum, l) => sum + l.quantite, 0),
          total_panier: Math.round(totalPanier * 100) / 100
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
   * Nettoyer les lignes invalides (produits supprimés, etc.)
   * @param {number} panierId - ID du panier (optionnel)
   * @returns {Object} - Résultat du nettoyage
   */
  LignePanier.nettoyerLignesInvalides = async function(panierId = null) {
    try {
      const whereClause = panierId ? { panier_id: panierId } : {};
      
      // Trouver les lignes dont le produit n'existe plus ou est inactif
      const lignesInvalides = await this.findAll({
        where: whereClause,
        include: [{
          model: sequelize.models.Produit,
          as: 'produit',
          required: false // LEFT JOIN pour trouver les produits manquants
        }]
      });

      const lignesASupprimer = lignesInvalides.filter(ligne => 
        !ligne.produit || ligne.produit.statut !== 'actif'
      );
      
      if (lignesASupprimer.length > 0) {
        await this.destroy({
          where: {
            id: { [sequelize.Sequelize.Op.in]: lignesASupprimer.map(l => l.id) }
          }
        });
      }

      return {
        success: true,
        lignes_supprimees: lignesASupprimer.length,
        message: `${lignesASupprimer.length} ligne${lignesASupprimer.length > 1 ? 's' : ''} invalide${lignesASupprimer.length > 1 ? 's' : ''} supprimée${lignesASupprimer.length > 1 ? 's' : ''}`
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  };

  /**
   * Actualiser tous les sous-totaux d'un panier
   * @param {number} panierId - ID du panier
   * @returns {Object} - Résultat de l'actualisation
   */
  LignePanier.actualiserTousLesSousTotaux = async function(panierId) {
    try {
      const lignes = await this.findAll({
        where: { panier_id: panierId },
        include: [{
          model: sequelize.models.Produit,
          as: 'produit'
        }]
      });

      let lignesMisesAJour = 0;

      for (const ligne of lignes) {
        if (ligne.produit) {
          const nouveauSousTotal = ligne.quantite * parseFloat(ligne.produit.prix);
          if (ligne.sous_total !== nouveauSousTotal) {
            await ligne.update({ sous_total: nouveauSousTotal });
            lignesMisesAJour++;
          }
        }
      }

      return {
        success: true,
        message: `${lignesMisesAJour} sous-total${lignesMisesAJour > 1 ? 'aux' : ''} mis à jour`,
        lignes_mises_a_jour: lignesMisesAJour
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  };

  /**
   * Obtenir les statistiques des lignes de panier
   * @param {Object} options - Options de filtrage
   * @returns {Object} - Statistiques détaillées
   */
  LignePanier.obtenirStatistiques = async function(options = {}) {
    try {
      const whereClause = {};
      
      if (options.dateDebut && options.dateFin) {
        whereClause.created_at = {
          [sequelize.Sequelize.Op.between]: [options.dateDebut, options.dateFin]
        };
      }

      const statistiques = await this.findAll({
        where: whereClause,
        attributes: [
          [sequelize.fn('COUNT', sequelize.col('id')), 'total_lignes'],
          [sequelize.fn('SUM', sequelize.col('quantite')), 'total_articles'],
          [sequelize.fn('SUM', sequelize.col('sous_total')), 'total_montant'],
          [sequelize.fn('AVG', sequelize.col('quantite')), 'quantite_moyenne'],
          [sequelize.fn('AVG', sequelize.col('sous_total')), 'sous_total_moyen']
        ],
        raw: true
      });

      const stats = statistiques[0];

      return {
        success: true,
        statistiques: {
          total_lignes: parseInt(stats.total_lignes) || 0,
          total_articles: parseInt(stats.total_articles) || 0,
          total_montant: parseFloat(stats.total_montant) || 0,
          quantite_moyenne: parseFloat(stats.quantite_moyenne) || 0,
          sous_total_moyen: parseFloat(stats.sous_total_moyen) || 0
        }
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  };

  // ==================== HOOKS ====================
  
  // Hook avant création pour vérifier les contraintes
  LignePanier.addHook('beforeCreate', async (lignePanier) => {
    const produit = await sequelize.models.Produit.findByPk(lignePanier.produit_id);
    if (!produit) {
      throw new Error('Produit non trouvé');
    }
    
    if (produit.statut !== 'actif') {
      throw new Error(`${produit.nom} n'est plus disponible`);
    }
    
    if (!produit.verifierDisponibilite(lignePanier.quantite)) {
      throw new Error(`Stock insuffisant pour ${produit.nom}`);
    }

    // Calculer le sous_total si pas défini
    if (!lignePanier.sous_total) {
      lignePanier.sous_total = lignePanier.quantite * parseFloat(produit.prix);
    }
  });

  // Hook avant mise à jour pour vérifier les contraintes
  LignePanier.addHook('beforeUpdate', async (lignePanier) => {
    if (lignePanier.changed('quantite') || lignePanier.changed('produit_id')) {
      const produit = await sequelize.models.Produit.findByPk(lignePanier.produit_id);
      if (!produit) {
        throw new Error('Produit non trouvé');
      }
      
      if (produit.statut !== 'actif') {
        throw new Error(`${produit.nom} n'est plus disponible`);
      }
      
      if (!produit.verifierDisponibilite(lignePanier.quantite)) {
        throw new Error(`Stock insuffisant pour ${produit.nom}`);
      }

      // Recalculer le sous_total
      lignePanier.sous_total = lignePanier.quantite * parseFloat(produit.prix);
    }
  });

  // ==================== ASSOCIATIONS ====================
  LignePanier.associate = function(models) {
    // Une ligne appartient à un panier
    LignePanier.belongsTo(models.Panier, {
      foreignKey: 'panier_id',
      as: 'panier'
    });

    // Une ligne référence un produit
    LignePanier.belongsTo(models.Produit, {
      foreignKey: 'produit_id',
      as: 'produit'
    });
  };

  return LignePanier;
};