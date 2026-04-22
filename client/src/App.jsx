import React, { useState, useEffect, useRef } from 'react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import Inventario from './Inventario'; 

const GOOGLE_CLIENT_ID = "63486001099-vsqvofv817300d8vj1hsk4v7439566h6.apps.googleusercontent.com"; 

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(null);
  const [carrito, setCarrito] = useState([]); 
  const [view, setView] = useState('inventario_pro');
  const [cargando, setCargando] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [configComercio, setConfigComercio] = useState({
    nombre: "Retail 24h AI",
    logo: "https://via.placeholder.com/80"
  });

  // RESTAURACIÓN DE LA CONEXIÓN DINÁMICA
  const API_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:3000' 
    : window.location.origin;

  const logout = () => {
    localStorage.clear();
    setToken(null);
    setUser(null);
  };

  const obtenerProductos = async () => {
    const tokenAct = localStorage.getItem('token');
    const email = localStorage.getItem('userEmail');
    if (!tokenAct) return;

    try {
      const res = await fetch(`${API_URL}/api/productos`, {
        headers: {
          'Authorization': `Bearer ${tokenAct}`,
          'x-user-email': email,
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();
      // Si la DB está ok, esto llena la lista
    } catch (error) {
      console.error("Error al pedir productos", error);
    }
  };

  useEffect(() => {
    if (token) obtenerProductos();
  }, [token]);

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      setCargando(true);
      const res = await fetch(`${API_URL}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: credentialResponse.credential })
      });
      const data = await res.json();
      if (res.ok && data.token) {
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem('token', data.token);
        localStorage.setItem('userEmail', data.user.email);
      }
    } catch (err) { 
        alert("Error de conexión con el servidor"); 
    } finally { 
        setCargando(false); 
    }
  };

  const manejarPago = async () => {
    if (carrito.length === 0) return;
    try {
      setCargando(true);
      const res = await fetch(`${API_URL}/api/pagos/crear-preferencia`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          items: carrito.map(p => ({
            id: String(p.id),
            title: p.nombre,
            unit_price: Number(p.precio_actualizado),
            quantity: p.cantidad
          }))
        })
      });
      const data = await res.json();
      if (data.init_point) window.location.href = data.init_point;
    } catch (err) { alert("Error al conectar con Mercado Pago"); }
    finally { setCargando(false); }
  };

  if (!token) {
    return (
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <div className="login-screen">
          <div className="login-box">
            <div className="login-logo" style={{ backgroundImage: `url(${configComercio.logo})`, width: '80px', height: '80px', margin: '0 auto 20px', backgroundSize: 'cover', borderRadius: '12px' }}></div>
            <h1>{configComercio.nombre}</h1>
            <p>Gestión Inteligente de Inventario</p>
            <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => { }} useOneTap />
          </div>
        </div>
      </GoogleOAuthProvider>
    );
  }

  return (
    <div className="admin-layout">
      {menuAbierto && <div className="sidebar-overlay" onClick={() => setMenuAbierto(false)}></div>}

      <aside className={`sidebar ${menuAbierto ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <div className="mini-logo" style={{ backgroundImage: `url(${configComercio.logo})` }}></div>
          {configComercio.nombre}
        </div>

        <nav className="sidebar-nav">
          <button className={`nav-btn ${view === 'inventario_pro' ? 'active' : ''}`} onClick={() => { setView('inventario_pro'); setMenuAbierto(false); }}>🚀 Inventario PRO</button>
          <button className={`nav-btn ${view === 'clientes' ? 'active' : ''}`} onClick={() => { setView('clientes'); setMenuAbierto(false); }}>👥 Clientes</button>
          <div style={{ margin: '10px 0', borderTop: '1px solid #e2e8f0', paddingTop: '10px' }}>
            <button className="nav-btn" style={{ color: '#25D366' }} onClick={() => window.open(`${API_URL}/qr`, '_blank')}>💬 WhatsApp</button>
          </div>
        </nav>

        <div className="cart-card">
          <p className="cart-label">TOTAL VENTA</p>
          <b className="total-price" style={{ fontFamily: "'Roboto Mono', monospace" }}>
            ${carrito.reduce((acc, p) => acc + (p.precio_actualizado * p.cantidad), 0).toLocaleString()}
          </b>
          <button className="btn-pay" onClick={manejarPago} disabled={carrito.length === 0 || cargando}>
            {cargando ? '...' : 'PAGAR'}
          </button>
        </div>

        <button className="btn-logout" onClick={logout}>Cerrar Sesión</button>
      </aside>

      <main className="content">
        <header className="content-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <button className="menu-toggle" onClick={() => setMenuAbierto(!menuAbierto)}>
              {menuAbierto ? '✕' : '☰'}
            </button>
            <h2 style={{ margin: 0 }}>{configComercio.nombre}</h2>
          </div>
          <div className="user-badge">
            <span className="d-none-mobile">{user?.nombre || 'Admin'}</span>
            <div className="avatar" style={{ backgroundImage: `url(${configComercio.logo})` }}></div>
          </div>
        </header>

        {cargando && <div className="loading-bar-container"><div className="loading-bar-fill"></div></div>}

        {view === 'inventario_pro' ? (
          <Inventario 
            token={token} 
            API_URL={`${API_URL}/api`} 
            refreshList={obtenerProductos}
            carrito={carrito}
            setCarrito={setCarrito}
          />
        ) : (
          <div className="placeholder-module">
            <h3>Módulo de {view}</h3>
            <p>Próximamente disponible para {configComercio.nombre}</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;