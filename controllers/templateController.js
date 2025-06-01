// controllers/templateController.js
const { Template, GradeVendeur, Boutique, Vendeur } = require('../models');
const ApiResponse = require('../utils/apiResponse');
const { Op } = require('sequelize');

class TemplateController {
  /**
   * Lister tous les templates disponibles
   */
  static async listerTemplates(req, res) {
    try {
      const { 
        page = 1, 
        limit = 12, 
        grade_maximum, 
        gratuit_seulement, 
        note_minimum, 
        tri = 'nom',
        search 
      } = req.query;

      const criteres = {
        limite: parseInt(limit),
        tri,
        ...(grade_maximum && { gradeMaximum: parseInt(grade_maximum) }),
        ...(gratuit_seulement === 'true' && { gratuitSeulement: true }),
        ...(note_minimum && { noteMinimum: parseFloat(note_minimum) })
      };

      const resultat = await Template.rechercherTemplates(criteres);

      if (!resultat.success) {
        return ApiResponse.error(res, resultat.message, 400);
      }

      // Appliquer la recherche textuelle si fournie
      let templates = resultat.templates;
      if (search) {
        templates = templates.filter(t => 
          t.nom.toLowerCase().includes(search.toLowerCase()) ||
          t.description.toLowerCase().includes(search.toLowerCase())
        );
      }

      // Pagination manuelle
      const offset = (page - 1) * limit;
      const templatesPagines = templates.slice(offset, offset + parseInt(limit));

      return ApiResponse.paginated(res, templatesPagines, {
        page: parseInt(page),
        limit: parseInt(limit),
        total: templates.length
      });

    } catch (error) {
      console.error('Erreur liste templates:', error);
      return ApiResponse.error(res, 'Erreur lors de la récupération des templates', 500);
    }
  }

  /**
   * Récupérer les templates disponibles pour le grade du vendeur connecté
   */
  static async obtenirTemplatesDisponibles(req, res) {
    try {
      // Récupérer le grade du vendeur
      const vendeur = await Vendeur.findByPk(req.user.id, {
        include: [{ model: GradeVendeur, as: 'grade' }]
      });

      if (!vendeur) {
        return ApiResponse.notFound(res, 'Profil vendeur non trouvé');
      }

      const gradeId = vendeur.grade_id;
      const resultat = await Template.obtenirTemplatesParGrade(gradeId);

      if (!resultat.success) {
        return ApiResponse.error(res, resultat.message, 400);
      }

      return ApiResponse.success(res, {
        grade_actuel: vendeur.grade.nom,
        templates_disponibles: resultat.templates
      });

    } catch (error) {
      console.error('Erreur templates disponibles:', error);
      return ApiResponse.error(res, 'Erreur lors de la récupération des templates disponibles', 500);
    }
  }

  /**
   * Récupérer un template par son ID avec sa configuration
   */
  static async obtenirTemplate(req, res) {
    try {
      const { id } = req.params;

      const template = await Template.findByPk(id, {
        include: [
          { model: GradeVendeur, as: 'gradeRequis' },
          { model: Boutique, as: 'boutiques' }
        ]
      });

      if (!template) {
        return ApiResponse.notFound(res, 'Template non trouvé');
      }

      // Obtenir la configuration par défaut
      const configuration = template.obtenirConfigurationDefaut();

      if (!configuration.success) {
        return ApiResponse.error(res, configuration.message, 500);
      }

      const templateComplet = {
        ...template.toJSON(),
        configuration_defaut: configuration.configuration,
        nombre_boutiques_utilisant: template.boutiques.length
      };

      return ApiResponse.success(res, templateComplet);

    } catch (error) {
      console.error('Erreur récupération template:', error);
      return ApiResponse.error(res, 'Erreur lors de la récupération du template', 500);
    }
  }

  /**
   * Obtenir l'aperçu d'un template avec données de démo
   */
  static async obtenirApercu(req, res) {
    try {
      const { id } = req.params;

      const template = await Template.findByPk(id);
      if (!template) {
        return ApiResponse.notFound(res, 'Template non trouvé');
      }

      const apercu = template.obtenirApercu();

      if (!apercu.success) {
        return ApiResponse.error(res, apercu.message, 500);
      }

      return ApiResponse.success(res, apercu.apercu);

    } catch (error) {
      console.error('Erreur aperçu template:', error);
      return ApiResponse.error(res, 'Erreur lors de la génération de l\'aperçu', 500);
    }
  }

  /**
   * Personnaliser un template pour une boutique
   */
  static async personnaliserTemplate(req, res) {
    try {
      const { id } = req.params;
      const { personnalisations } = req.body;

      const template = await Template.findByPk(id);
      if (!template) {
        return ApiResponse.notFound(res, 'Template non trouvé');
      }

      // Vérifier que le vendeur peut utiliser ce template
      const vendeur = await Vendeur.findByPk(req.user.id, {
        include: [{ model: GradeVendeur, as: 'grade' }]
      });

      if (!template.estAccessiblePourGrade(vendeur.grade_id)) {
        return ApiResponse.forbidden(res, `Ce template nécessite le grade ${template.gradeRequis?.nom || 'supérieur'}`);
      }

      const resultat = template.personnaliser(personnalisations);

      if (!resultat.success) {
        return ApiResponse.error(res, resultat.message, 400);
      }

      // Générer le CSS personnalisé
      const css = template.genererCSS(resultat.configuration_personnalisee);

      return ApiResponse.success(res, {
        configuration_personnalisee: resultat.configuration_personnalisee,
        css_genere: css
      }, 'Template personnalisé avec succès');

    } catch (error) {
      console.error('Erreur personnalisation template:', error);
      return ApiResponse.error(res, 'Erreur lors de la personnalisation du template', 500);
    }
  }

  /**
   * Appliquer un template à sa boutique
   */
  static async appliquerTemplate(req, res) {
    try {
      const { id } = req.params;
      const { personnalisations = {} } = req.body;

      const template = await Template.findByPk(id);
      if (!template) {
        return ApiResponse.notFound(res, 'Template non trouvé');
      }

      // Vérifier que le vendeur a une boutique
      const boutique = await Boutique.findOne({
        where: { vendeur_id: req.user.id }
      });

      if (!boutique) {
        return ApiResponse.error(res, 'Vous devez d\'abord créer une boutique', 400);
      }

      // Vérifier le grade requis
      const vendeur = await Vendeur.findByPk(req.user.id, {
        include: [{ model: GradeVendeur, as: 'grade' }]
      });

      if (!template.estAccessiblePourGrade(vendeur.grade_id)) {
        return ApiResponse.forbidden(res, 'Votre grade ne permet pas d\'utiliser ce template');
      }

      // Appliquer le template à la boutique
      await boutique.update({ template_id: template.id });

      // Incrémenter le compteur d'utilisation
      await template.incrementerUtilisation();

      // Personnaliser si des options sont fournies
      let configurationFinale = null;
      let cssGenere = null;

      if (Object.keys(personnalisations).length > 0) {
        const resultatPersonnalisation = template.personnaliser(personnalisations);
        if (resultatPersonnalisation.success) {
          configurationFinale = resultatPersonnalisation.configuration_personnalisee;
          cssGenere = template.genererCSS(configurationFinale);
        }
      } else {
        const configDefaut = template.obtenirConfigurationDefaut();
        if (configDefaut.success) {
          configurationFinale = configDefaut.configuration;
          cssGenere = template.genererCSS(configurationFinale);
        }
      }

      return ApiResponse.success(res, {
        boutique: {
          id: boutique.id,
          nom: boutique.nom,
          template_id: template.id
        },
        template: {
          id: template.id,
          nom: template.nom
        },
        configuration: configurationFinale,
        css: cssGenere
      }, 'Template appliqué avec succès');

    } catch (error) {
      console.error('Erreur application template:', error);
      return ApiResponse.error(res, 'Erreur lors de l\'application du template', 500);
    }
  }

  /**
   * Noter un template
   */
  static async noterTemplate(req, res) {
    try {
      const { id } = req.params;
      const { note } = req.body;

      if (!note || note < 1 || note > 5) {
        return ApiResponse.validationError(res, [
          { field: 'note', message: 'La note doit être entre 1 et 5' }
        ]);
      }

      const template = await Template.findByPk(id);
      if (!template) {
        return ApiResponse.notFound(res, 'Template non trouvé');
      }

      // Vérifier que le vendeur utilise ce template
      const boutique = await Boutique.findOne({
        where: { 
          vendeur_id: req.user.id,
          template_id: id
        }
      });

      if (!boutique) {
        return ApiResponse.forbidden(res, 'Vous devez utiliser ce template pour le noter');
      }

      const resultat = await template.ajouterNote(note);

      if (!resultat.success) {
        return ApiResponse.error(res, resultat.message, 400);
      }

      return ApiResponse.success(res, {
        template_id: template.id,
        nouvelle_note_moyenne: resultat.nouvelle_moyenne
      }, 'Note ajoutée avec succès');

    } catch (error) {
      console.error('Erreur notation template:', error);
      return ApiResponse.error(res, 'Erreur lors de la notation du template', 500);
    }
  }

  /**
   * Valider une configuration de template
   */
  static async validerConfiguration(req, res) {
    try {
      const { id } = req.params;
      const { configuration } = req.body;

      const template = await Template.findByPk(id);
      if (!template) {
        return ApiResponse.notFound(res, 'Template non trouvé');
      }

      const validation = template.validerConfiguration(configuration);

      if (!validation.success) {
        return ApiResponse.validationError(res, validation.erreurs || []);
      }

      return ApiResponse.success(res, {
        valide: true,
        message: validation.message
      });

    } catch (error) {
      console.error('Erreur validation configuration:', error);
      return ApiResponse.error(res, 'Erreur lors de la validation de la configuration', 500);
    }
  }

  /**
   * Créer un nouveau template (admin uniquement)
   */
  static async creerTemplate(req, res) {
    try {
      const {
        nom,
        description,
        grade_requis_id = 1,
        config_couleurs,
        config_layout,
        config_composants,
        image_apercu,
        prix = 0,
        est_gratuit = true
      } = req.body;

      if (!nom) {
        return ApiResponse.validationError(res, [
          { field: 'nom', message: 'Le nom du template est requis' }
        ]);
      }

      const template = await Template.create({
        nom,
        description,
        grade_requis_id,
        config_couleurs: config_couleurs ? JSON.stringify(config_couleurs) : null,
        config_layout: config_layout ? JSON.stringify(config_layout) : null,
        config_composants: config_composants ? JSON.stringify(config_composants) : null,
        image_apercu,
        prix,
        est_gratuit
      });

      return ApiResponse.created(res, template, 'Template créé avec succès');

    } catch (error) {
      console.error('Erreur création template:', error);
      return ApiResponse.error(res, 'Erreur lors de la création du template', 500);
    }
  }

  /**
   * Mettre à jour un template (admin uniquement)
   */
  static async mettreAJourTemplate(req, res) {
    try {
      const { id } = req.params;
      const {
        nom,
        description,
        grade_requis_id,
        config_couleurs,
        config_layout,
        config_composants,
        image_apercu,
        prix,
        est_gratuit,
        statut
      } = req.body;

      const template = await Template.findByPk(id);
      if (!template) {
        return ApiResponse.notFound(res, 'Template non trouvé');
      }

      const donneesAMettreAJour = {};
      if (nom) donneesAMettreAJour.nom = nom;
      if (description) donneesAMettreAJour.description = description;
      if (grade_requis_id) donneesAMettreAJour.grade_requis_id = grade_requis_id;
      if (config_couleurs) donneesAMettreAJour.config_couleurs = JSON.stringify(config_couleurs);
      if (config_layout) donneesAMettreAJour.config_layout = JSON.stringify(config_layout);
      if (config_composants) donneesAMettreAJour.config_composants = JSON.stringify(config_composants);
      if (image_apercu) donneesAMettreAJour.image_apercu = image_apercu;
      if (prix !== undefined) donneesAMettreAJour.prix = prix;
      if (est_gratuit !== undefined) donneesAMettreAJour.est_gratuit = est_gratuit;
      if (statut) donneesAMettreAJour.statut = statut;

      await template.update(donneesAMettreAJour);

      return ApiResponse.updated(res, template);

    } catch (error) {
      console.error('Erreur mise à jour template:', error);
      return ApiResponse.error(res, 'Erreur lors de la mise à jour du template', 500);
    }
  }

  /**
   * Supprimer un template (admin uniquement)
   */
  static async supprimerTemplate(req, res) {
    try {
      const { id } = req.params;

      const template = await Template.findByPk(id);
      if (!template) {
        return ApiResponse.notFound(res, 'Template non trouvé');
      }

      // Vérifier qu'aucune boutique n'utilise ce template
      const boutiquesUtilisant = await Boutique.count({
        where: { template_id: id }
      });

      if (boutiquesUtilisant > 0) {
        return ApiResponse.error(res, `Impossible de supprimer: ${boutiquesUtilisant} boutique(s) utilisent ce template`, 400);
      }

      await template.destroy();
      return ApiResponse.deleted(res, 'Template supprimé avec succès');

    } catch (error) {
      console.error('Erreur suppression template:', error);
      return ApiResponse.error(res, 'Erreur lors de la suppression du template', 500);
    }
  }

  /**
   * Statistiques des templates (admin uniquement)
   */
  static async statistiquesTemplates(req, res) {
    try {
      const totalTemplates = await Template.count();
      const templatesActifs = await Template.count({ where: { statut: 'actif' } });
      const templatesGratuits = await Template.count({ where: { est_gratuit: true } });

      // Template le plus utilisé
      const templatePopulaire = await Template.findOne({
        order: [['nombre_utilisations', 'DESC']],
        attributes: ['id', 'nom', 'nombre_utilisations']
      });

      // Template le mieux noté
      const templateMieuxNote = await Template.findOne({
        order: [['note_moyenne', 'DESC']],
        attributes: ['id', 'nom', 'note_moyenne']
      });

      // Répartition par grade
      const repartitionParGrade = await Template.findAll({
        include: [{ model: GradeVendeur, as: 'gradeRequis' }],
        attributes: ['grade_requis_id'],
        raw: true
      });

      const compteurGrades = {};
      repartitionParGrade.forEach(t => {
        const grade = t['gradeRequis.nom'] || 'Inconnu';
        compteurGrades[grade] = (compteurGrades[grade] || 0) + 1;
      });

      return ApiResponse.success(res, {
        total_templates: totalTemplates,
        templates_actifs: templatesActifs,
        templates_inactifs: totalTemplates - templatesActifs,
        templates_gratuits: templatesGratuits,
        templates_payants: totalTemplates - templatesGratuits,
        template_populaire: templatePopulaire,
        template_mieux_note: templateMieuxNote,
        repartition_par_grade: compteurGrades
      });

    } catch (error) {
      console.error('Erreur statistiques templates:', error);
      return ApiResponse.error(res, 'Erreur lors de la récupération des statistiques', 500);
    }
  }
}

module.exports = TemplateController;