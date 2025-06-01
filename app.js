const express = require('express');
const app = express();

app.use(express.json());

// Import des routes boutiques
const boutiqueRoutes = require('./routes/boutiqueRoutes');
app.use('/api/boutiques', boutiqueRoutes);

// ... autres routes, middleware, etc.

app.listen(3308, () => {
  console.log('Serveur démarré sur le port 3000');
});
