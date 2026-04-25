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

  // Definimos la base limpia del servidor
  const SERVER_URL = window.location.hostname === 'localhost' 
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
      const res = await fetch(`${SERVER_URL}/api/productos`, {
        headers: {
          'Authorization': `Bearer ${tokenAct}`,
          'x-user-email': email,
          'Content-Type': 'application/json'
        }
      });
      if (res.status === 401 || res.status === 403) logout();
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
      const res = await fetch(`${SERVER_URL}/api/auth/google`, {
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
      } else {
        alert(data.error || "Error al iniciar sesión");
      }
    } catch (err) { alert("Error de conexión"); } 
    finally { setCargando(false); }
  };

  const manejarPago = async () => {
    if (carrito.length === 0) return;
    try {
      setCargando(true);
      const res = await fetch(`${SERVER_URL}/api/pagos/crear-preferencia`, {
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
    } catch (err) { alert("Error con Mercado Pago"); } 
    finally { setCargando(false); }
  };

  if (!token) {
    return (
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <div className="login-screen">
          <div className="login-box" style={{ textAlign: 'center', padding: '2rem' }}>
            <div className="login-logo" style={{ backgroundImage: `url(${configComercio.logo})`, width: '80px', height: '80px', margin: '0 auto 20px', backgroundSize: 'cover', borderRadius: '12px' }}></div>
            <h1 style={{ fontWeight: '800' }}>{configComercio.nombre}</h1>
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}>
                <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => alert("Error")} useOneTap />
            </div>
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
          <span style={{ fontWeight: '800' }}>{configComercio.nombre}</span>
        </div>
        <nav className="sidebar-nav">
          <button className={`nav-btn ${view === 'inventario_pro' ? 'active' : ''}`} onClick={() => { setView('inventario_pro'); setMenuAbierto(false); }}>🚀 Inventario</button>
          <button className={`nav-btn ${view === 'clientes' ? 'active' : ''}`} onClick={() => { setView('clientes'); setMenuAbierto(false); }}>👥 Clientes</button>
          
          <div style={{ marginTop: '20px', borderTop: '1px solid #334155', paddingTop: '10px' }}>
            <button className="nav-btn" style={{ color: '#22c55e' }} onClick={() => window.open(`${SERVER_URL}/qr`, '_blank')}>
              🟢 Conectar Bot
            </button>
          </div>
        </nav>

        <div className="cart-card" style={{ background: '#1e293b', padding: '15px', borderRadius: '12px', marginTop: 'auto', maxHeight: '350px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: '800' }}>CARRITO ({carrito.length})</span>
            {carrito.length > 0 && <button onClick={vaciarCarrito} style={{ background: 'none', border: 'none', color: '#f87171', fontSize: '0.7rem' }}>Vaciar</button>}
          </div>
          
          <div style={{ overflowY: 'auto', flexGrow: 1, marginBottom: '10px' }}>
            {carrito.map(item => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', color: 'white', fontSize: '0.85rem', marginBottom: '5px', paddingBottom: '5px', borderBottom: '1px solid #334155' }}>
                <span>{item.cantidad}x {item.nombre}</span>
                <button onClick={() => eliminarDelCarrito(item.id)} style={{ background: 'none', border: 'none', color: '#64748b' }}>✕</button>
              </div>
            ))}
          </div>

          <b className="font-numeric" style={{ color: '#fff', fontSize: '1.2rem', textAlign: 'right', display: 'block' }}>
            Total: ${carrito.reduce((acc, p) => acc + (p.precio_actualizado * p.cantidad), 0).toLocaleString()}
          </b>

          <button className="btn-pay" onClick={manejarPago} disabled={carrito.length === 0 || cargando} style={{ width: '100%', marginTop: '10px', background: '#2563eb', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: '800' }}>
            {cargando ? 'PROCESANDO...' : 'PAGAR'}
          </button>
        </div>

        <button onClick={logout} style={{ width: '100%', marginTop: '10px', background: 'transparent', color: '#94a3b8', border: '1px solid #475569', borderRadius: '8px', padding: '8px', cursor: 'pointer' }}>Cerrar Sesión</button>
      </aside>

      <main className="content">
        <header style={{ background: '#ffffff', padding: '15px', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0' }}>
          <button onClick={() => setMenuAbierto(!menuAbierto)} style={{ fontSize: '1.5rem', background: 'none', border: 'none', cursor: 'pointer' }}>☰</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontWeight: '700' }}>{user?.nombre || 'Administrador'}</span>
            <div style={{ backgroundImage: `url(${configComercio.logo})`, width: '35px', height: '35px', borderRadius: '50%', backgroundSize: 'cover' }}></div>
          </div>
        </header>
        <div style={{ padding: '1.5rem' }}>
          {view === 'inventario_pro' ? (
            <Inventario 
                token={token} 
                API_URL={`${SERVER_URL}/api/productos`} 
                refreshList={obtenerProductos} 
                carrito={carrito} 
                setCarrito={setCarrito} 
            />
          ) : (
            <div style={{ textAlign: 'center', marginTop: '50px' }}><h3>Módulo de {view} en desarrollo</h3></div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;