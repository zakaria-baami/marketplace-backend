// utils/apiResponse.js - Utilitaire pour standardiser les réponses API

/**
 * Réponse de succès
 * @param {Object} res - Objet de réponse Express
 * @param {string} message - Message de succès
 * @returns {Object} - Réponse JSON
 */
const successResponse = (res, message) => {
  return res.status(200).json({
    success: true,
    message: message,
    timestamp: new Date().toISOString()
  });
};

/**
 * Réponse de succès avec données
 * @param {Object} res - Objet de réponse Express
 * @param {string} message - Message de succès
 * @param {Object} data - Données à retourner
 * @returns {Object} - Réponse JSON
 */
const successResponseWithData = (res, message, data) => {
  return res.status(200).json({
    success: true,
    message: message,
    data: data,
    timestamp: new Date().toISOString()
  });
};

/**
 * Réponse d'erreur générique
 * @param {Object} res - Objet de réponse Express
 * @param {string} message - Message d'erreur
 * @param {number} statusCode - Code de statut HTTP (défaut: 500)
 * @returns {Object} - Réponse JSON
 */
const ErrorResponse = (res, message, statusCode = 500) => {
  return res.status(statusCode).json({
    success: false,
    error: 'Erreur serveur',
    message: message,
    timestamp: new Date().toISOString()
  });
};

/**
 * Réponse d'erreur de validation
 * @param {Object} res - Objet de réponse Express
 * @param {string} message - Message d'erreur
 * @param {Array} errors - Tableau des erreurs de validation
 * @returns {Object} - Réponse JSON
 */
const validationErrorWithData = (res, message, errors) => {
  return res.status(400).json({
    success: false,
    error: 'Erreur de validation',
    message: message,
    errors: errors,
    timestamp: new Date().toISOString()
  });
};

/**
 * Réponse d'erreur non autorisé (401)
 * @param {Object} res - Objet de réponse Express
 * @param {string} message - Message d'erreur
 * @returns {Object} - Réponse JSON
 */
const unauthorizedResponse = (res, message) => {
  return res.status(401).json({
    success: false,
    error: 'Non autorisé',
    message: message,
    timestamp: new Date().toISOString()
  });
};

/**
 * Réponse d'erreur interdit (403)
 * @param {Object} res - Objet de réponse Express
 * @param {string} message - Message d'erreur
 * @returns {Object} - Réponse JSON
 */
const forbiddenResponse = (res, message) => {
  return res.status(403).json({
    success: false,
    error: 'Accès interdit',
    message: message,
    timestamp: new Date().toISOString()
  });
};

/**
 * Réponse d'erreur non trouvé (404)
 * @param {Object} res - Objet de réponse Express
 * @param {string} message - Message d'erreur
 * @returns {Object} - Réponse JSON
 */
const notFoundResponse = (res, message) => {
  return res.status(404).json({
    success: false,
    error: 'Non trouvé',
    message: message,
    timestamp: new Date().toISOString()
  });
};

/**
 * Réponse d'erreur de conflit (409)
 * @param {Object} res - Objet de réponse Express
 * @param {string} message - Message d'erreur
 * @returns {Object} - Réponse JSON
 */
const conflictResponse = (res, message) => {
  return res.status(409).json({
    success: false,
    error: 'Conflit',
    message: message,
    timestamp: new Date().toISOString()
  });
};

/**
 * Réponse d'erreur de serveur indisponible (503)
 * @param {Object} res - Objet de réponse Express
 * @param {string} message - Message d'erreur
 * @returns {Object} - Réponse JSON
 */
const serviceUnavailableResponse = (res, message) => {
  return res.status(503).json({
    success: false,
    error: 'Service indisponible',
    message: message,
    timestamp: new Date().toISOString()
  });
};

/**
 * Réponse d'erreur de trop de requêtes (429)
 * @param {Object} res - Objet de réponse Express
 * @param {string} message - Message d'erreur
 * @param {number} retryAfter - Temps d'attente en secondes
 * @returns {Object} - Réponse JSON
 */
const tooManyRequestsResponse = (res, message, retryAfter = 60) => {
  res.set('Retry-After', retryAfter);
  return res.status(429).json({
    success: false,
    error: 'Trop de requêtes',
    message: message,
    retryAfter: retryAfter,
    timestamp: new Date().toISOString()
  });
};

/**
 * Réponse de création réussie (201)
 * @param {Object} res - Objet de réponse Express
 * @param {string} message - Message de succès
 * @param {Object} data - Données créées
 * @returns {Object} - Réponse JSON
 */
const createdResponse = (res, message, data) => {
  return res.status(201).json({
    success: true,
    message: message,
    data: data,
    timestamp: new Date().toISOString()
  });
};

/**
 * Réponse de suppression réussie (204)
 * @param {Object} res - Objet de réponse Express
 * @returns {Object} - Réponse vide
 */
const deletedResponse = (res) => {
  return res.status(204).send();
};

/**
 * Réponse personnalisée
 * @param {Object} res - Objet de réponse Express
 * @param {number} statusCode - Code de statut HTTP
 * @param {boolean} success - Indicateur de succès
 * @param {string} message - Message
 * @param {Object} data - Données optionnelles
 * @returns {Object} - Réponse JSON
 */
const customResponse = (res, statusCode, success, message, data = null) => {
  const response = {
    success: success,
    message: message,
    timestamp: new Date().toISOString()
  };

  if (data !== null) {
    response.data = data;
  }

  return res.status(statusCode).json(response);
};

module.exports = {
  // Réponses de succès
  successResponse,
  successResponseWithData,
  createdResponse,
  deletedResponse,
  
  // Réponses d'erreur
  ErrorResponse,
  validationErrorWithData,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
  conflictResponse,
  serviceUnavailableResponse,
  tooManyRequestsResponse,
  
  // Réponse personnalisée
  customResponse
};