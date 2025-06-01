// models/produit.js
module.exports = (sequelize, DataTypes) => {
  const Produit = sequelize.define('Produit', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    boutique_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    categorie_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    nom: {
      type: DataTypes.STRING(100), 
      allowNull: false,
      validate: {
        len: [2, 100],
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    prix: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0,
        isDecimal: true
      }
    },
    stock: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    // Statistiques du produit
    nombre_vues: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    nombre_ventes: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    note_moyenne: {
      type: DataTypes.DECIMAL(3, 2),
      defaultValue: 0.00
    },
    // Statut et gestion
    statut: {
      type: DataTypes.ENUM('actif', 'inactif', 'suspendu'),
      defaultValue: 'actif'
    },
    tags: {
      type: DataTypes.TEXT,
      allowNull: true,
      get() {
        const rawValue = this.getDataValue('tags');
        return rawValue ? JSON.parse(rawValue) : [];
      },
      set(value) {
        this.setDataValue('tags', JSON.stringify(value || []));
      }
    }
  }, {
    tableName: 'produits',
    timestamps: true,
    underscored: true
  });

  // ==================== MÉTHODES D'INSTANCE ====================

  /**
   * Obtenir les informations complètes du produit
   * @returns {Object} - Informations complètes
   */
  Produit.prototype.obtenirInformationsCompletes = async function() {
    try {
      await this.reload({
        include: [
          {
            model: sequelize.models.Boutique,
            as: 'boutique',
            include: [{
              model: sequelize.models.Vendeur,
              as: 'vendeur',
              include: [{
                model: sequelize.models.Utilisateur,
                as: 'utilisateur'
              }]
            }]
          },
          {
            model: sequelize.models.Categorie,
            as: 'categorie'
          },
          {
            model: sequelize.models.ImageProduit,
            as: 'images'
          }
        ]
      });

      return {
        success: true,
        produit: {
          id: this.id,
          nom: this.nom,
          description: this.description,
          prix: parseFloat(this.prix),
          stock: this.stock,
          nombre_vues: this.nombre_vues,
          nombre_ventes: this.nombre_ventes,
          note_moyenne: parseFloat(this.note_moyenne),
          statut: this.statut,
          tags: this.tags,
          statut_stock: this.obtenirStatutStock(),
          boutique: {
            id: this.boutique.id,
            nom: this.boutique.nom,
            vendeur: this.boutique.vendeur.utilisateur.nom
          },
          categorie: {
            id: this.categorie.id,
            nom: this.categorie.nom
          },
          images: this.images.map(img => ({
            id: img.id,
            url: img.url,
            est_principale: img.est_principale
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
   * Mettre à jour le stock du produit
   * @param {number} nouveauStock - Nouveau stock
   * @returns {Object} - Résultat de la mise à jour
   */
  Produit.prototype.mettreAJourStock = async function(nouveauStock) {
    try {
      if (nouveauStock < 0) {
        throw new Error('Le stock ne peut pas être négatif');
      }

      const ancienStock = this.stock;
      await this.update({ stock: nouveauStock });

      return {
        success: true,
        message: 'Stock mis à jour avec succès',
        ancien_stock: ancienStock,
        nouveau_stock: nouveauStock,
        statut_stock: this.obtenirStatutStock()
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  };

  /**
   * Vérifier si le produit est disponible
   * @param {number} quantiteVoulue - Quantité souhaitée (optionnel)
   * @returns {boolean} - True si disponible
   */
  Produit.prototype.verifierDisponibilite = function(quantiteVoulue = 1) {
    return this.stock >= quantiteVoulue && this.statut === 'actif';
  };

  /**
   * Réserver du stock (diminuer temporairement)
   * @param {number} quantite - Quantité à réserver
   * @returns {Object} - Résultat de la réservation
   */
  Produit.prototype.reserverStock = async function(quantite) {
    try {
      if (quantite <= 0) {
        throw new Error('La quantité doit être positive');
      }

      if (!this.verifierDisponibilite(quantite)) {
        throw new Error(`Produit indisponible. Stock: ${this.stock}, Statut: ${this.statut}`);
      }

      const nouveauStock = this.stock - quantite;
      await this.update({ stock: nouveauStock });

      return {
        success: true,
        message: 'Stock réservé avec succès',
        quantite_reservee: quantite,
        stock_restant: nouveauStock
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  };

  /**
   * Libérer du stock réservé (remettre en stock)
   * @param {number} quantite - Quantité à libérer
   * @returns {Object} - Résultat de la libération
   */
  Produit.prototype.libererStock = async function(quantite) {
    try {
      if (quantite <= 0) {
        throw new Error('La quantité doit être positive');
      }

      const nouveauStock = this.stock + quantite;
      await this.update({ stock: nouveauStock });

      return {
        success: true,
        message: 'Stock libéré avec succès',
        quantite_liberee: quantite,
        stock_total: nouveauStock
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  };

  /**
   * Calculer le prix total pour une quantité donnée
   * @param {number} quantite - Quantité
   * @returns {number} - Prix total
   */
  Produit.prototype.calculerPrixTotal = function(quantite) {
    return parseFloat(this.prix) * quantite;
  };

  /**
   * Vérifier si le produit est en rupture de stock
   * @returns {boolean} - True si en rupture
   */
  Produit.prototype.estEnRuptureStock = function() {
    return this.stock === 0;
  };

  /**
   * Vérifier si le stock est critique (moins de 5 unités)
   * @param {number} seuil - Seuil critique (défaut: 5)
   * @returns {boolean} - True si stock critique
   */
  Produit.prototype.estStockCritique = function(seuil = 5) {
    return this.stock > 0 && this.stock <= seuil;
  };

  /**
   * Obtenir le statut du stock
   * @returns {Object} - Statut détaillé du stock
   */
  Produit.prototype.obtenirStatutStock = function() {
    if (this.statut !== 'actif') {
      return {
        statut: 'inactif',
        couleur: 'gray',
        message: 'Produit non disponible'
      };
    }

    if (this.estEnRuptureStock()) {
      return {
        statut: 'epuise',
        couleur: 'red',
        message: 'Produit épuisé'
      };
    } else if (this.estStockCritique()) {
      return {
        statut: 'critique',
        couleur: 'orange',
        message: `Stock faible (${this.stock} restant${this.stock > 1 ? 's' : ''})`
      };
    } else {
      return {
        statut: 'disponible',
        couleur: 'green',
        message: `En stock (${this.stock} disponible${this.stock > 1 ? 's' : ''})`
      };
    }
  };

  /**
   * Mettre à jour les informations du produit
   * @param {Object} nouvellesDonnees - Nouvelles données
   * @returns {Object} - Résultat de la mise à jour
   */
  Produit.prototype.mettreAJourInformations = async function(nouvellesDonnees) {
    try {
      const champsAutorises = ['nom', 'description', 'prix', 'stock', 'categorie_id', 'tags', 'statut'];
      const donneesFiltered = {};

      champsAutorises.forEach(champ => {
        if (nouvellesDonnees[champ] !== undefined) {
          donneesFiltered[champ] = nouvellesDonnees[champ];
        }
      });

      // Validations
      if (donneesFiltered.nom && donneesFiltered.nom.length < 2) {
        throw new Error('Le nom doit contenir au moins 2 caractères');
      }

      if (donneesFiltered.prix && donneesFiltered.prix < 0) {
        throw new Error('Le prix ne peut pas être négatif');
      }

      if (donneesFiltered.stock && donneesFiltered.stock < 0) {
        throw new Error('Le stock ne peut pas être négatif');
      }

      await this.update(donneesFiltered);

      return {
        success: true,
        message: 'Produit mis à jour avec succès',
        produit: await this.obtenirInformationsCompletes()
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  };

  /**
   * Ajouter une image au produit
   * @param {Object} imageData - Données de l'image
   * @returns {Object} - Résultat de l'ajout
   */
  Produit.prototype.ajouterImage = async function(imageData) {
    try {
      // Si c'est la première image, elle devient principale
      const images = await this.getImages();
      const estPrincipale = images.length === 0 || imageData.est_principale;

      // Si nouvelle image principale, désactiver les autres
      if (estPrincipale) {
        await sequelize.models.ImageProduit.update(
          { est_principale: false },
          { where: { produit_id: this.id } }
        );
      }

      const nouvelleImage = await sequelize.models.ImageProduit.create({
        produit_id: this.id,
        url: imageData.url,
        description: imageData.description || '',
        est_principale: estPrincipale
      });

      return {
        success: true,
        message: 'Image ajoutée avec succès',
        image: nouvelleImage
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  };

  /**
   * Supprimer une image du produit
   * @param {number} imageId - ID de l'image
   * @returns {Object} - Résultat de la suppression
   */
  Produit.prototype.supprimerImage = async function(imageId) {
    try {
      const image = await sequelize.models.ImageProduit.findOne({
        where: { id: imageId, produit_id: this.id }
      });

      if (!image) {
        throw new Error('Image non trouvée');
      }

      const etaitPrincipale = image.est_principale;
      await image.destroy();

      // Si l'image principale a été supprimée, en définir une nouvelle
      if (etaitPrincipale) {
        const premiereImage = await sequelize.models.ImageProduit.findOne({
          where: { produit_id: this.id }
        });
        
        if (premiereImage) {
          await premiereImage.update({ est_principale: true });
        }
      }

      return {
        success: true,
        message: 'Image supprimée avec succès'
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  };

  /**
   * Incrémenter le compteur de vues
   * @returns {Object} - Résultat de l'incrémentation
   */
  Produit.prototype.incrementerVues = async function() {
    try {
      await this.increment('nombre_vues');
      return {
        success: true,
        nouvelles_vues: this.nombre_vues + 1
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  };

  /**
   * Mettre à jour après une vente
   * @param {number} quantiteVendue - Quantité vendue
   * @returns {Object} - Résultat de la mise à jour
   */
  Produit.prototype.mettreAJourApresVente = async function(quantiteVendue) {
    try {
      await this.increment('nombre_ventes', { by: quantiteVendue });
      
      return {
        success: true,
        message: 'Statistiques de vente mises à jour',
        nouvelles_ventes: this.nombre_ventes + quantiteVendue
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
   * Rechercher des produits par critères
   * @param {Object} criteres - Critères de recherche
   * @returns {Object} - Résultats de recherche
   */
  Produit.rechercherProduits = async function(criteres = {}) {
    try {
      const whereClause = { statut: 'actif' };
      const includeClause = [];

      // Filtrer par nom ou description
      if (criteres.search) {
        whereClause[sequelize.Sequelize.Op.or] = [
          { nom: { [sequelize.Sequelize.Op.like]: `%${criteres.search}%` } },
          { description: { [sequelize.Sequelize.Op.like]: `%${criteres.search}%` } }
        ];
      }

      // Filtrer par prix
      if (criteres.prix_min || criteres.prix_max) {
        whereClause.prix = {};
        if (criteres.prix_min) whereClause.prix[sequelize.Sequelize.Op.gte] = criteres.prix_min;
        if (criteres.prix_max) whereClause.prix[sequelize.Sequelize.Op.lte] = criteres.prix_max;
      }

      // Filtrer par catégorie
      if (criteres.categorie) {
        whereClause.categorie_id = criteres.categorie;
      }

      // Filtrer par boutique
      if (criteres.boutique_id) {
        whereClause.boutique_id = criteres.boutique_id;
      }

      // Filtrer par disponibilité
      if (criteres.disponibles_uniquement) {
        whereClause.stock = { [sequelize.Sequelize.Op.gt]: 0 };
      }

      // Inclure les relations
      includeClause.push({
        model: sequelize.models.Boutique,
        as: 'boutique',
        attributes: ['id', 'nom']
      });

      includeClause.push({
        model: sequelize.models.Categorie,
        as: 'categorie',
        attributes: ['id', 'nom']
      });

      includeClause.push({
        model: sequelize.models.ImageProduit,
        as: 'images',
        limit: 1,
        where: { est_principale: true },
        required: false
      });

      // Tri
      let orderClause = [['nom', 'ASC']];
      if (criteres.tri === 'prix_asc') orderClause = [['prix', 'ASC']];
      if (criteres.tri === 'prix_desc') orderClause = [['prix', 'DESC']];
      if (criteres.tri === 'popularite') orderClause = [['nombre_ventes', 'DESC'], ['nombre_vues', 'DESC']];
      if (criteres.tri === 'recent') orderClause = [['created_at', 'DESC']];

      // Pagination
      const page = criteres.page || 1;
      const limit = criteres.limit || 20;
      const offset = (page - 1) * limit;

      const { count, rows: produits } = await this.findAndCountAll({
        where: whereClause,
        include: includeClause,
        order: orderClause,
        limit: limit,
        offset: offset,
        distinct: true
      });

      return {
        success: true,
        produits: produits.map(p => ({
          id: p.id,
          nom: p.nom,
          description: p.description,
          prix: parseFloat(p.prix),
          stock: p.stock,
          nombre_vues: p.nombre_vues,
          nombre_ventes: p.nombre_ventes,
          statut_stock: p.obtenirStatutStock(),
          boutique: p.boutique,
          categorie: p.categorie,
          image_principale: p.images.length > 0 ? p.images[0].url : null
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
   * Obtenir les produits les plus populaires (vraies ventes)
   * @param {Object} options - Options de filtrage
   * @returns {Object} - Liste des produits populaires
   */
  Produit.obtenirProduitsPopulaires = async function(options = {}) {
    try {
      const limite = options.limite || 10;
      const periode = options.periode || 30; // jours

      // Calculer les ventes réelles depuis les paniers validés
      const dateDebut = new Date();
      dateDebut.setDate(dateDebut.getDate() - periode);

      const produitsAvecVentes = await sequelize.query(`
        SELECT 
          p.id,
          p.nom,
          p.prix,
          p.stock,
          p.nombre_vues,
          b.nom as boutique_nom,
          c.nom as categorie_nom,
          COALESCE(SUM(lp.quantite), 0) as ventes_periode,
          COALESCE(SUM(lp.sous_total), 0) as ca_periode
        FROM produits p
        LEFT JOIN boutiques b ON p.boutique_id = b.id
        LEFT JOIN categories c ON p.categorie_id = c.id
        LEFT JOIN ligne_panier lp ON p.id = lp.produit_id
        LEFT JOIN paniers pa ON lp.panier_id = pa.id 
          AND pa.statut IN ('valide', 'expedie', 'livre')
          AND pa.date_validation >= :dateDebut
        WHERE p.statut = 'actif'
        GROUP BY p.id, p.nom, p.prix, p.stock, p.nombre_vues, b.nom, c.nom
        ORDER BY ventes_periode DESC, p.nombre_vues DESC
        LIMIT :limite
      `, {
        replacements: { 
          dateDebut: dateDebut.toISOString().split('T')[0],
          limite: limite
        },
        type: sequelize.QueryTypes.SELECT
      });

      return {
        success: true,
        periode_jours: periode,
        produits_populaires: produitsAvecVentes.map(p => ({
          id: p.id,
          nom: p.nom,
          prix: parseFloat(p.prix),
          stock: p.stock,
          nombre_vues: p.nombre_vues,
          ventes_periode: parseInt(p.ventes_periode),
          ca_periode: parseFloat(p.ca_periode) || 0,
          boutique: p.boutique_nom,
          categorie: p.categorie_nom
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
   * Obtenir les produits d'une boutique
   * @param {number} boutiqueId - ID de la boutique
   * @param {Object} options - Options de filtrage
   * @returns {Object} - Produits de la boutique
   */
  Produit.obtenirProduitsParBoutique = async function(boutiqueId, options = {}) {
    try {
      const criteres = {
        boutique_id: boutiqueId,
        ...options
      };

      return await this.rechercherProduits(criteres);
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  };

  /**
   * Obtenir des recommandations pour un client
   * @param {number} clientId - ID du client
   * @param {Object} options - Options de recommandation
   * @returns {Object} - Produits recommandés
   */
  Produit.obtenirRecommandations = async function(clientId, options = {}) {
    try {
      const limite = options.limite || 10;

      // Récupérer l'historique des achats du client
      const historiqueAchats = await sequelize.models.Panier.findAll({
        where: {
          client_id: clientId,
          statut: ['valide', 'expedie', 'livre']
        },
        include: [{
          model: sequelize.models.LignePanier,
          as: 'lignes',
          include: [{
            model: sequelize.models.Produit,
            as: 'produit',
            include: [{
              model: sequelize.models.Categorie,
              as: 'categorie'
            }]
          }]
        }]
      });

      // Extraire les catégories favorites
      const categoriesAchetees = [];
      historiqueAchats.forEach(panier => {
        panier.lignes.forEach(ligne => {
          if (ligne.produit && ligne.produit.categorie) {
            categoriesAchetees.push(ligne.produit.categorie.id);
          }
        });
      });

      const categoriesFavorites = [...new Set(categoriesAchetees)];

      // Recommander des produits dans ces catégories
      const recommandations = await this.rechercherProduits({
        categorie: categoriesFavorites.length > 0 ? categoriesFavorites : undefined,
        disponibles_uniquement: true,
        tri: 'popularite',
        limit: limite
      });

      return {
        success: true,
        message: 'Recommandations basées sur votre historique d\'achats',
        categories_favorites: categoriesFavorites,
        recommandations: recommandations.produits
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  };

  // ==================== ASSOCIATIONS ====================
  Produit.associate = function(models) {
    // Un produit appartient à une boutique
    Produit.belongsTo(models.Boutique, {
      foreignKey: 'boutique_id',
      as: 'boutique'
    });

    // Un produit appartient à une catégorie
    Produit.belongsTo(models.Categorie, {
      foreignKey: 'categorie_id',
      as: 'categorie'
    });

    // Un produit peut être dans plusieurs lignes de panier
    Produit.hasMany(models.LignePanier, {
      foreignKey: 'produit_id',
      as: 'lignesPanier'
    });

    // Un produit peut avoir plusieurs images
    Produit.hasMany(models.ImageProduit, {
      foreignKey: 'produit_id',
      as: 'images'
    });
  };

  return Produit;
};