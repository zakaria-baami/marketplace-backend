// models/boutique.js
const path = require('path');
const fs = require('fs').promises;

module.exports = (sequelize, DataTypes) => {
  const Boutique = sequelize.define('Boutique', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    vendeur_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    nom: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    template_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 1
    },
    // Images de personnalisation
    logo: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    banniere: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    // Personnalisation avancée
    couleur_theme: {
      type: DataTypes.STRING(7), // Format #RRGGBB
      allowNull: true,
      defaultValue: '#007bff'
    },
    url_personnalisee: {
      type: DataTypes.STRING(100),
      allowNull: true,
      unique: true
    },
    // Statut et statistiques
    statut: {
      type: DataTypes.ENUM('active', 'suspendue', 'fermee'),
      allowNull: false,
      defaultValue: 'active'
    },
    nombre_visites: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    note_moyenne: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: false,
      defaultValue: 0.00
    },
    nombre_ventes: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    }
  }, {
    tableName: 'boutiques',
    timestamps: true,
    underscored: true
  });

  // ==================== MÉTHODES D'INSTANCE ====================

  /**
   * Obtenir les informations complètes de la boutique
   * @returns {Object} - Informations complètes
   */
  Boutique.prototype.obtenirInformationsCompletes = async function() {
    try {
      await this.reload({
        include: [
          {
            model: sequelize.models.Vendeur,
            as: 'vendeur',
            include: [
              {
                model: sequelize.models.Utilisateur,
                as: 'utilisateur'
              },
              {
                model: sequelize.models.GradeVendeur,
                as: 'grade'
              }
            ]
          },
          {
            model: sequelize.models.Template,
            as: 'template'
          },
          {
            model: sequelize.models.Produit,
            as: 'produits',
            limit: 10
          }
        ]
      });

      return {
        success: true,
        boutique: {
          id: this.id,
          nom: this.nom,
          description: this.description,
          logo: this.logo,
          banniere: this.banniere,
          couleur_theme: this.couleur_theme,
          url_personnalisee: this.url_personnalisee,
          statut: this.statut,
          nombre_visites: this.nombre_visites,
          note_moyenne: parseFloat(this.note_moyenne),
          nombre_ventes: this.nombre_ventes,
          template: this.template,
          vendeur: {
            nom: this.vendeur.utilisateur.nom,
            email: this.vendeur.utilisateur.email,
            grade: this.vendeur.grade.nom
          },
          produits_apercu: this.produits.map(p => ({
            id: p.id,
            nom: p.nom,
            prix: parseFloat(p.prix),
            stock: p.stock
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
   * Changer le template de la boutique
   * @param {number} nouveauTemplateId - ID du nouveau template
   * @returns {Object} - Résultat du changement
   */
  Boutique.prototype.changerTemplate = async function(nouveauTemplateId) {
    try {
      // Vérifier que le template existe
      const template = await sequelize.models.Template.findByPk(nouveauTemplateId);
      if (!template) {
        throw new Error('Template non trouvé');
      }

      // Vérifier les permissions du vendeur
      const vendeur = await this.getVendeur({ 
        include: [{ model: sequelize.models.GradeVendeur, as: 'grade' }] 
      });
      
      const templatesAutorises = vendeur.grade.templates_disponibles || vendeur.grade.getTemplatesParDefaut();
      
      if (!templatesAutorises.includes(nouveauTemplateId)) {
        throw new Error(`Template non autorisé pour le grade ${vendeur.grade.nom}`);
      }

      // Sauvegarder l'ancien template pour rollback si nécessaire
      const ancienTemplateId = this.template_id;

      // Appliquer le nouveau template
      await this.update({ template_id: nouveauTemplateId });

      return {
        success: true,
        message: 'Template changé avec succès',
        template: {
          id: template.id,
          nom: template.nom,
          ancien_id: ancienTemplateId
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
   * Modifier les informations de la boutique
   * @param {Object} nouvellesInfos - Nouvelles informations
   * @returns {Object} - Résultat de la modification
   */
  Boutique.prototype.modifierInformations = async function(nouvellesInfos) {
    try {
      const champsAutorises = ['nom', 'description', 'couleur_theme', 'url_personnalisee'];
      const donneesFiltered = {};

      // Filtrer et valider les champs
      champsAutorises.forEach(champ => {
        if (nouvellesInfos[champ] !== undefined) {
          donneesFiltered[champ] = nouvellesInfos[champ];
        }
      });

      // Validations spécifiques
      if (donneesFiltered.nom && donneesFiltered.nom.length < 3) {
        throw new Error('Le nom doit contenir au moins 3 caractères');
      }

      if (donneesFiltered.couleur_theme && !/^#[0-9A-F]{6}$/i.test(donneesFiltered.couleur_theme)) {
        throw new Error('Code couleur invalide (format: #RRGGBB)');
      }

      if (donneesFiltered.url_personnalisee) {
        // Vérifier que l'URL est unique et valide
        const urlRegex = /^[a-zA-Z0-9-_]+$/;
        if (!urlRegex.test(donneesFiltered.url_personnalisee)) {
          throw new Error('URL personnalisée invalide (lettres, chiffres, tirets et underscores uniquement)');
        }

        // Vérifier l'unicité
        const boutiqueMemeUrl = await sequelize.models.Boutique.findOne({
          where: { 
            url_personnalisee: donneesFiltered.url_personnalisee,
            id: { [sequelize.Sequelize.Op.ne]: this.id }
          }
        });

        if (boutiqueMemeUrl) {
          throw new Error('Cette URL personnalisée est déjà utilisée');
        }
      }

      await this.update(donneesFiltered);

      return {
        success: true,
        message: 'Informations mises à jour avec succès',
        boutique: await this.obtenirInformationsCompletes()
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  };

  /**
   * Ajouter une image (logo ou bannière)
   * @param {Object} fichierImage - Informations du fichier
   * @param {string} type - 'logo' ou 'banniere'
   * @returns {Object} - Résultat de l'ajout
   */
  Boutique.prototype.ajouterImage = async function(fichierImage, type) {
    try {
      if (!['logo', 'banniere'].includes(type)) {
        throw new Error('Type d\'image invalide (logo ou banniere)');
      }

      // Vérifier le format de l'image
      const formatsAutorises = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
      const extension = path.extname(fichierImage.originalname).toLowerCase().substring(1);
      
      if (!formatsAutorises.includes(extension)) {
        throw new Error('Format d\'image non autorisé');
      }

      // Vérifier la taille du fichier (max 5MB)
      if (fichierImage.size > 5 * 1024 * 1024) {
        throw new Error('Fichier trop volumineux (max 5MB)');
      }

      // Générer un nom de fichier unique
      const timestamp = Date.now();
      const nomFichier = `${type}_${this.id}_${timestamp}.${extension}`;
      const dossierUpload = process.env.UPLOAD_PATH || 'uploads/boutiques';
      
      // S'assurer que le dossier existe
      await fs.mkdir(dossierUpload, { recursive: true });
      
      const cheminComplet = path.join(dossierUpload, nomFichier);

      // Sauvegarder le fichier
      await fs.writeFile(cheminComplet, fichierImage.buffer);

      // Supprimer l'ancienne image si elle existe
      const ancienneImage = this[type];
      if (ancienneImage) {
        try {
          const ancienChemin = path.join(dossierUpload, path.basename(ancienneImage));
          await fs.unlink(ancienChemin);
        } catch (error) {
          console.log('Ancienne image non trouvée:', ancienneImage);
        }
      }

      // Mettre à jour la base de données
      const urlImage = `/uploads/boutiques/${nomFichier}`;
      await this.update({ [type]: urlImage });

      return {
        success: true,
        message: `${type.charAt(0).toUpperCase() + type.slice(1)} ajouté(e) avec succès`,
        url: urlImage
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  };

  /**
   * Supprimer une image
   * @param {string} type - 'logo' ou 'banniere'
   * @returns {Object} - Résultat de la suppression
   */
  Boutique.prototype.supprimerImage = async function(type) {
    try {
      if (!['logo', 'banniere'].includes(type)) {
        throw new Error('Type d\'image invalide');
      }

      const imageActuelle = this[type];
      if (!imageActuelle) {
        throw new Error(`Aucun ${type} à supprimer`);
      }

      // Supprimer le fichier physique
      try {
        const dossierUpload = process.env.UPLOAD_PATH || 'uploads/boutiques';
        const cheminFichier = path.join(dossierUpload, path.basename(imageActuelle));
        await fs.unlink(cheminFichier);
      } catch (error) {
        console.log('Fichier non trouvé:', imageActuelle);
      }

      // Mettre à jour la base de données
      await this.update({ [type]: null });

      return {
        success: true,
        message: `${type.charAt(0).toUpperCase() + type.slice(1)} supprimé(e) avec succès`
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  };

  /**
   * Obtenir les templates disponibles selon le grade du vendeur
   * @returns {Array} - Liste des templates disponibles
   */
  Boutique.prototype.getTemplatesDisponibles = async function() {
    try {
      const vendeur = await this.getVendeur({ 
        include: [{ model: sequelize.models.GradeVendeur, as: 'grade' }] 
      });
      
      const templatesAutorises = vendeur.grade.templates_disponibles || vendeur.grade.getTemplatesParDefaut();

      const templates = await sequelize.models.Template.findAll({
        where: {
          id: { [sequelize.Sequelize.Op.in]: templatesAutorises }
        },
        order: [['id', 'ASC']]
      });

      return {
        success: true,
        templates: templates.map(t => ({
          id: t.id,
          nom: t.nom,
          description: t.description,
          est_actuel: t.id === this.template_id
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
   * Obtenir les statistiques de la boutique
   * @param {Object} options - Options de période
   * @returns {Object} - Statistiques détaillées
   */
  Boutique.prototype.obtenirStatistiques = async function(options = {}) {
    try {
      const maintenant = new Date();
      const debut = options.dateDebut || new Date(maintenant.getTime() - 30 * 24 * 60 * 60 * 1000);
      const fin = options.dateFin || maintenant;

      // Statistiques des produits
      const produits = await this.getProduits({
        include: [{
          model: sequelize.models.Categorie,
          as: 'categorie'
        }]
      });

      const statsProduitsParCategorie = {};
      let totalProduits = 0;
      let produitsEnStock = 0;
      let valeurStock = 0;

      produits.forEach(produit => {
        totalProduits++;
        if (produit.stock > 0) {
          produitsEnStock++;
          valeurStock += produit.stock * parseFloat(produit.prix);
        }

        const categorie = produit.categorie ? produit.categorie.nom : 'Sans catégorie';
        if (!statsProduitsParCategorie[categorie]) {
          statsProduitsParCategorie[categorie] = { nombre: 0, valeur: 0 };
        }
        statsProduitsParCategorie[categorie].nombre++;
        statsProduitsParCategorie[categorie].valeur += parseFloat(produit.prix);
      });

      // Statistiques des ventes via paniers validés
      const paniersValidés = await sequelize.models.Panier.findAll({
        where: {
          statut: ['valide', 'expedie', 'livre'],
          date_validation: {
            [sequelize.Sequelize.Op.between]: [debut, fin]
          }
        },
        include: [{
          model: sequelize.models.LignePanier,
          as: 'lignes',
          include: [{
            model: sequelize.models.Produit,
            as: 'produit',
            where: { boutique_id: this.id }
          }]
        }]
      });

      // Calculer les ventes pour cette boutique
      let totalVentes = 0;
      let totalCA = 0;
      const ventesParJour = {};

      paniersValidés.forEach(panier => {
        const lignesBoutique = panier.lignes.filter(ligne => 
          ligne.produit && ligne.produit.boutique_id === this.id
        );
        
        if (lignesBoutique.length > 0) {
          totalVentes++;
          const caPanier = lignesBoutique.reduce((sum, ligne) => 
            sum + parseFloat(ligne.sous_total), 0
          );
          totalCA += caPanier;

          const dateKey = panier.date_validation.toISOString().split('T')[0];
          if (!ventesParJour[dateKey]) {
            ventesParJour[dateKey] = { ventes: 0, ca: 0 };
          }
          ventesParJour[dateKey].ventes++;
          ventesParJour[dateKey].ca += caPanier;
        }
      });

      return {
        success: true,
        statistiques: {
          periode: { debut, fin },
          boutique: {
            nom: this.nom,
            statut: this.statut,
            visites: this.nombre_visites,
            note_moyenne: parseFloat(this.note_moyenne)
          },
          produits: {
            total: totalProduits,
            en_stock: produitsEnStock,
            rupture_stock: totalProduits - produitsEnStock,
            valeur_stock: valeurStock,
            par_categorie: statsProduitsParCategorie
          },
          ventes: {
            total_ventes: totalVentes,
            chiffre_affaires: totalCA,
            moyenne_par_jour: totalVentes / Math.max(Object.keys(ventesParJour).length, 1),
            par_jour: ventesParJour
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

  /**
   * Incrémenter le compteur de visites
   * @returns {Object} - Résultat de l'incrémentation
   */
  Boutique.prototype.incrementerVisites = async function() {
    try {
      await this.increment('nombre_visites');
      return {
        success: true,
        nouvelles_visites: this.nombre_visites + 1
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  };

  /**
   * Mettre à jour les statistiques après une vente
   * @param {number} montantVente - Montant de la vente
   * @returns {Object} - Résultat de la mise à jour
   */
  Boutique.prototype.mettreAJourApresVente = async function(montantVente) {
    try {
      await this.increment('nombre_ventes');
      
      // Recalculer la note moyenne basée sur les performances
      const nouvelleNote = await this.calculerNoteMoyenne();
      
      return {
        success: true,
        message: 'Statistiques mises à jour',
        nouvelle_note: nouvelleNote
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  };

  /**
   * Calculer et mettre à jour la note moyenne
   * @returns {number} - Nouvelle note moyenne
   */
  Boutique.prototype.calculerNoteMoyenne = async function() {
    try {
      const produits = await this.getProduits();
      
      let noteCalculee = 3.0; // Note de base
      
      // Bonus pour le nombre de produits
      if (produits.length > 10) noteCalculee += 0.3;
      if (produits.length > 50) noteCalculee += 0.4;
      
      // Bonus pour la diversité (nombre de catégories)
      const categories = new Set(produits.map(p => p.categorie_id));
      if (categories.size > 3) noteCalculee += 0.3;
      
      // Bonus pour les ventes
      if (this.nombre_ventes > 50) noteCalculee += 0.5;
      if (this.nombre_ventes > 200) noteCalculee += 0.5;
      
      noteCalculee = Math.min(noteCalculee, 5.0); // Maximum 5.0

      await this.update({ note_moyenne: noteCalculee });
      
      return noteCalculee;
    } catch (error) {
      return 3.0; // Note par défaut en cas d'erreur
    }
  };

  // ==================== MÉTHODES STATIQUES ====================

  /**
   * Rechercher des boutiques par critères
   * @param {Object} criteres - Critères de recherche
   * @returns {Object} - Résultats de la recherche
   */
  Boutique.rechercherBoutiques = async function(criteres = {}) {
    try {
      const whereClause = { statut: 'active' };
      const includeClause = [];

      // Filtrer par nom
      if (criteres.nom) {
        whereClause.nom = {
          [sequelize.Sequelize.Op.like]: `%${criteres.nom}%`
        };
      }

      // Filtrer par note minimum
      if (criteres.noteMin) {
        whereClause.note_moyenne = {
          [sequelize.Sequelize.Op.gte]: criteres.noteMin
        };
      }

      // Inclure le vendeur si demandé
      if (criteres.inclureVendeur) {
        includeClause.push({
          model: sequelize.models.Vendeur,
          as: 'vendeur',
          include: [{
            model: sequelize.models.Utilisateur,
            as: 'utilisateur'
          }, {
            model: sequelize.models.GradeVendeur,
            as: 'grade'
          }]
        });
      }

      // Inclure les produits si demandé
      if (criteres.inclureProduits) {
        includeClause.push({
          model: sequelize.models.Produit,
          as: 'produits',
          limit: 5
        });
      }

      const boutiques = await this.findAll({
        where: whereClause,
        include: includeClause,
        order: [
          ['note_moyenne', 'DESC'],
          ['nombre_visites', 'DESC']
        ],
        limit: criteres.limite || 20
      });

      return {
        success: true,
        boutiques: boutiques.map(b => ({
          id: b.id,
          nom: b.nom,
          description: b.description,
          logo: b.logo,
          banniere: b.banniere,
          note_moyenne: parseFloat(b.note_moyenne),
          nombre_visites: b.nombre_visites,
          url_personnalisee: b.url_personnalisee,
          vendeur: criteres.inclureVendeur ? {
            nom: b.vendeur.utilisateur.nom,
            grade: b.vendeur.grade.nom
          } : undefined,
          produits_apercu: criteres.inclureProduits ? b.produits.map(p => ({
            id: p.id,
            nom: p.nom,
            prix: parseFloat(p.prix)
          })) : undefined
        }))
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  };

  // ==================== ASSOCIATIONS ====================
  Boutique.associate = function(models) {
    // Une boutique appartient à un vendeur
    Boutique.belongsTo(models.Vendeur, {
      foreignKey: 'vendeur_id',
      as: 'vendeur'
    });

    // Une boutique possède plusieurs produits
    Boutique.hasMany(models.Produit, {
      foreignKey: 'boutique_id',
      as: 'produits'
    });

    // Une boutique utilise un template
    Boutique.belongsTo(models.Template, {
      foreignKey: 'template_id',
      as: 'template'
    });
  };

  return Boutique;
};