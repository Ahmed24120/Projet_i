const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../db");

const router = express.Router();

const { authenticateToken } = require("../middleware/auth"); // Import middleware

// ... (existing code top) ...

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
  } else if (role === "ADMIN") {
    // ✅ ADMIN : Connexion par Email (ou Matricule si défini)
    query = "SELECT * FROM users WHERE (email = ? OR matricule = ?) AND role = 'ADMIN'";
    params = [loginId, loginId];
  } else {
    // Professeur (ou fallback) : connexion par Email
    query = "SELECT * FROM users WHERE email = ? AND role = 'professor'";
    params = [loginId];
  }

  db.get(query, params, async (err, user) => {
    if (err) return res.status(500).json({ message: "Database error" });
    if (!user) return res.status(404).json({ message: "Utilisateur non trouvé ou rôle incorrect" });
    if (user.deleted_at) return res.status(403).json({ message: "Ce compte a été supprimé." });

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
      { expiresIn: "8h" } // Session plus longue pour admin/prof
    );

    // Split name into prenom and nom for frontend display
    const nameParts = (user.name || "").split(" ");
    const prenom = nameParts[0] || "";
    const nom = nameParts.slice(1).join(" ") || "";

    res.json({
      token,
      user: {
        id: user.id,
        role: user.role,
        email: user.email,
        matricule: user.matricule,
        name: user.name,
        prenom: prenom,
        nom: nom
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
  const checkQuery = "SELECT * FROM users WHERE (matricule = ? AND role = 'student') OR (email = ?)";
  db.get(checkQuery, [matricule || 'NOMATCH', email], async (err, existing) => {
    if (err) return res.status(500).json({ message: "Erreur base de données" });

    // ✅ CAS 1: Matricule trouvé pour un étudiant -> CLAIM ACCOUNT
    if (existing && existing.matricule === matricule && existing.role === 'student') {
      const hashedPassword = await bcrypt.hash(password, 10);
      const fullName = (prenom && nom) ? `${prenom} ${nom}` : existing.name;

      // Email Validation Rule: matricule@domain
      const domain = "@supnum.mr";
      const proposedEmail = email.trim();
      const isValidSchoolEmail = proposedEmail.toLowerCase().includes(matricule.toLowerCase()) && proposedEmail.endsWith(domain);

      // On met à jour l'email SEULEMENT SI valide format école, sinon on garde l'ancien (souvent le placeholder d'import)
      const finalEmail = (isValidSchoolEmail) ? proposedEmail : existing.email;

      // Safety check: Don't take an email used by another ID
      if (finalEmail !== existing.email) {
        const emailTaken = await new Promise(r => db.get("SELECT id FROM users WHERE email = ? AND id != ?", [finalEmail, existing.id], (e, row) => r(row)));
        if (emailTaken) {
          // Si l'email voulu est pris, on garde l'email existant de l'import, mais on claim le compte quand même avec le password.
          // On pourrait renvoyer une erreur, mais "Claim" est prioritaire pour l'accès.
          // On continue avec existing.email
        }
      }

      const updateQuery = `
        UPDATE users SET password_hash = ?, name = ?, email = ?
        WHERE id = ?
      `;

      db.run(updateQuery, [hashedPassword, fullName, finalEmail, existing.id], function (err) {
        if (err) return res.status(500).json({ message: "Erreur lors de la mise à jour (Claim): " + err.message });

        // Token
        const token = jwt.sign(
          { id: existing.id, role: existing.role, matricule: existing.matricule, name: fullName },
          process.env.JWT_SECRET || "secret",
          { expiresIn: "4h" }
        );
        res.status(200).json({ // 200 OK (updated)
          token,
          user: {
            id: existing.id,
            role: existing.role,
            email: finalEmail,
            matricule,
            name: fullName,
            prenom: prenom,
            nom: nom,
            claimed: true
          }
        });
      });
      return;
    }

    // CAS 2: Email pris par quelqu'un d'autre
    if (existing) {
      return res.status(409).json({ message: "Email ou Matricule déjà utilisé." });
    }

    // CAS 3: Nouveau compte (Standard)
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
        user: {
          id: userId,
          role,
          email,
          matricule,
          name: fullName,
          prenom: prenom,
          nom: nom
        }
      });
    });
  });
});


/* =========================================================================
   ✅ SECTION ADMIN : GESTION DES UTILISATEURS (Branché ici pour éviter un nouveau fichier)
   ========================================================================= */

// Middleware checkAdmin local (ou importé s'il existait, mais on le fait inline pour simplicité dans ce fichier)
const checkAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'ADMIN') {
    next();
  } else {
    res.status(403).json({ error: "Accès refusé: Réservé aux administrateurs" });
  }
};

// GET /api/auth/users -> Lister les utilisateurs (Profs ou Etudiants)
router.get("/users", authenticateToken, checkAdmin, (req, res) => {
  const { role, search } = req.query;

  let sql = "SELECT id, matricule, email, name, role, created_at FROM users WHERE deleted_at IS NULL";
  let params = [];

  if (role) {
    sql += " AND role = ?";
    params.push(role);
  }
  if (search) {
    sql += " AND (name LIKE ? OR matricule LIKE ? OR email LIKE ?)";
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  sql += " ORDER BY id DESC LIMIT 100";

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// POST /api/auth/users -> Créer un utilisateur (Prof ou Etudiant) par Admin
router.post("/users", authenticateToken, checkAdmin, async (req, res) => {
  const { name, email, matricule, role, password, salle } = req.body;

  if (!name || !email || !role || !password) return res.status(400).json({ error: "Champs requis manquants" });

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    // Check duplication
    const exists = await new Promise((resolve) => {
      db.get("SELECT id FROM users WHERE email=? OR (matricule=? AND matricule IS NOT NULL)", [email, matricule], (err, row) => resolve(row));
    });
    if (exists) return res.status(409).json({ error: "Utilisateur déjà existant (email ou matricule)" });

    db.run("INSERT INTO users (name, email, password_hash, role, matricule) VALUES (?, ?, ?, ?, ?)",
      [name, email, hashedPassword, role, matricule || null],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        const newId = this.lastID;

        // Si etudiant et salle fournie, on update profile
        if (role === 'student' && salle) {
          db.run("INSERT INTO profile (id_user, classe, matricule, nom) VALUES (?, ?, ?, ?)", [newId, salle, matricule, name]);
        }

        // LOG
        const adminInfo = req.user.matricule || req.user.email;
        db.run("INSERT INTO logs (action, type, matricule) VALUES (?, 'admin', ?)",
          [`ADMIN_CREATE_USER: Created ${role} ${email}`, adminInfo]);

        res.json({ ok: true, id: newId });
      }
    );
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/auth/users/:id -> Mettre à jour (Admin)
router.put("/users/:id", authenticateToken, checkAdmin, (req, res) => {
  const { name, email, matricule, salle } = req.body;
  const userId = req.params.id;

  // Update base user info
  let sql = "UPDATE users SET name = ?, email = ?"; // start
  let params = [name, email];

  if (matricule !== undefined) {
    sql += ", matricule = ?";
    params.push(matricule);
  }

  sql += " WHERE id = ?";
  params.push(userId);

  db.run(sql, params, function (err) {
    if (err) return res.status(500).json({ error: err.message });

    // Update profile classe if student
    if (salle) {
      db.run("UPDATE profile SET classe = ? WHERE id_user = ?", [salle, userId]);
    }

    // LOG
    const adminInfo = req.user.matricule || req.user.email;
    db.run("INSERT INTO logs (action, type, matricule) VALUES (?, 'admin', ?)",
      [`ADMIN_UPDATE_USER: Updated user ${userId}`, adminInfo]);

    res.json({ ok: true });
  });
});

// POST /api/auth/users/:id/reset-password -> Reset Password (Admin)
router.post("/users/:id/reset-password", authenticateToken, checkAdmin, async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: "Nouveau mot de passe requis" });

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    db.run("UPDATE users SET password_hash = ? WHERE id = ?", [hashedPassword, req.params.id], function (err) {
      if (err) return res.status(500).json({ error: err.message });

      // LOG
      const adminInfo = req.user.matricule || req.user.email;
      db.run("INSERT INTO logs (action, type, matricule) VALUES (?, 'admin', ?)",
        [`ADMIN_RESET_PASSWORD: User ${req.params.id}`, adminInfo]);

      res.json({ ok: true });
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/auth/users/trash -> Lister la corbeille (Admin)
router.get("/users/trash", authenticateToken, checkAdmin, (req, res) => {
  const { search } = req.query;
  let sql = "SELECT id, matricule, email, name, role, deleted_at FROM users WHERE deleted_at IS NOT NULL";
  let params = [];

  if (search) {
    sql += " AND (name LIKE ? OR matricule LIKE ? OR email LIKE ?)";
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  sql += " ORDER BY deleted_at DESC LIMIT 50";

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// DELETE /api/auth/users/:id -> Soft Delete (Admin)
router.delete("/users/:id", authenticateToken, checkAdmin, (req, res) => {
  const userId = req.params.id;
  // Prevent self-delete
  if (req.user.id == userId) return res.status(400).json({ error: "Impossible de supprimer son propre compte." });

  db.run("UPDATE users SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?", [userId], function (err) {
    if (err) return res.status(500).json({ error: err.message });

    // LOG
    const adminInfo = req.user.matricule || req.user.email;
    db.run("INSERT INTO logs (action, type, matricule) VALUES (?, 'admin', ?)",
      [`ADMIN_DELETE_USER: Soft deleted user ${userId}`, adminInfo]);

    res.json({ ok: true });
  });
});

// POST /api/auth/users/:id/restore -> Restaurer (Admin)
router.post("/users/:id/restore", authenticateToken, checkAdmin, (req, res) => {
  const userId = req.params.id;
  db.run("UPDATE users SET deleted_at = NULL WHERE id = ?", [userId], function (err) {
    if (err) return res.status(500).json({ error: err.message });

    // LOG
    const adminInfo = req.user.matricule || req.user.email;
    db.run("INSERT INTO logs (action, type, matricule) VALUES (?, 'admin', ?)",
      [`ADMIN_RESTORE_USER: Restored user ${userId}`, adminInfo]);

    res.json({ ok: true });
  });
});

module.exports = router;

