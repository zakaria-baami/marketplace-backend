// server-test-auth.js - Serveur minimal pour tester l'auth
require('dotenv').config();
const express = require('express');

const app = express();
const PORT = 3308; // Port différent pour éviter les conflits

console.log('🚀 Démarrage serveur test auth...');

// Middlewares de base
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Test que Express fonctionne
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Serveur test auth fonctionnel',
    timestamp: new Date().toISOString()
  });
});

// Import et test du contrôleur
console.log('📁 Import du contrôleur...');
try {
  const AuthController = require('./controllers/authController');
  console.log('✅ Contrôleur importé avec succès');
  
  // Vérification des méthodes
  console.log('🔍 Vérification méthodes:');
  console.log('- inscription:', typeof AuthController.inscription);
  console.log('- connexion:', typeof AuthController.connexion);
  
  // Import des routes
  console.log('📁 Import des routes...');
  const authRoutes = require('./routes/authRoutes');
  console.log('✅ Routes importées avec succès');
  
  // Montage des routes
  console.log('🔗 Montage des routes...');
  app.use('/api/auth', authRoutes);
  console.log('✅ Routes montées sur /api/auth');
  
} catch (error) {
  console.error('❌ Erreur lors de l\'import:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}

// Route de test directe (sans passer par le fichier routes)
app.post('/test-direct', async (req, res) => {
  try {
    const AuthController = require('./controllers/authController');
    console.log('🧪 Test direct de la méthode inscription');
    
    // Simuler req avec body
    const mockReq = { body: req.body };
    await AuthController.inscription(mockReq, res);
  } catch (error) {
    console.error('❌ Erreur test direct:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur test direct',
      error: error.message
    });
  }
});

// Gestion d'erreurs
app.use((err, req, res, next) => {
  console.error('💥 Erreur serveur:', err);
  res.status(500).json({
    success: false,
    message: 'Erreur serveur',
    error: err.message
  });
});

// Route 404
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route non trouvée',
    path: req.originalUrl,
    method: req.method,
    available_routes: [
      'GET /',
      'POST /test-direct',
      'POST /api/auth/inscription',
      'GET /api/auth/ping'
    ]
  });
});

// Démarrage
app.listen(PORT, () => {
  console.log(`\n🎉 Serveur test démarré sur le port ${PORT}`);
  console.log('🌐 Tests disponibles:');
  console.log(`   GET  http://localhost:${PORT}/`);
  console.log(`   POST http://localhost:${PORT}/test-direct`);
  console.log(`   POST http://localhost:${PORT}/api/auth/inscription`);
  console.log(`   GET  http://localhost:${PORT}/api/auth/ping`);
  console.log('');
});

// Gestion des erreurs non capturées
process.on('uncaughtException', (error) => {
  console.error('💥 Erreur critique:', error.message);
  console.error('Stack:', error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Promesse rejetée:', reason);
});