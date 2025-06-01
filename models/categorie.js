// models/categorie.js
module.exports = (sequelize, DataTypes) => {
  const Categorie = sequelize.define('Categorie', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    nom: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      validate: {
        len: [2, 100]
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    image: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    couleur: {
      type: DataTypes.STRING(7), // Format #RRGGBB
      allowNull: true,
      defaultValue: '#007bff',
      validate: {
        is: /^#[0-9A-F]{6}$/i
      }
    },
    statut: {
      type: DataTypes.ENUM('active', 'inactive'),
      allowNull: false,
      defaultValue: 'active'
    },
    ordre_affichage: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    }
  }, {
    tableName: 'categories',
    timestamps: true,
    underscored: true
  });

  // ==================== MÉTHODES D'INSTANCE ====================

  /**
   * Obtenir les informations complètes de la catégorie
   * @returns {Object} - Informations complètes
   */
  Categorie.prototype.obtenirInformationsCompletes = async function() {
    try {
      const nombreProduits = await this.compterProduits();
      const nombreProduitsActifs = await this.compterProduits(true);

      return {
        success: true,
        categorie: {
          id: this.id,
          nom: this.nom,
          description: this.description,
          image: this.image,
          couleur: this.couleur,
          statut: this.statut,
          ordre_affichage: this.ordre_affichage,
          statistiques: {
            total_produits: nombreProduits,
            produits_actifs: nombreProduitsActifs,
            produits_inactifs: nombreProduits - nombreProduitsActifs
          },
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
   * Obtenir le nombre de produits dans cette catégorie
   * @param {boolean} actifUniquement - Ne compter que les produits actifs
   * @returns {number} - Nombre de produits
   */
  Categorie.prototype.compterProduits = async function(actifUniquement = false) {
    try {
      const whereClause = { categorie_id: this.id };
      
      if (actifUniquement) {
        whereClause.statut = 'actif';
        whereClause.stock = { [sequelize.Sequelize.Op.gt]: 0 };
      }

      const count = await sequelize.models.Produit.count({
        where: whereClause
      });
      
      return count;
    } catch (error) {
      return 0;
    }
  };

  /**
   * Obtenir les produits de cette catégorie
   * @param {Object} options - Options de filtrage
   * @returns {Object} - Liste des produits
   */
  Categorie.prototype.obtenirProduits = async function(options = {}) {
    try {
      const whereClause = { 
        categorie_id: this.id,
        statut: 'actif'
      };
      
      if (options.disponibles_uniquement) {
        whereClause.stock = { [sequelize.Sequelize.Op.gt]: 0 };
      }

      if (options.prix_min || options.prix_max) {
        whereClause.prix = {};
        if (options.prix_min) whereClause.prix[sequelize.Sequelize.Op.gte] = options.prix_min;
        if (options.prix_max) whereClause.prix[sequelize.Sequelize.Op.lte] = options.prix_max;
      }

      // Tri
      let orderClause = [['nom', 'ASC']];
      if (options.tri === 'prix_asc') orderClause = [['prix', 'ASC']];
      if (options.tri === 'prix_desc') orderClause = [['prix', 'DESC']];
      if (options.tri === 'popularite') orderClause = [['nombre_ventes', 'DESC']];
      if (options.tri === 'recent') orderClause = [['created_at', 'DESC']];

      // Pagination
      const page = options.page || 1;
      const limit = options.limit || 20;
      const offset = (page - 1) * limit;

      const { count, rows: produits } = await sequelize.models.Produit.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: sequelize.models.Boutique,
            as: 'boutique',
            attributes: ['id', 'nom']
          },
          {
            model: sequelize.models.ImageProduit,
            as: 'images',
            where: { est_principale: true },
            required: false,
            limit: 1
          }
        ],
        order: orderClause,
        limit: limit,
        offset: offset,
        distinct: true
      });

      return {
        success: true,
        categorie: {
          id: this.id,
          nom: this.nom
        },
        produits: produits.map(p => ({
          id: p.id,
          nom: p.nom,
          description: p.description,
          prix: parseFloat(p.prix),
          stock: p.stock,
          nombre_vues: p.nombre_vues,
          nombre_ventes: p.nombre_ventes,
          boutique: p.boutique,
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
   * Mettre à jour les informations de la catégorie
   * @param {Object} nouvellesDonnees - Nouvelles données
   * @returns {Object} - Résultat de la mise à jour
   */
  Categorie.prototype.mettreAJourInformations = async function(nouvellesDonnees) {
    try {
      const champsAutorises = ['nom', 'description', 'image', 'couleur', 'statut', 'ordre_affichage'];
      const donneesFiltered = {};

      champsAutorises.forEach(champ => {
        if (nouvellesDonnees[champ] !== undefined) {
          donneesFiltered[champ] = nouvellesDonnees[champ];
        }
      });

      // Validations
      if (donneesFiltered.nom) {
        if (donneesFiltered.nom.length < 2) {
          throw new Error('Le nom doit contenir au moins 2 caractères');
        }

        // Vérifier l'unicité du nom
        const categorieExistante = await sequelize.models.Categorie.findOne({
          where: { 
            nom: donneesFiltered.nom,
            id: { [sequelize.Sequelize.Op.ne]: this.id }
          }
        });

        if (categorieExistante) {
          throw new Error('Une catégorie avec ce nom existe déjà');
        }
      }

      if (donneesFiltered.couleur && !/^#[0-9A-F]{6}$/i.test(donneesFiltered.couleur)) {
        throw new Error('Code couleur invalide (format: #RRGGBB)');
      }

      await this.update(donneesFiltered);

      return {
        success: true,
        message: 'Catégorie mise à jour avec succès',
        categorie: await this.obtenirInformationsCompletes()
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  };

  /**
   * Obtenir les statistiques de vente de la catégorie
   * @param {Object} options - Options de période
   * @returns {Object} - Statistiques détaillées
   */
  Categorie.prototype.obtenirStatistiquesVente = async function(options = {}) {
    try {
      const periode = options.periode || 30; // jours
      const dateDebut = new Date();
      dateDebut.setDate(dateDebut.getDate() - periode);

      const statistiques = await sequelize.query(`
        SELECT 
          COUNT(DISTINCT lp.panier_id) as nombre_commandes,
          SUM(lp.quantite) as produits_vendus,
          SUM(lp.sous_total) as chiffre_affaires,
          AVG(lp.sous_total / lp.quantite) as prix_moyen
        FROM ligne_panier lp
        JOIN produits p ON lp.produit_id = p.id
        JOIN paniers pa ON lp.panier_id = pa.id
        WHERE p.categorie_id = :categorieId
          AND pa.statut IN ('valide', 'expedie', 'livre')
          AND pa.date_validation >= :dateDebut
      `, {
        replacements: { 
          categorieId: this.id,
          dateDebut: dateDebut.toISOString().split('T')[0]
        },
        type: sequelize.QueryTypes.SELECT
      });

      const stats = statistiques[0];

      return {
        success: true,
        periode_jours: periode,
        statistiques: {
          nombre_commandes: parseInt(stats.nombre_commandes) || 0,
          produits_vendus: parseInt(stats.produits_vendus) || 0,
          chiffre_affaires: parseFloat(stats.chiffre_affaires) || 0,
          prix_moyen: parseFloat(stats.prix_moyen) || 0
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
   * Changer le statut de la catégorie
   * @param {string} nouveauStatut - 'active' ou 'inactive'
   * @returns {Object} - Résultat du changement
   */
  Categorie.prototype.changerStatut = async function(nouveauStatut) {
    try {
      if (!['active', 'inactive'].includes(nouveauStatut)) {
        throw new Error('Statut invalide');
      }

      const ancienStatut = this.statut;
      await this.update({ statut: nouveauStatut });

      // Si on désactive la catégorie, désactiver aussi ses produits
      if (nouveauStatut === 'inactive') {
        await sequelize.models.Produit.update(
          { statut: 'inactif' },
          { where: { categorie_id: this.id } }
        );
      }

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

  // ==================== MÉTHODES STATIQUES ====================

  /**
   * Créer une nouvelle catégorie
   * @param {Object} donnees - Données de la catégorie
   * @returns {Object} - Catégorie créée
   */
  Categorie.creerCategorie = async function(donnees) {
    try {
      // Validation
      if (!donnees.nom || donnees.nom.length < 2) {
        throw new Error('Le nom est obligatoire et doit contenir au moins 2 caractères');
      }

      // Vérifier l'unicité
      const categorieExistante = await this.findOne({
        where: { nom: donnees.nom }
      });

      if (categorieExistante) {
        throw new Error('Une catégorie avec ce nom existe déjà');
      }

      // Définir l'ordre d'affichage si non spécifié
      if (!donnees.ordre_affichage) {
        const maxOrdre = await this.max('ordre_affichage') || 0;
        donnees.ordre_affichage = maxOrdre + 1;
      }

      const categorie = await this.create({
        nom: donnees.nom,
        description: donnees.description || '',
        image: donnees.image || null,
        couleur: donnees.couleur || '#007bff',
        statut: donnees.statut || 'active',
        ordre_affichage: donnees.ordre_affichage
      });

      return {
        success: true,
        message: 'Catégorie créée avec succès',
        categorie: await categorie.obtenirInformationsCompletes()
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  };

  /**
   * Obtenir toutes les catégories avec compteurs
   * @param {Object} options - Options de filtrage
   * @returns {Object} - Catégories avec nombre de produits
   */
  Categorie.obtenirAvecCompteurs = async function(options = {}) {
    try {
      const whereClause = {};
      
      // Filtrer par statut si spécifié
      if (options.statut) {
        whereClause.statut = options.statut;
      }

      const categories = await this.findAll({
        where: whereClause,
        attributes: [
          'id',
          'nom',
          'description',
          'image',
          'couleur',
          'statut',
          'ordre_affichage',
          [sequelize.fn('COUNT', sequelize.col('produits.id')), 'nombre_produits'],
          [sequelize.fn('COUNT', 
            sequelize.literal('CASE WHEN produits.statut = "actif" AND produits.stock > 0 THEN 1 END')
          ), 'produits_disponibles']
        ],
        include: [{
          model: sequelize.models.Produit,
          as: 'produits',
          attributes: [],
          required: false
        }],
        group: ['Categorie.id'],
        order: [['ordre_affichage', 'ASC'], ['nom', 'ASC']]
      });

      return {
        success: true,
        categories: categories.map(c => ({
          id: c.id,
          nom: c.nom,
          description: c.description,
          image: c.image,
          couleur: c.couleur,
          statut: c.statut,
          ordre_affichage: c.ordre_affichage,
          nombre_produits: parseInt(c.get('nombre_produits')) || 0,
          produits_disponibles: parseInt(c.get('produits_disponibles')) || 0
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
   * Obtenir une catégorie par ID avec ses informations complètes
   * @param {number} categorieId - ID de la catégorie
   * @returns {Object} - Catégorie trouvée
   */
  Categorie.obtenirParId = async function(categorieId) {
    try {
      const categorie = await this.findByPk(categorieId);
      
      if (!categorie) {
        return {
          success: false,
          message: 'Catégorie non trouvée'
        };
      }

      return await categorie.obtenirInformationsCompletes();
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  };

  /**
   * Supprimer une catégorie (avec vérifications)
   * @param {number} categorieId - ID de la catégorie
   * @returns {Object} - Résultat de la suppression
   */
  Categorie.supprimerCategorie = async function(categorieId) {
    try {
      const categorie = await this.findByPk(categorieId);
      
      if (!categorie) {
        throw new Error('Catégorie non trouvée');
      }

      // Vérifier s'il y a des produits dans cette catégorie
      const nombreProduits = await categorie.compterProduits();
      
      if (nombreProduits > 0) {
        throw new Error(`Impossible de supprimer: ${nombreProduits} produit(s) dans cette catégorie`);
      }

      await categorie.destroy();

      return {
        success: true,
        message: 'Catégorie supprimée avec succès'
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  };

  /**
   * Réorganiser l'ordre d'affichage des catégories
   * @param {Array} ordreCategories - Tableau des IDs dans le nouvel ordre
   * @returns {Object} - Résultat de la réorganisation
   */
  Categorie.reorganiserOrdre = async function(ordreCategories) {
    const transaction = await sequelize.transaction();
    
    try {
      for (let i = 0; i < ordreCategories.length; i++) {
        await this.update(
          { ordre_affichage: i + 1 },
          { 
            where: { id: ordreCategories[i] },
            transaction
          }
        );
      }

      await transaction.commit();

      return {
        success: true,
        message: 'Ordre des catégories mis à jour'
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
   * Rechercher des catégories
   * @param {Object} criteres - Critères de recherche
   * @returns {Object} - Résultats de recherche
   */
  Categorie.rechercherCategories = async function(criteres = {}) {
    try {
      const whereClause = {};

      if (criteres.nom) {
        whereClause.nom = {
          [sequelize.Sequelize.Op.like]: `%${criteres.nom}%`
        };
      }

      if (criteres.statut) {
        whereClause.statut = criteres.statut;
      }

      const categories = await this.findAll({
        where: whereClause,
        order: [['ordre_affichage', 'ASC'], ['nom', 'ASC']],
        limit: criteres.limite || 50
      });

      const categoriesAvecInfos = await Promise.all(
        categories.map(async (categorie) => {
          const infos = await categorie.obtenirInformationsCompletes();
          return infos.categorie;
        })
      );

      return {
        success: true,
        categories: categoriesAvecInfos
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  };

  // ==================== ASSOCIATIONS ====================
  Categorie.associate = function(models) {
    // Une catégorie contient plusieurs produits
    Categorie.hasMany(models.Produit, {
      foreignKey: 'categorie_id',
      as: 'produits'
    });
  };

  return Categorie;
};