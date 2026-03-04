const API = 'http://localhost:3000/api';
let editingId = null;

// ── Utilidades ──────────────────────────────────────────────
function showMsg(id, text, isError = false) {
  const el = document.getElementById(id);
  el.textContent = text;
  el.className = 'msg ' + (isError ? 'error' : 'ok');
}

function showTab(tab) {
  document.getElementById('tab-login').style.display = tab === 'login' ? '' : 'none';
  document.getElementById('tab-register').style.display = tab === 'register' ? '' : 'none';
}

// ── Auth ────────────────────────────────────────────────────
async function register() {
  const username = document.getElementById('reg-user').value.trim();
  const password = document.getElementById('reg-pass').value;
  const confirmPassword = document.getElementById('reg-confirm').value;

  const res = await fetch(`${API}/register`, {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, confirmPassword })
  });
  const data = await res.json();
  showMsg('reg-msg', data.message || data.error, !res.ok);
}

async function login() {
  const username = document.getElementById('login-user').value.trim();
  const password = document.getElementById('login-pass').value;

  const res = await fetch(`${API}/login`, {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await res.json();
  if (res.ok) {
    document.getElementById('username-display').textContent = data.username;
    document.getElementById('section-auth').style.display = 'none';
    document.getElementById('section-app').style.display = '';
    cargarNotas();
  } else {
    showMsg('login-msg', data.error, true);
  }
}

async function logout() {
  await fetch(`${API}/logout`, { method: 'POST', credentials: 'include' });
  document.getElementById('section-auth').style.display = '';
  document.getElementById('section-app').style.display = 'none';
}

async function checkSession() {
  const res = await fetch(`${API}/me`, { credentials: 'include' });
  if (res.ok) {
    const data = await res.json();
    document.getElementById('username-display').textContent = data.username;
    document.getElementById('section-auth').style.display = 'none';
    document.getElementById('section-app').style.display = '';
    cargarNotas();
  }
}

// ── Notas ───────────────────────────────────────────────────
async function cargarNotas() {
  const res = await fetch(`${API}/notas`, { credentials: 'include' });
  const notas = await res.json();
  const lista = document.getElementById('lista-notas');

  if (notas.length === 0) {
    lista.innerHTML = '<p>No tienes notas aún. ¡Crea una!</p>';
    return;
  }

  lista.innerHTML = notas.map(n => `
    <div class="nota-card">
      <h4>${escapeHtml(n.titulo)}</h4>
      <small>${new Date(n.created_at).toLocaleString('es-ES')}</small>
      <div class="nota-actions">
        <button onclick="verNota(${n.id})">👁 Ver</button>
        <button onclick="editarNota(${n.id})">✏️ Editar</button>
        <button class="secondary" onclick="eliminarNota(${n.id})">🗑 Eliminar</button>
      </div>
    </div>
  `).join('');
}

async function guardarNota() {
  const titulo = document.getElementById('nota-titulo').value.trim();
  const contenido = document.getElementById('nota-contenido').value.trim();

  if (!titulo || !contenido)
    return showMsg('nota-msg', 'El título y el contenido son obligatorios.', true);

  const url = editingId ? `${API}/notas/${editingId}` : `${API}/notas`;
  const method = editingId ? 'PUT' : 'POST';

  const res = await fetch(url, {
    method, credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ titulo, contenido })
  });
  const data = await res.json();

  if (res.ok) {
    showMsg('nota-msg', data.message, false);
    cancelarEdicion();
    cargarNotas();
  } else {
    showMsg('nota-msg', data.error, true);
  }
}

async function verNota(id) {
  const res = await fetch(`${API}/notas/${id}`, { credentials: 'include' });
  const nota = await res.json();
  alert(`📝 ${nota.titulo}\n\n${nota.contenido}`);
}

async function editarNota(id) {
  const res = await fetch(`${API}/notas/${id}`, { credentials: 'include' });
  const nota = await res.json();
  document.getElementById('nota-titulo').value = nota.titulo;
  document.getElementById('nota-contenido').value = nota.contenido;
  document.getElementById('form-title').textContent = 'Editando nota';
  document.getElementById('btn-cancelar').style.display = '';
  editingId = id;
  window.scrollTo(0, 0);
}

function cancelarEdicion() {
  editingId = null;
  document.getElementById('form-title').textContent = 'Nueva nota';
  document.getElementById('btn-cancelar').style.display = 'none';
  document.getElementById('nota-titulo').value = '';
  document.getElementById('nota-contenido').value = '';
}

async function eliminarNota(id) {
  if (!confirm('¿Seguro que quieres eliminar esta nota?')) return;
  const res = await fetch(`${API}/notas/${id}`, { method: 'DELETE', credentials: 'include' });
  const data = await res.json();
  showMsg('nota-msg', data.message || data.error, !res.ok);
  cargarNotas();
}

function escapeHtml(text) {
  return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// Comprobar sesión al iniciar
checkSession();