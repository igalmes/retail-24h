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

  // --- LÓGICA DE PRODUCTOS ---
  const obtenerProductos = async () => {
    const token = localStorage.getItem('token'); // O donde lo guardes
    const email = localStorage.getItem('userEmail');

    try {
        const res = await fetch(`${API_URL}/api/productos`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'x-user-email': email, // Mandamos ambos por seguridad
                'Content-Type': 'application/json'
            }
        });
        const data = await res.json();
        // Ojo: ahora tu controller devuelve { productos: [...] }, no la lista sola.
        setLista(data.productos || []); 
    } catch (error) {
        console.error("Error al pedir productos", error);
    }
};

  useEffect(() => {
    if (token) obtenerProductos();
  }, [token, obtenerProductos]);

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
      }
    } catch (err) { alert("Error de conexión"); } 
    finally { setCargando(false); }
  };

  const manejarPago = async () => {
    if (carrito.length === 0) return;
    try {
        setCargando(true);
        const res = await fetch(`${API_URL}/pagos/crear-preferencia`, {
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
            <div 
              className="login-logo" 
              style={{backgroundImage: `url(${configComercio.logo})`, width: '80px', height: '80px', margin: '0 auto 20px', backgroundSize: 'cover', borderRadius: '12px'}}
            ></div>
            <h1>{configComercio.nombre}</h1>
            <p>Gestión Inteligente de Inventario</p>
            <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => {}} useOneTap />
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
          <div className="mini-logo" style={{backgroundImage: `url(${configComercio.logo})`}}></div>
          {configComercio.nombre}
        </div>

        <nav className="sidebar-nav">
          {/* BOTÓN PARA EL NUEVO MÓDULO */}
          <button className={`nav-btn ${view === 'inventario_pro' ? 'active' : ''}`} onClick={() => { setView('inventario_pro'); setMenuAbierto(false); }}>🚀 Inventario PRO</button>
          <button className={`nav-btn ${view === 'clientes' ? 'active' : ''}`} onClick={() => { setView('clientes'); setMenuAbierto(false); }}>👥 Clientes</button>
          
          <div style={{ margin: '10px 0', borderTop: '1px solid #e2e8f0', paddingTop: '10px' }}>
            <button className="nav-btn" style={{ color: '#25D366' }} onClick={() => window.open(`${API_URL.replace('/api', '')}/qr`, '_blank')}>💬 WhatsApp</button>
          </div>
        </nav>
        
        {/* CARRITO SIEMPRE VISIBLE PARA VENTAS RÁPIDAS */}
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
          <div style={{display: 'flex', alignItems: 'center', gap: '15px'}}>
            <button className="menu-toggle" onClick={() => setMenuAbierto(!menuAbierto)}>
              {menuAbierto ? '✕' : '☰'}
            </button>
            <div className="brand-editable">
              {editandoNombre ? (
                <input autoFocus className="edit-brand-input" defaultValue={configComercio.nombre} onBlur={(e) => cambiarNombreEmpresa(e.target.value)} />
              ) : (
                <h2 style={{margin: 0, cursor: 'pointer'}} onClick={() => setEditandoNombre(true)}>
                  {configComercio.nombre} <small style={{fontSize: '0.6em'}}>✎</small>
                </h2>
              )}
            </div>
          </div>
          <div className="user-badge">
            <span className="d-none-mobile">{user?.nombre || 'Admin'}</span>
            <input type="file" ref={logoInputRef} hidden accept="image/*" onChange={manejarCambioLogo} />
            <div 
              className="avatar company-logo-trigger" 
              style={{backgroundImage: `url(${configComercio.logo})`, cursor: 'pointer'}}
              onClick={() => logoInputRef.current.click()}
            ></div>
          </div>
        </header>

        {cargando && <div className="loading-bar-container"><div className="loading-bar-fill"></div></div>}

        {/* --- NAVEGACIÓN DE VISTAS --- */}
        {view === 'inventario_pro' ? (
          <Inventario token={token} API_URL={API_URL} refreshList={obtenerProductos} />
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