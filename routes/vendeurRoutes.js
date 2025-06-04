// routes/vendeurRoutes.js - Routes pour les vendeurs
const express = require('express');
const router = express.Router();
const vendeurController = require('../controllers/vendeurController');
const { auth } = require('../middlewares/auth');
const { vendeurOnly } = require('../middlewares/vendeurOnly');
const { body, param, query, validationResult } = require('express-validator');

console.log('🏪 Chargement des routes vendeur...');

// ==================== MIDDLEWARE DE VALIDATION ====================

/**
 * Middleware pour gérer les erreurs de validation
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Erreurs de validation',
      errors: errors.array()
    });
  }
  next();
};

// ==================== VALIDATIONS ====================

/**
 * Validation pour la création de boutique
 */
const validateBoutiqueCreation = [
  body('nom')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Le nom de la boutique doit contenir entre 2 et 100 caractères'),
  
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('La description ne peut pas dépasser 500 caractères'),
  
  body('template_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('L\'ID du template doit être un entier positif')
];

/**
 * Validation pour la modification de boutique
 */
const validateBoutiqueUpdate = [
  param('boutiqueId')
    .isInt({ min: 1 })
    .withMessage('L\'ID de la boutique doit être un entier positif'),
  
  body('nom')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Le nom de la boutique doit contenir entre 2 et 100 caractères'),
  
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('La description ne peut pas dépasser 500 caractères'),
  
  body('template_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('L\'ID du template doit être un entier positif')
];

/**
 * Validation pour la création de produit
 */
const validateProduitCreation = [
  body('nom')
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('Le nom du produit doit contenir entre 2 et 200 caractères'),
  
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('La description ne peut pas dépasser 1000 caractères'),
  
  body('prix')
    .isFloat({ min: 0.01 })
    .withMessage('Le prix doit être un nombre positif'),
  
  body('stock')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Le stock doit être un entier positif ou zéro'),
  
  body('boutique_id')
    .isInt({ min: 1 })
    .withMessage('L\'ID de la boutique doit être un entier positif'),
  
  body('categorie_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('L\'ID de la catégorie doit être un entier positif')
];

/**
 * Validation pour la modification de produit
 */
const validateProduitUpdate = [
  param('produitId')
    .isInt({ min: 1 })
    .withMessage('L\'ID du produit doit être un entier positif'),
  
  body('nom')
    .optional()
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('Le nom du produit doit contenir entre 2 et 200 caractères'),
  
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('La description ne peut pas dépasser 1000 caractères'),
  
  body('prix')
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage('Le prix doit être un nombre positif'),
  
  body('stock')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Le stock doit être un entier positif ou zéro'),
  
  body('categorie_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('L\'ID de la catégorie doit être un entier positif')
];

/**
 * Validation pour la mise à jour du profil vendeur
 */
const validateProfilUpdate = [
  body('numero_fiscal')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Le numéro fiscal ne peut pas dépasser 50 caractères'),
  
  body('nom')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Le nom doit contenir entre 2 et 100 caractères'),
  
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Email invalide')
];

// ==================== ROUTES PROFIL VENDEUR ====================

/**
 * @route   GET /api/vendeur/profil
 * @desc    Obtenir le profil complet du vendeur
 * @access  Private (Vendeur)
 */
router.get('/profil', auth, vendeurOnly, vendeurController.obtenirProfilComplet);

/**
 * @route   PUT /api/vendeur/profil
 * @desc    Mettre à jour les informations du vendeur
 * @access  Private (Vendeur)
 */
router.put('/profil', auth, vendeurOnly, validateProfilUpdate, handleValidationErrors, vendeurController.mettreAJourInformations);

/**
 * @route   GET /api/vendeur/dashboard
 * @desc    Obtenir le tableau de bord du vendeur
 * @access  Private (Vendeur)
 */
router.get('/dashboard', auth, vendeurOnly, vendeurController.obtenirTableauDeBord);

// ==================== ROUTES GESTION DES BOUTIQUES ====================

/**
 * @route   POST /api/vendeur/boutiques
 * @desc    Créer une nouvelle boutique
 * @access  Private (Vendeur)
 */
router.post('/boutiques', auth, vendeurOnly, validateBoutiqueCreation, handleValidationErrors, vendeurController.creerBoutique);

/**
 * @route   GET /api/vendeur/boutiques
 * @desc    Lister toutes les boutiques du vendeur
 * @access  Private (Vendeur)
 */
router.get('/boutiques', auth, vendeurOnly, vendeurController.listerBoutiques);

/**
 * @route   GET /api/vendeur/boutiques/:boutiqueId
 * @desc    Obtenir une boutique spécifique
 * @access  Private (Vendeur)
 */
router.get('/boutiques/:boutiqueId', auth, vendeurOnly, [
  param('boutiqueId').isInt({ min: 1 }).withMessage('ID de boutique invalide')
], handleValidationErrors, vendeurController.obtenirBoutique);

/**
 * @route   PUT /api/vendeur/boutiques/:boutiqueId
 * @desc    Modifier une boutique
 * @access  Private (Vendeur)
 */
router.put('/boutiques/:boutiqueId', auth, vendeurOnly, validateBoutiqueUpdate, handleValidationErrors, vendeurController.modifierBoutique);

/**
 * @route   DELETE /api/vendeur/boutiques/:boutiqueId
 * @desc    Supprimer une boutique
 * @access  Private (Vendeur)
 */
router.delete('/boutiques/:boutiqueId', auth, vendeurOnly, [
  param('boutiqueId').isInt({ min: 1 }).withMessage('ID de boutique invalide')
], handleValidationErrors, vendeurController.supprimerBoutique);

// ==================== ROUTES GESTION DES PRODUITS ====================

/**
 * @route   POST /api/vendeur/produits
 * @desc    Ajouter un produit à une boutique
 * @access  Private (Vendeur)
 */
router.post('/produits', auth, vendeurOnly, validateProduitCreation, handleValidationErrors, vendeurController.ajouterProduit);

/**
 * @route   GET /api/vendeur/produits
 * @desc    Lister tous les produits du vendeur
 * @access  Private (Vendeur)
 */
router.get('/produits', auth, vendeurOnly, [
  query('boutique_id').optional().isInt({ min: 1 }).withMessage('ID de boutique invalide'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limite doit être entre 1 et 100'),
  query('offset').optional().isInt({ min: 0 }).withMessage('Offset doit être positif')
], handleValidationErrors, vendeurController.listerProduits);

/**
 * @route   GET /api/vendeur/produits/:produitId
 * @desc    Obtenir un produit spécifique
 * @access  Private (Vendeur)
 */
router.get('/produits/:produitId', auth, vendeurOnly, [
  param('produitId').isInt({ min: 1 }).withMessage('ID de produit invalide')
], handleValidationErrors, vendeurController.obtenirProduit);

/**
 * @route   PUT /api/vendeur/produits/:produitId
 * @desc    Modifier un produit
 * @access  Private (Vendeur)
 */
router.put('/produits/:produitId', auth, vendeurOnly, validateProduitUpdate, handleValidationErrors, vendeurController.modifierProduit);

/**
 * @route   DELETE /api/vendeur/produits/:produitId
 * @desc    Supprimer un produit
 * @access  Private (Vendeur)
 */
router.delete('/produits/:produitId', auth, vendeurOnly, [
  param('produitId').isInt({ min: 1 }).withMessage('ID de produit invalide')
], handleValidationErrors, vendeurController.supprimerProduit);

/**
 * @route   GET /api/vendeur/stock
 * @desc    Vérifier le stock de tous les produits
 * @access  Private (Vendeur)
 */
router.get('/stock', auth, vendeurOnly, [
  query('seuil_critique').optional().isInt({ min: 0 }).withMessage('Seuil critique doit être positif')
], handleValidationErrors, vendeurController.verifierStock);

// ==================== ROUTES GESTION DES COMMANDES/PANIERS ====================

/**
 * @route   GET /api/vendeur/commandes
 * @desc    Lister les paniers validés (commandes)
 * @access  Private (Vendeur)
 */
router.get('/commandes', auth, vendeurOnly, [
  query('statut').optional().isIn(['valide', 'expedie', 'livre', 'annule']).withMessage('Statut invalide'),
  query('date_debut').optional().isISO8601().withMessage('Date de début invalide'),
  query('date_fin').optional().isISO8601().withMessage('Date de fin invalide'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limite doit être entre 1 et 100')
], handleValidationErrors, vendeurController.listerCommandes);

/**
 * @route   PUT /api/vendeur/commandes/:panierId/statut
 * @desc    Modifier le statut d'une commande (panier validé)
 * @access  Private (Vendeur)
 */
router.put('/commandes/:panierId/statut', auth, vendeurOnly, [
  param('panierId').isInt({ min: 1 }).withMessage('ID de panier invalide'),
  body('statut').isIn(['valide', 'expedie', 'livre', 'annule']).withMessage('Statut invalide')
], handleValidationErrors, vendeurController.modifierStatutCommande);

// ==================== ROUTES GRADES ET STATISTIQUES ====================

/**
 * @route   POST /api/vendeur/grade/promotion
 * @desc    Demander une promotion de grade
 * @access  Private (Vendeur)
 */
router.post('/grade/promotion', auth, vendeurOnly, vendeurController.demanderPromotionGrade);

/**
 * @route   GET /api/vendeur/statistiques
 * @desc    Obtenir les statistiques de vente
 * @access  Private (Vendeur)
 */
router.get('/statistiques', auth, vendeurOnly, [
  query('periode').optional().isIn(['semaine', 'mois', 'trimestre', 'annee']).withMessage('Période invalide'),
  query('date_debut').optional().isISO8601().withMessage('Date de début invalide'),
  query('date_fin').optional().isISO8601().withMessage('Date de fin invalide')
], handleValidationErrors, vendeurController.obtenirStatistiques);

/**
 * @route   GET /api/vendeur/grade
 * @desc    Obtenir les informations sur le grade actuel
 * @access  Private (Vendeur)
 */
router.get('/grade', auth, vendeurOnly, vendeurController.obtenirInfosGrade);

// ==================== ROUTES UTILITAIRES ====================

/**
 * @route   GET /api/vendeur/ping
 * @desc    Test de connexion pour les vendeurs
 * @access  Private (Vendeur)
 */
router.get('/ping', auth, vendeurOnly, (req, res) => {
  res.json({
    success: true,
    message: 'Pong! API Vendeur active',
    user: {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role
    },
    timestamp: new Date().toISOString()
  });
});

/**
 * @route   GET /api/vendeur/info
 * @desc    Informations sur l'API vendeur
 * @access  Public
 */
router.get('/info', (req, res) => {
  res.json({
    success: true,
    message: 'API Vendeur - Marketplace',
    version: '1.0.0',
    endpoints: {
      profil: [
        'GET /api/vendeur/profil - Profil complet',
        'PUT /api/vendeur/profil - Mise à jour profil',
        'GET /api/vendeur/dashboard - Tableau de bord'
      ],
      boutiques: [
        'POST /api/vendeur/boutiques - Créer boutique',
        'GET /api/vendeur/boutiques - Lister boutiques',
        'GET /api/vendeur/boutiques/:id - Détail boutique',
        'PUT /api/vendeur/boutiques/:id - Modifier boutique',
        'DELETE /api/vendeur/boutiques/:id - Supprimer boutique'
      ],
      produits: [
        'POST /api/vendeur/produits - Ajouter produit',
        'GET /api/vendeur/produits - Lister produits',
        'GET /api/vendeur/produits/:id - Détail produit',
        'PUT /api/vendeur/produits/:id - Modifier produit',
        'DELETE /api/vendeur/produits/:id - Supprimer produit',
        'GET /api/vendeur/stock - Vérifier stock'
      ],
      commandes: [
        'GET /api/vendeur/commandes - Lister commandes',
        'PUT /api/vendeur/commandes/:id/statut - Modifier statut'
      ],
      grades_statistiques: [
        'POST /api/vendeur/grade/promotion - Demander promotion',
        'GET /api/vendeur/grade - Infos grade actuel',
        'GET /api/vendeur/statistiques - Statistiques de vente'
      ]
    },
    authentication: 'Token JWT requis + rôle vendeur',
    documentation: 'Utilisez les endpoints ci-dessus'
  });
});

console.log('✅ Routes vendeur configurées');

module.exports = router;