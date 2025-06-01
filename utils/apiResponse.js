/**
 * Classe pour standardiser les réponses API
 */
class ApiResponse {
  /**
   * Réponse de succès
   * @param {Object} res - Objet de réponse Express
   * @param {*} data - Données à renvoyer
   * @param {String} message - Message de succès
   * @param {Number} statusCode - Code de statut HTTP
   */
  static success(res, data = null, message = 'Opération réussie', statusCode = 200) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Réponse d'erreur
   * @param {Object} res - Objet de réponse Express
   * @param {String} message - Message d'erreur
   * @param {Number} statusCode - Code de statut HTTP
   * @param {*} errors - Détails des erreurs
   */
  static error(res, message = 'Une erreur est survenue', statusCode = 500, errors = null) {
    return res.status(statusCode).json({
      success: false,
      message,
      errors,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Réponse de validation échouée
   * @param {Object} res - Objet de réponse Express
   * @param {Array} errors - Erreurs de validation
   */
  static validationError(res, errors) {
    return res.status(422).json({
      success: false,
      message: 'Erreurs de validation',
      errors,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Réponse non autorisée
   * @param {Object} res - Objet de réponse Express
   * @param {String} message - Message d'erreur
   */
  static unauthorized(res, message = 'Non autorisé') {
    return res.status(401).json({
      success: false,
      message,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Réponse interdite
   * @param {Object} res - Objet de réponse Express
   * @param {String} message - Message d'erreur
   */
  static forbidden(res, message = 'Accès interdit') {
    return res.status(403).json({
      success: false,
      message,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Réponse non trouvé
   * @param {Object} res - Objet de réponse Express
   * @param {String} message - Message d'erreur
   */
  static notFound(res, message = 'Ressource non trouvée') {
    return res.status(404).json({
      success: false,
      message,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Réponse avec pagination
   * @param {Object} res - Objet de réponse Express
   * @param {Array} data - Données paginées
   * @param {Object} pagination - Informations de pagination
   * @param {String} message - Message de succès
   */
  static paginated(res, data, pagination, message = 'Données récupérées avec succès') {
    return res.status(200).json({
      success: true,
      message,
      data,
      pagination: {
        currentPage: pagination.page,
        totalPages: Math.ceil(pagination.total / pagination.limit),
        totalItems: pagination.total,
        itemsPerPage: pagination.limit,
        hasNextPage: pagination.page < Math.ceil(pagination.total / pagination.limit),
        hasPrevPage: pagination.page > 1
      },
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Réponse créée avec succès
   * @param {Object} res - Objet de réponse Express
   * @param {*} data - Données créées
   * @param {String} message - Message de succès
   */
  static created(res, data, message = 'Ressource créée avec succès') {
    return this.success(res, data, message, 201);
  }

  /**
   * Réponse supprimée avec succès
   * @param {Object} res - Objet de réponse Express
   * @param {String} message - Message de succès
   */
  static deleted(res, message = 'Ressource supprimée avec succès') {
    return this.success(res, null, message, 204);
  }

  /**
   * Réponse mise à jour avec succès
   * @param {Object} res - Objet de réponse Express
   * @param {*} data - Données mises à jour
   * @param {String} message - Message de succès
   */
  static updated(res, data, message = 'Ressource mise à jour avec succès') {
    return this.success(res, data, message, 200);
  }
}

module.exports = ApiResponse;