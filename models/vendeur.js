// models/vendeur.js
module.exports = (sequelize, DataTypes) => {
  const Vendeur = sequelize.define('Vendeur', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false
    },
    numero_fiscal: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    grade_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 1 // Grade Bronze par défaut
    }
  }, {
    tableName: 'vendeurs',
    timestamps: true,
    underscored: true
  });

  // ==================== MÉTHODES D'INSTANCE ====================

  /**
   * Obtenir le profil complet du vendeur
   * @returns {Object} - Profil complet avec données utilisateur
   */
  Vendeur.prototype.obtenirProfilComplet = async function() {
    try {
      const utilisateur = await this.getUtilisateur();
      const grade = await this.getGrade();
      
      return {
        success: true,
        profil: {
          id: this.id,
          nom: utilisateur.nom,
          email: utilisateur.email,
          numero_fiscal: this.numero_fiscal,
          grade: {
            id: grade.id,
            nom: grade.nom,
            avantages: grade.avantages
          },
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

  /**
   * Mettre à jour les informations du vendeur
   * @param {Object} donnees - Nouvelles données
   * @returns {Object} - Résultat de la mise à jour
   */
  Vendeur.prototype.mettreAJourInformations = async function(donnees) {
    try {
      const champsAutorises = ['numero_fiscal'];
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

      // Mettre à jour les données vendeur
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
   * Créer une nouvelle boutique
   * @param {Object} donneesBoutique - Données de la boutique
   * @returns {Object} - Résultat de la création
   */
  Vendeur.prototype.genererBoutique = async function(donneesBoutique) {
    try {
      // Vérifier les données requises
      if (!donneesBoutique.nom) {
        throw new Error('Le nom de la boutique est obligatoire');
      }

      // Vérifier si le vendeur peut créer une boutique selon son grade
      const grade = await this.getGrade();
      if (!grade) {
        throw new Error('Grade vendeur non défini');
      }

      // Vérifier le nombre de boutiques existantes selon le grade
      const boutiquesExistantes = await this.getBoutiques();
      const limiteParGrade = {
        1: 1, // Bronze: 1 boutique
        2: 3, // Argent: 3 boutiques
        3: 5, // Or: 5 boutiques
        4: 10 // Platine: 10 boutiques
      };

      if (boutiquesExistantes.length >= (limiteParGrade[grade.id] || 1)) {
        throw new Error(`Votre grade ${grade.nom} ne permet que ${limiteParGrade[grade.id]} boutique(s)`);
      }

      // Créer la boutique
      const boutique = await sequelize.models.Boutique.create({
        vendeur_id: this.id,
        nom: donneesBoutique.nom,
        description: donneesBoutique.description || '',
        template_id: donneesBoutique.template_id || 1 // Template basique par défaut
      });

      return {
        success: true,
        message: 'Boutique créée avec succès',
        boutique: {
          id: boutique.id,
          nom: boutique.nom,
          description: boutique.description,
          template_id: boutique.template_id
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
   * Obtenir une boutique spécifique du vendeur
   * @param {number} boutiqueId - ID de la boutique
   * @returns {Object} - Boutique trouvée
   */
  Vendeur.prototype.obtenirBoutique = async function(boutiqueId) {
    try {
      const boutique = await sequelize.models.Boutique.findOne({
        where: {
          id: boutiqueId,
          vendeur_id: this.id
        },
        include: [
          {
            model: sequelize.models.Produit,
            as: 'produits',
            include: ['images']
          },
          {
            model: sequelize.models.Template,
            as: 'template'
          }
        ]
      });

      if (!boutique) {
        return {
          success: false,
          message: 'Boutique non trouvée'
        };
      }

      return {
        success: true,
        boutique: boutique
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  };

  /**
   * Mettre à jour une boutique
   * @param {number} boutiqueId - ID de la boutique
   * @param {Object} donnees - Nouvelles données
   * @returns {Object} - Résultat de la mise à jour
   */
  Vendeur.prototype.modifierBoutique = async function(boutiqueId, donnees) {
    try {
      const boutique = await sequelize.models.Boutique.findOne({
        where: {
          id: boutiqueId,
          vendeur_id: this.id
        }
      });

      if (!boutique) {
        throw new Error('Boutique non trouvée ou non autorisée');
      }

      const champsAutorises = ['nom', 'description', 'template_id'];
      const donneesFiltered = {};

      champsAutorises.forEach(champ => {
        if (donnees[champ] !== undefined) {
          donneesFiltered[champ] = donnees[champ];
        }
      });

      await boutique.update(donneesFiltered);

      return {
        success: true,
        message: 'Boutique mise à jour avec succès',
        boutique: boutique
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  };

  /**
   * Ajouter un produit à une boutique
   * @param {Object} donnesProduit - Données du produit
   * @returns {Object} - Résultat de l'ajout
   */
  Vendeur.prototype.ajouterProduit = async function(donnesProduit) {
    try {
      // Vérifier les données requises
      if (!donnesProduit.nom || !donnesProduit.prix || !donnesProduit.boutique_id) {
        throw new Error('Nom, prix et boutique sont obligatoires');
      }

      // Vérifier que la boutique appartient au vendeur
      const boutique = await sequelize.models.Boutique.findOne({
        where: {
          id: donnesProduit.boutique_id,
          vendeur_id: this.id
        }
      });

      if (!boutique) {
        throw new Error('Boutique non trouvée ou non autorisée');
      }

      // Vérifier les limites selon le grade
      const grade = await this.getGrade();
      const produitsExistants = await sequelize.models.Produit.count({
        where: { boutique_id: boutique.id }
      });

      const limitesParGrade = {
        1: 10,   // Bronze: 10 produits par boutique
        2: 50,   // Argent: 50 produits par boutique
        3: 200,  // Or: 200 produits par boutique
        4: 1000  // Platine: 1000 produits par boutique
      };

      if (produitsExistants >= (limitesParGrade[grade.id] || 10)) {
        throw new Error(`Votre grade ${grade.nom} limite à ${limitesParGrade[grade.id]} produits par boutique`);
      }

      // Créer le produit
      const produit = await sequelize.models.Produit.create({
        boutique_id: donnesProduit.boutique_id,
        categorie_id: donnesProduit.categorie_id,
        nom: donnesProduit.nom,
        description: donnesProduit.description || '',
        prix: donnesProduit.prix,
        stock: donnesProduit.stock || 0
      });

      return {
        success: true,
        message: 'Produit ajouté avec succès',
        produit: {
          id: produit.id,
          nom: produit.nom,
          prix: produit.prix,
          stock: produit.stock
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
   * Modifier un produit
   * @param {number} produitId - ID du produit
   * @param {Object} nouvellesDonnees - Nouvelles données
   * @returns {Object} - Résultat de la modification
   */
  Vendeur.prototype.modifierProduit = async function(produitId, nouvellesDonnees) {
    try {
      // Vérifier que le produit appartient au vendeur
      const produit = await sequelize.models.Produit.findOne({
        where: { id: produitId },
        include: [{
          model: sequelize.models.Boutique,
          as: 'boutique',
          where: { vendeur_id: this.id }
        }]
      });

      if (!produit) {
        throw new Error('Produit non trouvé ou non autorisé');
      }

      // Filtrer les champs modifiables
      const champsAutorises = ['nom', 'description', 'prix', 'stock', 'categorie_id'];
      const donneesFiltered = {};

      champsAutorises.forEach(champ => {
        if (nouvellesDonnees[champ] !== undefined) {
          donneesFiltered[champ] = nouvellesDonnees[champ];
        }
      });

      await produit.update(donneesFiltered);

      return {
        success: true,
        message: 'Produit modifié avec succès',
        produit: {
          id: produit.id,
          nom: produit.nom,
          prix: produit.prix,
          stock: produit.stock
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
   * Supprimer un produit
   * @param {number} produitId - ID du produit
   * @returns {Object} - Résultat de la suppression
   */
  Vendeur.prototype.supprimerProduit = async function(produitId) {
    try {
      // Vérifier que le produit appartient au vendeur
      const produit = await sequelize.models.Produit.findOne({
        where: { id: produitId },
        include: [{
          model: sequelize.models.Boutique,
          as: 'boutique',
          where: { vendeur_id: this.id }
        }]
      });

      if (!produit) {
        throw new Error('Produit non trouvé ou non autorisé');
      }

      // Vérifier s'il y a des paniers actifs avec ce produit
      const lignesPanierActives = await sequelize.models.LignePanier.count({
        where: { produit_id: produitId },
        include: [{
          model: sequelize.models.Panier,
          as: 'panier',
          where: { statut: 'actif' }
        }]
      });

      if (lignesPanierActives > 0) {
        throw new Error('Impossible de supprimer: produit présent dans des paniers actifs');
      }

      await produit.destroy();

      return {
        success: true,
        message: 'Produit supprimé avec succès'
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  };

  /**
   * Lister les paniers validés pour le vendeur (remplace commandes)
   * @param {Object} options - Options de filtrage
   * @returns {Object} - Liste des paniers validés
   */
  Vendeur.prototype.listerPaniersValidés = async function(options = {}) {
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

      const paniers = await sequelize.models.Panier.findAll({
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
              where: { vendeur_id: this.id }
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

      // Filtrer pour ne garder que les paniers contenant des produits du vendeur
      const paniersVendeur = paniers.filter(panier => 
        panier.lignes.some(ligne => ligne.produit && ligne.produit.boutique)
      );

      return {
        success: true,
        paniers: paniersVendeur.map(panier => ({
          id: panier.id,
          date_validation: panier.date_validation,
          statut: panier.statut,
          total_vendeur: panier.lignes
            .filter(ligne => ligne.produit && ligne.produit.boutique)
            .reduce((sum, ligne) => sum + ligne.sous_total, 0),
          client: {
            nom: panier.client.utilisateur.nom,
            email: panier.client.utilisateur.email
          },
          adresse_livraison: panier.adresse_livraison,
          produits: panier.lignes
            .filter(ligne => ligne.produit && ligne.produit.boutique)
            .map(ligne => ({
              nom: ligne.produit.nom,
              quantite: ligne.quantite,
              prix_unitaire: ligne.produit.prix,
              sous_total: ligne.sous_total
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
   * Mettre à jour le statut d'un panier validé
   * @param {number} panierId - ID du panier
   * @param {string} nouveauStatut - Nouveau statut
   * @returns {Object} - Résultat de la mise à jour
   */
  Vendeur.prototype.modifierStatutPanier = async function(panierId, nouveauStatut) {
    try {
      const statutsAutorises = ['valide', 'expedie', 'livre', 'annule'];
      if (!statutsAutorises.includes(nouveauStatut)) {
        throw new Error('Statut non autorisé');
      }

      // Vérifier que le panier contient des produits du vendeur
      const panier = await sequelize.models.Panier.findOne({
        where: {
          id: panierId,
          statut: { [sequelize.Sequelize.Op.in]: ['valide', 'expedie'] }
        },
        include: [{
          model: sequelize.models.LignePanier,
          as: 'lignes',
          include: [{
            model: sequelize.models.Produit,
            as: 'produit',
            include: [{
              model: sequelize.models.Boutique,
              as: 'boutique',
              where: { vendeur_id: this.id }
            }]
          }]
        }]
      });

      if (!panier || !panier.lignes.some(ligne => ligne.produit && ligne.produit.boutique)) {
        throw new Error('Panier non trouvé ou non autorisé');
      }

      await panier.update({ statut: nouveauStatut });

      return {
        success: true,
        message: `Statut mis à jour vers "${nouveauStatut}"`
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  };

  /**
   * Vérifier le stock de tous les produits
   * @param {number} seuilCritique - Seuil en dessous duquel le stock est critique
   * @returns {Object} - Rapport de stock
   */
  Vendeur.prototype.verifierStock = async function(seuilCritique = 5) {
    try {
      const boutiques = await this.getBoutiques({
        include: [{
          model: sequelize.models.Produit,
          as: 'produits'
        }]
      });

      const rapport = {
        total_produits: 0,
        stock_critique: [],
        stock_epuise: [],
        stock_ok: 0
      };

      boutiques.forEach(boutique => {
        boutique.produits.forEach(produit => {
          rapport.total_produits++;
          
          if (produit.stock === 0) {
            rapport.stock_epuise.push({
              id: produit.id,
              nom: produit.nom,
              boutique: boutique.nom
            });
          } else if (produit.stock <= seuilCritique) {
            rapport.stock_critique.push({
              id: produit.id,
              nom: produit.nom,
              stock: produit.stock,
              boutique: boutique.nom
            });
          } else {
            rapport.stock_ok++;
          }
        });
      });

      return {
        success: true,
        rapport
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  };

  /**
   * Demander une promotion de grade
   * @returns {Object} - Résultat de la demande
   */
  Vendeur.prototype.demanderPromotionGrade = async function() {
    try {
      const gradeActuel = await this.getGrade();
      const gradeSuperieur = await sequelize.models.GradeVendeur.findOne({
        where: {
          id: gradeActuel.id + 1
        }
      });

      if (!gradeSuperieur) {
        return {
          success: false,
          message: 'Vous avez déjà le grade maximum'
        };
      }

      // Vérifier les conditions du grade supérieur
      const conditionsRemplies = await gradeSuperieur.verifierConditions(this);
      
      if (!conditionsRemplies.success) {
        return {
          success: false,
          message: `Conditions non remplies: ${conditionsRemplies.message}`
        };
      }

      // Promouvoir automatiquement
      await this.update({ grade_id: gradeSuperieur.id });

      return {
        success: true,
        message: `Promotion vers ${gradeSuperieur.nom} accordée !`,
        nouveau_grade: {
          id: gradeSuperieur.id,
          nom: gradeSuperieur.nom
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
   * Obtenir les statistiques de vente
   * @param {Object} options - Options de période
   * @returns {Object} - Statistiques de vente
   */
  Vendeur.prototype.obtenirStatistiquesVente = async function(options = {}) {
    try {
      const whereClause = { vendeur_id: this.id };

      // Filtrer par période
      if (options.periode) {
        const maintenant = new Date();
        let dateDebut;

        switch (options.periode) {
          case 'semaine':
            dateDebut = new Date(maintenant.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case 'mois':
            dateDebut = new Date(maintenant.getFullYear(), maintenant.getMonth(), 1);
            break;
          case 'trimestre':
            dateDebut = new Date(maintenant.getFullYear(), maintenant.getMonth() - 3, 1);
            break;
          case 'annee':
            dateDebut = new Date(maintenant.getFullYear(), 0, 1);
            break;
          default:
            dateDebut = new Date(maintenant.getTime() - 30 * 24 * 60 * 60 * 1000);
        }

        whereClause.date = {
          [sequelize.Sequelize.Op.gte]: dateDebut
        };
      }

      const statistiques = await sequelize.models.StatistiqueVente.findAll({
        where: whereClause,
        order: [['date', 'DESC']]
      });

      const totalVentes = statistiques.reduce((sum, stat) => sum + stat.ventes, 0);
      const totalCA = statistiques.reduce((sum, stat) => sum + parseFloat(stat.chiffre_affaires), 0);

      return {
        success: true,
        statistiques: {
          periode: options.periode || 'personnalisee',
          total_ventes: totalVentes,
          chiffre_affaires: totalCA,
          details: statistiques.map(stat => ({
            date: stat.date,
            ventes: stat.ventes,
            chiffre_affaires: stat.chiffre_affaires
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
   * Obtenir le tableau de bord du vendeur
   * @returns {Object} - Données du tableau de bord
   */
  Vendeur.prototype.obtenirTableauDeBord = async function() {
    try {
      const utilisateur = await this.getUtilisateur();
      const boutiques = await this.getBoutiques({
        include: [{
          model: sequelize.models.Produit,
          as: 'produits'
        }]
      });

      const grade = await this.getGrade();
      
      // Statistiques des 30 derniers jours
      const il30Jours = new Date();
      il30Jours.setDate(il30Jours.getDate() - 30);

      const statistiques30Jours = await sequelize.models.StatistiqueVente.findAll({
        where: {
          vendeur_id: this.id,
          date: { [sequelize.Sequelize.Op.gte]: il30Jours }
        },
        order: [['date', 'DESC']]
      });

      const ventesMois = statistiques30Jours.reduce((sum, stat) => sum + stat.ventes, 0);
      const caMois = statistiques30Jours.reduce((sum, stat) => sum + parseFloat(stat.chiffre_affaires), 0);

      const totalProduits = boutiques.reduce((sum, boutique) => sum + boutique.produits.length, 0);
      const produitsEnStock = boutiques.reduce((sum, boutique) => 
        sum + boutique.produits.filter(p => p.stock > 0).length, 0);

      return {
        success: true,
        tableau_de_bord: {
          vendeur: {
            nom: utilisateur.nom,
            email: utilisateur.email,
            grade: grade.nom
          },
          boutiques: {
            nombre: boutiques.length,
            details: boutiques.map(b => ({
              id: b.id,
              nom: b.nom,
              nombre_produits: b.produits.length
            }))
          },
          produits: {
            total: totalProduits,
            en_stock: produitsEnStock,
            rupture_stock: totalProduits - produitsEnStock
          },
          performance_mois: {
            ventes: ventesMois,
            chiffre_affaires: caMois
          },
          statistiques_recentes: statistiques30Jours.slice(0, 7).map(stat => ({
            date: stat.date,
            ventes: stat.ventes,
            chiffre_affaires: stat.chiffre_affaires
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

  // ==================== ASSOCIATIONS ====================
  Vendeur.associate = function(models) {
    // Héritage d'Utilisateur
    Vendeur.belongsTo(models.Utilisateur, {
      foreignKey: 'id',
      targetKey: 'id',
      as: 'utilisateur'
    });

    // Relation avec GradeVendeur
    Vendeur.belongsTo(models.GradeVendeur, {
      foreignKey: 'grade_id',
      as: 'grade'
    });

    // Un vendeur génère des boutiques
    Vendeur.hasMany(models.Boutique, {
      foreignKey: 'vendeur_id',
      as: 'boutiques'
    });

    // Un vendeur possède des statistiques
    Vendeur.hasMany(models.StatistiqueVente, {
      foreignKey: 'vendeur_id',
      as: 'statistiques'
    });
  };

  return Vendeur;
};