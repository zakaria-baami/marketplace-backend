// models/template.js - Version compatible avec vos web services et votre marketplace
module.exports = (sequelize, DataTypes) => {
  const Template = sequelize.define('Template', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    nom: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: 'Le nom du template est obligatoire'
        },
        len: {
          args: [2, 100],
          msg: 'Le nom doit contenir entre 2 et 100 caractères'
        }
      }
    },
    grade_requis_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        isInt: {
          msg: 'L\'ID du grade doit être un entier'
        },
        min: {
          args: [1],
          msg: 'L\'ID du grade doit être supérieur à 0'
        }
      }
    }
  }, {
    tableName: 'template', // Correspond à votre table SQL TEMPLATE
    timestamps: false, // Pas de created_at/updated_at dans votre schéma
    underscored: false // Garde les noms de colonnes comme dans votre SQL
  });

  // ==================== MÉTHODES D'INSTANCE ====================

  /**
   * Vérifier si le template est accessible pour un grade de vendeur
   * Selon votre doc : "Amateur, Professionnel ou Premium"
   * @param {number} gradeVendeurId - ID du grade du vendeur
   * @returns {boolean} - True si accessible
   */
  Template.prototype.estAccessiblePourGrade = function(gradeVendeurId) {
    if (!gradeVendeurId || !this.grade_requis_id) {
      return false;
    }
    // Un vendeur peut accéder aux templates de son grade ou inférieur
    return gradeVendeurId >= this.grade_requis_id;
  };

  /**
   * Obtenir les informations du template avec le grade requis
   * Compatible avec GET /api/templates/:id
   * @returns {Object} - Informations complètes du template
   */
  Template.prototype.obtenirInfosCompletes = async function() {
    try {
      const gradeRequis = await this.getGradeRequis();
      
      return {
        success: true,
        template: {
          id: this.id,
          nom: this.nom,
          grade_requis_id: this.grade_requis_id,
          grade_requis_nom: gradeRequis ? gradeRequis.nom : 'Inconnu',
          // Informations utiles pour la personnalisation de boutique
          description: `Template ${this.nom} - Adapté pour les vendeurs ${gradeRequis?.nom || 'de ce grade'}`
        }
      };
    } catch (error) {
      return {
        success: false,
        message: 'Erreur lors de la récupération des informations du template',
        error: error.message
      };
    }
  };

  /**
   * Valider qu'un vendeur peut utiliser ce template pour sa boutique
   * @param {Object} vendeur - Objet vendeur avec grade
   * @returns {Object} - Résultat de la validation
   */
  Template.prototype.validerPourVendeur = async function(vendeur) {
    try {
      if (!vendeur || !vendeur.grade_id) {
        return {
          success: false,
          message: 'Informations vendeur manquantes'
        };
      }

      const peutAcceder = this.estAccessiblePourGrade(vendeur.grade_id);
      
      if (!peutAcceder) {
        const gradeRequis = await this.getGradeRequis();
        return {
          success: false,
          message: `Ce template nécessite le grade "${gradeRequis?.nom || 'supérieur'}" ou plus élevé`
        };
      }

      return {
        success: true,
        message: 'Template accessible pour ce vendeur'
      };
    } catch (error) {
      return {
        success: false,
        message: 'Erreur lors de la validation',
        error: error.message
      };
    }
  };

  /**
   * Compter le nombre de boutiques utilisant ce template
   * Utile pour les statistiques de popularité
   * @returns {Object} - Nombre de boutiques
   */
  Template.prototype.compterBoutiques = async function() {
    try {
      const nombreBoutiques = await sequelize.models.Boutique.count({
        where: { template_id: this.id }
      });
      
      return {
        success: true,
        nombre: nombreBoutiques,
        message: `${nombreBoutiques} boutique(s) utilisent ce template`
      };
    } catch (error) {
      return {
        success: false,
        nombre: 0,
        message: 'Erreur lors du comptage des boutiques',
        error: error.message
      };
    }
  };

  /**
   * Obtenir les boutiques utilisant ce template
   * @param {number} limite - Limite de résultats (optionnel)
   * @returns {Object} - Liste des boutiques
   */
  Template.prototype.obtenirBoutiques = async function(limite = 10) {
    try {
      const boutiques = await sequelize.models.Boutique.findAll({
        where: { template_id: this.id },
        include: [{
          model: sequelize.models.Vendeur,
          as: 'vendeur',
          attributes: ['id'],
          include: [{
            model: sequelize.models.Utilisateur,
            as: 'utilisateur',
            attributes: ['nom', 'email']
          }]
        }],
        limit: limite,
        order: [['id', 'DESC']]
      });

      return {
        success: true,
        boutiques: boutiques.map(boutique => ({
          id: boutique.id,
          nom: boutique.nom,
          description: boutique.description,
          vendeur_nom: boutique.vendeur?.utilisateur?.nom || 'Inconnu'
        }))
      };
    } catch (error) {
      return {
        success: false,
        boutiques: [],
        message: 'Erreur lors de la récupération des boutiques',
        error: error.message
      };
    }
  };

  // ==================== MÉTHODES STATIQUES ====================

  /**
   * Obtenir tous les templates avec leurs grades
   * Compatible avec GET /api/templates
   * @returns {Object} - Liste complète des templates
   */
  Template.obtenirTous = async function() {
    try {
      const templates = await this.findAll({
        include: [{
          model: sequelize.models.GradeVendeur,
          as: 'gradeRequis',
          attributes: ['id', 'nom']
        }],
        order: [['grade_requis_id', 'ASC'], ['nom', 'ASC']]
      });

      return {
        success: true,
        templates: templates.map(template => ({
          id: template.id,
          nom: template.nom,
          grade_requis_id: template.grade_requis_id,
          grade_requis_nom: template.gradeRequis ? template.gradeRequis.nom : 'Inconnu',
          description: `Template pour les vendeurs ${template.gradeRequis?.nom || 'de ce grade'}`
        }))
      };
    } catch (error) {
      return {
        success: false,
        message: 'Erreur lors de la récupération des templates',
        templates: [],
        error: error.message
      };
    }
  };

  /**
   * Obtenir les templates disponibles pour un grade spécifique
   * Compatible avec GET /api/templates/grade/:gradeId
   * Selon votre doc : grades "Amateur, Professionnel ou Premium"
   * @param {number} gradeId - ID du grade (1=Amateur, 2=Professionnel, 3=Premium)
   * @returns {Object} - Templates accessibles
   */
  Template.obtenirParGrade = async function(gradeId) {
    try {
      if (!gradeId || gradeId < 1) {
        throw new Error('ID de grade invalide');
      }

      const templates = await this.findAll({
        where: {
          grade_requis_id: {
            [sequelize.Sequelize.Op.lte]: gradeId
          }
        },
        include: [{
          model: sequelize.models.GradeVendeur,
          as: 'gradeRequis',
          attributes: ['id', 'nom']
        }],
        order: [['grade_requis_id', 'ASC'], ['nom', 'ASC']]
      });

      return {
        success: true,
        templates: templates.map(template => ({
          id: template.id,
          nom: template.nom,
          grade_requis_id: template.grade_requis_id,
          grade_requis_nom: template.gradeRequis?.nom || 'Inconnu',
          accessible: true, // Tous les templates retournés sont accessibles
          description: `Template ${template.nom} - Disponible pour votre grade`
        })),
        grade_demande: gradeId,
        message: `${templates.length} template(s) disponible(s) pour ce grade`
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        templates: [],
        grade_demande: gradeId
      };
    }
  };

  /**
   * Créer un nouveau template (pour admin)
   * Compatible avec POST /api/templates
   * @param {Object} donnees - {nom, grade_requis_id}
   * @returns {Object} - Template créé
   */
  Template.creerNouveauTemplate = async function(donnees) {
    try {
      // Validation des données
      if (!donnees.nom || !donnees.grade_requis_id) {
        throw new Error('Nom et grade requis sont obligatoires');
      }

      // Vérifier que le grade existe
      const gradeExiste = await sequelize.models.GradeVendeur.findByPk(donnees.grade_requis_id);
      if (!gradeExiste) {
        throw new Error('Le grade spécifié n\'existe pas');
      }

      // Vérifier l'unicité du nom
      const templateExistant = await this.findOne({
        where: { nom: donnees.nom }
      });
      if (templateExistant) {
        throw new Error('Un template avec ce nom existe déjà');
      }

      const nouveauTemplate = await this.create({
        nom: donnees.nom.trim(),
        grade_requis_id: donnees.grade_requis_id
      });

      return {
        success: true,
        message: 'Template créé avec succès',
        template: {
          id: nouveauTemplate.id,
          nom: nouveauTemplate.nom,
          grade_requis_id: nouveauTemplate.grade_requis_id
        }
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        template: null
      };
    }
  };

  /**
   * Rechercher des templates par nom
   * Utile pour les fonctionnalités de recherche dans la marketplace
   * @param {string} terme - Terme de recherche
   * @param {number} gradeMaximum - Grade maximum du vendeur (optionnel)
   * @returns {Object} - Résultats de recherche
   */
  Template.rechercherParNom = async function(terme, gradeMaximum = null) {
    try {
      const whereClause = {
        nom: {
          [sequelize.Sequelize.Op.like]: `%${terme}%`
        }
      };

      // Filtrer par grade si spécifié
      if (gradeMaximum) {
        whereClause.grade_requis_id = {
          [sequelize.Sequelize.Op.lte]: gradeMaximum
        };
      }

      const templates = await this.findAll({
        where: whereClause,
        include: [{
          model: sequelize.models.GradeVendeur,
          as: 'gradeRequis',
          attributes: ['id', 'nom']
        }],
        order: [['nom', 'ASC']]
      });

      return {
        success: true,
        templates: templates.map(template => ({
          id: template.id,
          nom: template.nom,
          grade_requis_id: template.grade_requis_id,
          grade_requis_nom: template.gradeRequis?.nom || 'Inconnu'
        })),
        terme_recherche: terme,
        nombre_resultats: templates.length
      };
    } catch (error) {
      return {
        success: false,
        message: 'Erreur lors de la recherche',
        templates: [],
        terme_recherche: terme
      };
    }
  };

  /**
   * Obtenir les statistiques d'utilisation des templates
   * Utile pour les admins et le tableau de bord
   * @returns {Object} - Statistiques
   */
  Template.obtenirStatistiques = async function() {
    try {
      // Compter les templates par grade
      const templatesParGrade = await this.findAll({
        attributes: [
          'grade_requis_id',
          [sequelize.fn('COUNT', sequelize.col('id')), 'nombre_templates']
        ],
        include: [{
          model: sequelize.models.GradeVendeur,
          as: 'gradeRequis',
          attributes: ['nom']
        }],
        group: ['grade_requis_id', 'gradeRequis.id'],
        raw: false
      });

      // Compter les boutiques utilisant des templates
      const boutiquesAvecTemplate = await sequelize.models.Boutique.count({
        where: {
          template_id: {
            [sequelize.Sequelize.Op.not]: null
          }
        }
      });

      const totalTemplates = await this.count();

      return {
        success: true,
        statistiques: {
          total_templates: totalTemplates,
          boutiques_avec_template: boutiquesAvecTemplate,
          repartition_par_grade: templatesParGrade.map(item => ({
            grade_id: item.grade_requis_id,
            grade_nom: item.gradeRequis?.nom || 'Inconnu',
            nombre_templates: parseInt(item.get('nombre_templates'))
          }))
        }
      };
    } catch (error) {
      return {
        success: false,
        message: 'Erreur lors du calcul des statistiques',
        statistiques: null
      };
    }
  };

  // ==================== ASSOCIATIONS ====================
  Template.associate = function(models) {
    // Un template peut être utilisé par plusieurs boutiques
    Template.hasMany(models.Boutique, {
      foreignKey: 'template_id',
      as: 'boutiques'
    });

    // Un template appartient à un grade vendeur
    Template.belongsTo(models.GradeVendeur, {
      foreignKey: 'grade_requis_id',
      as: 'gradeRequis'
    });
  };

  return Template;
};