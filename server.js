// server.js - Version corrigée et optimisée
require('dotenv').config(); // ⭐ IMPORTANT: À ajouter en première ligne

const express = require('express');
const cors = require('cors');

// ⚠️ NE PAS importer le contrôleur ici !
// Le contrôleur est importé dans les routes

const app = express();
const PORT = process.env.PORT || 3308;

console.log(`🚀 Démarrage avec Express ${require('express/package.json').version}`);
console.log(`🔑 JWT Secret configuré: ${process.env.JWT_SECRET ? '✅ Oui' : '❌ Non'}`);

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Route de base
app.get('/', (req, res) => {
  res.json({ 
    message: 'API Marketplace fonctionnelle!',
    express_version: require('express/package.json').version,
    environment: process.env.NODE_ENV || 'development',
    jwt_configured: !!process.env.JWT_SECRET,
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: '/api/auth',
      register: '/api/auth/register',
      login: '/api/auth/login',
      profile: '/api/auth/me',
      ping: '/api/auth/ping',
      info: '/api/auth/info',
      db_status: '/api/auth/db-status',
      // Nouveaux endpoints vendeur
      vendeur_profil: '/api/vendeur/profil',
      vendeur_dashboard: '/api/vendeur/dashboard',
      vendeur_boutiques: '/api/vendeur/boutiques',
      vendeur_produits: '/api/vendeur/produits',
      vendeur_commandes: '/api/vendeur/commandes',
      vendeur_info: '/api/vendeur/info'
    }
  });
});

// ==================== ROUTES UTILITAIRES ====================

// Route ping pour tester la connexion
app.get('/api/auth/ping', (req, res) => {
  res.json({
    success: true,
    message: 'Pong! Serveur d\'authentification actif',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Route d'information sur l'API
app.get('/api/auth/info', (req, res) => {
  res.json({
    success: true,
    message: 'API d\'Authentification - Marketplace',
    version: '1.0.0',
    endpoints: {
      public_routes: [
        'POST /api/auth/register - Inscription',
        'POST /api/auth/login - Connexion',
        'POST /api/auth/refresh - Rafraîchir token',
        'GET /api/auth/check-email/:email - Vérifier email',
        'POST /api/auth/forgot-password - Mot de passe oublié',
        'POST /api/auth/reset-password - Réinitialiser mot de passe'
      ],
      protected_routes: [
        'GET /api/auth/me - Profil utilisateur',
        'PUT /api/auth/profile - Mettre à jour profil',
        'PUT /api/auth/change-password - Changer mot de passe',
        'POST /api/auth/logout - Déconnexion',
        'GET /api/auth/sessions - Sessions actives',
        'DELETE /api/auth/sessions/:id - Supprimer session'
      ],
      vendeur_routes: [
        'GET /api/vendeur/profil - Profil vendeur',
        'PUT /api/vendeur/profil - Mettre à jour profil vendeur',
        'GET /api/vendeur/dashboard - Tableau de bord',
        'POST /api/vendeur/boutiques - Créer boutique',
        'GET /api/vendeur/boutiques - Lister boutiques',
        'POST /api/vendeur/produits - Ajouter produit',
        'GET /api/vendeur/commandes - Lister commandes',
        'GET /api/vendeur/statistiques - Statistiques de vente'
      ],
      utility_routes: [
        'GET /api/auth/ping - Test connexion',
        'GET /api/auth/info - Cette documentation',
        'GET /api/auth/db-status - Status base de données',
        'GET /api/vendeur/info - Documentation vendeur'
      ]
    },
    environment: process.env.NODE_ENV || 'development',
    jwt_configured: !!process.env.JWT_SECRET
  });
});

// Route de status de la base de données
app.get('/api/auth/db-status', async (req, res) => {
  try {
    // Essayer d'importer sequelize si disponible
    let dbStatus = { available: false };
    
    try {
      const { sequelize } = require('./models/db');
      await sequelize.authenticate();
      dbStatus = {
        available: true,
        connected: true,
        database: process.env.DB_NAME,
        host: process.env.DB_HOST,
        dialect: sequelize.getDialect(),
        models: Object.keys(sequelize.models)
      };
    } catch (dbError) {
      dbStatus = {
        available: false,
        error: dbError.message,
        suggestion: 'Vérifiez votre configuration de base de données dans .env'
      };
    }
    
    res.json({
      success: true,
      message: 'Status de la base de données',
      database: dbStatus,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la vérification de la base de données',
      error: error.message
    });
  }
});

// Fonction pour charger une route avec gestion d'erreur améliorée
function loadRoute(routePath, mountPath, routeName) {
  try {
    console.log(`🔄 Tentative de chargement: ${routeName} (${routePath})`);
    
    // Test d'import du fichier
    const route = require(routePath);
    
    // Vérification que c'est bien un router Express
    if (typeof route !== 'function') {
      throw new Error(`Le fichier ${routePath} n'exporte pas un router Express valide`);
    }
    
    // Montage de la route
    app.use(mountPath, route);
    console.log(`✅ ${routeName} chargé avec succès sur ${mountPath}`);
    return true;
    
  } catch (error) {
    console.log(`❌ Erreur lors du chargement de ${routeName}:`);
    console.log(`   Fichier: ${routePath}`);
    console.log(`   Erreur: ${error.message}`);
    
    // Gestion des erreurs spécifiques
    if (error.code === 'MODULE_NOT_FOUND') {
      console.log(`   💡 Solution: Vérifiez que le fichier ${routePath} existe`);
    } else if (error.message.includes('Route.post() requires a callback function')) {
      console.log(`   💡 Solution: Vérifiez que le contrôleur est bien importé dans ${routePath}`);
    } else if (error.stack && error.stack.includes('path-to-regexp')) {
      console.log(`   🚨 ERREUR PATH-TO-REGEXP détectée dans ${routeName}!`);
      console.log(`   💡 Solution: Vérifiez les définitions de routes dans ${routePath}`);
    }
    
    console.log(`   📋 Stack: ${error.stack}`);
    return false;
  }
}

// Test de l'environnement avant chargement des routes
console.log('\n🔍 VÉRIFICATION DE L\'ENVIRONNEMENT:');
console.log(`- Node.js: ${process.version}`);
console.log(`- Express: ${require('express/package.json').version}`);
console.log(`- JWT Secret: ${process.env.JWT_SECRET ? 'Configuré' : 'Non configuré'}`);
console.log(`- Database: ${process.env.DB_NAME || 'Non configuré'}`);

// Chargement des routes
console.log('\n📚 CHARGEMENT DES ROUTES:\n');

// Routes d'authentification (priorité)
const authLoaded = loadRoute('./routes/authRoutes', '/api/auth', 'Routes d\'authentification');

// Autres routes (prêtes à être décommentées selon vos besoins)
const clientLoaded = loadRoute('./routes/clientRoutes', '/api/client', 'Routes clients');
const vendeurLoaded = loadRoute('./routes/vendeurRoutes', '/api/vendeur', 'Routes vendeurs');
const boutiqueLoaded = loadRoute('./routes/boutiqueRoutes', '/api/boutique', 'Routes boutiques');
const produitLoaded = loadRoute('./routes/produitRoutes', '/api/produit', 'Routes produits');
const categorieLoaded = loadRoute('./routes/categorieRoutes', '/api/categorie', 'Routes catégories');
const commandeLoaded = loadRoute('./routes/commandeRoutes', '/api/commande', 'Routes commandes');
const panierLoaded = loadRoute('./routes/panierRoutes', '/api/panier', 'Routes panier');
const messageLoaded = loadRoute('./routes/messageRoutes', '/api/message', 'Routes messages');
const statistiqueLoaded = loadRoute('./routes/statistiqueRoutes', '/api/statistique', 'Routes statistiques');
const templateLoaded = loadRoute('./routes/templateRoutes', '/api/template', 'Routes templates');

console.log('\n📋 RÉSUMÉ DU CHARGEMENT:');
console.log(`✅ Routes d'authentification: ${authLoaded ? 'Chargées' : 'Échec'}`);
console.log(`📊 Routes clients: ${clientLoaded ? 'Chargées' : 'En attente'}`);
console.log(`🏪 Routes vendeurs: ${vendeurLoaded ? 'Chargées' : 'En attente'}`);
console.log(`🏬 Routes boutiques: ${boutiqueLoaded ? 'Chargées' : 'En attente'}`);
console.log(`📦 Routes produits: ${produitLoaded ? 'Chargées' : 'En attente'}`);
console.log(`📂 Routes catégories: ${categorieLoaded ? 'Chargées' : 'En attente'}`);
console.log(`🛒 Routes commandes: ${commandeLoaded ? 'Chargées' : 'En attente'}`);
console.log(`🛍️  Routes panier: ${panierLoaded ? 'Chargées' : 'En attente'}`);
console.log(`💬 Routes messages: ${messageLoaded ? 'Chargées' : 'En attente'}`);
console.log(`📈 Routes statistiques: ${statistiqueLoaded ? 'Chargées' : 'En attente'}`);
console.log(`🎨 Routes templates: ${templateLoaded ? 'Chargées' : 'En attente'}`);

// Middleware de gestion d'erreurs
app.use((err, req, res, next) => {
  console.error('🚨 Erreur serveur:', err);
  
  // Erreurs spécifiques
  if (err.message && err.message.includes('Missing parameter name')) {
    return res.status(500).json({ 
      success: false,
      error: 'Erreur de configuration des routes',
      message: 'Un paramètre de route est mal défini',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
  
  if (err.name === 'SyntaxError' && err.message.includes('JSON')) {
    return res.status(400).json({
      success: false,
      error: 'JSON invalide',
      message: 'Vérifiez le format de votre requête JSON'
    });
  }
  
  res.status(500).json({ 
    success: false,
    error: 'Erreur interne du serveur',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Une erreur est survenue'
  });
});

// Route 404 améliorée
app.use('*', (req, res) => {
  const availableRoutes = [
    'GET /',
    'GET /api/auth/ping',
    'GET /api/auth/info',
    'GET /api/auth/db-status'
  ];
  
  // Ajout conditionnel des routes selon le chargement
  if (authLoaded) {
    availableRoutes.push(
      'POST /api/auth/register',
      'POST /api/auth/login',
      'GET /api/auth/me (avec token)',
      'PUT /api/auth/profile (avec token)',
      'POST /api/auth/logout (avec token)'
    );
  }
  
  // Ajouter les routes vendeur si chargées
  if (vendeurLoaded) {
    availableRoutes.push(
      'GET /api/vendeur/profil (vendeur only)',
      'PUT /api/vendeur/profil (vendeur only)',
      'GET /api/vendeur/dashboard (vendeur only)',
      'POST /api/vendeur/boutiques (vendeur only)',
      'GET /api/vendeur/boutiques (vendeur only)',
      'POST /api/vendeur/produits (vendeur only)',
      'GET /api/vendeur/commandes (vendeur only)',
      'GET /api/vendeur/info'
    );
  }
  
  // Ajouter les autres routes si chargées
  if (clientLoaded) availableRoutes.push('GET /api/client/* (client only)');
  if (boutiqueLoaded) availableRoutes.push('GET /api/boutique/*');
  if (produitLoaded) availableRoutes.push('GET /api/produit/*');
  
  res.status(404).json({ 
    success: false,
    error: 'Route non trouvée',
    path: req.originalUrl,
    method: req.method,
    available_endpoints: availableRoutes,
    suggestion: `Consultez la documentation: GET ${req.protocol}://${req.get('host')}/api/auth/info`
  });
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`\n🎉 Serveur démarré avec succès sur le port ${PORT}`);
  console.log(`🌐 Serveur: http://localhost:${PORT}`);
  console.log(`📚 Documentation: http://localhost:${PORT}/api/auth/info`);
  console.log(`🏓 Test rapide: http://localhost:${PORT}/api/auth/ping`);
  console.log(`🔍 DB Status: http://localhost:${PORT}/api/auth/db-status`);
  
  if (authLoaded) {
    console.log(`\n🔐 AUTHENTIFICATION DISPONIBLE:`);
    console.log(`📝 Inscription: POST /api/auth/register`);
    console.log(`🔐 Connexion: POST /api/auth/login`);
    console.log(`👤 Profil: GET /api/auth/me`);
    console.log(`🔄 Refresh: POST /api/auth/refresh`);
  }
  
  if (vendeurLoaded) {
    console.log(`\n🏪 API VENDEUR DISPONIBLE:`);
    console.log(`👤 Profil vendeur: GET /api/vendeur/profil`);
    console.log(`📊 Dashboard: GET /api/vendeur/dashboard`);
    console.log(`🏬 Boutiques: GET /api/vendeur/boutiques`);
    console.log(`📦 Produits: GET /api/vendeur/produits`);
    console.log(`🛒 Commandes: GET /api/vendeur/commandes`);
    console.log(`📈 Statistiques: GET /api/vendeur/statistiques`);
    console.log(`📚 Documentation: GET /api/vendeur/info`);
  }
  
  // Afficher les modules chargés
  const loadedModules = [];
  if (clientLoaded) loadedModules.push('Clients');
  if (vendeurLoaded) loadedModules.push('Vendeurs'); 
  if (boutiqueLoaded) loadedModules.push('Boutiques');
  if (produitLoaded) loadedModules.push('Produits');
  if (categorieLoaded) loadedModules.push('Catégories');
  if (commandeLoaded) loadedModules.push('Commandes');
  if (panierLoaded) loadedModules.push('Panier');
  if (messageLoaded) loadedModules.push('Messages');
  if (statistiqueLoaded) loadedModules.push('Statistiques');
  if (templateLoaded) loadedModules.push('Templates');
  
  if (loadedModules.length > 0) {
    console.log(`\n🚀 MODULES ADDITIONNELS CHARGÉS:`);
    loadedModules.forEach(module => console.log(`✅ ${module}`));
  }
  
  // Vérifications finales
  if (!process.env.JWT_SECRET) {
    console.log('\n⚠️  ATTENTION: JWT_SECRET non configuré - créez un fichier .env');
    console.log('   Exemple: JWT_SECRET=your_super_secret_jwt_key_here');
  }
  
  if (!authLoaded) {
    console.log('\n⚠️  ATTENTION: Routes d\'authentification non chargées');
    console.log('   Vérifiez le fichier routes/authRoutes.js et le contrôleur');
  }
  
  console.log('\n✨ Serveur prêt à recevoir des requêtes!');
});

// Gestion des erreurs de processus
process.on('uncaughtException', (error) => {
  console.error('💥 Erreur critique non gérée:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Promesse rejetée non gérée:', reason);
  console.error('Promise:', promise);
});

// Gestion de l'arrêt propre
process.on('SIGTERM', () => {
  console.log('🛑 Signal SIGTERM reçu, arrêt du serveur...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n🛑 Arrêt du serveur demandé (Ctrl+C)');
  process.exit(0);
});