const express = require('express');
const router = express.Router();
const { query, param } = require('express-validator');

// Import sécurisé du contrôleur
let BoutiqueController;
try {
  BoutiqueController = require('../controllers/boutiqueController');
  console.log('✅ BoutiqueController importé avec succès');
} catch (error) {
  console.error('❌ Erreur import BoutiqueController:', error.message);
  process.exit(1);
}

// Validations
const validationRecherche = [
  query('nom').optional().isLength({ min: 2, max: 100 }),
  query('note_min').optional().isFloat({ min: 0, max: 5 }),
  query('limite').optional().isInt({ min: 1, max: 100 })
];

const validationId = [
  param('id').isInt({ min: 1 })
];

// Routes publiques
router.get('/recherche', validationRecherche, BoutiqueController.rechercherBoutiques);
router.get('/:id', validationId, BoutiqueController.obtenirBoutique);

// Route de test
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Route de test boutiques fonctionnelle',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;