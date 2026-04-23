import React, { useState, useEffect } from 'react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import Inventario from './Inventario'; 

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID; 

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

  // Estilos según tus requerimientos
  const fontTexto = { fontFamily: "'Inter', sans-serif" };
  const fontNumeros = { fontFamily: "'Roboto Mono', monospace" };

  // URL dinámica: Detecta si estamos en local o en el dominio de Render
  const API_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:3000' 
    : window.location.origin;

  const logout = () => {
    localStorage.clear();
    setToken(null);
    setUser(null);
  };

  const eliminarDelCarrito = (id) => {
    setCarrito(prev => prev.filter(item => item.id !== id));
  };

  const vaciarCarrito = () => {
    setCarrito([]);
  };

  const obtenerProductos = async () => {
    const tokenAct = localStorage.getItem('token');
    const email = localStorage.getItem('userEmail');
    if (!tokenAct) return;

    try {
      // Ajustado a /api/productos según tu index.js
      const res = await fetch(`${API_URL}/api/productos`, {
        headers: {
          'Authorization': `Bearer ${tokenAct}`,
          'x-user-email': email,
          'Content-Type': 'application/json'
        }
      });
      if (res.status === 401 || res.status === 403) logout();
      await res.json(); 
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
      // RUTA CRÍTICA: /api/auth/google para coincidir con el backend
      const res = await fetch(`${API_URL}/api/auth/google`, {
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
        console.log("✅ Login exitoso en el servidor");
      } else {
        alert(data.error || "Error al iniciar sesión");
      }
    } catch (err) { 
        console.error("Error de conexión:", err);
        alert("No se pudo conectar con el servidor"); 
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
        <div className="login-screen" style={fontTexto}>
          <div className="login-box" style={{ textAlign: 'center', padding: '2rem' }}>
            <div className="login-logo" style={{ backgroundImage: `url(${configComercio.logo})`, width: '80px', height: '80px', margin: '0 auto 20px', backgroundSize: 'cover', borderRadius: '12px' }}></div>
            <h1 style={{ fontWeight: '800' }}>{configComercio.nombre}</h1>
            <p style={{ marginBottom: '20px' }}>Gestión Inteligente de Inventario</p>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
                <GoogleLogin 
                    onSuccess={handleGoogleSuccess} 
                    onError={() => alert("Error en el login de Google")} 
                    useOneTap 
                />
            </div>
          </div>
        </div>
      </GoogleOAuthProvider>
    );
  }

  return (
    <div className="admin-layout" style={fontTexto}>
      {menuAbierto && <div className="sidebar-overlay" onClick={() => setMenuAbierto(false)}></div>}

      <aside className={`sidebar ${menuAbierto ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <div className="mini-logo" style={{ backgroundImage: `url(${configComercio.logo})` }}></div>
          <span style={{ fontWeight: '800' }}>{configComercio.nombre}</span>
        </div>

        <nav className="sidebar-nav">
          <button className={`nav-btn ${view === 'inventario_pro' ? 'active' : ''}`} onClick={() => { setView('inventario_pro'); setMenuAbierto(false); }}>
            🚀 <span style={{ fontWeight: '700' }}>Inventario</span>
          </button>
          <button className={`nav-btn ${view === 'clientes' ? 'active' : ''}`} onClick={() => { setView('clientes'); setMenuAbierto(false); }}>
            👥 <span style={{ fontWeight: '700' }}>Clientes</span>
          </button>
          <div style={{ margin: '10px 0', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '10px' }}>
            <button className="nav-btn" style={{ color: '#22c55e', fontWeight: '700' }} onClick={() => window.open(`${API_URL}/qr`, '_blank')}>
              💬 WhatsApp
            </button>
          </div>
        </nav>

        <div className="cart-card" style={{ background: '#1e293b', padding: '15px', borderRadius: '12px', marginTop: 'auto', marginBottom: '15px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <p className="cart-label" style={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: '800', margin: 0 }}>CARRITO</p>
            {carrito.length > 0 && (
              <button onClick={vaciarCarrito} style={{ background: 'transparent', border: 'none', color: '#f87171', fontSize: '0.65rem', cursor: 'pointer', fontWeight: '700' }}>VACIAR</button>
            )}
          </div>
          
          <div className="cart-items-list" style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {carrito.length === 0 ? (
              <p style={{ color: '#475569', fontSize: '0.8rem', textAlign: 'center' }}>Sin productos</p>
            ) : (
              carrito.map(item => (
                <div key={item.id} className="cart-item-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid #334155', paddingBottom: '5px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span className="cart-item-name" style={{ color: '#fff', fontSize: '0.85rem', fontWeight: '600' }}>{item.cantidad}x {item.nombre}</span>
                    <span className="cart-item-sub" style={{ ...fontNumeros, color: '#22c55e', fontSize: '1rem' }}>${(item.precio_actualizado * item.cantidad).toLocaleString()}</span>
                  </div>
                  <button onClick={() => eliminarDelCarrito(item.id)} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer' }}>✕</button>
                </div>
              ))
            )}
          </div>

          <div style={{ marginTop: '15px', paddingTop: '10px', borderTop: '1px solid #334155' }}>
            <p className="cart-label" style={{ color: '#94a3b8', fontSize: '0.7rem', margin: 0 }}>TOTAL VENTA</p>
            <b className="total-price" style={{ ...fontNumeros, color: '#fff', fontSize: '1.4rem', display: 'block' }}>
              ${carrito.reduce((acc, p) => acc + (p.precio_actualizado * p.cantidad), 0).toLocaleString()}
            </b>
            <button 
              className="btn-pay" 
              onClick={manejarPago} 
              disabled={carrito.length === 0 || cargando}
              style={{ 
                width: '100%', 
                marginTop: '12px', 
                background: carrito.length > 0 ? '#2563eb' : '#475569', 
                color: 'white', 
                border: 'none', 
                padding: '12px', 
                borderRadius: '8px', 
                fontWeight: '800', 
                cursor: 'pointer' 
              }}
            >
              {cargando ? 'PROCESANDO...' : 'CONFIRMAR PAGO'}
            </button>
          </div>
        </div>

        <button className="btn-logout" onClick={logout} style={{ width: '100%', background: 'transparent', border: '1px solid #475569', color: '#94a3b8', padding: '10px', borderRadius: '8px', cursor: 'pointer' }}>
          Cerrar Sesión
        </button>
      </aside>

      <main className="content">
        <header className="content-header" style={{ background: '#fff', padding: '15px 25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <button className="menu-toggle" onClick={() => setMenuAbierto(!menuAbierto)} style={{ fontSize: '1.5rem', background: 'none', border: 'none', cursor: 'pointer' }}>
              {menuAbierto ? '✕' : '☰'}
            </button>
            <h2 style={{ margin: 0, fontWeight: '800', color: '#0f172a' }}>{configComercio.nombre}</h2>
          </div>
          <div className="user-badge" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="d-none-mobile" style={{ fontWeight: '700', color: '#475569' }}>{user?.nombre || 'Admin'}</span>
            <div className="avatar" style={{ backgroundImage: `url(${configComercio.logo})`, width: '35px', height: '35px', borderRadius: '50%', backgroundSize: 'cover' }}></div>
          </div>
        </header>

        {cargando && (
          <div className="loading-bar-container" style={{ height: '4px', background: '#e2e8f0' }}>
            <div className="loading-bar-fill" style={{ height: '100%', background: '#2563eb', width: '50%' }}></div>
          </div>
        )}

        <div style={{ padding: '1.5rem' }}>
          {view === 'inventario_pro' ? (
            <Inventario 
              token={token} 
              API_URL={`${API_URL}/api`} 
              refreshList={obtenerProductos}
              carrito={carrito}
              setCarrito={setCarrito}
            />
          ) : (
            <div className="placeholder-module" style={{ textAlign: 'center', marginTop: '100px', color: '#94a3b8' }}>
              <h3>Módulo de {view}</h3>
              <p>Próximamente disponible.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;