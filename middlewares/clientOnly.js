// middlewares/clientOnly.js - Middleware pour vérifier le rôle client
const { Client } = require('../models/db');

/**
 * Middleware pour vérifier que l'utilisateur est client
 * À utiliser après le middleware auth
 */
const clientOnly = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentification requise'
      });
    }

    if (req.user.role !== 'client') {
      return res.status(403).json({
        success: false,
        message: 'Accès réservé aux clients',
        role_requis: 'client',
        role_actuel: req.user.role
      });
    }

    // Vérifier que les données client existent
    const client = await Client.findByPk(req.user.id);

    if (!client) {
      return res.status(403).json({
        success: false,
        message: 'Données client manquantes',
        suggestion: 'Contactez le support technique'
      });
    }

    // Ajouter les données client à req.user pour les contrôleurs
    req.user.client = {
      id: client.id,
      adresse: client.adresse,
      telephone: client.telephone
    };

    next();

  } catch (error) {
    console.error('❌ Erreur middleware clientOnly:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur de vérification des droits client'
    });
  }
};

module.exports = clientOnly;