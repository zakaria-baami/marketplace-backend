// controllers/categorieController.js
const { Categorie, Produit, Boutique, Vendeur, ImageProduit } = require('../models');
const ApiResponse = require('../utils/apiResponse');
const { Op } = require('sequelize');

class CategorieController {
  /**
   * Lister toutes les catégories avec compteurs
   */
  static async listerCategories(req, res) {
    try {
      const { 
        actives_uniquement = 'true',
        avec_produits_uniquement = 'false',
        niveau_max,
        parent_id,
        format = 'liste' 
      } = req.query;

      const options = {
        activesUniquement: actives_uniquement === 'true',
        produitsEnStockUniquement: avec_produits_uniquement === 'true'
      };

      if (niveau_max) options.niveauMax = parseInt(niveau_max);
      if (parent_id) options.parent_id = parent_id === 'null' ? null : parseInt(parent_id);

      let resultat;

      if (format === 'arbre') {
        // Retourner sous forme d'arbre hiérarchique
        resultat = await Categorie.obtenirArbre(options);
      } else {
        // Retourner sous forme de liste plate
        resultat = await Categorie.obtenirAvecCompteurs(options);
      }

      if (!resultat.success) {
        return ApiResponse.error(res, resultat.message, 400);
      }

      const dataKey = format === 'arbre' ? 'arbre_categories' : 'categories';
      return ApiResponse.success(res, resultat[dataKey]);

    } catch (error) {
      console.error('Erreur liste catégories:', error);
      return ApiResponse.error(res, 'Erreur lors de la récupération des catégories', 500);
    }
  }

  /**
   * Obtenir une catégorie par ID avec ses détails
   */
  static async obtenirCategorie(req, res) {
    try {
      const { id } = req.params;
      const { avec_statistiques = 'false' } = req.query;

      const categorie = await Categorie.findByPk(id, {
        include: [
          { model: Categorie, as: 'parent' },
          { model: Categorie, as: 'enfants', where: { actif: true }, required: false }
        ]
      });

      if (!categorie) {
        return ApiResponse.notFound(res, 'Catégorie non trouvée');
      }

      let response = categorie.toJSON();

      // Ajouter les statistiques si demandées
      if (avec_statistiques === 'true') {
        const statistiques = await categorie.obtenirStatistiques();
        if (statistiques.success) {
          response.statistiques = statistiques.statistiques;
        }
      }

      // Ajouter le chemin hiérarchique
      const chemin = await categorie.obtenirChemin();
      response.chemin = chemin;

      // Ajouter le nombre de produits
      response.nombre_produits = await categorie.compterProduits({ boutiquesActivesUniquement: true });

      return ApiResponse.success(res, response);

    } catch (error) {
      console.error('Erreur récupération catégorie:', error);
      return ApiResponse.error(res, 'Erreur lors de la récupération de la catégorie', 500);
    }
  }

  /**
   * Obtenir une catégorie par son slug
   */
  static async obtenirCategorieParSlug(req, res) {
    try {
      const { slug } = req.params;
      const { avec_statistiques = 'false' } = req.query;

      const categorie = await Categorie.findOne({
        where: { slug, actif: true },
        include: [
          { model: Categorie, as: 'parent' },
          { model: Categorie, as: 'enfants', where: { actif: true }, required: false }
        ]
      });

      if (!categorie) {
        return ApiResponse.notFound(res, 'Catégorie non trouvée');
      }

      let response = categorie.toJSON();

      if (avec_statistiques === 'true') {
        const statistiques = await categorie.obtenirStatistiques();
        if (statistiques.success) {
          response.statistiques = statistiques.statistiques;
        }
      }

      const chemin = await categorie.obtenirChemin();
      response.chemin = chemin;
      response.nombre_produits = await categorie.compterProduits({ boutiquesActivesUniquement: true });

      return ApiResponse.success(res, response);

    } catch (error) {
      console.error('Erreur récupération catégorie par slug:', error);
      return ApiResponse.error(res, 'Erreur lors de la récupération de la catégorie', 500);
    }
  }

  /**
   * Obtenir les produits d'une catégorie avec filtres
   */
  static async obtenirProduits(req, res) {
    try {
      const { id } = req.params;
      const {
        page = 1,
        limit = 12,
        disponibles_uniquement = 'true',
        prix_min,
        prix_max,
        recherche,
        tri = 'nom',
        vendeur_id
      } = req.query;

      const categorie = await Categorie.findByPk(id);
      if (!categorie) {
        return ApiResponse.notFound(res, 'Catégorie non trouvée');
      }

      const options = {
        disponiblesUniquement: disponibles_uniquement === 'true',
        limite: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit),
        tri
      };

      if (prix_min) options.prixMin = parseFloat(prix_min);
      if (prix_max) options.prixMax = parseFloat(prix_max);
      if (recherche) options.recherche = recherche;

      const resultat = await categorie.obtenirProduits(options);

      if (!resultat.success) {
        return ApiResponse.error(res, resultat.message, 400);
      }

      // Filtrer par vendeur si spécifié
      let produitsFiltres = resultat.produits;
      if (vendeur_id) {
        produitsFiltres = resultat.produits.filter(p => 
          p.boutique.vendeur_id === parseInt(vendeur_id)
        );
      }

      return ApiResponse.paginated(res, produitsFiltres, {
        page: parseInt(page),
        limit: parseInt(limit),
        total: produitsFiltres.length,
        categorie: {
          id: categorie.id,
          nom: categorie.nom,
          slug: categorie.slug
        }
      });

    } catch (error) {
      console.error('Erreur produits catégorie:', error);
      return ApiResponse.error(res, 'Erreur lors de la récupération des produits', 500);
    }
  }

  /**
   * Rechercher des catégories
   */
  static async rechercherCategories(req, res) {
    try {
      const { q: terme, limit = 10, actives_uniquement = 'true' } = req.query;

      if (!terme || terme.trim().length < 2) {
        return ApiResponse.validationError(res, [
          { field: 'q', message: 'Le terme de recherche doit contenir au moins 2 caractères' }
        ]);
      }

      const options = {
        limite: parseInt(limit),
        activesUniquement: actives_uniquement === 'true'
      };

      const resultat = await Categorie.rechercher(terme.trim(), options);

      if (!resultat.success) {
        return ApiResponse.error(res, resultat.message, 400);
      }

      return ApiResponse.success(res, {
        terme_recherche: terme,
        resultats: resultat.resultats,
        nombre_resultats: resultat.resultats.length
      });

    } catch (error) {
      console.error('Erreur recherche catégories:', error);
      return ApiResponse.error(res, 'Erreur lors de la recherche', 500);
    }
  }

  /**
   * Obtenir les catégories populaires
   */
  static async obtenirCategoriesPopulaires(req, res) {
    try {
      const { limit = 8 } = req.query;

      const resultat = await Categorie.obtenirPopulaires({
        limite: parseInt(limit)
      });

      if (!resultat.success) {
        return ApiResponse.error(res, resultat.message, 400);
      }

      return ApiResponse.success(res, resultat.categories_populaires);

    } catch (error) {
      console.error('Erreur catégories populaires:', error);
      return ApiResponse.error(res, 'Erreur lors de la récupération des catégories populaires', 500);
    }
  }

  /**
   * Obtenir les sous-catégories d'une catégorie
   */
  static async obtenirSousCategories(req, res) {
    try {
      const { id } = req.params;

      const categorie = await Categorie.findByPk(id);
      if (!categorie) {
        return ApiResponse.notFound(res, 'Catégorie non trouvée');
      }

      const resultat = await categorie.obtenirSousCategories();

      if (!resultat.success) {
        return ApiResponse.error(res, resultat.message, 400);
      }

      return ApiResponse.success(res, {
        categorie_parent: {
          id: categorie.id,
          nom: categorie.nom,
          slug: categorie.slug
        },
        sous_categories: resultat.sous_categories
      });

    } catch (error) {
      console.error('Erreur sous-catégories:', error);
      return ApiResponse.error(res, 'Erreur lors de la récupération des sous-catégories', 500);
    }
  }

  /**
   * Créer une nouvelle catégorie (admin uniquement)
   */
  static async creerCategorie(req, res) {
    try {
      const {
        nom,
        description,
        icone,
        couleur = '#3498db',
        ordre_affichage = 0,
        parent_id,
        slug,
        meta_title,
        meta_description
      } = req.body;

      if (!nom || nom.trim().length < 2) {
        return ApiResponse.validationError(res, [
          { field: 'nom', message: 'Le nom doit contenir au moins 2 caractères' }
        ]);
      }

      // Vérifier l'unicité du nom
      const categorieExistante = await Categorie.findOne({
        where: { nom: nom.trim() }
      });

      if (categorieExistante) {
        return ApiResponse.error(res, 'Une catégorie avec ce nom existe déjà', 409);
      }

      // Calculer le niveau si parent spécifié
      let niveau = 0;
      if (parent_id) {
        const parent = await Categorie.findByPk(parent_id);
        if (!parent) {
          return ApiResponse.notFound(res, 'Catégorie parent non trouvée');
        }
        niveau = parent.niveau + 1;
      }

      const categorie = await Categorie.create({
        nom: nom.trim(),
        description,
        icone,
        couleur,
        ordre_affichage,
        parent_id: parent_id || null,
        niveau,
        slug,
        meta_title,
        meta_description
      });

      return ApiResponse.created(res, categorie, 'Catégorie créée avec succès');

    } catch (error) {
      console.error('Erreur création catégorie:', error);
      if (error.name === 'SequelizeUniqueConstraintError') {
        return ApiResponse.error(res, 'Le nom ou le slug existe déjà', 409);
      }
      return ApiResponse.error(res, 'Erreur lors de la création de la catégorie', 500);
    }
  }

  /**
   * Mettre à jour une catégorie (admin uniquement)
   */
  static async mettreAJourCategorie(req, res) {
    try {
      const { id } = req.params;
      const {
        nom,
        description,
        icone,
        couleur,
        ordre_affichage,
        parent_id,
        actif,
        slug,
        meta_title,
        meta_description
      } = req.body;

      const categorie = await Categorie.findByPk(id);
      if (!categorie) {
        return ApiResponse.notFound(res, 'Catégorie non trouvée');
      }

      // Vérifier l'unicité du nom si modifié
      if (nom && nom !== categorie.nom) {
        const categorieExistante = await Categorie.findOne({
          where: { 
            nom: nom.trim(),
            id: { [Op.ne]: id }
          }
        });

        if (categorieExistante) {
          return ApiResponse.error(res, 'Une catégorie avec ce nom existe déjà', 409);
        }
      }

      // Calculer le nouveau niveau si parent modifié
      let niveau = categorie.niveau;
      if (parent_id !== undefined) {
        if (parent_id) {
          // Vérifier que ce n'est pas un parent circulaire
          if (parseInt(parent_id) === parseInt(id)) {
            return ApiResponse.error(res, 'Une catégorie ne peut pas être son propre parent', 400);
          }

          const parent = await Categorie.findByPk(parent_id);
          if (!parent) {
            return ApiResponse.notFound(res, 'Catégorie parent non trouvée');
          }
          niveau = parent.niveau + 1;
        } else {
          niveau = 0;
        }
      }

      const donneesAMettreAJour = {};
      if (nom) donneesAMettreAJour.nom = nom.trim();
      if (description !== undefined) donneesAMettreAJour.description = description;
      if (icone !== undefined) donneesAMettreAJour.icone = icone;
      if (couleur) donneesAMettreAJour.couleur = couleur;
      if (ordre_affichage !== undefined) donneesAMettreAJour.ordre_affichage = ordre_affichage;
      if (parent_id !== undefined) {
        donneesAMettreAJour.parent_id = parent_id;
        donneesAMettreAJour.niveau = niveau;
      }
      if (actif !== undefined) donneesAMettreAJour.actif = actif;
      if (slug !== undefined) donneesAMettreAJour.slug = slug;
      if (meta_title !== undefined) donneesAMettreAJour.meta_title = meta_title;
      if (meta_description !== undefined) donneesAMettreAJour.meta_description = meta_description;

      await categorie.update(donneesAMettreAJour);

      return ApiResponse.updated(res, categorie);

    } catch (error) {
      console.error('Erreur mise à jour catégorie:', error);
      if (error.name === 'SequelizeUniqueConstraintError') {
        return ApiResponse.error(res, 'Le nom ou le slug existe déjà', 409);
      }
      return ApiResponse.error(res, 'Erreur lors de la mise à jour de la catégorie', 500);
    }
  }

  /**
   * Supprimer une catégorie (admin uniquement)
   */
  static async supprimerCategorie(req, res) {
    try {
      const { id } = req.params;
      const { forcer = 'false' } = req.query;

      const categorie = await Categorie.findByPk(id);
      if (!categorie) {
        return ApiResponse.notFound(res, 'Catégorie non trouvée');
      }

      // Vérifier si la catégorie peut être supprimée
      const verification = await categorie.peutEtreSupprimee();
      
      if (!verification.peut_supprimer && forcer !== 'true') {
        return ApiResponse.error(res, verification.message, 400, {
          peut_forcer: true,
          raisons: verification.raisons
        });
      }

      if (forcer === 'true') {
        // Supprimer en cascade : déplacer les sous-catégories vers le parent
        if (verification.raisons.sous_categories > 0) {
          await Categorie.update(
            { parent_id: categorie.parent_id },
            { where: { parent_id: categorie.id } }
          );
        }

        // Pour les produits, vous devriez les déplacer vers une catégorie par défaut
        // ou demander à l'utilisateur de les réassigner
        if (verification.raisons.produits > 0) {
          return ApiResponse.error(res, 
            `Impossible de supprimer: ${verification.raisons.produits} produit(s) doivent être réassignés à une autre catégorie`, 
            400
          );
        }
      }

      await categorie.destroy();
      return ApiResponse.deleted(res, 'Catégorie supprimée avec succès');

    } catch (error) {
      console.error('Erreur suppression catégorie:', error);
      return ApiResponse.error(res, 'Erreur lors de la suppression de la catégorie', 500);
    }
  }

  /**
   * Obtenir les statistiques détaillées d'une catégorie (admin uniquement)
   */
  static async obtenirStatistiques(req, res) {
    try {
      const { id } = req.params;

      const categorie = await Categorie.findByPk(id);
      if (!categorie) {
        return ApiResponse.notFound(res, 'Catégorie non trouvée');
      }

      const resultat = await categorie.obtenirStatistiques();

      if (!resultat.success) {
        return ApiResponse.error(res, resultat.message, 400);
      }

      return ApiResponse.success(res, {
        categorie: {
          id: categorie.id,
          nom: categorie.nom,
          niveau: categorie.niveau
        },
        ...resultat.statistiques
      });

    } catch (error) {
      console.error('Erreur statistiques catégorie:', error);
      return ApiResponse.error(res, 'Erreur lors de la récupération des statistiques', 500);
    }
  }

  /**
   * Obtenir les statistiques globales des catégories (admin uniquement)
   */
  static async obtenirStatistiquesGlobales(req, res) {
    try {
      const resultat = await Categorie.obtenirStatistiquesGlobales();

      if (!resultat.success) {
        return ApiResponse.error(res, resultat.message, 400);
      }

      return ApiResponse.success(res, resultat.statistiques);

    } catch (error) {
      console.error('Erreur statistiques globales:', error);
      return ApiResponse.error(res, 'Erreur lors de la récupération des statistiques globales', 500);
    }
  }

  /**
   * Réorganiser l'ordre des catégories (admin uniquement)
   */
  static async reorganiserOrdre(req, res) {
    try {
      const { categories_ordre } = req.body;

      if (!Array.isArray(categories_ordre)) {
        return ApiResponse.validationError(res, [
          { field: 'categories_ordre', message: 'Un tableau d\'objets {id, ordre} est requis' }
        ]);
      }

      // Mettre à jour l'ordre pour chaque catégorie
      const promisesUpdate = categories_ordre.map(item => 
        Categorie.update(
          { ordre_affichage: item.ordre },
          { where: { id: item.id } }
        )
      );

      await Promise.all(promisesUpdate);

      return ApiResponse.success(res, null, 'Ordre des catégories mis à jour avec succès');

    } catch (error) {
      console.error('Erreur réorganisation ordre:', error);
      return ApiResponse.error(res, 'Erreur lors de la réorganisation', 500);
    }
  }
}

module.exports = CategorieController;