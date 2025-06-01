// models/panier.js
module.exports = (sequelize, DataTypes) => {
  const Panier = sequelize.define('Panier', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    client_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    date_creation: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    // CORRIGÉ: Statuts harmonisés avec les autres classes
    statut: {
      type: DataTypes.ENUM('actif', 'valide', 'expedie', 'livre', 'annule'),
      defaultValue: 'actif',
      allowNull: false
    },
    total: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.00,
      validate: {
        min: 0,
        isDecimal: true
      }
    },
    adresse_livraison: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        len: [10, 500]
      }
    },
    // AJOUTÉ: Propriétés manquantes
    date_validation: {
      type: DataTypes.DATE,
      allowNull: true
    },
    mode_paiement: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    date_annulation: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'paniers',
    timestamps: true,
    underscored: true
  });

  // ==================== MÉTHODES D'INSTANCE ====================

  /**
   * Calculer le total du panier
   * @returns {Object} - Total et détails du panier
   */
  Panier.prototype.calculerTotal = async function() {
    try {
      const lignes = await this.getLignes({
        include: [{
          model: sequelize.models.Produit,
          as: 'produit'
        }]
      });

      let total = 0;
      let nombreArticles = 0;
      const details = [];

      for (const ligne of lignes) {
        const sousTotal = ligne.quantite * parseFloat(ligne.produit.prix);
        total += sousTotal;
        nombreArticles += ligne.quantite;

        // Mettre à jour le sous_total de la ligne si nécessaire
        if (ligne.sous_total !== sousTotal) {
          await ligne.update({ sous_total: sousTotal });
        }

        details.push({
          produit_id: ligne.produit_id,
          nom_produit: ligne.produit.nom,
          prix_unitaire: parseFloat(ligne.produit.prix),
          quantite: ligne.quantite,
          sous_total: sousTotal
        });
      }

      const totalFinal = Math.round(total * 100) / 100;
      
      // Mettre à jour le champ total en base
      if (this.total !== totalFinal) {
        await this.update({ total: totalFinal });
      }

      return {
        success: true,
        total: totalFinal,
        nombre_articles: nombreArticles,
        nombre_lignes: lignes.length,
        details
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
   * @param {number} produitId - ID du produit
   * @param {number} quantite - Quantité à ajouter
   * @returns {Object} - Résultat de l'ajout
   */
  Panier.prototype.ajouterProduit = async function(produitId, quantite = 1) {
    try {
      // Vérifier si c'est encore un panier actif
      if (this.statut !== 'actif') {
        throw new Error('Impossible de modifier un panier validé');
      }

      if (quantite <= 0) {
        throw new Error('La quantité doit être positive');
      }

      // Vérifier que le produit existe et est disponible
      const produit = await sequelize.models.Produit.findByPk(produitId);
      if (!produit) {
        throw new Error('Produit non trouvé');
      }

      if (!produit.verifierDisponibilite(quantite)) {
        throw new Error(`Stock insuffisant. Disponible: ${produit.stock}, Demandé: ${quantite}`);
      }

      // Vérifier si le produit est déjà dans le panier
      let lignePanier = await sequelize.models.LignePanier.findOne({
        where: {
          panier_id: this.id,
          produit_id: produitId
        }
      });

      if (lignePanier) {
        // Mettre à jour la quantité existante
        const nouvelleQuantite = lignePanier.quantite + quantite;
        
        if (!produit.verifierDisponibilite(nouvelleQuantite)) {
          throw new Error(`Stock insuffisant pour cette quantité. Disponible: ${produit.stock}, Total demandé: ${nouvelleQuantite}`);
        }

        const nouveauSousTotal = nouvelleQuantite * parseFloat(produit.prix);
        await lignePanier.update({ 
          quantite: nouvelleQuantite,
          sous_total: nouveauSousTotal
        });
        
        // Recalculer le total
        await this.calculerTotal();
        
        return {
          success: true,
          message: 'Quantité mise à jour dans le panier',
          ligne: {
            id: lignePanier.id,
            produit_nom: produit.nom,
            quantite: nouvelleQuantite,
            prix_unitaire: parseFloat(produit.prix),
            sous_total: nouveauSousTotal
          }
        };
      } else {
        // Créer une nouvelle ligne de panier
        const sousTotal = quantite * parseFloat(produit.prix);
        lignePanier = await sequelize.models.LignePanier.create({
          panier_id: this.id,
          produit_id: produitId,
          quantite: quantite,
          sous_total: sousTotal
        });

        // Recalculer le total
        await this.calculerTotal();

        return {
          success: true,
          message: 'Produit ajouté au panier',
          ligne: {
            id: lignePanier.id,
            produit_nom: produit.nom,
            quantite: quantite,
            prix_unitaire: parseFloat(produit.prix),
            sous_total: sousTotal
          }
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
   * Retirer un produit du panier
   * @param {number} ligneId - ID de la ligne de panier à retirer
   * @returns {Object} - Résultat de la suppression
   */
  Panier.prototype.retirerLigne = async function(ligneId) {
    try {
      // Vérifier si c'est encore un panier actif
      if (this.statut !== 'actif') {
        throw new Error('Impossible de modifier un panier validé');
      }

      const lignePanier = await sequelize.models.LignePanier.findOne({
        where: {
          id: ligneId,
          panier_id: this.id
        },
        include: [{
          model: sequelize.models.Produit,
          as: 'produit'
        }]
      });

      if (!lignePanier) {
        throw new Error('Ligne de panier non trouvée');
      }

      const nomProduit = lignePanier.produit.nom;
      await lignePanier.destroy();

      // Recalculer le total
      await this.calculerTotal();

      return {
        success: true,
        message: `${nomProduit} retiré du panier`
      };
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
  Panier.prototype.modifierQuantiteLigne = async function(ligneId, nouvelleQuantite) {
    try {
      // Vérifier si c'est encore un panier actif
      if (this.statut !== 'actif') {
        throw new Error('Impossible de modifier un panier validé');
      }

      if (nouvelleQuantite < 0) {
        throw new Error('La quantité ne peut pas être négative');
      }

      if (nouvelleQuantite === 0) {
        return await this.retirerLigne(ligneId);
      }

      const lignePanier = await sequelize.models.LignePanier.findOne({
        where: {
          id: ligneId,
          panier_id: this.id
        },
        include: [{
          model: sequelize.models.Produit,
          as: 'produit'
        }]
      });

      if (!lignePanier) {
        throw new Error('Ligne de panier non trouvée');
      }

      // Vérifier la disponibilité
      if (!lignePanier.produit.verifierDisponibilite(nouvelleQuantite)) {
        throw new Error(`Stock insuffisant. Disponible: ${lignePanier.produit.stock}, Demandé: ${nouvelleQuantite}`);
      }

      const nouveauSousTotal = nouvelleQuantite * parseFloat(lignePanier.produit.prix);
      await lignePanier.update({ 
        quantite: nouvelleQuantite,
        sous_total: nouveauSousTotal
      });

      // Recalculer le total
      await this.calculerTotal();

      return {
        success: true,
        message: 'Quantité mise à jour',
        ligne: {
          id: lignePanier.id,
          produit_nom: lignePanier.produit.nom,
          nouvelle_quantite: nouvelleQuantite,
          prix_unitaire: parseFloat(lignePanier.produit.prix),
          sous_total: nouveauSousTotal
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
   * Vider complètement le panier
   * @returns {Object} - Résultat de la suppression
   */
  Panier.prototype.vider = async function() {
    try {
      // Vérifier si c'est encore un panier actif
      if (this.statut !== 'actif') {
        throw new Error('Impossible de vider un panier validé');
      }

      const nombreLignes = await sequelize.models.LignePanier.count({
        where: { panier_id: this.id }
      });

      await sequelize.models.LignePanier.destroy({
        where: { panier_id: this.id }
      });

      // Remettre le total à zéro
      await this.update({ total: 0.00 });

      return {
        success: true,
        message: `Panier vidé (${nombreLignes} article${nombreLignes > 1 ? 's' : ''} supprimé${nombreLignes > 1 ? 's' : ''})`
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  };

  /**
   * Valider le panier (transformer en commande)
   * @param {Object} infosLivraison - Informations de livraison et paiement
   * @returns {Object} - Résultat de la validation
   */
  Panier.prototype.valider = async function(infosLivraison = {}) {
    const transaction = await sequelize.transaction();
    
    try {
      if (this.statut !== 'actif') {
        throw new Error('Seuls les paniers actifs peuvent être validés');
      }

      // Vérifier que le panier n'est pas vide
      const lignes = await this.getLignes({
        include: [{
          model: sequelize.models.Produit,
          as: 'produit'
        }]
      });

      if (lignes.length === 0) {
        throw new Error('Impossible de valider un panier vide');
      }

      // Vérifier la validité du panier
      const validite = await this.verifierValidite();
      if (!validite.est_valide) {
        throw new Error(`Panier invalide: ${validite.erreurs.join(', ')}`);
      }

      // Valider l'adresse de livraison
      if (!infosLivraison.adresse_livraison || infosLivraison.adresse_livraison.length < 10) {
        throw new Error('Adresse de livraison invalide (minimum 10 caractères)');
      }

      // Réserver le stock des produits
      for (const ligne of lignes) {
        const produit = ligne.produit;
        const resultatReservation = await produit.reserverStock(ligne.quantite);
        if (!resultatReservation.success) {
          throw new Error(`Erreur réservation stock ${produit.nom}: ${resultatReservation.message}`);
        }
      }

      // Calculer le total final
      const calculTotal = await this.calculerTotal();
      if (!calculTotal.success) {
        throw new Error('Erreur lors du calcul du total');
      }

      // Valider le panier
      await this.update({
        statut: 'valide',
        date_validation: new Date(),
        adresse_livraison: infosLivraison.adresse_livraison,
        mode_paiement: infosLivraison.mode_paiement || null,
        total: calculTotal.total
      }, { transaction });

      // Mettre à jour les statistiques de vente
      if (sequelize.models.StatistiqueVente.mettreAJourApresVente) {
        // Grouper par vendeur
        const ventesParVendeur = {};
        for (const ligne of lignes) {
          const boutique = await ligne.produit.getBoutique();
          const vendeurId = boutique.vendeur_id;
          
          if (!ventesParVendeur[vendeurId]) {
            ventesParVendeur[vendeurId] = 0;
          }
          ventesParVendeur[vendeurId] += ligne.sous_total;
        }

        // Mettre à jour les statistiques
        for (const [vendeurId, montant] of Object.entries(ventesParVendeur)) {
          await sequelize.models.StatistiqueVente.mettreAJourApresVente(
            parseInt(vendeurId), 
            montant
          );
        }
      }

      await transaction.commit();

      return {
        success: true,
        message: 'Panier validé avec succès',
        panier_valide: {
          id: this.id,
          statut: this.statut,
          total: this.total,
          date_validation: this.date_validation,
          adresse_livraison: this.adresse_livraison,
          mode_paiement: this.mode_paiement
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
   * Modifier le statut du panier/commande
   * @param {string} nouveauStatut - Nouveau statut
   * @returns {Object} - Résultat de la modification
   */
  Panier.prototype.modifierStatut = async function(nouveauStatut) {
    try {
      const statutsAutorises = ['actif', 'valide', 'expedie', 'livre', 'annule'];
      if (!statutsAutorises.includes(nouveauStatut)) {
        throw new Error('Statut non autorisé');
      }

      // Vérifications des transitions de statut
      const transitionsAutorisees = {
        'actif': ['valide', 'annule'],
        'valide': ['expedie', 'annule'],
        'expedie': ['livre'],
        'livre': [], // Terminal
        'annule': [] // Terminal
      };

      if (!transitionsAutorisees[this.statut].includes(nouveauStatut)) {
        throw new Error(`Transition de ${this.statut} vers ${nouveauStatut} non autorisée`);
      }

      const ancienStatut = this.statut;
      const donneesUpdate = { statut: nouveauStatut };

      // Gérer les cas spéciaux
      if (nouveauStatut === 'annule') {
        donneesUpdate.date_annulation = new Date();
        
        // Libérer le stock si la commande était validée
        if (['valide', 'expedie'].includes(ancienStatut)) {
          const lignes = await this.getLignes({
            include: [{
              model: sequelize.models.Produit,
              as: 'produit'
            }]
          });

          for (const ligne of lignes) {
            await ligne.produit.libererStock(ligne.quantite);
          }
        }
      }

      await this.update(donneesUpdate);

      return {
        success: true,
        message: `Statut changé de ${ancienStatut} vers ${nouveauStatut}`,
        ancien_statut: ancienStatut,
        nouveau_statut: nouveauStatut
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  };

  /**
   * Vérifier la validité du panier (stocks disponibles)
   * @returns {Object} - Résultat de la vérification
   */
  Panier.prototype.verifierValidite = async function() {
    try {
      const lignes = await this.getLignes({
        include: [{
          model: sequelize.models.Produit,
          as: 'produit'
        }]
      });

      const erreurs = [];
      const avertissements = [];

      for (const ligne of lignes) {
        const produit = ligne.produit;
        
        if (!produit) {
          erreurs.push(`Produit ID ${ligne.produit_id} non trouvé`);
          continue;
        }

        if (produit.statut !== 'actif') {
          erreurs.push(`${produit.nom} n'est plus disponible`);
          continue;
        }

        if (produit.stock === 0) {
          erreurs.push(`${produit.nom} est en rupture de stock`);
        } else if (produit.stock < ligne.quantite) {
          erreurs.push(`${produit.nom}: stock insuffisant (disponible: ${produit.stock}, demandé: ${ligne.quantite})`);
        } else if (produit.estStockCritique && typeof produit.estStockCritique === 'function' && produit.estStockCritique()) {
          avertissements.push(`${produit.nom}: stock faible (${produit.stock} restant${produit.stock > 1 ? 's' : ''})`);
        }
      }

      return {
        success: erreurs.length === 0,
        est_valide: erreurs.length === 0,
        erreurs,
        avertissements,
        message: erreurs.length === 0 ? 'Panier valide' : `${erreurs.length} erreur${erreurs.length > 1 ? 's' : ''} trouvée${erreurs.length > 1 ? 's' : ''}`
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  };

  /**
   * Obtenir un résumé complet du panier
   * @returns {Object} - Résumé détaillé
   */
  Panier.prototype.obtenirResume = async function() {
    try {
      const calculTotal = await this.calculerTotal();
      const validite = await this.verifierValidite();

      if (!calculTotal.success) {
        throw new Error('Erreur lors du calcul du total');
      }

      return {
        success: true,
        resume: {
          panier_id: this.id,
          client_id: this.client_id,
          date_creation: this.date_creation,
          statut: this.statut,
          statut_libelle: this.getStatutLibelle(),
          total: calculTotal.total,
          nombre_articles: calculTotal.nombre_articles,
          nombre_lignes: calculTotal.nombre_lignes,
          est_valide: validite.est_valide,
          erreurs: validite.erreurs,
          avertissements: validite.avertissements,
          articles: calculTotal.details,
          adresse_livraison: this.adresse_livraison,
          mode_paiement: this.mode_paiement,
          date_validation: this.date_validation,
          date_annulation: this.date_annulation
        }
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  };

  // ==================== MÉTHODES UTILITAIRES ====================

  /**
   * Vérifier si c'est encore un panier (modifiable)
   * @returns {boolean}
   */
  Panier.prototype.estActif = function() {
    return this.statut === 'actif';
  };

  /**
   * Vérifier si c'est une commande
   * @returns {boolean}
   */
  Panier.prototype.estCommande = function() {
    return this.statut !== 'actif';
  };

  /**
   * Obtenir le libellé du statut
   * @returns {string}
   */
  Panier.prototype.getStatutLibelle = function() {
    const libelles = {
      'actif': 'Panier',
      'valide': 'Commande validée',
      'expedie': 'Expédiée',
      'livre': 'Livrée',
      'annule': 'Annulée'
    };
    return libelles[this.statut] || this.statut;
  };

  // ==================== MÉTHODES STATIQUES ====================

  /**
   * Créer ou récupérer le panier actif d'un client
   * @param {number} clientId - ID du client
   * @returns {Object} - Panier du client
   */
  Panier.obtenirPanierActif = async function(clientId) {
    try {
      // Chercher uniquement les paniers actifs
      let panier = await this.findOne({
        where: { 
          client_id: clientId,
          statut: 'actif'
        },
        include: [{
          model: sequelize.models.LignePanier,
          as: 'lignes',
          include: [{
            model: sequelize.models.Produit,
            as: 'produit',
            include: [{
              model: sequelize.models.ImageProduit,
              as: 'images',
              where: { est_principale: true },
              required: false,
              limit: 1
            }]
          }]
        }]
      });

      if (!panier) {
        panier = await this.create({
          client_id: clientId,
          date_creation: new Date(),
          statut: 'actif'
        });
        
        // Recharger avec les relations
        panier = await this.findByPk(panier.id, {
          include: [{
            model: sequelize.models.LignePanier,
            as: 'lignes',
            include: [{
              model: sequelize.models.Produit,
              as: 'produit'
            }]
          }]
        });
      }

      return {
        success: true,
        panier
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  };

  /**
   * Obtenir l'historique des commandes d'un client
   * @param {number} clientId - ID du client
   * @param {Object} options - Options de filtrage
   * @returns {Object} - Historique des commandes
   */
  Panier.obtenirHistoriqueCommandes = async function(clientId, options = {}) {
    try {
      const whereClause = { 
        client_id: clientId,
        statut: { 
          [sequelize.Sequelize.Op.ne]: 'actif' 
        }
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

      const commandes = await this.findAll({
        where: whereClause,
        include: [{
          model: sequelize.models.LignePanier,
          as: 'lignes',
          include: [{
            model: sequelize.models.Produit,
            as: 'produit',
            include: [{
              model: sequelize.models.ImageProduit,
              as: 'images',
              where: { est_principale: true },
              required: false,
              limit: 1
            }]
          }]
        }],
        order: [['date_validation', 'DESC']],
        limit: options.limit || 50
      });

      return {
        success: true,
        commandes: commandes.map(commande => ({
          id: commande.id,
          statut: commande.statut,
          statut_libelle: commande.getStatutLibelle(),
          total: parseFloat(commande.total),
          date_creation: commande.date_creation,
          date_validation: commande.date_validation,
          adresse_livraison: commande.adresse_livraison,
          mode_paiement: commande.mode_paiement,
          nombre_articles: commande.lignes.reduce((sum, ligne) => sum + ligne.quantite, 0),
          articles: commande.lignes.map(ligne => ({
            id: ligne.id,
            quantite: ligne.quantite,
            sous_total: parseFloat(ligne.sous_total),
            produit: {
              id: ligne.produit.id,
              nom: ligne.produit.nom,
              prix: parseFloat(ligne.produit.prix),
              image: ligne.produit.images.length > 0 ? ligne.produit.images[0].url : null
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
   * Obtenir un panier/commande par ID
   * @param {number} panierId - ID du panier
   * @returns {Object} - Panier trouvé
   */
  Panier.obtenirParId = async function(panierId) {
    try {
      const panier = await this.findByPk(panierId, {
        include: [{
          model: sequelize.models.LignePanier,
          as: 'lignes',
          include: [{
            model: sequelize.models.Produit,
            as: 'produit',
            include: [{
              model: sequelize.models.ImageProduit,
              as: 'images',
              where: { est_principale: true },
              required: false,
              limit: 1
            }]
          }]
        }]
      });

      if (!panier) {
        return {
          success: false,
          message: 'Panier non trouvé'
        };
      }

      return await panier.obtenirResume();
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  };

  /**
   * Obtenir les commandes pour un vendeur
   * @param {number} vendeurId - ID du vendeur
   * @param {Object} options - Options de filtrage
   * @returns {Object} - Commandes du vendeur
   */
  Panier.obtenirCommandesVendeur = async function(vendeurId, options = {}) {
    try {
      const whereClause = {
        statut: ['valide', 'expedie', 'livre', 'annule']
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

      const commandes = await this.findAll({
        where: whereClause,
        include: [{
          model: sequelize.models.LignePanier,
          as: 'lignes',
          include: [{
            model: sequelize.models.Produit,
            as: 'produit',
            include: [{
              model: sequelize.models.Boutique,
              as: 'boutique',
              where: { vendeur_id: vendeurId }
            }]
          }]
        }, {
          model: sequelize.models.Client,
          as: 'client',
          include: [{
            model: sequelize.models.Utilisateur,
            as: 'utilisateur'
          }]
        }],
        order: [['date_validation', 'DESC']],
        limit: options.limit || 50
      });

      // Filtrer pour ne garder que les commandes contenant des produits du vendeur
      const commandesVendeur = commandes.filter(commande => 
        commande.lignes.some(ligne => ligne.produit && ligne.produit.boutique)
      );

      return {
        success: true,
        commandes: commandesVendeur.map(commande => ({
          id: commande.id,
          statut: commande.statut,
          statut_libelle: commande.getStatutLibelle(),
          date_validation: commande.date_validation,
          adresse_livraison: commande.adresse_livraison,
          mode_paiement: commande.mode_paiement,
          client: {
            nom: commande.client.utilisateur.nom,
            email: commande.client.utilisateur.email
          },
          total_vendeur: commande.lignes
            .filter(ligne => ligne.produit && ligne.produit.boutique)
            .reduce((sum, ligne) => sum + parseFloat(ligne.sous_total), 0),
          articles: commande.lignes
            .filter(ligne => ligne.produit && ligne.produit.boutique)
            .map(ligne => ({
              id: ligne.id,
              nom: ligne.produit.nom,
              quantite: ligne.quantite,
              prix_unitaire: parseFloat(ligne.produit.prix),
              sous_total: parseFloat(ligne.sous_total)
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
   * Rechercher des paniers/commandes par critères
   * @param {Object} criteres - Critères de recherche
   * @returns {Object} - Résultats de la recherche
   */
  Panier.rechercherPaniers = async function(criteres = {}) {
    try {
      const whereClause = {};
      const includeClause = [];

      // Filtrer par statut
      if (criteres.statut) {
        whereClause.statut = criteres.statut;
      }

      // Filtrer par client
      if (criteres.client_id) {
        whereClause.client_id = criteres.client_id;
      }

      // Filtrer par période
      if (criteres.dateDebut && criteres.dateFin) {
        if (criteres.statut === 'actif') {
          whereClause.date_creation = {
            [sequelize.Sequelize.Op.between]: [criteres.dateDebut, criteres.dateFin]
          };
        } else {
          whereClause.date_validation = {
            [sequelize.Sequelize.Op.between]: [criteres.dateDebut, criteres.dateFin]
          };
        }
      }

      // Filtrer par montant
      if (criteres.montantMin || criteres.montantMax) {
        whereClause.total = {};
        if (criteres.montantMin) whereClause.total[sequelize.Sequelize.Op.gte] = criteres.montantMin;
        if (criteres.montantMax) whereClause.total[sequelize.Sequelize.Op.lte] = criteres.montantMax;
      }

      // Inclure les relations
      includeClause.push({
        model: sequelize.models.Client,
        as: 'client',
        include: [{
          model: sequelize.models.Utilisateur,
          as: 'utilisateur'
        }]
      });

      if (criteres.inclureLignes) {
        includeClause.push({
          model: sequelize.models.LignePanier,
          as: 'lignes',
          include: [{
            model: sequelize.models.Produit,
            as: 'produit'
          }]
        });
      }

      // Tri
      let orderClause = [['date_creation', 'DESC']];
      if (criteres.tri === 'total_asc') orderClause = [['total', 'ASC']];
      if (criteres.tri === 'total_desc') orderClause = [['total', 'DESC']];
      if (criteres.tri === 'date_asc') orderClause = [['date_creation', 'ASC']];

      // Pagination
      const page = criteres.page || 1;
      const limit = criteres.limit || 20;
      const offset = (page - 1) * limit;

      const { count, rows: paniers } = await this.findAndCountAll({
        where: whereClause,
        include: includeClause,
        order: orderClause,
        limit: limit,
        offset: offset,
        distinct: true
      });

      return {
        success: true,
        paniers: paniers.map(p => ({
          id: p.id,
          statut: p.statut,
          statut_libelle: p.getStatutLibelle(),
          total: parseFloat(p.total),
          date_creation: p.date_creation,
          date_validation: p.date_validation,
          client: {
            nom: p.client.utilisateur.nom,
            email: p.client.utilisateur.email
          },
          nombre_articles: criteres.inclureLignes ? 
            p.lignes.reduce((sum, ligne) => sum + ligne.quantite, 0) : null
        })),
        pagination: {
          page: page,
          limit: limit,
          total: count,
          total_pages: Math.ceil(count / limit)
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
   * Obtenir les statistiques globales des paniers/commandes
   * @param {Object} options - Options de période
   * @returns {Object} - Statistiques globales
   */
  Panier.obtenirStatistiquesGlobales = async function(options = {}) {
    try {
      const dateDebut = options.dateDebut || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const dateFin = options.dateFin || new Date();

      // Statistiques par statut
      const statistiquesParStatut = await this.findAll({
        where: {
          date_creation: {
            [sequelize.Sequelize.Op.between]: [dateDebut, dateFin]
          }
        },
        attributes: [
          'statut',
          [sequelize.fn('COUNT', sequelize.col('id')), 'nombre'],
          [sequelize.fn('SUM', sequelize.col('total')), 'total_montant'],
          [sequelize.fn('AVG', sequelize.col('total')), 'montant_moyen']
        ],
        group: ['statut'],
        raw: true
      });

      // Évolution journalière
      const evolutionJournaliere = await this.findAll({
        where: {
          statut: { [sequelize.Sequelize.Op.ne]: 'actif' },
          date_validation: {
            [sequelize.Sequelize.Op.between]: [dateDebut, dateFin]
          }
        },
        attributes: [
          [sequelize.fn('DATE', sequelize.col('date_validation')), 'date'],
          [sequelize.fn('COUNT', sequelize.col('id')), 'commandes'],
          [sequelize.fn('SUM', sequelize.col('total')), 'chiffre_affaires']
        ],
        group: [sequelize.fn('DATE', sequelize.col('date_validation'))],
        order: [[sequelize.fn('DATE', sequelize.col('date_validation')), 'ASC']],
        raw: true
      });

      // Statistiques globales
      const totaux = statistiquesParStatut.reduce((acc, stat) => {
        acc.total_paniers += parseInt(stat.nombre) || 0;
        acc.total_montant += parseFloat(stat.total_montant) || 0;
        return acc;
      }, { total_paniers: 0, total_montant: 0 });

      return {
        success: true,
        periode: {
          debut: dateDebut.toISOString().split('T')[0],
          fin: dateFin.toISOString().split('T')[0]
        },
        statistiques: {
          global: {
            total_paniers: totaux.total_paniers,
            total_montant: Math.round(totaux.total_montant * 100) / 100,
            montant_moyen: totaux.total_paniers > 0 ? 
              Math.round((totaux.total_montant / totaux.total_paniers) * 100) / 100 : 0
          },
          par_statut: statistiquesParStatut.map(stat => ({
            statut: stat.statut,
            nombre: parseInt(stat.nombre) || 0,
            total_montant: parseFloat(stat.total_montant) || 0,
            montant_moyen: parseFloat(stat.montant_moyen) || 0
          })),
          evolution_journaliere: evolutionJournaliere.map(jour => ({
            date: jour.date,
            commandes: parseInt(jour.commandes) || 0,
            chiffre_affaires: parseFloat(jour.chiffre_affaires) || 0
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
   * Nettoyer les paniers abandonnés (anciens paniers actifs)
   * @param {number} joursInactivite - Nombre de jours d'inactivité
   * @returns {Object} - Résultat du nettoyage
   */
  Panier.nettoyerPaniersAbandonnes = async function(joursInactivite = 30) {
    try {
      const dateLimit = new Date();
      dateLimit.setDate(dateLimit.getDate() - joursInactivite);

      const paniersAbandonnes = await this.findAll({
        where: {
          statut: 'actif',
          date_creation: {
            [sequelize.Sequelize.Op.lt]: dateLimit
          }
        }
      });

      let nombreNettoyes = 0;
      
      for (const panier of paniersAbandonnes) {
        // Vider le panier abandonné
        await sequelize.models.LignePanier.destroy({
          where: { panier_id: panier.id }
        });
        
        // Supprimer le panier
        await panier.destroy();
        nombreNettoyes++;
      }

      return {
        success: true,
        message: `${nombreNettoyes} panier(s) abandonné(s) nettoyé(s)`,
        nombre_nettoyes: nombreNettoyes,
        date_limite: dateLimit
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  };

  // ==================== ASSOCIATIONS ====================
  Panier.associate = function(models) {
    // Un panier appartient à un client
    Panier.belongsTo(models.Client, {
      foreignKey: 'client_id',
      as: 'client'
    });

    // Un panier contient plusieurs lignes
    Panier.hasMany(models.LignePanier, {
      foreignKey: 'panier_id',
      as: 'lignes'
    });
  };

  return Panier;
};