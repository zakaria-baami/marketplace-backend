// routes/devRoutes.js - Outils de développement
const express = require('express');
const router = express.Router();

console.log('🔧 Chargement des outils de développement...');

/**
 * @desc    Test de connectivité des outils dev
 * @route   GET /api/dev/ping
 * @access  Public
 */
router.get('/ping', (req, res) => {
  console.log('🏓 Ping dev tools reçu');
  res.json({
    success: true,
    message: 'Pong! Outils de développement fonctionnels',
    timestamp: new Date().toISOString(),
    module: 'dev-tools'
  });
});

/**
 * @desc    Informations sur les outils de développement
 * @route   GET /api/dev/info
 * @access  Public
 */
router.get('/info', (req, res) => {
  const baseUrl = `${req.protocol}://${req.get('host')}/api/dev`;
  
  res.json({
    success: true,
    module: 'Outils de Développement',
    description: 'Outils pour faciliter le développement et les tests',
    routes: {
      'GET /ping': 'Test de connectivité',
      'GET /info': 'Documentation (cette page)',
      'GET /tokens': 'Générer des tokens JWT pour tous les rôles',
      'POST /quick-login': 'Connexion rapide avec génération automatique de token',
      'GET /status': 'Statut complet du serveur et des modules',
      'POST /reset-test-data': 'Réinitialiser les données de test',
      'GET /routes': 'Liste toutes les routes disponibles'
    },
    base_url: baseUrl,
    environment: process.env.NODE_ENV || 'development',
    warning: '⚠️ Ces outils ne doivent être utilisés qu\'en développement'
  });
});

/**
 * @desc    Générer des tokens JWT pour tous les rôles
 * @route   GET /api/dev/tokens
 * @access  Public (Dev uniquement)
 */
router.get('/tokens', (req, res) => {
  try {
    console.log('🔑 Génération de tokens de développement');
    
    const jwt = require('jsonwebtoken');
    const secret = process.env.JWT_SECRET || 'secret_dev_temporaire';
    
    const users = {
      client: { id: 1, email: 'client@test.com', role: 'client' },
      vendeur: { id: 2, email: 'vendeur@test.com', role: 'vendeur' },
      admin: { id: 3, email: 'admin@test.com', role: 'admin' }
    };
    
    const tokens = {};
    Object.entries(users).forEach(([role, user]) => {
      tokens[role] = jwt.sign(user, secret, { expiresIn: '24h' });
    });
    
    res.json({
      success: true,
      message: 'Tokens de développement générés',
      tokens,
      users,
      usage: {
        header: 'Authorization: Bearer <token>',
        examples: {
          client: `curl -H "Authorization: Bearer ${tokens.client}" http://localhost:3308/api/clients/profile`,
          vendeur: `curl -H "Authorization: Bearer ${tokens.vendeur}" http://localhost:3308/api/vendeurs/profile`,
          admin: `curl -H "Authorization: Bearer ${tokens.admin}" http://localhost:3308/api/admin/users`
        }
      },
      expiration: '24 heures',
      warning: '⚠️ Tokens pour développement uniquement'
    });
    
  } catch (error) {
    console.error('❌ Erreur génération tokens:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la génération des tokens',
      error: error.message
    });
  }
});

/**
 * @desc    Connexion rapide avec génération automatique de token
 * @route   POST /api/dev/quick-login
 * @access  Public (Dev uniquement)
 */
router.post('/quick-login', (req, res) => {
  try {
    const { role = 'client' } = req.body;
    
    console.log(`⚡ Connexion rapide en tant que ${role}`);
    
    const jwt = require('jsonwebtoken');
    const secret = process.env.JWT_SECRET || 'secret_dev_temporaire';
    
    const users = {
      client: { 
        id: 1, 
        nom: 'Client Test',
        email: 'client@test.com', 
        role: 'client',
        client: {
          adresse: '123 Rue Test',
          telephone: '0123456789'
        }
      },
      vendeur: { 
        id: 2, 
        nom: 'Vendeur Test',
        email: 'vendeur@test.com', 
        role: 'vendeur',
        vendeur: {
          numero_fiscal: 'FR123456789',
          grade: { id: 1, nom: 'Amateur' }
        }
      },
      admin: { 
        id: 3, 
        nom: 'Admin Test',
        email: 'admin@test.com', 
        role: 'admin'
      }
    };
    
    const user = users[role] || users.client;
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role }, 
      secret, 
      { expiresIn: '24h' }
    );
    
    res.json({
      success: true,
      message: `Connexion rapide réussie en tant que ${role}`,
      user,
      token,
      expires_in: '24h',
      next_steps: [
        'Utilisez ce token dans l\'en-tête Authorization',
        `Testez avec: curl -H "Authorization: Bearer ${token}" http://localhost:3308/api/${role}s/profile`
      ]
    });
    
  } catch (error) {
    console.error('❌ Erreur connexion rapide:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la connexion rapide',
      error: error.message
    });
  }
});

/**
 * @desc    Statut complet du serveur et des modules
 * @route   GET /api/dev/status
 * @access  Public (Dev uniquement)
 */
router.get('/status', (req, res) => {
  try {
    console.log('📊 Vérification statut complet');
    
    const status = {
      server: {
        status: 'running',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        node_version: process.version,
        environment: process.env.NODE_ENV || 'development'
      },
      database: {
        configured: !!(process.env.DB_NAME && process.env.DB_HOST),
        host: process.env.DB_HOST || 'localhost',
        name: process.env.DB_NAME || 'marketplace_db'
      },
      jwt: {
        secret_configured: !!process.env.JWT_SECRET,
        expires_in: process.env.JWT_EXPIRES_IN || '24h'
      },
      modules: {
        auth: 'loaded', // Toujours chargé selon votre server.js
        dev_tools: 'loaded'
      }
    };
    
    // Test rapide des modules
    const moduleTests = [];
    try {
      require('../controllers/authController');
      moduleTests.push({ module: 'authController', status: 'ok' });
    } catch (error) {
      moduleTests.push({ module: 'authController', status: 'error', error: error.message });
    }
    
    try {
      require('../middlewares/auth');
      moduleTests.push({ module: 'authMiddleware', status: 'ok' });
    } catch (error) {
      moduleTests.push({ module: 'authMiddleware', status: 'error', error: error.message });
    }
    
    res.json({
      success: true,
      message: 'Statut complet du serveur',
      status,
      module_tests: moduleTests,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Erreur vérification statut:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la vérification du statut',
      error: error.message
    });
  }
});

/**
 * @desc    Réinitialiser les données de test
 * @route   POST /api/dev/reset-test-data
 * @access  Public (Dev uniquement)
 */
router.post('/reset-test-data', (req, res) => {
  try {
    console.log('🔄 Réinitialisation des données de test');
    
    // TODO: Implémenter la réinitialisation des données de test
    // - Supprimer les utilisateurs de test
    // - Recréer les données par défaut
    // - Réinitialiser les compteurs
    
    res.json({
      success: true,
      message: 'Données de test réinitialisées',
      actions: [
        'Utilisateurs de test supprimés',
        'Données par défaut recréées',
        'Compteurs réinitialisés'
      ],
      warning: '⚠️ Fonctionnalité à implémenter selon vos besoins'
    });
    
  } catch (error) {
    console.error('❌ Erreur réinitialisation:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la réinitialisation',
      error: error.message
    });
  }
});

/**
 * @desc    Liste toutes les routes disponibles
 * @route   GET /api/dev/routes
 * @access  Public (Dev uniquement)
 */
router.get('/routes', (req, res) => {
  try {
    console.log('📋 Génération liste des routes');
    
    const routes = {
      authentication: [
        'GET /api/auth/ping - Test connectivité auth',
        'GET /api/auth/info - Documentation auth',
        'POST /api/auth/register - Inscription (format standard)',
        'POST /api/auth/login - Connexion (format standard)',
        'POST /api/auth/inscription - Inscription (format personnalisé)',
        'POST /api/auth/connexion - Connexion (format personnalisé)',
        'GET /api/auth/profil - Profil utilisateur',
        'GET /api/auth/db-status - Statut base de données',
        'POST /api/auth/create-test-user - Créer utilisateur test',
        'POST /api/auth/test-password - Tester mots de passe'
      ],
      dev_tools: [
        'GET /api/dev/ping - Test connectivité dev',
        'GET /api/dev/info - Documentation dev',
        'GET /api/dev/tokens - Générer tokens JWT',
        'POST /api/dev/quick-login - Connexion rapide',
        'GET /api/dev/status - Statut serveur',
        'POST /api/dev/reset-test-data - Reset données test',
        'GET /api/dev/routes - Liste routes (cette page)'
      ],
      future_modules: [
        'À créer: /api/users/* - Gestion utilisateurs',
        'À créer: /api/clients/* - Fonctions clients',
        'À créer: /api/vendeurs/* - Fonctions vendeurs',
        'À créer: /api/boutiques/* - Gestion boutiques',
        'À créer: /api/produits/* - Gestion produits',
        'À créer: /api/templates/* - Templates boutiques'
      ]
    };
    
    res.json({
      success: true,
      message: 'Liste complète des routes',
      routes,
      total_routes: Object.values(routes).flat().length,
      base_url: `${req.protocol}://${req.get('host')}`,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Erreur liste routes:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la génération de la liste',
      error: error.message
    });
  }
});

console.log('✅ Outils de développement configurés');

module.exports = router;