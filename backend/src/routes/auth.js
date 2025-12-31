const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../db");

const router = express.Router();

router.post("/login", async (req, res) => {
  const { Identifier, password, role } = req.body;
  // Support 'identifier' or 'email' for backward compatibility
  const loginId = Identifier || req.body.email;

  if (!loginId || !password || !role) {
    return res.status(400).json({ message: "Identifier/Email, password and role required" });
  }

  // Requête adaptée selon le rôle
  let query = "";
  let params = [];

  if (role === "student") {
    // Étudiant : connexion par Email OU Matricule
    query = `
      SELECT * FROM users
      WHERE (email = ? OR matricule = ?) AND role = 'student'
    `;
    params = [loginId, loginId];
  } else {
    // Professeur : connexion par Email
    query = "SELECT * FROM users WHERE email = ? AND role = 'professor'";
    params = [loginId];
  }

  db.get(query, params, async (err, user) => {
    if (err) return res.status(500).json({ message: "Database error" });
    if (!user) return res.status(404).json({ message: "Utilisateur non trouvé" });

    // Vérification mot de passe
    // On essaie bcrypt d'abord, sinon texte brut pour compatibilité
    let isValid = false;
    try {
      isValid = await bcrypt.compare(password, user.password_hash);
    } catch (e) {
      isValid = user.password_hash === password;
    }

    if (!isValid) {
      // Fallback ultime pour texte brut si bcrypt échoue ou si le sel n'est pas reconnu
      if (user.password_hash === password) {
        isValid = true;
      } else {
        return res.status(401).json({ message: "Mot de passe incorrect" });
      }
    }

    // Génération Token
    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
        matricule: user.matricule || user.email,
        name: user.name
      },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "4h" }
    );

    res.json({
      token,
      user: {
        id: user.id,
        role: user.role,
        email: user.email,
        matricule: user.matricule,
        name: user.name
      }
    });
  });
});

// Inscription
router.post("/register", async (req, res) => {
  const { prenom, nom, email, password, role, matricule, secretCode } = req.body;

  if (!prenom || !nom || !email || !password || !role) {
    return res.status(400).json({ message: "Champs obligatoires manquants" });
  }

  // Vérification Code Secret pour Professeur
  if (role === 'professor' && secretCode !== 'PSN147') {
    return res.status(403).json({ message: "Code secret invalide pour l'inscription professeur" });
  }

  // Vérification existence
  const checkQuery = "SELECT id FROM users WHERE email = ? OR (matricule = ? AND matricule IS NOT NULL)";
  db.get(checkQuery, [email, matricule || null], async (err, existing) => {
    if (err) return res.status(500).json({ message: "Erreur base de données" });
    if (existing) return res.status(409).json({ message: "Email ou Matricule déjà utilisé" });

    // Hashage
    const hashedPassword = await bcrypt.hash(password, 10);
    const fullName = `${prenom} ${nom}`;

    const insertQuery = `
      INSERT INTO users (name, email, password_hash, role, matricule)
      VALUES (?, ?, ?, ?, ?)
    `;

    db.run(insertQuery, [fullName, email, hashedPassword, role, matricule || null], function (err) {
      if (err) {
        console.error("Register Error:", err);
        return res.status(500).json({ message: "Erreur lors de la création du compte: " + err.message });
      }

      const userId = this.lastID;
      const token = jwt.sign(
        { id: userId, role, matricule: matricule || email, name: fullName },
        process.env.JWT_SECRET || "secret",
        { expiresIn: "4h" }
      );

      res.status(201).json({
        token,
        user: { id: userId, role, email, matricule, name: fullName }
      });
    });
  });
});

module.exports = router;
