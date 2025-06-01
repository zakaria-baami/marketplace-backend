// controllers/authController.js - Version complète avec toutes les fonctionnalités
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');

// Configuration JWT
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// Configuration MySQL
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'marketplace_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Pool de connexions MySQL
let pool;

try {
  pool = mysql.createPool(dbConfig);
  console.log('🔗 Pool MySQL créé avec succès');
} catch (error) {
  console.error('❌ Erreur création pool MySQL:', error.message);
}

class AuthController {

  // ==================== UTILITAIRES ====================

  /**
   * Test de connexion MySQL
   */
  static async testConnection() {
    try {
      const connection = await pool.getConnection();
      await connection.ping();
      connection.release();
      console.log('✅ Test connexion MySQL: OK');
      return true;
    } catch (error) {
      console.error('❌ Test connexion MySQL: ÉCHEC', error.message);
      return false;
    }
  }

  /**
   * Génère un token JWT
   */
  static generateToken(userId, email, role) {
    return jwt.sign(
      { id: userId, email, role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
  }

  /**
   * Hash un mot de passe
   */
  static async hashPassword(password) {
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    return await bcrypt.hash(password, saltRounds);
  }

  /**
   * Valide un email
   */
  static isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // ==================== INSCRIPTION AVEC MYSQL ====================

  /**
   * @route   POST /api/auth/inscription
   * @desc    Inscription avec sauvegarde en base MySQL
   * @access  Public
   */
  static inscription = async (req, res) => {
    let connection;
    
    try {
      const { nom, email, password, role = 'client', telephone, adresse, numero_fiscal } = req.body;

      console.log('📝 Tentative inscription:', { nom, email, role });

      // === VALIDATIONS ===
      
      if (!nom || !email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Nom, email et mot de passe sont requis',
          erreurs: {
            nom: !nom ? 'Le nom est requis' : null,
            email: !email ? 'L\'email est requis' : null,
            password: !password ? 'Le mot de passe est requis' : null
          }
        });
      }

      if (!this.isValidEmail(email)) {
        return res.status(400).json({
          success: false,
          message: 'Format d\'email invalide',
          exemple: 'exemple@domaine.com'
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Le mot de passe doit contenir au moins 6 caractères'
        });
      }

      // Validation du rôle selon votre enum
      const rolesValides = ['client', 'vendeur', 'admin'];
      if (!rolesValides.includes(role)) {
        return res.status(400).json({
          success: false,
          message: 'Rôle invalide',
          roles_disponibles: rolesValides
        });
      }

      if (role === 'vendeur' && !numero_fiscal) {
        return res.status(400).json({
          success: false,
          message: 'Le numéro fiscal est requis pour les vendeurs'
        });
      }

      // === CONNEXION À LA BASE DE DONNÉES ===
      
      try {
        connection = await pool.getConnection();
        console.log('🔗 Connexion MySQL établie');
      } catch (error) {
        console.error('❌ Erreur connexion MySQL:', error.message);
        return res.status(500).json({
          success: false,
          message: 'Erreur de connexion à la base de données',
          suggestion: 'Vérifiez que MySQL est démarré',
          details: {
            host: dbConfig.host,
            database: dbConfig.database,
            error: error.message
          }
        });
      }

      // === VÉRIFICATION EMAIL EXISTANT ===
      
      try {
        const [existingUsers] = await connection.execute(
          'SELECT id FROM utilisateurs WHERE email = ?',
          [email.toLowerCase().trim()]
        );

        if (existingUsers.length > 0) {
          return res.status(409).json({
            success: false,
            message: 'Cet email est déjà utilisé',
            suggestion: 'Essayez de vous connecter ou utilisez un autre email'
          });
        }
        console.log('✅ Email disponible');
      } catch (error) {
        console.error('❌ Erreur vérification email:', error.message);
        if (error.code === 'ER_NO_SUCH_TABLE') {
          return res.status(500).json({
            success: false,
            message: 'Table utilisateurs non trouvée',
            suggestion: 'Vérifiez que la table existe dans votre base de données'
          });
        }
        throw error;
      }

      // === CRÉATION DE L'UTILISATEUR ===
      
      // Hash du mot de passe
      console.log('🔐 Hachage du mot de passe...');
      const hashedPassword = await this.hashPassword(password);

      // Début de transaction
      await connection.beginTransaction();
      console.log('🔄 Transaction démarrée');

      let userId;

      try {
        // 1. Insertion dans utilisateurs (avec created_at et updated_at automatiques)
        const [userResult] = await connection.execute(
          'INSERT INTO utilisateurs (nom, email, password, role) VALUES (?, ?, ?, ?)',
          [nom.trim(), email.toLowerCase().trim(), hashedPassword, role]
        );

        userId = userResult.insertId;
        console.log(`👤 Utilisateur créé avec ID: ${userId}`);

        // 2. Récupération des données complètes de l'utilisateur créé
        const [newUser] = await connection.execute(
          'SELECT id, nom, email, role, created_at FROM utilisateurs WHERE id = ?',
          [userId]
        );

        const userData = newUser[0];

        // 3. Insertion dans tables spécifiques selon le rôle
        if (role === 'client') {
          // Vérifier si la table clients existe
          try {
            await connection.execute(
              'INSERT INTO clients (id, adresse, telephone) VALUES (?, ?, ?)',
              [userId, adresse || null, telephone || null]
            );
            console.log('🏠 Données client ajoutées dans table clients');
          } catch (clientError) {
            console.log('⚠️ Table clients non trouvée ou erreur, mais utilisateur créé');
            console.log('Erreur client:', clientError.message);
          }
          
        } else if (role === 'vendeur') {
          // Vérifier si les tables vendeurs et GRADE_VENDEUR existent
          try {
            // Essayer de trouver un grade par défaut
            let gradeId = 1;
            try {
              const [grades] = await connection.execute(
                'SELECT id FROM GRADE_VENDEUR WHERE nom = ? LIMIT 1',
                ['Amateur']
              );
              
              if (grades.length > 0) {
                gradeId = grades[0].id;
              } else {
                // Créer le grade Amateur s'il n'existe pas
                const [gradeResult] = await connection.execute(
                  'INSERT INTO GRADE_VENDEUR (nom, conditions) VALUES (?, ?)',
                  ['Amateur', 'Grade par défaut pour nouveaux vendeurs']
                );
                gradeId = gradeResult.insertId;
                console.log('📊 Grade Amateur créé');
              }
            } catch (gradeError) {
              console.log('⚠️ Problème avec table GRADE_VENDEUR, utilisation ID par défaut');
            }
            
            await connection.execute(
              'INSERT INTO vendeurs (id, numero_fiscal, grade_id) VALUES (?, ?, ?)',
              [userId, numero_fiscal, gradeId]
            );
            console.log('🏪 Données vendeur ajoutées dans table vendeurs');
          } catch (vendeurError) {
            console.log('⚠️ Table vendeurs non trouvée ou erreur, mais utilisateur créé');
            console.log('Erreur vendeur:', vendeurError.message);
          }
        }

        // Valider la transaction
        await connection.commit();
        console.log('✅ Transaction validée');

        // === GÉNÉRATION TOKEN ===
        const token = this.generateToken(userId, userData.email, userData.role);

        // === RÉPONSE SUCCÈS ===
        res.status(201).json({
          success: true,
          message: `🎉 Inscription ${role} réussie avec succès`,
          user: {
            id: userData.id,
            nom: userData.nom,
            email: userData.email,
            role: userData.role,
            created_at: userData.created_at,
            ...(role === 'vendeur' && { grade: 'Amateur' })
          },
          token,
          expires_in: JWT_EXPIRES_IN,
          database: {
            status: '✅ Sauvegardé en MySQL',
            table: 'utilisateurs',
            additional_tables: role === 'client' ? 'clients' : role === 'vendeur' ? 'vendeurs' : 'aucune'
          }
        });

      } catch (transactionError) {
        // Annuler la transaction
        await connection.rollback();
        console.error('❌ Erreur transaction, rollback effectué');
        throw transactionError;
      }

    } catch (error) {
      console.error('❌ Erreur inscription:', error);
      
      // Gestion des erreurs MySQL spécifiques
      let message = 'Erreur lors de l\'inscription';
      let suggestion = '';

      switch (error.code) {
        case 'ER_DUP_ENTRY':
          message = 'Cet email est déjà utilisé';
          suggestion = 'Utilisez un autre email';
          break;
        case 'ER_NO_SUCH_TABLE':
          message = 'Table de base de données non trouvée';
          suggestion = 'Vérifiez que toutes les tables existent';
          break;
        case 'ECONNREFUSED':
          message = 'Connexion à MySQL refusée';
          suggestion = 'Vérifiez que MySQL est démarré';
          break;
        case 'ER_ACCESS_DENIED_ERROR':
          message = 'Accès à MySQL refusé';
          suggestion = 'Vérifiez les identifiants dans .env';
          break;
        case 'ER_BAD_DB_ERROR':
          message = 'Base de données non trouvée';
          suggestion = 'Créez la base marketplace_db';
          break;
        case 'ER_DATA_TOO_LONG':
          message = 'Données trop longues pour un champ';
          suggestion = 'Vérifiez la longueur des données';
          break;
      }

      res.status(500).json({
        success: false,
        message,
        suggestion,
        error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur interne',
        error_code: error.code || 'UNKNOWN'
      });
    } finally {
      if (connection) {
        connection.release();
        console.log('🔌 Connexion MySQL libérée');
      }
    }
  };

  // ==================== CONNEXION AVEC MYSQL ====================

  /**
   * @route   POST /api/auth/connexion
   * @desc    Connexion avec vérification en base MySQL
   * @access  Public
   */
  static connexion = async (req, res) => {
    try {
      const { email, password } = req.body;

      console.log('🔐 Tentative connexion:', { email });

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email et mot de passe requis'
        });
      }

      if (!this.isValidEmail(email)) {
        return res.status(400).json({
          success: false,
          message: 'Format d\'email invalide'
        });
      }

      // === RECHERCHE UTILISATEUR EN BASE ===
      
      const [users] = await pool.execute(
        'SELECT id, nom, email, password, role, created_at FROM utilisateurs WHERE email = ?',
        [email.toLowerCase().trim()]
      );

      if (users.length === 0) {
        console.log('❌ Utilisateur non trouvé:', email);
        return res.status(401).json({
          success: false,
          message: 'Email ou mot de passe incorrect'
        });
      }

      const user = users[0];
      console.log(`👤 Utilisateur trouvé: ${user.nom} (${user.role})`);

      // === VÉRIFICATION MOT DE PASSE ===
      
      const isValidPassword = await bcrypt.compare(password, user.password);

      if (!isValidPassword) {
        console.log('❌ Mot de passe incorrect');
        return res.status(401).json({
          success: false,
          message: 'Email ou mot de passe incorrect'
        });
      }

      // === RÉCUPÉRATION DONNÉES ADDITIONNELLES ===
      let additionalData = {};

      if (user.role === 'client') {
        try {
          const [clientData] = await pool.execute(
            'SELECT adresse, telephone FROM clients WHERE id = ?',
            [user.id]
          );
          if (clientData.length > 0) {
            additionalData.client_info = clientData[0];
          }
        } catch (error) {
          console.log('⚠️ Impossible de récupérer les données client');
        }
      } else if (user.role === 'vendeur') {
        try {
          const [vendeurData] = await pool.execute(
            'SELECT numero_fiscal, grade_id FROM vendeurs WHERE id = ?',
            [user.id]
          );
          if (vendeurData.length > 0) {
            additionalData.vendeur_info = vendeurData[0];
            
            // Récupérer le nom du grade
            try {
              const [gradeData] = await pool.execute(
                'SELECT nom FROM GRADE_VENDEUR WHERE id = ?',
                [vendeurData[0].grade_id]
              );
              if (gradeData.length > 0) {
                additionalData.vendeur_info.grade = gradeData[0].nom;
              }
            } catch (gradeError) {
              additionalData.vendeur_info.grade = 'Amateur';
            }
          }
        } catch (error) {
          console.log('⚠️ Impossible de récupérer les données vendeur');
        }
      }

      // === GÉNÉRATION TOKEN ===
      const token = this.generateToken(user.id, user.email, user.role);

      console.log('✅ Connexion réussie');

      res.json({
        success: true,
        message: '🎉 Connexion réussie',
        user: {
          id: user.id,
          nom: user.nom,
          email: user.email,
          role: user.role,
          created_at: user.created_at,
          ...additionalData
        },
        token,
        expires_in: JWT_EXPIRES_IN,
        login_time: new Date().toISOString(),
        database: '✅ Authentifié via MySQL'
      });

    } catch (error) {
      console.error('❌ Erreur connexion:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la connexion',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur interne'
      });
    }
  };

  // ==================== PROFIL COMPLET ====================

  /**
   * @route   GET /api/auth/profil
   * @desc    Récupération du profil utilisateur complet depuis MySQL
   * @access  Privé (JWT requis)
   */
  static profil = async (req, res) => {
    try {
      const userId = req.user.id;

      console.log('👤 Récupération profil pour utilisateur:', userId);

      // === RÉCUPÉRATION UTILISATEUR ===
      
      const [users] = await pool.execute(
        'SELECT id, nom, email, role, created_at, updated_at FROM utilisateurs WHERE id = ?',
        [userId]
      );

      if (users.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Utilisateur non trouvé'
        });
      }

      const user = users[0];

      // === RÉCUPÉRATION DONNÉES SPÉCIFIQUES AU RÔLE ===
      
      if (user.role === 'client') {
        try {
          const [clientData] = await pool.execute(
            'SELECT adresse, telephone, created_at, updated_at FROM clients WHERE id = ?',
            [userId]
          );
          if (clientData.length > 0) {
            user.client_info = clientData[0];
          }

          // Statistiques commandes (si table existe)
          try {
            const [commandeStats] = await pool.execute(
              'SELECT COUNT(*) as total_commandes, COALESCE(SUM(total), 0) as total_depense FROM commandes WHERE client_id = ?',
              [userId]
            );
            user.statistiques = commandeStats[0];
          } catch (error) {
            user.statistiques = { total_commandes: 0, total_depense: 0 };
          }

        } catch (error) {
          console.log('⚠️ Impossible de récupérer les données client');
        }

      } else if (user.role === 'vendeur') {
        try {
          const [vendeurData] = await pool.execute(
            'SELECT numero_fiscal, grade_id, created_at, updated_at FROM vendeurs WHERE id = ?',
            [userId]
          );
          
          if (vendeurData.length > 0) {
            user.vendeur_info = vendeurData[0];
            
            // Récupérer le nom du grade
            try {
              const [gradeData] = await pool.execute(
                'SELECT nom, conditions FROM GRADE_VENDEUR WHERE id = ?',
                [vendeurData[0].grade_id]
              );
              if (gradeData.length > 0) {
                user.vendeur_info.grade = gradeData[0].nom;
                user.vendeur_info.grade_conditions = gradeData[0].conditions;
              }
            } catch (gradeError) {
              user.vendeur_info.grade = 'Amateur';
            }
          }

          // Boutique du vendeur (si table existe)
          try {
            const [boutiqueData] = await pool.execute(
              'SELECT id, nom, description FROM boutiques WHERE vendeur_id = ?',
              [userId]
            );
            if (boutiqueData.length > 0) {
              user.boutique = boutiqueData[0];
              
              // Nombre de produits
              try {
                const [produitCount] = await pool.execute(
                  'SELECT COUNT(*) as total_produits FROM produits WHERE boutique_id = ?',
                  [boutiqueData[0].id]
                );
                user.boutique.total_produits = produitCount[0].total_produits;
              } catch (error) {
                user.boutique.total_produits = 0;
              }
            }
          } catch (error) {
            console.log('⚠️ Table boutiques non trouvée');
          }

          // Statistiques ventes (si table existe)
          try {
            const [venteStats] = await pool.execute(
              'SELECT COUNT(*) as total_ventes, COALESCE(SUM(montant), 0) as chiffre_affaires FROM ventes WHERE vendeur_id = ?',
              [userId]
            );
            user.statistiques_ventes = venteStats[0];
          } catch (error) {
            user.statistiques_ventes = { total_ventes: 0, chiffre_affaires: 0 };
          }

        } catch (error) {
          console.log('⚠️ Impossible de récupérer les données vendeur');
        }
      }

      res.json({
        success: true,
        message: 'Profil récupéré avec succès',
        user,
        permissions: this.getUserPermissions(user.role),
        note: '✅ Données récupérées depuis MySQL',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Erreur récupération profil:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération du profil',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur interne'
      });
    }
  };

  // ==================== CHANGEMENT MOT DE PASSE ====================

  /**
   * @route   PUT /api/auth/changer-mot-de-passe
   * @desc    Changement de mot de passe avec MySQL
   * @access  Privé (JWT requis)
   */
  static changerMotDePasse = async (req, res) => {
    try {
      const { ancien_password, nouveau_password } = req.body;
      const userId = req.user.id;

      console.log('🔄 Changement mot de passe pour utilisateur:', userId);

      // === VALIDATIONS ===
      if (!ancien_password || !nouveau_password) {
        return res.status(400).json({
          success: false,
          message: 'Ancien et nouveau mot de passe requis',
          erreurs: {
            ancien_password: !ancien_password ? 'L\'ancien mot de passe est requis' : null,
            nouveau_password: !nouveau_password ? 'Le nouveau mot de passe est requis' : null
          }
        });
      }

      if (nouveau_password.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Le nouveau mot de passe doit contenir au moins 6 caractères'
        });
      }

      if (ancien_password === nouveau_password) {
        return res.status(400).json({
          success: false,
          message: 'Le nouveau mot de passe doit être différent de l\'ancien'
        });
      }

      // === RÉCUPÉRATION ET VÉRIFICATION UTILISATEUR ===
      
      const [users] = await pool.execute(
        'SELECT id, password FROM utilisateurs WHERE id = ?',
        [userId]
      );

      if (users.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Utilisateur non trouvé'
        });
      }

      const user = users[0];

      // === VÉRIFICATION ANCIEN MOT DE PASSE ===
      
      const isValidOldPassword = await bcrypt.compare(ancien_password, user.password);

      if (!isValidOldPassword) {
        console.log('❌ Ancien mot de passe incorrect');
        return res.status(401).json({
          success: false,
          message: 'Ancien mot de passe incorrect'
        });
      }

      // === MISE À JOUR MOT DE PASSE ===
      
      const hashedNewPassword = await this.hashPassword(nouveau_password);

      await pool.execute(
        'UPDATE utilisateurs SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [hashedNewPassword, userId]
      );

      console.log('✅ Mot de passe changé avec succès');

      res.json({
        success: true,
        message: '🎉 Mot de passe changé avec succès',
        user_id: userId,
        timestamp: new Date().toISOString(),
        security_tip: 'Déconnectez-vous sur tous les appareils pour plus de sécurité'
      });

    } catch (error) {
      console.error('❌ Erreur changement mot de passe:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors du changement de mot de passe',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur interne'
      });
    }
  };

  // ==================== DÉCONNEXION ====================

  /**
   * @route   POST /api/auth/deconnexion
   * @desc    Déconnexion (côté client)
   * @access  Public
   */
  static deconnexion = async (req, res) => {
    try {
      // En production, vous pourriez ajouter le token à une blacklist
      // const token = req.headers.authorization?.replace('Bearer ', '');
      
      res.json({
        success: true,
        message: '🚪 Déconnexion réussie',
        note: 'Supprimez le token de votre localStorage/sessionStorage',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la déconnexion',
        error: error.message
      });
    }
  };

  // ==================== STATUS BASE DE DONNÉES ====================

  /**
   * @route   GET /api/auth/db-status
   * @desc    Test de connexion MySQL et état des tables
   * @access  Public
   */
  static dbStatus = async (req, res) => {
    try {
      console.log('🔍 Test statut MySQL...');
      
      const isConnected = await this.testConnection();
      
      if (!isConnected) {
        return res.status(500).json({
          success: false,
          message: 'Connexion MySQL échouée',
          config: {
            host: dbConfig.host,
            port: dbConfig.port,
            database: dbConfig.database,
            user: dbConfig.user
          }
        });
      }

      // Test des tables et statistiques
      const tables = {};
      
      try {
        // Table utilisateurs
        const [userCount] = await pool.execute('SELECT COUNT(*) as total FROM utilisateurs');
        tables.utilisateurs = { exists: true, count: userCount[0].total };
      } catch (error) {
        tables.utilisateurs = { exists: false, error: error.message };
      }

      try {
        // Table clients
        const [clientCount] = await pool.execute('SELECT COUNT(*) as total FROM clients');
        tables.clients = { exists: true, count: clientCount[0].total };
      } catch (error) {
        tables.clients = { exists: false, error: 'Table non trouvée' };
      }

      try {
        // Table vendeurs
        const [vendeurCount] = await pool.execute('SELECT COUNT(*) as total FROM vendeurs');
        tables.vendeurs = { exists: true, count: vendeurCount[0].total };
      } catch (error) {
        tables.vendeurs = { exists: false, error: 'Table non trouvée' };
      }

      try {
        // Table GRADE_VENDEUR
        const [gradeCount] = await pool.execute('SELECT COUNT(*) as total FROM GRADE_VENDEUR');
        tables.GRADE_VENDEUR = { exists: true, count: gradeCount[0].total };
      } catch (error) {
        tables.GRADE_VENDEUR = { exists: false, error: 'Table non trouvée' };
      }

      res.json({
        success: true,
        message: '✅ MySQL connecté et opérationnel',
        database: {
          status: 'CONNECTED',
          host: dbConfig.host,
          port: dbConfig.port,
          database: dbConfig.database,
          user: dbConfig.user
        },
        tables: tables,
        summary: {
          total_utilisateurs: tables.utilisateurs.exists ? tables.utilisateurs.count : 0,
          total_clients: tables.clients.exists ? tables.clients.count : 0,
          total_vendeurs: tables.vendeurs.exists ? tables.vendeurs.count : 0
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Erreur test MySQL:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur MySQL',
        error: error.message,
        suggestion: 'Vérifiez que MySQL fonctionne et que la base marketplace_db existe'
      });
    }
  };

  // ==================== MISE À JOUR PROFIL ====================

  /**
   * @route   PUT /api/auth/profil
   * @desc    Mise à jour du profil utilisateur
   * @access  Privé (JWT requis)
   */
  static updateProfil = async (req, res) => {
    let connection;
    
    try {
      const userId = req.user.id;
      const { nom, telephone, adresse, numero_fiscal } = req.body;

      console.log('📝 Mise à jour profil pour utilisateur:', userId);

      // === VALIDATIONS ===
      if (!nom || nom.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Le nom est requis'
        });
      }

      connection = await pool.getConnection();
      await connection.beginTransaction();

      // === MISE À JOUR TABLE UTILISATEURS ===
      await connection.execute(
        'UPDATE utilisateurs SET nom = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [nom.trim(), userId]
      );

      // === MISE À JOUR SELON LE RÔLE ===
      const userRole = req.user.role;

      if (userRole === 'client') {
        // Mise à jour ou insertion dans table clients
        const [existingClient] = await connection.execute(
          'SELECT id FROM clients WHERE id = ?',
          [userId]
        );

        if (existingClient.length > 0) {
          // Mise à jour
          await connection.execute(
            'UPDATE clients SET adresse = ?, telephone = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [adresse || null, telephone || null, userId]
          );
        } else {
          // Insertion
          await connection.execute(
            'INSERT INTO clients (id, adresse, telephone) VALUES (?, ?, ?)',
            [userId, adresse || null, telephone || null]
          );
        }

      } else if (userRole === 'vendeur') {
        if (numero_fiscal) {
          // Mise à jour numéro fiscal
          await connection.execute(
            'UPDATE vendeurs SET numero_fiscal = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [numero_fiscal, userId]
          );
        }
      }

      await connection.commit();

      // === RÉCUPÉRATION DONNÉES MISES À JOUR ===
      const [updatedUser] = await connection.execute(
        'SELECT id, nom, email, role, updated_at FROM utilisateurs WHERE id = ?',
        [userId]
      );

      res.json({
        success: true,
        message: '🎉 Profil mis à jour avec succès',
        user: updatedUser[0],
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      if (connection) await connection.rollback();
      console.error('❌ Erreur mise à jour profil:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la mise à jour du profil',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur interne'
      });
    } finally {
      if (connection) connection.release();
    }
  };

  // ==================== LISTE UTILISATEURS (ADMIN) ====================

  /**
   * @route   GET /api/auth/utilisateurs
   * @desc    Liste de tous les utilisateurs (admin uniquement)
   * @access  Privé (Admin uniquement)
   */
  static getUtilisateurs = async (req, res) => {
    try {
      const { page = 1, limit = 10, role } = req.query;
      const offset = (page - 1) * limit;

      console.log('📋 Récupération liste utilisateurs (admin)');

      // === CONSTRUCTION REQUÊTE ===
      let whereClause = '';
      let params = [];

      if (role && ['client', 'vendeur', 'admin'].includes(role)) {
        whereClause = 'WHERE role = ?';
        params.push(role);
      }

      // === RÉCUPÉRATION UTILISATEURS ===
      const [users] = await pool.execute(
        `SELECT id, nom, email, role, created_at, updated_at 
         FROM utilisateurs 
         ${whereClause} 
         ORDER BY created_at DESC 
         LIMIT ? OFFSET ?`,
        [...params, parseInt(limit), parseInt(offset)]
      );

      // === COMPTAGE TOTAL ===
      const [totalCount] = await pool.execute(
        `SELECT COUNT(*) as total FROM utilisateurs ${whereClause}`,
        params
      );

      const total = totalCount[0].total;
      const totalPages = Math.ceil(total / limit);

      res.json({
        success: true,
        message: 'Liste des utilisateurs récupérée',
        users,
        pagination: {
          current_page: parseInt(page),
          total_pages: totalPages,
          total_users: total,
          per_page: parseInt(limit)
        },
        filters: {
          role: role || 'tous'
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Erreur récupération utilisateurs:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des utilisateurs',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur interne'
      });
    }
  };

  // ==================== RECHERCHE UTILISATEURS ====================

  /**
   * @route   GET /api/auth/rechercher
   * @desc    Recherche d'utilisateurs par nom ou email
   * @access  Privé (Admin uniquement)
   */
  static rechercherUtilisateurs = async (req, res) => {
    try {
      const { q, role, limit = 20 } = req.query;

      if (!q || q.trim().length < 2) {
        return res.status(400).json({
          success: false,
          message: 'Le terme de recherche doit contenir au moins 2 caractères'
        });
      }

      console.log('🔍 Recherche utilisateurs:', q);

      // === CONSTRUCTION REQUÊTE ===
      let whereClause = 'WHERE (nom LIKE ? OR email LIKE ?)';
      let params = [`%${q.trim()}%`, `%${q.trim()}%`];

      if (role && ['client', 'vendeur', 'admin'].includes(role)) {
        whereClause += ' AND role = ?';
        params.push(role);
      }

      // === RECHERCHE ===
      const [users] = await pool.execute(
        `SELECT id, nom, email, role, created_at 
         FROM utilisateurs 
         ${whereClause} 
         ORDER BY nom ASC 
         LIMIT ?`,
        [...params, parseInt(limit)]
      );

      res.json({
        success: true,
        message: `${users.length} utilisateur(s) trouvé(s)`,
        users,
        search: {
          query: q.trim(),
          role: role || 'tous',
          results_count: users.length
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Erreur recherche utilisateurs:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la recherche',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur interne'
      });
    }
  };

  // ==================== STATISTIQUES AUTH ====================

  /**
   * @route   GET /api/auth/statistiques
   * @desc    Statistiques générales d'authentification
   * @access  Privé (Admin uniquement)
   */
  static getStatistiques = async (req, res) => {
    try {
      console.log('📊 Récupération statistiques auth');

      // === STATISTIQUES GÉNÉRALES ===
      const [userStats] = await pool.execute(`
        SELECT 
          COUNT(*) as total_utilisateurs,
          COUNT(CASE WHEN role = 'client' THEN 1 END) as total_clients,
          COUNT(CASE WHEN role = 'vendeur' THEN 1 END) as total_vendeurs,
          COUNT(CASE WHEN role = 'admin' THEN 1 END) as total_admins,
          COUNT(CASE WHEN DATE(created_at) = CURDATE() THEN 1 END) as inscriptions_aujourd_hui,
          COUNT(CASE WHEN DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) THEN 1 END) as inscriptions_semaine,
          COUNT(CASE WHEN DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN 1 END) as inscriptions_mois
        FROM utilisateurs
      `);

      // === ÉVOLUTION DES INSCRIPTIONS (7 derniers jours) ===
      const [evolutionStats] = await pool.execute(`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as inscriptions,
          COUNT(CASE WHEN role = 'client' THEN 1 END) as clients,
          COUNT(CASE WHEN role = 'vendeur' THEN 1 END) as vendeurs
        FROM utilisateurs 
        WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `);

      res.json({
        success: true,
        message: 'Statistiques récupérées avec succès',
        statistiques: {
          generales: userStats[0],
          evolution_7_jours: evolutionStats,
          jwt: {
            expires_in: JWT_EXPIRES_IN,
            secret_configured: !!JWT_SECRET
          }
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Erreur statistiques:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des statistiques',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur interne'
      });
    }
  };

  // ==================== UTILITAIRES ====================

  /**
   * Retourne les permissions selon le rôle
   */
  static getUserPermissions(role) {
    const permissions = {
      client: [
        'consulter_produits',
        'ajouter_panier',
        'passer_commande',
        'consulter_commandes',
        'envoyer_messages',
        'modifier_profil'
      ],
      vendeur: [
        'gerer_boutique',
        'ajouter_produits',
        'modifier_produits',
        'consulter_ventes',
        'consulter_statistiques',
        'envoyer_messages',
        'gerer_commandes',
        'modifier_profil'
      ],
      admin: [
        'gerer_utilisateurs',
        'consulter_toutes_donnees',
        'moderer_contenu',
        'gerer_systeme',
        'voir_statistiques',
        'rechercher_utilisateurs'
      ]
    };

    return permissions[role] || [];
  }

  /**
   * Validation et nettoyage des données utilisateur
   */
  static sanitizeUserData(data) {
    const sanitized = {};
    
    if (data.nom) sanitized.nom = data.nom.trim();
    if (data.email) sanitized.email = data.email.toLowerCase().trim();
    if (data.telephone) sanitized.telephone = data.telephone.trim();
    if (data.adresse) sanitized.adresse = data.adresse.trim();
    if (data.numero_fiscal) sanitized.numero_fiscal = data.numero_fiscal.trim();
    
    return sanitized;
  }
}

// Test de connexion au démarrage
if (pool) {
  AuthController.testConnection();
}

module.exports = AuthController;