// routes/authRoutes.js - Version base de données
const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Import du contrôleur
const AuthController = require('../controllers/authController');

// ==================== MIDDLEWARES ====================

/**
 * Middleware d'authentification JWT
 */
const authenticateJWT = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'Token d\'authentification manquant',
        format_attendu: 'Authorization: Bearer <token>'
      });
    }

    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : authHeader;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token invalide'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      iat: decoded.iat
    };

    next();

  } catch (error) {
    console.error('❌ Erreur authentification JWT:', error.message);

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Token invalide'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expiré',
        suggestion: 'Reconnectez-vous'
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Erreur d\'authentification'
    });
  }
};

// ==================== ROUTES PUBLIQUES ====================

/**
 * @route   POST /api/auth/inscription
 * @desc    Inscription avec sauvegarde BDD
 * @access  Public
 */
router.post('/inscription', AuthController.inscription);

/**
 * @route   POST /api/auth/connexion
 * @desc    Connexion avec vérification BDD
 * @access  Public
 */
router.post('/connexion', AuthController.connexion);

/**
 * @route   POST /api/auth/deconnexion
 * @desc    Déconnexion
 * @access  Public
 */
router.post('/deconnexion', AuthController.deconnexion);

/**
 * @route   GET /api/auth/db-status
 * @desc    Statut de la base de données
 * @access  Public
 */
router.get('/db-status', AuthController.dbStatus);

// ==================== ROUTES PROTÉGÉES ====================

/**
 * @route   GET /api/auth/profil
 * @desc    Profil utilisateur depuis BDD
 * @access  Privé
 */
router.get('/profil', authenticateJWT, AuthController.profil);

/**
 * @route   PUT /api/auth/changer-mot-de-passe
 * @desc    Changement de mot de passe
 * @access  Privé
 */
router.put('/changer-mot-de-passe', authenticateJWT, AuthController.changerMotDePasse);

// ==================== DOCUMENTATION ====================

/**
 * @route   GET /api/auth/info
 * @desc    Documentation des routes
 * @access  Public
 */
router.get('/info', (req, res) => {
  res.json({
    success: true,
    message: 'API d\'authentification avec base de données MySQL',
    base_url: '/api/auth',
    database: 'MySQL marketplace_db',
    routes: {
      publiques: {
        'POST /inscription': {
          description: 'Créer un compte (sauvegardé en BDD)',
          body: {
            nom: 'string (requis)',
            email: 'string (requis)',
            password: 'string (min 6 caractères)',
            role: 'string (client|vendeur)',
            telephone: 'string (optionnel, clients)',
            adresse: 'string (optionnel, clients)',
            numero_fiscal: 'string (requis pour vendeurs)'
          }
        },
        'POST /connexion': {
          description: 'Se connecter (vérifié en BDD)',
          body: {
            email: 'string',
            password: 'string'
          }
        },
        'GET /db-status': {
          description: 'Vérifier la connexion à la base de données'
        }
      },
      privees: {
        'GET /profil': {
          description: 'Récupérer son profil (depuis BDD)',
          headers: 'Authorization: Bearer <token>'
        }
      }
    },
    exemples: [
      '# Test connexion BDD',
      'curl http://localhost:3308/api/auth/db-status',
      '',
      '# Inscription client',
      'curl -X POST http://localhost:3308/api/auth/inscription \\',
      '  -H "Content-Type: application/json" \\',
      '  -d \'{"nom":"John Doe","email":"john@test.com","password":"password123","role":"client"}\'',
      '',
      '# Connexion',
      'curl -X POST http://localhost:3308/api/auth/connexion \\',
      '  -H "Content-Type: application/json" \\',
      '  -d \'{"email":"john@test.com","password":"password123"}\''
    ],
    database_info: {
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_NAME || 'marketplace_db',
      tables_utilisees: ['utilisateurs', 'clients', 'vendeurs', 'grade_vendeur']
    },
    timestamp: new Date().toISOString()
  });
});

/**
 * @route   GET /api/auth/ping
 * @desc    Test de l'API
 * @access  Public
 */
router.get('/ping', (req, res) => {
  res.json({
    success: true,
    message: '🏓 API d\'authentification opérationnelle',
    mode: 'DATABASE',
    timestamp: new Date().toISOString(),
    jwt_configured: !!process.env.JWT_SECRET
  });
});

module.exports = router;