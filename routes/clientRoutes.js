// routes/clientRoutes.js - Conforme aux web services
const express = require('express');
const router = express.Router();

// Import du contrôleur
const ClientController = require('../controllers/clientController');

// Import des middlewares
const auth = require('../middlewares/auth');
const clientOnly = require('../middlewares/clientOnly');

// ==================== ROUTES CLIENT SELON WEB SERVICES ====================

/**
 * @route   GET /api/clients/profile
 * @desc    Récupérer le profil client
 * @access  Private (Client uniquement)
 * @headers Authorization: Bearer token
 * @response { success, client }
 */
router.get('/profile', auth, clientOnly, ClientController.getProfile);

/**
 * @route   PUT /api/clients/profile
 * @desc    Mettre à jour le profil client
 * @access  Private (Client uniquement)
 * @headers Authorization: Bearer token
 * @body    { nom, email, adresse, telephone }
 * @response { success, message, client }
 */
router.put('/profile', auth, clientOnly, ClientController.updateProfile);

/**
 * @route   GET /api/clients/historique-paniers
 * @desc    Historique des paniers validés du client
 * @access  Private (Client uniquement)
 * @headers Authorization: Bearer token
 * @response { success, paniers_historique }
 */
router.get('/historique-paniers', auth, clientOnly, ClientController.getHistoriquePaniers);

// ==================== ROUTES ADDITIONNELLES UTILES ====================

/**
 * @route   GET /api/clients/dashboard
 * @desc    Tableau de bord du client avec statistiques
 * @access  Private (Client uniquement)
 * @headers Authorization: Bearer token
 * @response { success, dashboard }
 */
router.get('/dashboard', auth, clientOnly, ClientController.getDashboard);

/**
 * @route   GET /api/clients/commandes
 * @desc    Liste des commandes du client
 * @access  Private (Client uniquement)
 * @headers Authorization: Bearer token
 * @query   ?statut=&page=&limit=&date_debut=&date_fin=
 * @response { success, commandes, pagination }
 */
router.get('/commandes', auth, clientOnly, ClientController.getCommandes);

/**
 * @route   GET /api/clients/commandes/:commandeId
 * @desc    Détails d'une commande spécifique
 * @access  Private (Client uniquement)
 * @headers Authorization: Bearer token
 * @response { success, commande }
 */
router.get('/commandes/:commandeId', auth, clientOnly, ClientController.getCommandeDetails);

/**
 * @route   POST /api/clients/commandes/:commandeId/annuler
 * @desc    Annuler une commande
 * @access  Private (Client uniquement)
 * @headers Authorization: Bearer token
 * @response { success, message }
 */
router.post('/commandes/:commandeId/annuler', auth, clientOnly, ClientController.annulerCommande);

/**
 * @route   GET /api/clients/panier-actuel
 * @desc    Récupérer le panier actuel du client
 * @access  Private (Client uniquement)
 * @headers Authorization: Bearer token
 * @response { success, panier }
 */
router.get('/panier-actuel', auth, clientOnly, ClientController.getPanierActuel);

/**
 * @route   GET /api/clients/favoris
 * @desc    Liste des produits favoris du client
 * @access  Private (Client uniquement)
 * @headers Authorization: Bearer token
 * @query   ?page=&limit=
 * @response { success, favoris, pagination }
 */
router.get('/favoris', auth, clientOnly, ClientController.getFavoris);

/**
 * @route   POST /api/clients/favoris/:produitId
 * @desc    Ajouter un produit aux favoris
 * @access  Private (Client uniquement)
 * @headers Authorization: Bearer token
 * @response { success, message }
 */
router.post('/favoris/:produitId', auth, clientOnly, ClientController.ajouterAuxFavoris);

/**
 * @route   DELETE /api/clients/favoris/:produitId
 * @desc    Retirer un produit des favoris
 * @access  Private (Client uniquement)
 * @headers Authorization: Bearer token
 * @response { success, message }
 */
router.delete('/favoris/:produitId', auth, clientOnly, ClientController.retirerDesFavoris);

/**
 * @route   GET /api/clients/recommandations
 * @desc    Recommandations personnalisées pour le client
 * @access  Private (Client uniquement)
 * @headers Authorization: Bearer token
 * @query   ?limite=&categorie=
 * @response { success, recommandations }
 */
router.get('/recommandations', auth, clientOnly, ClientController.getRecommandations);

/**
 * @route   GET /api/clients/statistiques
 * @desc    Statistiques d'achat du client
 * @access  Private (Client uniquement)
 * @headers Authorization: Bearer token
 * @query   ?periode=
 * @response { success, statistiques }
 */
router.get('/statistiques', auth, clientOnly, ClientController.getStatistiques);

/**
 * @route   GET /api/clients/adresses
 * @desc    Gestion des adresses du client
 * @access  Private (Client uniquement)
 * @headers Authorization: Bearer token
 * @response { success, adresses }
 */
router.get('/adresses', auth, clientOnly, ClientController.getAdresses);

/**
 * @route   POST /api/clients/adresses
 * @desc    Ajouter une nouvelle adresse
 * @access  Private (Client uniquement)
 * @headers Authorization: Bearer token
 * @body    { nom, adresse, ville, code_postal, pays, est_principale }
 * @response { success, message, adresse }
 */
router.post('/adresses', auth, clientOnly, ClientController.ajouterAdresse);

/**
 * @route   PUT /api/clients/adresses/:adresseId
 * @desc    Modifier une adresse
 * @access  Private (Client uniquement)
 * @headers Authorization: Bearer token
 * @body    { nom, adresse, ville, code_postal, pays, est_principale }
 * @response { success, message, adresse }
 */
router.put('/adresses/:adresseId', auth, clientOnly, ClientController.modifierAdresse);

/**
 * @route   DELETE /api/clients/adresses/:adresseId
 * @desc    Supprimer une adresse
 * @access  Private (Client uniquement)
 * @headers Authorization: Bearer token
 * @response { success, message }
 */
router.delete('/adresses/:adresseId', auth, clientOnly, ClientController.supprimerAdresse);

// ==================== ROUTES PUBLIQUES ====================

/**
 * @route   GET /api/clients/search
 * @desc    Rechercher des clients (Admin uniquement)
 * @access  Private (Admin uniquement)
 * @headers Authorization: Bearer token
 * @query   ?nom=&email=&ville=&page=&limit=
 * @response { success, clients, pagination }
 */
router.get('/search', auth, ClientController.searchClients);

// ==================== DOCUMENTATION ET TESTS ====================

/**
 * @route   GET /api/clients/info
 * @desc    Documentation des routes client
 * @access  Public
 */
router.get('/info', (req, res) => {
  res.json({
    success: true,
    message: 'API Client - Marketplace',
    base_url: '/api/clients',
    routes: {
      profil_client: {
        'GET /profile': 'Récupérer le profil client',
        'PUT /profile': 'Mettre à jour le profil client',
        'GET /historique-paniers': 'Historique des paniers validés'
      },
      gestion_commandes: {
        'GET /dashboard': 'Tableau de bord avec statistiques',
        'GET /commandes': 'Liste des commandes',
        'GET /commandes/:id': 'Détails d\'une commande',
        'POST /commandes/:id/annuler': 'Annuler une commande'
      },
      panier_et_achats: {
        'GET /panier-actuel': 'Panier actuel du client',
        'GET /favoris': 'Produits favoris',
        'POST /favoris/:id': 'Ajouter aux favoris',
        'DELETE /favoris/:id': 'Retirer des favoris'
      },
      recommandations: {
        'GET /recommandations': 'Recommandations personnalisées',
        'GET /statistiques': 'Statistiques d\'achat'
      },
      gestion_adresses: {
        'GET /adresses': 'Liste des adresses',
        'POST /adresses': 'Ajouter une adresse',
        'PUT /adresses/:id': 'Modifier une adresse',
        'DELETE /adresses/:id': 'Supprimer une adresse'
      },
      admin: {
        'GET /search': 'Rechercher des clients (Admin)'
      }
    },
    authentification: 'Bearer Token requis pour routes privées',
    middleware: 'clientOnly appliqué pour routes spécifiques client',
    fonctionnalites: [
      'Gestion profil client',
      'Historique commandes et paniers',
      'Système de favoris',
      'Recommandations personnalisées',
      'Gestion multi-adresses',
      'Statistiques d\'achat'
    ],
    timestamp: new Date().toISOString()
  });
});

/**
 * @route   GET /api/clients/ping
 * @desc    Test de l'API client
 * @access  Public
 */
router.get('/ping', (req, res) => {
  res.json({
    success: true,
    message: '🛒 API Client opérationnelle',
    module: 'CLIENT_ROUTES',
    fonctionnalites: [
      'Gestion profil client',
      'Historique achats',
      'Système favoris',
      'Recommandations',
      'Multi-adresses'
    ],
    timestamp: new Date().toISOString()
  });
});

module.exports = router;