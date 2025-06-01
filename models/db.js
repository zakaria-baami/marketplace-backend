const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');

// Charger les variables d'environnement
dotenv.config();

// Créer une instance Sequelize avec les variables d'environnement directement
const sequelize = new Sequelize(
  process.env.DB_NAME || 'marketplace_db',
  process.env.DB_USER || 'root',
  process.env.DB_PASSWORD || '',
  {
    host: process.env.DB_HOST || 'localhost',
    dialect: 'mysql',
    port: process.env.DB_PORT || 3306,
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    define: {
      timestamps: true,
      underscored: true,
      freezeTableName: true,
      charset: 'utf8',
      dialectOptions: {
        collate: 'utf8_general_ci'
      }
    }
  }
);

// Objet pour stocker tous les modèles
const db = {};

// Ajouter Sequelize et l'instance sequelize
db.Sequelize = Sequelize;
db.sequelize = sequelize;

// Importer tous les modèles EXISTANTS
// Importez tous les modèles
db.Utilisateur = require('./utilisateur')(sequelize, Sequelize);
db.Client = require('./client')(sequelize, Sequelize);
db.Vendeur = require('./vendeur')(sequelize, Sequelize);
db.GradeVendeur = require('./gradeVendeur')(sequelize, Sequelize);
db.Boutique = require('./boutique')(sequelize, Sequelize);
db.Template = require('./template')(sequelize, Sequelize);
db.Message = require('./message')(sequelize, Sequelize);

// NOUVEAUX MODÈLES
db.Produit = require('./produit')(sequelize, Sequelize);
db.Panier = require('./panier')(sequelize, Sequelize);
db.LignePanier = require('./lignePanier')(sequelize, Sequelize);
db.Categorie = require('./categorie')(sequelize, Sequelize);
// Dans models/db.js
db.ImageProduit = require('./imageProduit')(sequelize, Sequelize);
// Encore à créer si nécessaire
db.StatistiqueVente = require('./statistiqueVente')(sequelize, Sequelize);


// Définir les associations entre les modèles
Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

// Fonction pour tester la connexion
db.testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Connexion à la base de données établie avec succès.');
    return true;
  } catch (error) {
    console.error('❌ Impossible de se connecter à la base de données:', error);
    throw error;
  }
};

// Fonction pour synchroniser la base de données
db.sync = async (options = {}) => {
  try {
    const defaultOptions = { 
      force: false,
      alter: false,
      ...options 
    };
    
    await sequelize.sync(defaultOptions);
    console.log('✅ Base de données synchronisée avec succès.');
    return true;
  } catch (error) {
    console.error('❌ Erreur lors de la synchronisation:', error);
    throw error;
  }
};

// Fonction pour fermer la connexion proprement
db.close = async () => {
  try {
    await sequelize.close();
    console.log('✅ Connexion à la base de données fermée.');
  } catch (error) {
    console.error('❌ Erreur lors de la fermeture:', error);
    throw error;
  }
};

module.exports = db;