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

module.exports = router;
