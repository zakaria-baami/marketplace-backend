// controllers/statistiqueController.js
const { StatistiqueVente, Vendeur, Utilisateur } = require('../models');
const ApiResponse = require('../utils/apiResponse');
const { Op } = require('sequelize');

class StatistiqueController {
  /**
   * Obtenir les statistiques du vendeur connecté
   */
  static async obtenirMesStatistiques(req, res) {
    try {
      const { 
        date_debut, 
        date_fin, 
        derniers_mois = 3, 
        limite = 30 
      } = req.query;

      const options = { limite: parseInt(limite) };

      if (date_debut && date_fin) {
        options.dateDebut = date_debut;
        options.dateFin = date_fin;
      } else {
        options.derniersMois = parseInt(derniers_mois);
      }

      const resultat = await StatistiqueVente.obtenirStatistiquesVendeur(req.user.id, options);

      if (!resultat.success) {
        return ApiResponse.error(res, resultat.message, 400);
      }

      return ApiResponse.success(res, resultat, 'Statistiques récupérées avec succès');

    } catch (error) {
      console.error('Erreur récupération statistiques vendeur:', error);
      return ApiResponse.error(res, 'Erreur lors de la récupération des statistiques', 500);
    }
  }

  /**
   * Ajouter une vente aux statistiques
   */
  static async ajouterVente(req, res) {
    try {
      const { montant, quantite_produits = 1, date } = req.body;

      if (!montant || montant <= 0) {
        return ApiResponse.validationError(res, [
          { field: 'montant', message: 'Le montant doit être supérieur à 0' }
        ]);
      }

      const dateVente = date || new Date().toISOString().split('T')[0];

      // Créer ou mettre à jour la statistique
      const resultat = await StatistiqueVente.creerOuMettreAJour(req.user.id, dateVente, {
        ventes: quantite_produits,
        chiffre_affaires: montant
      });

      if (!resultat.success) {
        return ApiResponse.error(res, resultat.message, 400);
      }

      // Ajouter la vente à la statistique existante
      const ajoutVente = await resultat.statistique.ajouterVente(montant, quantite_produits);

      if (!ajoutVente.success) {
        return ApiResponse.error(res, ajoutVente.message, 400);
      }

      return ApiResponse.success(res, ajoutVente.nouvelles_statistiques, ajoutVente.message);

    } catch (error) {
      console.error('Erreur ajout vente:', error);
      return ApiResponse.error(res, 'Erreur lors de l\'ajout de la vente', 500);
    }
  }

  /**
   * Générer les statistiques d'une date spécifique
   */
  static async genererStatistiquesDate(req, res) {
    try {
      const { date } = req.params;

      if (!date) {
        return ApiResponse.validationError(res, [
          { field: 'date', message: 'La date est requise (format: YYYY-MM-DD)' }
        ]);
      }

      // Créer ou récupérer la statistique pour cette date
      const resultat = await StatistiqueVente.creerOuMettreAJour(req.user.id, date);

      if (!resultat.success) {
        return ApiResponse.error(res, resultat.message, 400);
      }

      // Générer les statistiques
      const generation = await resultat.statistique.genererStatistiques();

      if (!generation.success) {
        return ApiResponse.error(res, generation.message, 400);
      }

      return ApiResponse.success(res, generation.statistiques, generation.message);

    } catch (error) {
      console.error('Erreur génération statistiques:', error);
      return ApiResponse.error(res, 'Erreur lors de la génération des statistiques', 500);
    }
  }

  /**
   * Obtenir le résumé détaillé d'une statistique
   */
  static async obtenirResumeStatistique(req, res) {
    try {
      const { id } = req.params;

      const statistique = await StatistiqueVente.findOne({
        where: { 
          id,
          vendeur_id: req.user.id // S'assurer que c'est bien sa statistique
        }
      });

      if (!statistique) {
        return ApiResponse.notFound(res, 'Statistique non trouvée');
      }

      const resume = await statistique.obtenirResume();

      if (!resume.success) {
        return ApiResponse.error(res, resume.message, 400);
      }

      return ApiResponse.success(res, resume.resume);

    } catch (error) {
      console.error('Erreur résumé statistique:', error);
      return ApiResponse.error(res, 'Erreur lors de la récupération du résumé', 500);
    }
  }

  /**
   * Comparer deux périodes de statistiques
   */
  static async comparerPeriodes(req, res) {
    try {
      const { 
        date_debut_1, 
        date_fin_1, 
        date_debut_2, 
        date_fin_2 
      } = req.query;

      if (!date_debut_1 || !date_fin_1 || !date_debut_2 || !date_fin_2) {
        return ApiResponse.validationError(res, [
          { field: 'dates', message: 'Toutes les dates de début et fin sont requises pour les deux périodes' }
        ]);
      }

      // Récupérer les statistiques des deux périodes
      const periode1 = await StatistiqueVente.obtenirStatistiquesVendeur(req.user.id, {
        dateDebut: date_debut_1,
        dateFin: date_fin_1
      });

      const periode2 = await StatistiqueVente.obtenirStatistiquesVendeur(req.user.id, {
        dateDebut: date_debut_2,
        dateFin: date_fin_2
      });

      if (!periode1.success || !periode2.success) {
        return ApiResponse.error(res, 'Erreur lors de la récupération des statistiques', 400);
      }

      // Calculer les évolutions
      const resume1 = periode1.resume;
      const resume2 = periode2.resume;

      const ventesEvolution = resume1.total_ventes - resume2.total_ventes;
      const caEvolution = resume1.total_ca - resume2.total_ca;
      
      const ventesEvolutionPct = resume2.total_ventes > 0 
        ? ((ventesEvolution / resume2.total_ventes) * 100) 
        : 0;
      
      const caEvolutionPct = resume2.total_ca > 0 
        ? ((caEvolution / resume2.total_ca) * 100) 
        : 0;

      const comparaison = {
        periode_1: {
          dates: { debut: date_debut_1, fin: date_fin_1 },
          ...resume1
        },
        periode_2: {
          dates: { debut: date_debut_2, fin: date_fin_2 },
          ...resume2
        },
        evolution: {
          ventes: {
            absolue: ventesEvolution,
            pourcentage: Math.round(ventesEvolutionPct * 100) / 100,
            tendance: ventesEvolution > 0 ? 'hausse' : ventesEvolution < 0 ? 'baisse' : 'stable'
          },
          chiffre_affaires: {
            absolue: Math.round(caEvolution * 100) / 100,
            pourcentage: Math.round(caEvolutionPct * 100) / 100,
            tendance: caEvolution > 0 ? 'hausse' : caEvolution < 0 ? 'baisse' : 'stable'
          }
        }
      };

      return ApiResponse.success(res, comparaison, 'Comparaison effectuée avec succès');

    } catch (error) {
      console.error('Erreur comparaison périodes:', error);
      return ApiResponse.error(res, 'Erreur lors de la comparaison des périodes', 500);
    }
  }

  /**
   * Calculer les moyennes de performance du vendeur
   */
  static async calculerMoyennes(req, res) {
    try {
      const { derniers_jours = 30 } = req.query;

      const dateDebut = new Date();
      dateDebut.setDate(dateDebut.getDate() - parseInt(derniers_jours));

      const statistiques = await StatistiqueVente.findAll({
        where: {
          vendeur_id: req.user.id,
          date: {
            [Op.gte]: dateDebut.toISOString().split('T')[0]
          }
        },
        order: [['date', 'DESC']]
      });

      if (statistiques.length === 0) {
        return ApiResponse.success(res, {
          periode: { derniers_jours: parseInt(derniers_jours) },
          moyennes: {
            ventes_par_jour: 0,
            ca_par_jour: 0,
            ca_par_vente: 0
          },
          message: 'Aucune donnée trouvée pour cette période'
        });
      }

      const totaux = statistiques.reduce((acc, stat) => {
        acc.ventes += stat.ventes;
        acc.ca += parseFloat(stat.chiffre_affaires);
        return acc;
      }, { ventes: 0, ca: 0 });

      const moyennes = {
        ventes_par_jour: Math.round((totaux.ventes / statistiques.length) * 100) / 100,
        ca_par_jour: Math.round((totaux.ca / statistiques.length) * 100) / 100,
        ca_par_vente: totaux.ventes > 0 ? Math.round((totaux.ca / totaux.ventes) * 100) / 100 : 0
      };

      return ApiResponse.success(res, {
        periode: { 
          debut: dateDebut.toISOString().split('T')[0],
          fin: new Date().toISOString().split('T')[0],
          nombre_jours: statistiques.length
        },
        moyennes,
        totaux
      });

    } catch (error) {
      console.error('Erreur calcul moyennes:', error);
      return ApiResponse.error(res, 'Erreur lors du calcul des moyennes', 500);
    }
  }

  /**
   * Obtenir le classement des vendeurs (admin/vendeur peut voir sa position)
   */
  static async obtenirClassement(req, res) {
    try {
      const { 
        date_debut, 
        date_fin, 
        tri = 'ca', 
        limite = 20 
      } = req.query;

      const options = {
        limite: parseInt(limite),
        tri: tri === 'ventes' ? 'ventes' : 'ca'
      };

      if (date_debut && date_fin) {
        options.dateDebut = date_debut;
        options.dateFin = date_fin;
      }

      const resultat = await StatistiqueVente.obtenirClassementVendeurs(options);

      if (!resultat.success) {
        return ApiResponse.error(res, resultat.message, 400);
      }

      // Si c'est un vendeur, ajouter sa position dans le classement
      if (req.user.role === 'vendeur') {
        const maPosition = resultat.classement.findIndex(item => item.vendeur.id === req.user.id);
        
        return ApiResponse.success(res, {
          classement: resultat.classement,
          ma_position: maPosition !== -1 ? maPosition + 1 : null,
          mes_stats: maPosition !== -1 ? resultat.classement[maPosition] : null
        });
      }

      return ApiResponse.success(res, resultat.classement);

    } catch (error) {
      console.error('Erreur classement vendeurs:', error);
      return ApiResponse.error(res, 'Erreur lors de la récupération du classement', 500);
    }
  }

  /**
   * Générer le rapport global des ventes (admin uniquement)
   */
  static async genererRapportGlobal(req, res) {
    try {
      const { date_debut, date_fin } = req.query;

      const options = {};
      if (date_debut && date_fin) {
        options.dateDebut = new Date(date_debut);
        options.dateFin = new Date(date_fin);
      }

      const resultat = await StatistiqueVente.genererRapportGlobal(options);

      if (!resultat.success) {
        return ApiResponse.error(res, resultat.message, 400);
      }

      return ApiResponse.success(res, resultat.rapport, 'Rapport global généré avec succès');

    } catch (error) {
      console.error('Erreur rapport global:', error);
      return ApiResponse.error(res, 'Erreur lors de la génération du rapport global', 500);
    }
  }

  /**
   * Obtenir les statistiques d'un vendeur spécifique (admin uniquement)
   */
  static async obtenirStatistiquesVendeur(req, res) {
    try {
      const { vendeur_id } = req.params;
      const { 
        date_debut, 
        date_fin, 
        derniers_mois = 3, 
        limite = 50 
      } = req.query;

      const options = { limite: parseInt(limite) };

      if (date_debut && date_fin) {
        options.dateDebut = date_debut;
        options.dateFin = date_fin;
      } else {
        options.derniersMois = parseInt(derniers_mois);
      }

      const resultat = await StatistiqueVente.obtenirStatistiquesVendeur(vendeur_id, options);

      if (!resultat.success) {
        return ApiResponse.error(res, resultat.message, 400);
      }

      // Récupérer les infos du vendeur
      const vendeur = await Vendeur.findByPk(vendeur_id, {
        include: [{ model: Utilisateur, as: 'utilisateur' }]
      });

      return ApiResponse.success(res, {
        vendeur: {
          id: vendeur?.id,
          nom: vendeur?.utilisateur?.nom || 'Nom non disponible'
        },
        ...resultat
      });

    } catch (error) {
      console.error('Erreur statistiques vendeur admin:', error);
      return ApiResponse.error(res, 'Erreur lors de la récupération des statistiques du vendeur', 500);
    }
  }

  /**
   * Mettre à jour manuellement une statistique (admin uniquement)
   */
  static async mettreAJourStatistique(req, res) {
    try {
      const { id } = req.params;
      const { ventes, chiffre_affaires } = req.body;

      const statistique = await StatistiqueVente.findByPk(id);
      if (!statistique) {
        return ApiResponse.notFound(res, 'Statistique non trouvée');
      }

      const donneesAMettreAJour = {};
      if (ventes !== undefined) donneesAMettreAJour.ventes = ventes;
      if (chiffre_affaires !== undefined) donneesAMettreAJour.chiffre_affaires = chiffre_affaires;

      await statistique.update(donneesAMettreAJour);

      return ApiResponse.updated(res, statistique, 'Statistique mise à jour avec succès');

    } catch (error) {
      console.error('Erreur mise à jour statistique:', error);
      return ApiResponse.error(res, 'Erreur lors de la mise à jour de la statistique', 500);
    }
  }

  /**
   * Supprimer une statistique (admin uniquement)
   */
  static async supprimerStatistique(req, res) {
    try {
      const { id } = req.params;

      const statistique = await StatistiqueVente.findByPk(id);
      if (!statistique) {
        return ApiResponse.notFound(res, 'Statistique non trouvée');
      }

      await statistique.destroy();
      return ApiResponse.deleted(res, 'Statistique supprimée avec succès');

    } catch (error) {
      console.error('Erreur suppression statistique:', error);
      return ApiResponse.error(res, 'Erreur lors de la suppression de la statistique', 500);
    }
  }

  /**
   * Obtenir les statistiques de performance détaillées
   */
  static async obtenirPerformanceDetaillee(req, res) {
    try {
      const { derniers_jours = 7 } = req.query;

      const dateDebut = new Date();
      dateDebut.setDate(dateDebut.getDate() - parseInt(derniers_jours));

      const statistiques = await StatistiqueVente.findAll({
        where: {
          vendeur_id: req.user.id,
          date: {
            [Op.gte]: dateDebut.toISOString().split('T')[0]
          }
        },
        order: [['date', 'ASC']]
      });

      const performance = await Promise.all(
        statistiques.map(async (stat) => {
          const resume = await stat.obtenirResume();
          return {
            date: stat.date,
            ventes: stat.ventes,
            chiffre_affaires: parseFloat(stat.chiffre_affaires),
            evaluation: stat.evaluerPerformance(),
            moyennes: stat.calculerMoyennes().moyennes
          };
        })
      );

      // Calculer les tendances
      const tendances = {
        ventes: this.calculerTendance(performance.map(p => p.ventes)),
        chiffre_affaires: this.calculerTendance(performance.map(p => p.chiffre_affaires))
      };

      return ApiResponse.success(res, {
        periode: { derniers_jours: parseInt(derniers_jours) },
        performance_quotidienne: performance,
        tendances,
        resume_global: {
          total_ventes: performance.reduce((sum, p) => sum + p.ventes, 0),
          total_ca: performance.reduce((sum, p) => sum + p.chiffre_affaires, 0),
          score_moyen: Math.round(performance.reduce((sum, p) => sum + p.evaluation.score, 0) / performance.length)
        }
      });

    } catch (error) {
      console.error('Erreur performance détaillée:', error);
      return ApiResponse.error(res, 'Erreur lors de la récupération de la performance détaillée', 500);
    }
  }

  /**
   * Méthode utilitaire pour calculer la tendance
   */
  static calculerTendance(valeurs) {
    if (valeurs.length < 2) return { direction: 'stable', force: 0 };

    const debut = valeurs.slice(0, Math.floor(valeurs.length / 2));
    const fin = valeurs.slice(Math.floor(valeurs.length / 2));

    const moyenneDebut = debut.reduce((sum, val) => sum + val, 0) / debut.length;
    const moyenneFin = fin.reduce((sum, val) => sum + val, 0) / fin.length;

    const evolution = moyenneFin - moyenneDebut;
    const evolutionPct = moyenneDebut > 0 ? (evolution / moyenneDebut) * 100 : 0;

    let direction = 'stable';
    if (evolutionPct > 5) direction = 'hausse';
    else if (evolutionPct < -5) direction = 'baisse';

    return {
      direction,
      force: Math.abs(Math.round(evolutionPct * 100) / 100),
      evolution_absolue: Math.round(evolution * 100) / 100
    };
  }
}

module.exports = StatistiqueController;