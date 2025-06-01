// models/gradeVendeur.js
module.exports = (sequelize, DataTypes) => {
  const GradeVendeur = sequelize.define('GradeVendeur', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
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
    conditions: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    // Conditions numériques pour les promotions
    ventes_minimum: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    ca_minimum: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.00
    },
    duree_minimum_jours: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    // Avantages et limites du grade
    max_boutiques: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1
    },
    max_produits_par_boutique: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 10
    },
    commission_reduite: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0.00
    },
    templates_disponibles: {
      type: DataTypes.TEXT,
      allowNull: true,
      get() {
        const rawValue = this.getDataValue('templates_disponibles');
        return rawValue ? JSON.parse(rawValue) : this.getTemplatesParDefaut();
      },
      set(value) {
        this.setDataValue('templates_disponibles', JSON.stringify(value));
      }
    },
    avantages: {
      type: DataTypes.TEXT,
      allowNull: true,
      get() {
        const rawValue = this.getDataValue('avantages');
        return rawValue ? JSON.parse(rawValue) : [];
      },
      set(value) {
        this.setDataValue('avantages', JSON.stringify(value));
      }
    }
  }, {
    tableName: 'grade_vendeur',
    timestamps: true,
    underscored: true
  });

  // ==================== MÉTHODES D'INSTANCE ====================

  /**
   * Obtenir les templates par défaut selon le grade
   * @returns {Array} - IDs des templates
   */
  GradeVendeur.prototype.getTemplatesParDefaut = function() {
    const templatesParDefaut = {
      1: [1], // Bronze: template basique
      2: [1, 2], // Argent: basique + professionnel
      3: [1, 2, 3], // Or: basique + professionnel + premium
      4: [1, 2, 3, 4] // Platine: tous les templates
    };
    return templatesParDefaut[this.id] || [1];
  };

  /**
   * Vérifier si un vendeur respecte les conditions de ce grade
   * @param {Object} vendeur - Le vendeur à vérifier
   * @returns {Object} - Résultat de la vérification
   */
  GradeVendeur.prototype.verifierConditions = async function(vendeur) {
    try {
      const conditions = [];
      const erreurs = [];

      // Obtenir les statistiques du vendeur
      const statistiques = await this.obtenirStatistiquesVendeur(vendeur);

      // Vérifier le nombre de ventes
      if (statistiques.total_ventes < this.ventes_minimum) {
        erreurs.push(`Ventes insuffisantes: ${statistiques.total_ventes}/${this.ventes_minimum}`);
      } else {
        conditions.push(`✓ Ventes: ${statistiques.total_ventes}/${this.ventes_minimum}`);
      }

      // Vérifier le chiffre d'affaires
      const caVendeur = parseFloat(statistiques.chiffre_affaires);
      const caRequis = parseFloat(this.ca_minimum);
      
      if (caVendeur < caRequis) {
        erreurs.push(`CA insuffisant: ${caVendeur.toFixed(2)}€/${caRequis.toFixed(2)}€`);
      } else {
        conditions.push(`✓ CA: ${caVendeur.toFixed(2)}€/${caRequis.toFixed(2)}€`);
      }

      // Vérifier la durée d'activité
      if (this.duree_minimum_jours > 0) {
        const vendeurUser = await vendeur.getUtilisateur();
        const joursActivite = Math.floor((new Date() - vendeurUser.created_at) / (1000 * 60 * 60 * 24));
        
        if (joursActivite < this.duree_minimum_jours) {
          erreurs.push(`Durée insuffisante: ${joursActivite}/${this.duree_minimum_jours} jours`);
        } else {
          conditions.push(`✓ Activité: ${joursActivite}/${this.duree_minimum_jours} jours`);
        }
      }

      // Conditions spéciales selon le grade
      const conditionsSpeciales = await this.verifierConditionsSpeciales(vendeur);
      if (!conditionsSpeciales.success) {
        erreurs.push(...conditionsSpeciales.erreurs);
      } else {
        conditions.push(...conditionsSpeciales.conditions);
      }

      const success = erreurs.length === 0;

      return {
        success,
        message: success ? 'Toutes les conditions sont remplies' : 'Conditions non remplies',
        conditions_remplies: conditions,
        conditions_manquantes: erreurs,
        pourcentage_completion: Math.round((conditions.length / (conditions.length + erreurs.length)) * 100)
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  };

  /**
   * Obtenir les statistiques d'un vendeur
   * @param {Object} vendeur - Le vendeur
   * @returns {Object} - Statistiques consolidées
   */
  GradeVendeur.prototype.obtenirStatistiquesVendeur = async function(vendeur) {
    try {
      // Compter les paniers validés contenant des produits du vendeur
      const paniersValidés = await sequelize.models.Panier.findAll({
        where: {
          statut: ['valide', 'expedie', 'livre']
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
              where: { vendeur_id: vendeur.id }
            }]
          }]
        }]
      });

      let totalVentes = 0;
      let chiffreAffaires = 0;

      paniersValidés.forEach(panier => {
        const lignesVendeur = panier.lignes.filter(ligne => 
          ligne.produit && ligne.produit.boutique
        );
        
        if (lignesVendeur.length > 0) {
          totalVentes++;
          chiffreAffaires += lignesVendeur.reduce((sum, ligne) => 
            sum + parseFloat(ligne.sous_total), 0
          );
        }
      });

      return {
        total_ventes: totalVentes,
        chiffre_affaires: chiffreAffaires
      };
    } catch (error) {
      return {
        total_ventes: 0,
        chiffre_affaires: 0
      };
    }
  };

  /**
   * Vérifier les conditions spéciales selon le grade
   * @param {Object} vendeur - Le vendeur
   * @returns {Object} - Résultat des vérifications spéciales
   */
  GradeVendeur.prototype.verifierConditionsSpeciales = async function(vendeur) {
    const conditions = [];
    const erreurs = [];

    try {
      switch (this.id) {
        case 1: // Bronze - Aucune condition spéciale
          conditions.push('✓ Grade de base');
          break;

        case 2: // Argent
          // Vérifier qu'il a au moins une boutique active
          const boutiquesArgent = await vendeur.getBoutiques();
          if (boutiquesArgent.length === 0) {
            erreurs.push('Au moins une boutique requise');
          } else {
            conditions.push('✓ Boutique active');
          }
          break;

        case 3: // Or
          // Vérifier diversité des produits (au moins 3 catégories)
          const boutiquesOr = await vendeur.getBoutiques({
            include: [{
              model: sequelize.models.Produit,
              as: 'produits',
              include: [{
                model: sequelize.models.Categorie,
                as: 'categorie'
              }]
            }]
          });

          const categories = new Set();
          boutiquesOr.forEach(boutique => {
            boutique.produits.forEach(produit => {
              if (produit.categorie) {
                categories.add(produit.categorie.id);
              }
            });
          });

          if (categories.size < 3) {
            erreurs.push(`Diversité insuffisante: ${categories.size}/3 catégories`);
          } else {
            conditions.push(`✓ Diversité: ${categories.size}/3 catégories`);
          }
          break;

        case 4: // Platine
          // Vérifier régularité des ventes (au moins 3 semaines avec ventes sur le dernier mois)
          const il4Semaines = new Date();
          il4Semaines.setDate(il4Semaines.getDate() - 28);

          const statistiques = await sequelize.models.StatistiqueVente.findAll({
            where: {
              vendeur_id: vendeur.id,
              date: { [sequelize.Sequelize.Op.gte]: il4Semaines },
              ventes: { [sequelize.Sequelize.Op.gt]: 0 }
            }
          });

          const semainesAvecVentes = new Set();
          statistiques.forEach(stat => {
            const semaine = Math.floor((new Date(stat.date) - il4Semaines) / (7 * 24 * 60 * 60 * 1000));
            semainesAvecVentes.add(semaine);
          });

          if (semainesAvecVentes.size < 3) {
            erreurs.push(`Régularité insuffisante: ${semainesAvecVentes.size}/3 semaines avec ventes`);
          } else {
            conditions.push(`✓ Régularité: ${semainesAvecVentes.size}/4 semaines actives`);
          }
          break;
      }

      return {
        success: erreurs.length === 0,
        conditions,
        erreurs
      };
    } catch (error) {
      return {
        success: false,
        erreurs: [`Erreur vérification: ${error.message}`]
      };
    }
  };

  /**
   * Appliquer les avantages du grade au vendeur
   * @param {Object} vendeur - Le vendeur
   * @returns {Object} - Résultat de l'application
   */
  GradeVendeur.prototype.appliquerAvantages = async function(vendeur) {
    try {
      const avantagesAppliques = [];

      // Templates disponibles
      const templatesDispos = this.templates_disponibles;
      avantagesAppliques.push(`${templatesDispos.length} template(s) disponible(s)`);

      // Boutiques autorisées
      avantagesAppliques.push(`${this.max_boutiques} boutique(s) maximum`);

      // Produits par boutique
      avantagesAppliques.push(`${this.max_produits_par_boutique} produits max par boutique`);

      // Commission réduite
      if (this.commission_reduite > 0) {
        avantagesAppliques.push(`${this.commission_reduite}% de réduction sur les commissions`);
      }

      // Avantages spéciaux selon le grade
      const avantagesSpeciaux = this.appliquerAvantagesSpeciaux();
      if (avantagesSpeciaux.length > 0) {
        avantagesAppliques.push(...avantagesSpeciaux);
      }

      return {
        success: true,
        message: 'Avantages appliqués avec succès',
        avantages: avantagesAppliques
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  };

  /**
   * Obtenir les avantages spéciaux selon le grade
   * @returns {Array} - Liste des avantages spéciaux
   */
  GradeVendeur.prototype.appliquerAvantagesSpeciaux = function() {
    const avantages = [];

    switch (this.id) {
      case 1: // Bronze
        avantages.push('Accès aux fonctionnalités de base');
        break;

      case 2: // Argent
        avantages.push('Statistiques détaillées mensuelles');
        avantages.push('Support prioritaire');
        break;

      case 3: // Or
        avantages.push('Outils de marketing avancés');
        avantages.push('Promotion sur la page d\'accueil');
        avantages.push('Badge "Vendeur Or"');
        break;

      case 4: // Platine
        avantages.push('Manager dédié');
        avantages.push('Accès aux ventes privées');
        avantages.push('Programme de fidélité pour clients');
        avantages.push('Badge "Vendeur Platine"');
        break;
    }

    return avantages;
  };

  /**
   * Calculer le pourcentage de progression vers ce grade
   * @param {Object} vendeur - Le vendeur
   * @returns {Object} - Informations de progression
   */
  GradeVendeur.prototype.calculerProgression = async function(vendeur) {
    try {
      const verification = await this.verifierConditions(vendeur);
      const statistiques = await this.obtenirStatistiquesVendeur(vendeur);
      
      const progression = {
        grade_cible: this.nom,
        pourcentage_global: verification.pourcentage_completion,
        details: {},
        peut_promouvoir: verification.success
      };

      // Progression des ventes
      progression.details.ventes = {
        actuel: statistiques.total_ventes,
        requis: this.ventes_minimum,
        pourcentage: this.ventes_minimum > 0 ? 
          Math.min(Math.round((statistiques.total_ventes / this.ventes_minimum) * 100), 100) : 100
      };

      // Progression du CA
      const caVendeur = parseFloat(statistiques.chiffre_affaires);
      const caRequis = parseFloat(this.ca_minimum);
      progression.details.chiffre_affaires = {
        actuel: caVendeur,
        requis: caRequis,
        pourcentage: caRequis > 0 ? 
          Math.min(Math.round((caVendeur / caRequis) * 100), 100) : 100
      };

      // Progression de la durée
      if (this.duree_minimum_jours > 0) {
        const vendeurUser = await vendeur.getUtilisateur();
        const joursActivite = Math.floor((new Date() - vendeurUser.created_at) / (1000 * 60 * 60 * 24));
        
        progression.details.duree = {
          actuel: joursActivite,
          requis: this.duree_minimum_jours,
          pourcentage: Math.min(Math.round((joursActivite / this.duree_minimum_jours) * 100), 100)
        };
      }

      return {
        success: true,
        progression
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  };

  /**
   * Obtenir les détails complets du grade
   * @returns {Object} - Informations complètes du grade
   */
  GradeVendeur.prototype.obtenirDetails = function() {
    return {
      id: this.id,
      nom: this.nom,
      description: this.description,
      conditions: {
        ventes_minimum: this.ventes_minimum,
        ca_minimum: this.ca_minimum,
        duree_minimum_jours: this.duree_minimum_jours
      },
      avantages: {
        max_boutiques: this.max_boutiques,
        max_produits_par_boutique: this.max_produits_par_boutique,
        commission_reduite: this.commission_reduite,
        templates_disponibles: this.templates_disponibles,
        avantages_speciaux: this.appliquerAvantagesSpeciaux()
      }
    };
  };

  // ==================== MÉTHODES STATIQUES ====================

  /**
   * Obtenir tous les grades avec leurs détails
   * @returns {Object} - Liste de tous les grades
   */
  GradeVendeur.obtenirTousLesGrades = async function() {
    try {
      const grades = await this.findAll({
        order: [['id', 'ASC']]
      });

      return {
        success: true,
        grades: grades.map(grade => grade.obtenirDetails())
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  };

  /**
   * Obtenir le prochain grade disponible pour un vendeur
   * @param {Object} vendeur - Le vendeur
   * @returns {Object} - Prochain grade ou null
   */
  GradeVendeur.obtenirProchainGradeDisponible = async function(vendeur) {
    try {
      const gradeActuel = await vendeur.getGrade();
      const prochainGrade = await this.findOne({
        where: {
          id: { [sequelize.Sequelize.Op.gt]: gradeActuel.id }
        },
        order: [['id', 'ASC']]
      });

      if (!prochainGrade) {
        return {
          success: false,
          message: 'Grade maximum atteint'
        };
      }

      const progression = await prochainGrade.calculerProgression(vendeur);

      return {
        success: true,
        prochain_grade: {
          id: prochainGrade.id,
          nom: prochainGrade.nom,
          description: prochainGrade.description,
          progression: progression.progression
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
   * Initialiser les grades par défaut
   * @returns {Object} - Résultat de l'initialisation
   */
  GradeVendeur.initialiserGradesParDefaut = async function() {
    try {
      const gradesParDefaut = [
        {
          id: 1,
          nom: 'Bronze',
          description: 'Grade de départ pour tous les nouveaux vendeurs',
          ventes_minimum: 0,
          ca_minimum: 0.00,
          duree_minimum_jours: 0,
          max_boutiques: 1,
          max_produits_par_boutique: 10,
          commission_reduite: 0.00,
          templates_disponibles: [1]
        },
        {
          id: 2,
          nom: 'Argent',
          description: 'Grade intermédiaire avec plus d\'avantages',
          ventes_minimum: 10,
          ca_minimum: 500.00,
          duree_minimum_jours: 30,
          max_boutiques: 3,
          max_produits_par_boutique: 50,
          commission_reduite: 5.00,
          templates_disponibles: [1, 2]
        },
        {
          id: 3,
          nom: 'Or',
          description: 'Grade avancé pour vendeurs expérimentés',
          ventes_minimum: 50,
          ca_minimum: 2500.00,
          duree_minimum_jours: 90,
          max_boutiques: 5,
          max_produits_par_boutique: 200,
          commission_reduite: 10.00,
          templates_disponibles: [1, 2, 3]
        },
        {
          id: 4,
          nom: 'Platine',
          description: 'Grade premium avec tous les avantages',
          ventes_minimum: 200,
          ca_minimum: 10000.00,
          duree_minimum_jours: 180,
          max_boutiques: 10,
          max_produits_par_boutique: 1000,
          commission_reduite: 15.00,
          templates_disponibles: [1, 2, 3, 4]
        }
      ];

      for (const gradeData of gradesParDefaut) {
        await this.upsert(gradeData);
      }

      return {
        success: true,
        message: 'Grades par défaut initialisés'
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  };

  // ==================== ASSOCIATIONS ====================
  GradeVendeur.associate = function(models) {
    // Un grade est attribué à plusieurs vendeurs
    GradeVendeur.hasMany(models.Vendeur, {
      foreignKey: 'grade_id',
      as: 'vendeurs'
    });

    // Un grade donne accès à certains templates
    GradeVendeur.hasMany(models.Template, {
      foreignKey: 'grade_requis_id',
      as: 'templates'
    });
  };

  return GradeVendeur;
};