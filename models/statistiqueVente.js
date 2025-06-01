// models/statistiqueVente.js
module.exports = (sequelize, DataTypes) => {
  const StatistiqueVente = sequelize.define('StatistiqueVente', {
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
    ventes: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    chiffre_affaires: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.00,
      validate: {
        min: 0
      }
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'statistique_ventes',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ['vendeur_id', 'date'],
        name: 'idx_vendeur_date'
      },
      {
        unique: true,
        fields: ['vendeur_id', 'date'],
        name: 'unique_vendeur_date'
      }
    ]
  });

  // ==================== MÉTHODES D'INSTANCE ====================

  /**
   * Générer les statistiques réelles depuis les paniers validés
   * @returns {Object} - Résultat de la génération
   */
  StatistiqueVente.prototype.genererStatistiques = async function() {
    try {
      const dateStr = this.date;
      const vendeurId = this.vendeur_id;
      
      // Convertir la date en plage complète (début et fin de journée)
      const dateDebut = new Date(`${dateStr}T00:00:00`);
      const dateFin = new Date(`${dateStr}T23:59:59`);

      // Récupérer les paniers validés pour ce vendeur à cette date
      const paniersValidés = await sequelize.models.Panier.findAll({
        where: {
          statut: ['valide', 'expedie', 'livre'],
          date_validation: {
            [sequelize.Sequelize.Op.between]: [dateDebut, dateFin]
          }
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
              where: { vendeur_id: vendeurId }
            }]
          }]
        }]
      });

      let totalVentes = 0;
      let totalCA = 0;

      // Calculer les statistiques réelles
      paniersValidés.forEach(panier => {
        const lignesVendeur = panier.lignes.filter(ligne => 
          ligne.produit && ligne.produit.boutique && ligne.produit.boutique.vendeur_id === vendeurId
        );
        
        if (lignesVendeur.length > 0) {
          totalVentes++;
          const caPanier = lignesVendeur.reduce((sum, ligne) => 
            sum + parseFloat(ligne.sous_total || 0), 0
          );
          totalCA += caPanier;
        }
      });

      // Mettre à jour les statistiques
      await this.update({
        ventes: totalVentes,
        chiffre_affaires: totalCA
      });

      return {
        success: true,
        message: 'Statistiques générées avec succès',
        statistiques: {
          vendeur_id: this.vendeur_id,
          date: this.date,
          ventes: totalVentes,
          chiffre_affaires: totalCA,
          paniers_analysés: paniersValidés.length
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
   * Ajouter une vente à cette statistique
   * @param {number} montant - Montant de la vente
   * @param {number} quantiteProduits - Nombre de produits vendus (optionnel)
   * @returns {Object} - Résultat de l'ajout
   */
  StatistiqueVente.prototype.ajouterVente = async function(montant, quantiteProduits = 1) {
    try {
      if (montant < 0) {
        throw new Error('Le montant ne peut pas être négatif');
      }

      if (quantiteProduits < 1) {
        throw new Error('La quantité de produits doit être au moins 1');
      }

      const nouvellesVentes = this.ventes + 1; // Une vente = un panier validé
      const nouveauCA = parseFloat(this.chiffre_affaires) + parseFloat(montant);

      await this.update({
        ventes: nouvellesVentes,
        chiffre_affaires: nouveauCA
      });

      return {
        success: true,
        message: 'Vente ajoutée avec succès',
        nouvelles_statistiques: {
          ventes: nouvellesVentes,
          chiffre_affaires: nouveauCA,
          montant_ajoute: parseFloat(montant)
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
   * Calculer la moyenne journalière des ventes
   * @returns {Object} - Moyennes calculées
   */
  StatistiqueVente.prototype.calculerMoyennes = function() {
    return {
      success: true,
      moyennes: {
        ventes_jour: this.ventes,
        ca_jour: parseFloat(this.chiffre_affaires),
        ca_par_vente: this.ventes > 0 ? parseFloat(this.chiffre_affaires) / this.ventes : 0
      }
    };
  };

  /**
   * Comparer avec une autre statistique
   * @param {Object} autreStatistique - Autre StatistiqueVente
   * @returns {Object} - Comparaison détaillée
   */
  StatistiqueVente.prototype.comparerAvec = function(autreStatistique) {
    try {
      const ventesEvolution = this.ventes - autreStatistique.ventes;
      const caEvolution = parseFloat(this.chiffre_affaires) - parseFloat(autreStatistique.chiffre_affaires);
      
      const ventesEvolutionPct = autreStatistique.ventes > 0 
        ? ((ventesEvolution / autreStatistique.ventes) * 100) 
        : 0;
      
      const caEvolutionPct = parseFloat(autreStatistique.chiffre_affaires) > 0 
        ? ((caEvolution / parseFloat(autreStatistique.chiffre_affaires)) * 100) 
        : 0;

      return {
        success: true,
        comparaison: {
          periode_actuelle: {
            date: this.date,
            ventes: this.ventes,
            chiffre_affaires: parseFloat(this.chiffre_affaires)
          },
          periode_precedente: {
            date: autreStatistique.date,
            ventes: autreStatistique.ventes,
            chiffre_affaires: parseFloat(autreStatistique.chiffre_affaires)
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
   * Obtenir un résumé formaté de cette statistique
   * @returns {Object} - Résumé formaté
   */
  StatistiqueVente.prototype.obtenirResume = async function() {
    try {
      const vendeur = await this.getVendeur({
        include: [{
          model: sequelize.models.Utilisateur,
          as: 'utilisateur'
        }, {
          model: sequelize.models.GradeVendeur,
          as: 'grade'
        }]
      });

      return {
        success: true,
        resume: {
          vendeur: {
            id: vendeur.id,
            nom: vendeur.utilisateur?.nom || 'Nom non disponible',
            grade: vendeur.grade?.nom || 'Grade non défini'
          },
          date: this.date,
          performance: {
            ventes: this.ventes,
            chiffre_affaires: parseFloat(this.chiffre_affaires),
            ca_moyen_par_vente: this.ventes > 0 
              ? Math.round((parseFloat(this.chiffre_affaires) / this.ventes) * 100) / 100 
              : 0
          },
          evaluation: this.evaluerPerformance()
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
   * Évaluer la performance de cette journée
   * @returns {Object} - Évaluation de performance
   */
  StatistiqueVente.prototype.evaluerPerformance = function() {
    let niveau = 'faible';
    let couleur = 'red';
    let message = 'Performance à améliorer';

    const ca = parseFloat(this.chiffre_affaires);

    if (this.ventes >= 10 && ca >= 500) {
      niveau = 'excellent';
      couleur = 'green';
      message = 'Excellente performance !';
    } else if (this.ventes >= 5 && ca >= 200) {
      niveau = 'bon';
      couleur = 'blue';
      message = 'Bonne performance';
    } else if (this.ventes >= 1 && ca >= 50) {
      niveau = 'moyen';
      couleur = 'orange';
      message = 'Performance correcte';
    }

    return {
      niveau,
      couleur,
      message,
      score: Math.min(
        Math.round(((this.ventes * 10) + (ca / 10)) / 2),
        100
      )
    };
  };

  // ==================== MÉTHODES STATIQUES ====================

  /**
   * Créer ou mettre à jour une statistique pour un vendeur à une date
   * @param {number} vendeurId - ID du vendeur
   * @param {string} date - Date (YYYY-MM-DD)
   * @param {Object} donnees - Données à ajouter
   * @returns {Object} - Statistique créée ou mise à jour
   */
  StatistiqueVente.creerOuMettreAJour = async function(vendeurId, date, donnees = {}) {
    try {
      let statistique = await this.findOne({
        where: {
          vendeur_id: vendeurId,
          date: date
        }
      });

      if (statistique) {
        // Mettre à jour les données existantes
        const nouvellesVentes = statistique.ventes + (donnees.ventes || 0);
        const nouveauCA = parseFloat(statistique.chiffre_affaires) + (parseFloat(donnees.chiffre_affaires) || 0);

        await statistique.update({
          ventes: nouvellesVentes,
          chiffre_affaires: nouveauCA
        });

        return {
          success: true,
          action: 'mise_a_jour',
          statistique
        };
      } else {
        // Créer une nouvelle statistique
        statistique = await this.create({
          vendeur_id: vendeurId,
          date: date,
          ventes: donnees.ventes || 0,
          chiffre_affaires: donnees.chiffre_affaires || 0
        });

        return {
          success: true,
          action: 'creation',
          statistique
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
   * Mettre à jour automatiquement les statistiques après validation d'un panier
   * @param {number} vendeurId - ID du vendeur
   * @param {number} montantVente - Montant de la vente
   * @param {string} date - Date de la vente (optionnel, défaut aujourd'hui)
   * @returns {Object} - Résultat de la mise à jour
   */
  StatistiqueVente.mettreAJourApresVente = async function(vendeurId, montantVente, date = null) {
    try {
      const dateVente = date || new Date().toISOString().split('T')[0];
      
      const resultat = await this.creerOuMettreAJour(vendeurId, dateVente, {
        ventes: 1,
        chiffre_affaires: montantVente
      });

      return {
        success: true,
        message: 'Statistiques mises à jour après vente',
        action: resultat.action,
        montant: montantVente,
        date: dateVente
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  };

  /**
   * Obtenir les statistiques d'un vendeur sur une période
   * @param {number} vendeurId - ID du vendeur
   * @param {Object} options - Options de période
   * @returns {Object} - Statistiques de la période
   */
  StatistiqueVente.obtenirStatistiquesVendeur = async function(vendeurId, options = {}) {
    try {
      const whereClause = { vendeur_id: vendeurId };

      // Gestion des périodes prédéfinies
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
          [sequelize.Sequelize.Op.gte]: dateDebut.toISOString().split('T')[0]
        };
      }

      // Filtrer par période personnalisée
      if (options.dateDebut && options.dateFin) {
        whereClause.date = {
          [sequelize.Sequelize.Op.between]: [options.dateDebut, options.dateFin]
        };
      }

      const statistiques = await this.findAll({
        where: whereClause,
        order: [['date', 'DESC']],
        limit: options.limite || 365
      });

      // Calculer les totaux et moyennes
      const totaux = statistiques.reduce((acc, stat) => {
        acc.ventes += stat.ventes;
        acc.chiffre_affaires += parseFloat(stat.chiffre_affaires);
        return acc;
      }, { ventes: 0, chiffre_affaires: 0 });

      return {
        success: true,
        periode: options.periode || 'personnalisee',
        statistiques: statistiques.map(s => ({
          date: s.date,
          ventes: s.ventes,
          chiffre_affaires: parseFloat(s.chiffre_affaires),
          ca_moyen: s.ventes > 0 ? parseFloat(s.chiffre_affaires) / s.ventes : 0,
          evaluation: s.evaluerPerformance()
        })),
        resume: {
          nombre_jours: statistiques.length,
          total_ventes: totaux.ventes,
          total_ca: Math.round(totaux.chiffre_affaires * 100) / 100,
          moyenne_ventes_jour: statistiques.length > 0 
            ? Math.round(totaux.ventes / statistiques.length * 100) / 100 
            : 0,
          moyenne_ca_jour: statistiques.length > 0 
            ? Math.round(totaux.chiffre_affaires / statistiques.length * 100) / 100 
            : 0,
          ca_moyen_par_vente: totaux.ventes > 0 
            ? Math.round(totaux.chiffre_affaires / totaux.ventes * 100) / 100 
            : 0
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
   * Obtenir le classement des vendeurs sur une période
   * @param {Object} options - Options de classement
   * @returns {Object} - Classement des vendeurs
   */
  StatistiqueVente.obtenirClassementVendeurs = async function(options = {}) {
    try {
      const whereClause = {};
      
      // Filtrer par période
      if (options.dateDebut && options.dateFin) {
        whereClause.date = {
          [sequelize.Sequelize.Op.between]: [options.dateDebut, options.dateFin]
        };
      } else {
        // Par défaut, derniers 30 jours
        const dateDebut = new Date();
        dateDebut.setDate(dateDebut.getDate() - 30);
        whereClause.date = {
          [sequelize.Sequelize.Op.gte]: dateDebut.toISOString().split('T')[0]
        };
      }

      const statistiques = await this.findAll({
        where: whereClause,
        attributes: [
          'vendeur_id',
          [sequelize.fn('SUM', sequelize.col('ventes')), 'total_ventes'],
          [sequelize.fn('SUM', sequelize.col('chiffre_affaires')), 'total_ca'],
          [sequelize.fn('AVG', sequelize.col('ventes')), 'moyenne_ventes'],
          [sequelize.fn('AVG', sequelize.col('chiffre_affaires')), 'moyenne_ca'],
          [sequelize.fn('COUNT', sequelize.col('date')), 'jours_actifs']
        ],
        include: [{
          model: sequelize.models.Vendeur,
          as: 'vendeur',
          include: [{
            model: sequelize.models.Utilisateur,
            as: 'utilisateur',
            attributes: ['nom', 'email']
          }, {
            model: sequelize.models.GradeVendeur,
            as: 'grade',
            attributes: ['nom']
          }]
        }],
        group: ['vendeur_id'],
        order: options.tri === 'ventes' 
          ? [[sequelize.fn('SUM', sequelize.col('ventes')), 'DESC']]
          : [[sequelize.fn('SUM', sequelize.col('chiffre_affaires')), 'DESC']],
        limit: options.limite || 20
      });

      return {
        success: true,
        critere_tri: options.tri || 'chiffre_affaires',
        classement: statistiques.map((stat, index) => ({
          rang: index + 1,
          vendeur: {
            id: stat.vendeur_id,
            nom: stat.vendeur?.utilisateur?.nom || 'Nom non disponible',
            email: stat.vendeur?.utilisateur?.email || '',
            grade: stat.vendeur?.grade?.nom || 'Bronze'
          },
          performance: {
            total_ventes: parseInt(stat.get('total_ventes')) || 0,
            total_ca: Math.round(parseFloat(stat.get('total_ca')) * 100) / 100 || 0,
            moyenne_ventes: Math.round(parseFloat(stat.get('moyenne_ventes')) * 100) / 100 || 0,
            moyenne_ca: Math.round(parseFloat(stat.get('moyenne_ca')) * 100) / 100 || 0,
            jours_actifs: parseInt(stat.get('jours_actifs')) || 0
          }
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
   * Générer un rapport de ventes global pour les administrateurs
   * @param {Object} options - Options du rapport
   * @returns {Object} - Rapport complet
   */
  StatistiqueVente.genererRapportGlobal = async function(options = {}) {
    try {
      const dateDebut = options.dateDebut || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const dateFin = options.dateFin || new Date();

      // Statistiques globales
      const statsGlobales = await this.findAll({
        where: {
          date: {
            [sequelize.Sequelize.Op.between]: [
              dateDebut.toISOString().split('T')[0],
              dateFin.toISOString().split('T')[0]
            ]
          }
        },
        attributes: [
          [sequelize.fn('SUM', sequelize.col('ventes')), 'total_ventes'],
          [sequelize.fn('SUM', sequelize.col('chiffre_affaires')), 'total_ca'],
          [sequelize.fn('COUNT', sequelize.col('id')), 'nombre_enregistrements'],
          [sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.col('vendeur_id'))), 'vendeurs_actifs'],
          [sequelize.fn('AVG', sequelize.col('ventes')), 'moyenne_ventes'],
          [sequelize.fn('AVG', sequelize.col('chiffre_affaires')), 'moyenne_ca']
        ],
        raw: true
      });

      const stats = statsGlobales[0];

      // Évolution par jour
      const evolutionJournaliere = await this.findAll({
        where: {
          date: {
            [sequelize.Sequelize.Op.between]: [
              dateDebut.toISOString().split('T')[0],
              dateFin.toISOString().split('T')[0]
            ]
          }
        },
        attributes: [
          'date',
          [sequelize.fn('SUM', sequelize.col('ventes')), 'ventes_jour'],
          [sequelize.fn('SUM', sequelize.col('chiffre_affaires')), 'ca_jour'],
          [sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.col('vendeur_id'))), 'vendeurs_actifs_jour']
        ],
        group: ['date'],
        order: [['date', 'ASC']],
        raw: true
      });

      return {
        success: true,
        rapport: {
          periode: { 
            debut: dateDebut.toISOString().split('T')[0], 
            fin: dateFin.toISOString().split('T')[0] 
          },
          global: {
            total_ventes: parseInt(stats.total_ventes) || 0,
            total_ca: Math.round(parseFloat(stats.total_ca) * 100) / 100 || 0,
            vendeurs_actifs: parseInt(stats.vendeurs_actifs) || 0,
            jours_enregistres: parseInt(stats.nombre_enregistrements) || 0
          },
          moyennes: {
            ventes_par_jour: Math.round(parseFloat(stats.moyenne_ventes) * 100) / 100 || 0,
            ca_par_jour: Math.round(parseFloat(stats.moyenne_ca) * 100) / 100 || 0,
            ca_par_vente: (parseInt(stats.total_ventes) || 0) > 0 
              ? Math.round((parseFloat(stats.total_ca) / parseInt(stats.total_ventes)) * 100) / 100 
              : 0
          },
          evolution_journaliere: evolutionJournaliere.map(jour => ({
            date: jour.date,
            ventes: parseInt(jour.ventes_jour) || 0,
            chiffre_affaires: Math.round(parseFloat(jour.ca_jour) * 100) / 100 || 0,
            vendeurs_actifs: parseInt(jour.vendeurs_actifs_jour) || 0
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
   * Régénérer toutes les statistiques depuis les paniers validés
   * @param {Object} options - Options de régénération
   * @returns {Object} - Résultat de la régénération
   */
  StatistiqueVente.regenererToutesLesStatistiques = async function(options = {}) {
    try {
      const dateDebut = options.dateDebut || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000); // 1 an par défaut
      const dateFin = options.dateFin || new Date();

      // Supprimer les anciennes statistiques si demandé
      if (options.supprimerAncien) {
        await this.destroy({
          where: {
            date: {
              [sequelize.Sequelize.Op.between]: [
                dateDebut.toISOString().split('T')[0],
                dateFin.toISOString().split('T')[0]
              ]
            }
          }
        });
      }

      // Récupérer tous les paniers validés dans la période
      const paniersValidés = await sequelize.models.Panier.findAll({
        where: {
          statut: ['valide', 'expedie', 'livre'],
          date_validation: {
            [sequelize.Sequelize.Op.between]: [dateDebut, dateFin]
          }
        },
        include: [{
          model: sequelize.models.LignePanier,
          as: 'lignes',
          include: [{
            model: sequelize.models.Produit,
            as: 'produit',
            include: [{
              model: sequelize.models.Boutique,
              as: 'boutique'
            }]
          }]
        }]
      });

      const statistiquesParVendeurDate = {};

      // Traiter chaque panier
      paniersValidés.forEach(panier => {
        const dateVente = panier.date_validation.toISOString().split('T')[0];
        
        // Grouper par vendeur
        const ventesParvVendeur = {};
        
        panier.lignes.forEach(ligne => {
          if (ligne.produit && ligne.produit.boutique) {
            const vendeurId = ligne.produit.boutique.vendeur_id;
            if (!ventesParvVendeur[vendeurId]) {
              ventesParvVendeur[vendeurId] = 0;
            }
            ventesParvVendeur[vendeurId] += parseFloat(ligne.sous_total || 0);
          }
        });

        // Créer les statistiques
        Object.keys(ventesParvVendeur).forEach(vendeurId => {
          const cle = `${vendeurId}_${dateVente}`;
          if (!statistiquesParVendeurDate[cle]) {
            statistiquesParVendeurDate[cle] = {
              vendeur_id: parseInt(vendeurId),
              date: dateVente,
              ventes: 0,
              chiffre_affaires: 0
            };
          }
          statistiquesParVendeurDate[cle].ventes += 1;
          statistiquesParVendeurDate[cle].chiffre_affaires += ventesParvVendeur[vendeurId];
        });
      });

      // Créer les enregistrements en base
      const statistiques = Object.values(statistiquesParVendeurDate);
      
      for (const stat of statistiques) {
        await this.creerOuMettreAJour(stat.vendeur_id, stat.date, {
          ventes: stat.ventes,
          chiffre_affaires: stat.chiffre_affaires
        });
      }

      return {
        success: true,
        message: 'Statistiques régénérées avec succès',
        details: {
          paniers_traités: paniersValidés.length,
          statistiques_créées: statistiques.length,
          periode: {
            debut: dateDebut.toISOString().split('T')[0],
            fin: dateFin.toISOString().split('T')[0]
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
   * Obtenir les tendances d'évolution sur une période
   * @param {number} vendeurId - ID du vendeur (optionnel)
   * @param {Object} options - Options d'analyse
   * @returns {Object} - Analyse des tendances
   */
  StatistiqueVente.obtenirTendances = async function(vendeurId = null, options = {}) {
    try {
      const whereClause = {};
      
      if (vendeurId) {
        whereClause.vendeur_id = vendeurId;
      }

      // Période par défaut : 3 mois
      const dateFin = new Date();
      const dateDebut = new Date();
      dateDebut.setMonth(dateDebut.getMonth() - 3);

      whereClause.date = {
        [sequelize.Sequelize.Op.between]: [
          dateDebut.toISOString().split('T')[0],
          dateFin.toISOString().split('T')[0]
        ]
      };

      const statistiques = await this.findAll({
        where: whereClause,
        order: [['date', 'ASC']]
      });

      if (statistiques.length < 2) {
        return {
          success: true,
          tendances: {
            message: 'Données insuffisantes pour analyser les tendances',
            periode_analysée: statistiques.length
          }
        };
      }

      // Calculer les tendances
      const premiereMotie = statistiques.slice(0, Math.floor(statistiques.length / 2));
      const deuxiemeMotie = statistiques.slice(Math.floor(statistiques.length / 2));

      const moyenneVentes1 = premiereMotie.reduce((sum, s) => sum + s.ventes, 0) / premiereMotie.length;
      const moyenneVentes2 = deuxiemeMotie.reduce((sum, s) => sum + s.ventes, 0) / deuxiemeMotie.length;

      const moyenneCA1 = premiereMotie.reduce((sum, s) => sum + parseFloat(s.chiffre_affaires), 0) / premiereMotie.length;
      const moyenneCA2 = deuxiemeMotie.reduce((sum, s) => sum + parseFloat(s.chiffre_affaires), 0) / deuxiemeMotie.length;

      const tendanceVentes = moyenneVentes2 > moyenneVentes1 ? 'hausse' : 
                           moyenneVentes2 < moyenneVentes1 ? 'baisse' : 'stable';
      
      const tendanceCA = moyenneCA2 > moyenneCA1 ? 'hausse' : 
                        moyenneCA2 < moyenneCA1 ? 'baisse' : 'stable';

      return {
        success: true,
        tendances: {
          periode: {
            debut: dateDebut.toISOString().split('T')[0],
            fin: dateFin.toISOString().split('T')[0],
            jours_analysés: statistiques.length
          },
          ventes: {
            tendance: tendanceVentes,
            moyenne_début: Math.round(moyenneVentes1 * 100) / 100,
            moyenne_fin: Math.round(moyenneVentes2 * 100) / 100,
            evolution_pct: moyenneVentes1 > 0 ? 
              Math.round(((moyenneVentes2 - moyenneVentes1) / moyenneVentes1) * 10000) / 100 : 0
          },
          chiffre_affaires: {
            tendance: tendanceCA,
            moyenne_début: Math.round(moyenneCA1 * 100) / 100,
            moyenne_fin: Math.round(moyenneCA2 * 100) / 100,
            evolution_pct: moyenneCA1 > 0 ? 
              Math.round(((moyenneCA2 - moyenneCA1) / moyenneCA1) * 10000) / 100 : 0
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

  // ==================== ASSOCIATIONS ====================
  StatistiqueVente.associate = function(models) {
    // Une statistique appartient à un vendeur
    StatistiqueVente.belongsTo(models.Vendeur, {
      foreignKey: 'vendeur_id',
      as: 'vendeur'
    });
  };

  return StatistiqueVente;
};