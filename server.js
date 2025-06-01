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
      documentation: '/api/auth/info',
      inscription: '/api/auth/inscription',
      connexion: '/api/auth/connexion'
    }
  });
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

// Autres routes (décommentez selon vos besoins)
/*
loadRoute('./routes/boutiqueRoutes', '/api/boutiques', 'Routes boutiques');
loadRoute('./routes/clientRoutes', '/api/clients', 'Routes clients');
loadRoute('./routes/produitRoutes', '/api/produits', 'Routes produits');
loadRoute('./routes/categorieRoutes', '/api/categories', 'Routes catégories');
loadRoute('./routes/commandeRoutes', '/api/commandes', 'Routes commandes');
loadRoute('./routes/panierRoutes', '/api/panier', 'Routes panier');
loadRoute('./routes/messageRoutes', '/api/messages', 'Routes messages');
loadRoute('./routes/statistiqueRoutes', '/api/statistiques', 'Routes statistiques');
loadRoute('./routes/templateRoutes', '/api/templates', 'Routes templates');
*/

console.log('\n📋 RÉSUMÉ DU CHARGEMENT:');
console.log(`✅ Routes d'authentification: ${authLoaded ? 'Chargées' : 'Échec'}`);

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
      'POST /api/auth/inscription',
      'POST /api/auth/connexion',
      'GET /api/auth/profil (avec token)'
    );
  }
  
  res.status(404).json({ 
    success: false,
    error: 'Route non trouvée',
    path: req.originalUrl,
    method: req.method,
    available_endpoints: availableRoutes,
    suggestion: `Essayez: GET ${req.protocol}://${req.get('host')}/api/auth/info`
  });
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`\n🎉 Serveur démarré avec succès sur le port ${PORT}`);
  console.log(`🌐 Serveur: http://localhost:${PORT}`);
  console.log(`📚 Documentation: http://localhost:${PORT}/api/auth/info`);
  console.log(`🏓 Test rapide: http://localhost:${PORT}/api/auth/ping`);
  
  if (authLoaded) {
    console.log(`📝 Inscription: http://localhost:${PORT}/api/auth/inscription`);
    console.log(`🔐 Connexion: http://localhost:${PORT}/api/auth/connexion`);
    console.log(`🔍 DB Status: http://localhost:${PORT}/api/auth/db-status`);
  }
  
  // Vérifications finales
  if (!process.env.JWT_SECRET) {
    console.log('\n⚠️  ATTENTION: JWT_SECRET non configuré - créez un fichier .env');
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