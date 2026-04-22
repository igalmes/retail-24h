import { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import './App.css';
import Inventario from './Inventario';

const API_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:4000/api' 
    : 'https://retail-24h.onrender.com/api';

const GOOGLE_CLIENT_ID = "264704665731-hi7jv7mvdnrud4cfoumuth3sok12mdb3.apps.googleusercontent.com"; 

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [lista, setLista] = useState([]);
  const [view, setView] = useState('inventario_pro'); // Vista por defecto cambiada a la Pro
  const [cargando, setCargando] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  
  const [carrito, setCarrito] = useState(() => {
    const guardado = localStorage.getItem('carrito');
    return guardado ? JSON.parse(guardado) : [];
  });

  const [editando, setEditando] = useState(null); 
  const [menuAbierto, setMenuAbierto] = useState(false);
  const logoInputRef = useRef(null);

  // --- ESTADOS PARA PERSONALIZACIÓN ---
  const [configComercio, setConfigComercio] = useState(() => {
    const guardado = localStorage.getItem('configComercio');
    return guardado ? JSON.parse(guardado) : { 
      nombre: "Retail 24h AI", 
      logo: "https://via.placeholder.com/40" 
    };
  });
  const [editandoNombre, setEditandoNombre] = useState(false);

  useEffect(() => {
    localStorage.setItem('carrito', JSON.stringify(carrito));
  }, [carrito]);

  useEffect(() => {
    localStorage.setItem('configComercio', JSON.stringify(configComercio));
  }, [configComercio]);

  // Carga de Configuración desde el Servidor
  useEffect(() => {
    const cargarConfigDeNube = async () => {
      if (!token) return;
      try {
        const res = await fetch(`${API_URL}/config`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.nombreEmpresa || data.logoUrl) {
            setConfigComercio({
              nombre: data.nombreEmpresa || "Retail 24h AI",
              logo: data.logoUrl || "https://via.placeholder.com/40"
            });
          }
        }
      } catch (err) { console.error("Error cargando configuración remota"); }
    };
    cargarConfigDeNube();
  }, [token]);

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('carrito');
    setCarrito([]);
  };

  const guardarConfigEnNube = async (nuevosDatos) => {
    if (!token) return;
    try {
      const payload = {
        nombreEmpresa: nuevosDatos.nombre || configComercio.nombre,
        logoUrl: nuevosDatos.logo || configComercio.logo
      };
      const res = await fetch(`${API_URL}/config`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setConfigComercio(prev => ({ ...prev, ...nuevosDatos }));
      }
    } catch (err) { console.error("Error al guardar en nube"); }
  };

  const cambiarNombreEmpresa = (nuevoNombre) => {
    if (!nuevoNombre || nuevoNombre === configComercio.nombre) {
        setEditandoNombre(false);
        return;
    }
    guardarConfigEnNube({ nombre: nuevoNombre });
    setEditandoNombre(false);
  };

  const manejarCambioLogo = (e) => {
    const archivo = e.target.files[0];
    if (!archivo) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      guardarConfigEnNube({ logo: reader.result });
    };
    reader.readAsDataURL(archivo);
  };

 import React, { useState, useEffect, useRef } from 'react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import Inventario from './Inventario'; // Asegúrate de que la ruta sea correcta

const GOOGLE_CLIENT_ID = "TU_CLIENT_ID.apps.googleusercontent.com"; 

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(null);
  const [lista, setLista] = useState([]);
  const [carrito, setCarrito] = useState([]); // Estado del carrito
  const [view, setView] = useState('inventario_pro');
  const [cargando, setCargando] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [editandoNombre, setEditandoNombre] = useState(false);
  const [configComercio, setConfigComercio] = useState({
    nombre: "Mi Comercio",
    logo: "https://via.placeholder.com/80"
  });

  const API_URL = "https://tu-backend.com"; // Reemplazar por tu URL real
  const logoInputRef = useRef(null);

  const logout = () => {
    localStorage.clear();
    setToken(null);
    setUser(null);
  };

  // --- LÓGICA DE PRODUCTOS ---
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
      setLista(data.productos || []);
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
    } catch (err) { alert("Error de conexión"); }
    finally { setCargando(false); }
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
            <button className="nav-btn" style={{ color: '#25D366' }} onClick={() => window.open(`${API_URL.replace('/api', '')}/qr`, '_blank')}>💬 WhatsApp</button>
          </div>
        </nav>

        <div className="cart-card">
          <p className="cart-label">TOTAL VENTA</p>
          <b className="total-price">
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
            <span>{user?.nombre || 'Admin'}</span>
            <div className="avatar" style={{ backgroundImage: `url(${configComercio.logo})` }}></div>
          </div>
        </header>

        {view === 'inventario_pro' ? (
          <Inventario 
            token={token} 
            API_URL={`${API_URL}/api`} 
            refreshList={obtenerProductos}
            carrito={carrito}
            setCarrito={setCarrito}
          />
        ) : (
          <div className="placeholder-module"><h3>Módulo de {view}</h3></div>
        )}
      </main>
    </div>
  );
}

export default App;