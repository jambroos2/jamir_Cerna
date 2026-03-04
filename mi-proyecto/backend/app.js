const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const db = new Database(path.join(__dirname, 'notas.db'));

// ── Crear tablas si no existen ──────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS notas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    titulo TEXT NOT NULL,
    contenido TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES usuarios(id)
  );
`);

// ── Middlewares ─────────────────────────────────────────────
app.use(cors({ origin: ['http://localhost:8080', 'http://127.0.0.1:5500'], credentials: true }));
app.use(express.json());
app.use(session({
  secret: 'clave-secreta-hackathon',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true }
}));

// ── Middleware de autenticación ─────────────────────────────
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'No autorizado. Inicia sesión.' });
  }
  next();
}

// ══════════════════════════════════════════════════════════════
// RUTAS DE AUTENTICACIÓN
// ══════════════════════════════════════════════════════════════

// Registro
app.post('/api/register', (req, res) => {
  const { username, password, confirmPassword } = req.body;

  if (!username || !password || !confirmPassword)
    return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
  if (password !== confirmPassword)
    return res.status(400).json({ error: 'Las contraseñas no coinciden.' });
  if (username.length < 3 || username.length > 30)
    return res.status(400).json({ error: 'El usuario debe tener entre 3 y 30 caracteres.' });
  if (password.length < 6)
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });

  try {
    const hash = bcrypt.hashSync(password, 10);
    const stmt = db.prepare('INSERT INTO usuarios (username, password) VALUES (?, ?)');
    stmt.run(username.trim(), hash);
    res.status(201).json({ message: 'Usuario creado correctamente.' });
  } catch (err) {
    if (err.message.includes('UNIQUE'))
      return res.status(409).json({ error: 'Ese nombre de usuario ya existe.' });
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password)
    return res.status(400).json({ error: 'Usuario y contraseña son obligatorios.' });

  const user = db.prepare('SELECT * FROM usuarios WHERE username = ?').get(username.trim());
  if (!user || !bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: 'Credenciales incorrectas.' });

  req.session.userId = user.id;
  req.session.username = user.username;
  res.json({ message: 'Login correcto.', username: user.username });
});

// Logout
app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ message: 'Sesión cerrada.' });
});

// Quién soy
app.get('/api/me', requireAuth, (req, res) => {
  res.json({ userId: req.session.userId, username: req.session.username });
});

// ══════════════════════════════════════════════════════════════
// RUTAS DE NOTAS
// ══════════════════════════════════════════════════════════════

// Listar notas
app.get('/api/notas', requireAuth, (req, res) => {
  const notas = db.prepare(
    'SELECT id, titulo, created_at, updated_at FROM notas WHERE user_id = ? ORDER BY created_at DESC'
  ).all(req.session.userId);
  res.json(notas);
});

// Ver una nota
app.get('/api/notas/:id', requireAuth, (req, res) => {
  const nota = db.prepare('SELECT * FROM notas WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.session.userId);
  if (!nota) return res.status(404).json({ error: 'Nota no encontrada.' });
  res.json(nota);
});

// Crear nota
app.post('/api/notas', requireAuth, (req, res) => {
  const { titulo, contenido } = req.body;

  if (!titulo || !contenido)
    return res.status(400).json({ error: 'El título y el contenido son obligatorios.' });
  if (titulo.length > 100)
    return res.status(400).json({ error: 'El título no puede superar 100 caracteres.' });
  if (contenido.length > 5000)
    return res.status(400).json({ error: 'El contenido no puede superar 5000 caracteres.' });

  const stmt = db.prepare('INSERT INTO notas (user_id, titulo, contenido) VALUES (?, ?, ?)');
  const result = stmt.run(req.session.userId, titulo.trim(), contenido.trim());
  res.status(201).json({ id: result.lastInsertRowid, message: 'Nota creada.' });
});

// Editar nota
app.put('/api/notas/:id', requireAuth, (req, res) => {
  const { titulo, contenido } = req.body;

  if (!titulo || !contenido)
    return res.status(400).json({ error: 'El título y el contenido son obligatorios.' });

  const nota = db.prepare('SELECT * FROM notas WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.session.userId);
  if (!nota) return res.status(404).json({ error: 'Nota no encontrada.' });

  db.prepare('UPDATE notas SET titulo = ?, contenido = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(titulo.trim(), contenido.trim(), req.params.id);
  res.json({ message: 'Nota actualizada.' });
});

// Eliminar nota
app.delete('/api/notas/:id', requireAuth, (req, res) => {
  const nota = db.prepare('SELECT * FROM notas WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.session.userId);
  if (!nota) return res.status(404).json({ error: 'Nota no encontrada.' });

  db.prepare('DELETE FROM notas WHERE id = ?').run(req.params.id);
  res.json({ message: 'Nota eliminada.' });
});

// ── Arrancar servidor ───────────────────────────────────────
app.listen(3000, () => console.log('🚀 API corriendo en http://localhost:3000'));