const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');

// Charger les variables d'environnement
dotenv.config();

// Créer une instance Sequelize pour la connexion à MySQL
const sequelize = new Sequelize(
  process.env.DB_NAME || 'markateplace-db',
  process.env.DB_USER || 'root',
  process.env.DB_PASSWORD || '',
  {
    host: process.env.DB_HOST || 'localhost',
    dialect: 'mysql',
    port: process.env.DB_PORT || 3306,
    // Autres options...
  }
);

// Fonction pour tester la connexion à la base de données
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Connexion à la base de données MySQL établie avec succès.');
  } catch (error) {
    console.error('❌ Impossible de se connecter à la base de données:', error);
    throw error; // Propager l'erreur pour qu'elle soit capturée dans server.js
  }
};

// C'est important d'exporter les deux !
module.exports = {
  sequelize,
  testConnection
};