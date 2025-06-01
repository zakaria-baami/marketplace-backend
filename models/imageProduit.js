// models/imageProduit.js - Version compatible avec votre schéma SQL actuel
const path = require('path');
const fs = require('fs').promises;

module.exports = (sequelize, DataTypes) => {
  const ImageProduit = sequelize.define('ImageProduit', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    produit_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    url: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    est_principale: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  }, {
    tableName: 'IMAGE_PRODUIT', // Correspond à votre table SQL
    timestamps: false, // Pas de created_at/updated_at dans votre schéma
    underscored: false // Garde les noms de colonnes comme dans votre SQL
  });

  // ==================== MÉTHODES D'INSTANCE ====================

  /**
   * Télécharger et sauvegarder une image (version simplifiée)
   * @param {Object} fichier - Fichier image uploadé
   * @returns {Object} - Résultat du téléchargement
   */
  ImageProduit.prototype.telechargerImage = async function(fichier) {
    try {
      // Validation du fichier
      const formatsAutorises = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
      const extension = path.extname(fichier.originalname).toLowerCase().substring(1);
      
      if (!formatsAutorises.includes(extension)) {
        throw new Error(`Format non autorisé. Formats acceptés: ${formatsAutorises.join(', ')}`);
      }

      // Vérifier la taille (max 5MB)
      const tailleMax = 5 * 1024 * 1024; // 5MB
      if (fichier.size > tailleMax) {
        throw new Error('Fichier trop volumineux (maximum 5MB)');
      }

      // Générer un nom unique
      const timestamp = Date.now();
      const nomFichier = `produit_${this.produit_id}_${timestamp}.${extension}`;
      const dossierUpload = process.env.UPLOAD_PATH || 'uploads/produits';
      const cheminComplet = path.join(dossierUpload, nomFichier);

      // Créer le dossier s'il n'existe pas
      await fs.mkdir(path.dirname(cheminComplet), { recursive: true });

      // Sauvegarder le fichier
      await fs.writeFile(cheminComplet, fichier.buffer);

      // Mettre à jour l'URL
      await this.update({
        url: `/uploads/produits/${nomFichier}`
      });

      return {
        success: true,
        message: 'Image téléchargée avec succès',
        image: {
          id: this.id,
          url: this.url,
          taille: fichier.size,
          format: extension
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
   * Supprimer l'image du disque et de la base
   * @returns {Object} - Résultat de la suppression
   */
  ImageProduit.prototype.supprimerImage = async function() {
    try {
      // Supprimer le fichier physique
      if (this.url) {
        try {
          const cheminFichier = path.join(
            process.env.UPLOAD_PATH || 'uploads/produits',
            path.basename(this.url)
          );
          await fs.unlink(cheminFichier);
        } catch (error) {
          console.log('Fichier physique non trouvé:', this.url);
        }
      }

      // Si c'était l'image principale, désigner une autre image comme principale
      if (this.est_principale) {
        const autreImage = await sequelize.models.ImageProduit.findOne({
          where: {
            produit_id: this.produit_id,
            id: { [sequelize.Sequelize.Op.ne]: this.id }
          }
        });

        if (autreImage) {
          await autreImage.update({ est_principale: true });
        }
      }

      // Supprimer l'enregistrement
      await this.destroy();

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
   * Définir cette image comme image principale
   * @returns {Object} - Résultat de la mise à jour
   */
  ImageProduit.prototype.definirCommePrincipale = async function() {
    const transaction = await sequelize.transaction();
    
    try {
      // Retirer le statut principal des autres images du même produit
      await sequelize.models.ImageProduit.update(
        { est_principale: false },
        {
          where: {
            produit_id: this.produit_id,
            id: { [sequelize.Sequelize.Op.ne]: this.id }
          },
          transaction
        }
      );

      // Définir cette image comme principale
      await this.update({ est_principale: true }, { transaction });

      await transaction.commit();

      return {
        success: true,
        message: 'Image définie comme principale',
        image_principale: {
          id: this.id,
          url: this.url,
          est_principale: true
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
   * Obtenir les informations de l'image (version simplifiée)
   * @returns {Object} - Informations de base
   */
  ImageProduit.prototype.obtenirInfos = async function() {
    try {
      const produit = await this.getProduit();
      
      return {
        success: true,
        image: {
          id: this.id,
          url: this.url,
          est_principale: this.est_principale,
          produit: {
            id: produit?.id,
            nom: produit?.nom
          }
        }
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
   * Ajouter une image à un produit (compatible avec POST /api/produits/:id/images)
   * @param {number} produitId - ID du produit
   * @param {Object} fichier - Fichier image
   * @param {Object} options - Options (est_principale)
   * @returns {Object} - Image créée
   */
  ImageProduit.ajouterImageProduit = async function(produitId, fichier, options = {}) {
    try {
      // Vérifier que le produit existe
      const produit = await sequelize.models.Produit.findByPk(produitId);
      if (!produit) {
        throw new Error('Produit non trouvé');
      }

      // Vérifier les limites (ex: max 10 images par produit)
      const nombreImages = await this.count({ where: { produit_id: produitId } });
      if (nombreImages >= 10) {
        throw new Error('Limite maximale d\'images atteinte (10 par produit)');
      }

      // Créer l'enregistrement image
      const image = await this.create({
        produit_id: produitId,
        est_principale: options.est_principale || nombreImages === 0 // Première image = principale
      });

      // Télécharger le fichier
      const resultatUpload = await image.telechargerImage(fichier);
      
      if (!resultatUpload.success) {
        await image.destroy(); // Nettoyer si échec
        throw new Error(resultatUpload.message);
      }

      return {
        success: true,
        message: 'Image ajoutée avec succès',
        image: {
          id: image.id,
          url: image.url,
          est_principale: image.est_principale
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
   * Obtenir toutes les images d'un produit
   * @param {number} produitId - ID du produit
   * @param {Object} options - Options de filtrage
   * @returns {Object} - Liste des images
   */
  ImageProduit.obtenirImagesProduit = async function(produitId, options = {}) {
    try {
      const whereClause = { produit_id: produitId };
      
      if (options.principaleUniquement) {
        whereClause.est_principale = true;
      }

      const images = await this.findAll({
        where: whereClause,
        order: [
          ['est_principale', 'DESC'], // Principale en premier
          ['id', 'ASC']               // Puis par ID (ordre de création)
        ]
      });

      return {
        success: true,
        images: images.map(img => ({
          id: img.id,
          url: img.url,
          est_principale: img.est_principale
        })),
        statistiques: {
          total: images.length,
          principale: images.find(img => img.est_principale)?.id || null
        }
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        images: []
      };
    }
  };

  /**
   * Obtenir l'image principale d'un produit
   * @param {number} produitId - ID du produit
   * @returns {Object} - Image principale
   */
  ImageProduit.obtenirImagePrincipale = async function(produitId) {
    try {
      const imagePrincipale = await this.findOne({
        where: {
          produit_id: produitId,
          est_principale: true
        }
      });

      if (!imagePrincipale) {
        // Si pas d'image principale, prendre la première
        const premiereImage = await this.findOne({
          where: { produit_id: produitId },
          order: [['id', 'ASC']]
        });

        return {
          success: !!premiereImage,
          image: premiereImage ? {
            id: premiereImage.id,
            url: premiereImage.url,
            est_principale: premiereImage.est_principale
          } : null,
          message: premiereImage ? 'Première image trouvée' : 'Aucune image trouvée'
        };
      }

      return {
        success: true,
        image: {
          id: imagePrincipale.id,
          url: imagePrincipale.url,
          est_principale: true
        }
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        image: null
      };
    }
  };

  /**
   * Supprimer toutes les images d'un produit
   * @param {number} produitId - ID du produit
   * @returns {Object} - Résultat de la suppression
   */
  ImageProduit.supprimerImagesProduit = async function(produitId) {
    try {
      const images = await this.findAll({
        where: { produit_id: produitId }
      });

      let suppressions = 0;
      for (const image of images) {
        const resultat = await image.supprimerImage();
        if (resultat.success) suppressions++;
      }

      return {
        success: true,
        message: `${suppressions} image(s) supprimée(s)`,
        images_supprimees: suppressions
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  };

  // ==================== HOOKS ====================
  
  // Hook avant création pour valider
  ImageProduit.addHook('beforeCreate', async (image) => {
    const produit = await sequelize.models.Produit.findByPk(image.produit_id);
    if (!produit) {
      throw new Error('Produit associé non trouvé');
    }
  });

  // Hook après suppression pour nettoyer les fichiers
  ImageProduit.addHook('afterDestroy', async (image) => {
    if (image.url) {
      try {
        const cheminFichier = path.join(
          process.env.UPLOAD_PATH || 'uploads/produits',
          path.basename(image.url)
        );
        await fs.unlink(cheminFichier);
      } catch (error) {
        console.log('Erreur suppression fichier:', error.message);
      }
    }
  });

  // ==================== ASSOCIATIONS ====================
  ImageProduit.associate = function(models) {
    // Une image appartient à un produit
    ImageProduit.belongsTo(models.Produit, {
      foreignKey: 'produit_id',
      as: 'produit'
    });
  };

  return ImageProduit;
};