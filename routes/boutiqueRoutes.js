// routes/boutiqueRoutes.js - Conforme aux web services
const express = require('express');
const multer = require('multer');
const path = require('path');
const router = express.Router();

// Import du contrôleur
const BoutiqueController = require('../controllers/boutiqueController');

// Import des middlewares
const auth = require('../middlewares/auth');
const vendeurOnly = require('../middlewares/vendeurOnly');
const adminOnly = require('../middlewares/adminOnly');

// Configuration multer pour l'upload d'images
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Seules les images sont autorisées (jpeg, jpg, png, gif, webp)'));
    }
  }
});

// ==================== ROUTES BOUTIQUE SELON WEB SERVICES ====================

/**
 * @route   POST /api/boutiques
 * @desc    Créer une boutique
 * @access  Private (Vendeur uniquement)
 * @headers Authorization: Bearer token
 * @body    { nom, description, template_id }
 * @response { success, message, boutique }
 */
router.post('/', auth, vendeurOnly, BoutiqueController.createBoutique);

/**
 * @route   GET /api/boutiques/:id
 * @desc    Récupérer une boutique par ID
 * @access  Public
 * @response { success, boutique }
 */
router.get('/:id', BoutiqueController.getBoutiqueById);

/**
 * @route   PUT /api/boutiques/:id
 * @desc    Mettre à jour une boutique
 * @access  Private (Propriétaire ou Admin)
 * @headers Authorization: Bearer token
 * @body    { nom, description, template_id }
 * @response { success, message, boutique }
 */
router.put('/:id', auth, BoutiqueController.updateBoutique);

/**
 * @route   GET /api/boutiques/vendeur/:vendeurId
 * @desc    Récupérer la boutique d'un vendeur
 * @access  Public
 * @response { success, boutique }
 */
router.get('/vendeur/:vendeurId', BoutiqueController.getBoutiqueByVendeur);

/**
 * @route   POST /api/boutiques/:id/logo
 * @desc    Uploader le logo de la boutique
 * @access  Private (Propriétaire ou Admin)
 * @headers Authorization: Bearer token
 * @body    FormData avec image
 * @response { success, message, logoUrl }
 */
router.post('/:id/logo', auth, upload.single('logo'), BoutiqueController.uploadLogo);

/**
 * @route   POST /api/boutiques/:id/banniere
 * @desc    Uploader la bannière de la boutique
 * @access  Private (Propriétaire ou Admin)
 * @headers Authorization: Bearer token
 * @body    FormData avec image
 * @response { success, message, banniereUrl }
 */
router.post('/:id/banniere', auth, upload.single('banniere'), BoutiqueController.uploadBanniere);

// ==================== ROUTES ADDITIONNELLES UTILES ====================

/**
 * @route   GET /api/boutiques
 * @desc    Lister toutes les boutiques avec filtres
 * @access  Public
 * @query   ?nom=&categorie=&grade=&page=&limit=&tri=
 * @response { success, boutiques, pagination }
 */
router.get('/', BoutiqueController.getAllBoutiques);

/**
 * @route   GET /api/boutiques/:id/produits
 * @desc    Récupérer les produits d'une boutique
 * @access  Public
 * @query   ?categorie=&prix_min=&prix_max=&page=&limit=&tri=
 * @response { success, produits, pagination }
 */
router.get('/:id/produits', BoutiqueController.getBoutiqueProduits);

/**
 * @route   GET /api/boutiques/:id/statistiques
 * @desc    Statistiques de la boutique
 * @access  Private (Propriétaire ou Admin)
 * @headers Authorization: Bearer token
 * @query   ?periode=
 * @response { success, statistiques }
 */
router.get('/:id/statistiques', auth, BoutiqueController.getBoutiqueStatistiques);

/**
 * @route   GET /api/boutiques/:id/commandes
 * @desc    Commandes reçues par la boutique
 * @access  Private (Propriétaire ou Admin)
 * @headers Authorization: Bearer token
 * @query   ?statut=&page=&limit=&date_debut=&date_fin=
 * @response { success, commandes, pagination }
 */
router.get('/:id/commandes', auth, BoutiqueController.getBoutiqueCommandes);

/**
 * @route   PUT /api/boutiques/:id/personalisation
 * @desc    Personnaliser l'apparence de la boutique
 * @access  Private (Propriétaire ou Admin)
 * @headers Authorization: Bearer token
 * @body    { couleurs, layout, composants }
 * @response { success, message, personalisation }
 */
router.put('/:id/personalisation', auth, BoutiqueController.updatePersonalisation);

/**
 * @route   GET /api/boutiques/:id/apercu
 * @desc    Aperçu de la boutique avec template
 * @access  Public
 * @response { success, apercu }
 */
router.get('/:id/apercu', BoutiqueController.getBoutiqueApercu);

/**
 * @route   PUT /api/boutiques/:id/statut
 * @desc    Modifier le statut de la boutique (actif/inactif)
 * @access  Private (Propriétaire ou Admin)
 * @headers Authorization: Bearer token
 * @body    { statut }
 * @response { success, message }
 */
router.put('/:id/statut', auth, BoutiqueController.updateStatut);

/**
 * @route   GET /api/boutiques/:id/avis
 * @desc    Avis et évaluations de la boutique
 * @access  Public
 * @query   ?page=&limit=&note_min=
 * @response { success, avis, pagination, moyenne }
 */
router.get('/:id/avis', BoutiqueController.getBoutiqueAvis);

/**
 * @route   POST /api/boutiques/:id/avis
 * @desc    Ajouter un avis sur la boutique
 * @access  Private (Client uniquement)
 * @headers Authorization: Bearer token
 * @body    { note, commentaire }
 * @response { success, message, avis }
 */
router.post('/:id/avis', auth, BoutiqueController.ajouterAvis);

/**
 * @route   DELETE /api/boutiques/:id
 * @desc    Supprimer une boutique
 * @access  Private (Propriétaire ou Admin)
 * @headers Authorization: Bearer token
 * @response { success, message }
 */
router.delete('/:id', auth, BoutiqueController.deleteBoutique);

// ==================== ROUTES DE RECHERCHE ET DÉCOUVERTE ====================

/**
 * @route   GET /api/boutiques/search
 * @desc    Rechercher des boutiques
 * @access  Public
 * @query   ?q=&localisation=&grade=&categorie=&page=&limit=
 * @response { success, boutiques, pagination }
 */
router.get('/search', BoutiqueController.searchBoutiques);

/**
 * @route   GET /api/boutiques/populaires
 * @desc    Boutiques les plus populaires
 * @access  Public
 * @query   ?limite=&periode=
 * @response { success, boutiques }
 */
router.get('/populaires', BoutiqueController.getBoutiquesPopulaires);

/**
 * @route   GET /api/boutiques/nouvelles
 * @desc    Nouvelles boutiques récemment créées
 * @access  Public
 * @query   ?limite=&jours=
 * @response { success, boutiques }
 */
router.get('/nouvelles', BoutiqueController.getNouvellesBoutiques);

/**
 * @route   GET /api/boutiques/categories/:categorieId
 * @desc    Boutiques par catégorie de produits
 * @access  Public
 * @query   ?page=&limit=&tri=
 * @response { success, boutiques, pagination }
 */
router.get('/categories/:categorieId', BoutiqueController.getBoutiquesByCategorie);

// ==================== ROUTES ADMINISTRATIVES ====================

/**
 * @route   GET /api/boutiques/admin/list
 * @desc    Liste toutes les boutiques (Admin uniquement)
 * @access  Private (Admin uniquement)
 * @headers Authorization: Bearer token
 * @query   ?statut=&grade=&page=&limit=&vendeur=
 * @response { success, boutiques, pagination }
 */
router.get('/admin/list', auth, adminOnly, BoutiqueController.adminListBoutiques);

/**
 * @route   PUT /api/boutiques/admin/:id/validation
 * @desc    Valider/Rejeter une boutique (Admin uniquement)
 * @access  Private (Admin uniquement)
 * @headers Authorization: Bearer token
 * @body    { action, motif }
 * @response { success, message }
 */
router.put('/admin/:id/validation', auth, adminOnly, BoutiqueController.adminValidationBoutique);

/**
 * @route   GET /api/boutiques/admin/statistiques
 * @desc    Statistiques globales des boutiques (Admin uniquement)
 * @access  Private (Admin uniquement)
 * @headers Authorization: Bearer token
 * @response { success, statistiques }
 */
router.get('/admin/statistiques', auth, adminOnly, BoutiqueController.adminStatistiquesBoutiques);

// ==================== ROUTES DE GESTION AVANCÉE ====================

/**
 * @route   POST /api/boutiques/:id/clone
 * @desc    Cloner une boutique (pour templates)
 * @access  Private (Vendeur uniquement)
 * @headers Authorization: Bearer token
 * @body    { nouveau_nom, nouveau_template }
 * @response { success, message, nouvelle_boutique }
 */
router.post('/:id/clone', auth, vendeurOnly, BoutiqueController.cloneBoutique);

/**
 * @route   GET /api/boutiques/:id/analytics
 * @desc    Analytics détaillées de la boutique
 * @access  Private (Propriétaire ou Admin)
 * @headers Authorization: Bearer token
 * @query   ?periode=&type=
 * @response { success, analytics }
 */
router.get('/:id/analytics', auth, BoutiqueController.getBoutiqueAnalytics);

/**
 * @route   POST /api/boutiques/:id/backup
 * @desc    Créer une sauvegarde de la boutique
 * @access  Private (Propriétaire ou Admin)
 * @headers Authorization: Bearer token
 * @response { success, message, backup_id }
 */
router.post('/:id/backup', auth, BoutiqueController.createBackup);

/**
 * @route   POST /api/boutiques/:id/restore
 * @desc    Restaurer une sauvegarde de la boutique
 * @access  Private (Propriétaire ou Admin)
 * @headers Authorization: Bearer token
 * @body    { backup_id }
 * @response { success, message }
 */
router.post('/:id/restore', auth, BoutiqueController.restoreBackup);

// ==================== ROUTES PUBLIQUES D'INFORMATION ====================

/**
 * @route   GET /api/boutiques/templates/disponibles
 * @desc    Templates disponibles pour création de boutique
 * @access  Public
 * @query   ?grade=
 * @response { success, templates }
 */
router.get('/templates/disponibles', BoutiqueController.getTemplatesDisponibles);

/**
 * @route   GET /api/boutiques/grades/list
 * @desc    Liste des grades de vendeurs
 * @access  Public
 * @response { success, grades }
 */
router.get('/grades/list', BoutiqueController.getGradesList);

// ==================== DOCUMENTATION ET TESTS ====================

/**
 * @route   GET /api/boutiques/info
 * @desc    Documentation des routes boutique
 * @access  Public
 */
router.get('/info', (req, res) => {
  res.json({
    success: true,
    message: 'API Boutique - Marketplace',
    base_url: '/api/boutiques',
    routes: {
      gestion_boutique: {
        'POST /': 'Créer une boutique',
        'GET /:id': 'Récupérer une boutique par ID',
        'PUT /:id': 'Mettre à jour une boutique',
        'DELETE /:id': 'Supprimer une boutique',
        'GET /vendeur/:vendeurId': 'Boutique d\'un vendeur'
      },
      personnalisation: {
        'POST /:id/logo': 'Uploader le logo',
        'POST /:id/banniere': 'Uploader la bannière',
        'PUT /:id/personalisation': 'Personnaliser l\'apparence',
        'GET /:id/apercu': 'Aperçu avec template'
      },
      produits_et_ventes: {
        'GET /:id/produits': 'Produits de la boutique',
        'GET /:id/statistiques': 'Statistiques de vente',
        'GET /:id/commandes': 'Commandes reçues',
        'GET /:id/analytics': 'Analytics détaillées'
      },
      avis_et_reputation: {
        'GET /:id/avis': 'Avis de la boutique',
        'POST /:id/avis': 'Ajouter un avis'
      },
      decouverte: {
        'GET /': 'Lister toutes les boutiques',
        'GET /search': 'Rechercher des boutiques',
        'GET /populaires': 'Boutiques populaires',
        'GET /nouvelles': 'Nouvelles boutiques'
      },
      admin: {
        'GET /admin/list': 'Liste admin des boutiques',
        'PUT /admin/:id/validation': 'Valider/Rejeter boutique',
        'GET /admin/statistiques': 'Statistiques globales'
      },
      utilitaires: {
        'GET /templates/disponibles': 'Templates disponibles',
        'GET /grades/list': 'Liste des grades',
        'POST /:id/clone': 'Cloner une boutique'
      }
    },
    fonctionnalites: [
      'Création et gestion boutiques',
      'Système de templates',
      'Upload logo et bannière',
      'Personnalisation avancée',
      'Statistiques et analytics',
      'Système d\'avis',
      'Recherche et découverte',
      'Administration complète'
    ],
    authentification: 'Bearer Token requis pour routes privées',
    upload: 'Multer configuré pour images (5MB max)',
    timestamp: new Date().toISOString()
  });
});

/**
 * @route   GET /api/boutiques/ping
 * @desc    Test de l'API boutique
 * @access  Public
 */
router.get('/ping', (req, res) => {
  res.json({
    success: true,
    message: '🏪 API Boutique opérationnelle',
    module: 'BOUTIQUE_ROUTES',
    fonctionnalites: [
      'CRUD complet boutiques',
      'Système templates',
      'Upload images',
      'Personnalisation',
      'Statistiques',
      'Avis clients',
      'Administration'
    ],
    timestamp: new Date().toISOString()
  });
});

module.exports = router;