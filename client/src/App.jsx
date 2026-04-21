import { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import './App.css';

const API_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:4000/api' 
    : 'https://retail-24h.onrender.com/api';

const GOOGLE_CLIENT_ID = "264704665731-hi7jv7mvdnrud4cfoumuth3sok12mdb3.apps.googleusercontent.com"; 

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [lista, setLista] = useState([]);
  const [view, setView] = useState('inventario');
  const [cargando, setCargando] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  
  const [carrito, setCarrito] = useState(() => {
    const guardado = localStorage.getItem('carrito');
    return guardado ? JSON.parse(guardado) : [];
  });

  const [editando, setEditando] = useState(null); 
  const [menuAbierto, setMenuAbierto] = useState(false);
  const fileInputRef = useRef(null);
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

  // 1. Efecto para persistir carrito
  useEffect(() => {
    localStorage.setItem('carrito', JSON.stringify(carrito));
  }, [carrito]);

  // 2. Efecto para persistir config localmente (fallback rápido)
  useEffect(() => {
    localStorage.setItem('configComercio', JSON.stringify(configComercio));
  }, [configComercio]);

  // 3. NUEVO: Efecto para cargar Configuración desde el Servidor
  useEffect(() => {
    const cargarConfigDeNube = async () => {
      if (!token) return;
      try {
        const res = await fetch(`${API_URL}/config`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          // Mapeamos los nombres de tu modelo Configuracion.js
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

  // --- FUNCIONES DE PERSONALIZACIÓN (AHORA CON GUARDADO EN RED) ---
  
  const guardarConfigEnNube = async (nuevosDatos) => {
    if (!token) return;
    try {
      // Unimos lo que ya tenemos con lo nuevo
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

  const agregarAlCarrito = (producto) => {
    setCarrito(prev => {
      const existe = prev.find(item => item.id === producto.id);
      if (existe) {
        return prev.map(item => 
          item.id === producto.id ? { ...item, cantidad: item.cantidad + 1 } : item
        );
      }
      return [...prev, { ...producto, cantidad: 1 }];
    });
  };

  const restarDelCarrito = (id) => {
    setCarrito(prev => {
      const item = prev.find(i => i.id === id);
      if (item?.cantidad > 1) {
        return prev.map(i => i.id === id ? { ...i, cantidad: i.cantidad - 1 } : i);
      }
      return prev.filter(i => i.id !== id);
    });
  };

  const obtenerCantidad = (id) => {
    return carrito.find(item => item.id === id)?.cantidad || 0;
  };

  const obtenerProductos = useCallback(async (silencioso = false) => {
    if (!token) return;
    try {
      if (!silencioso) setCargando(true);
      const res = await fetch(`${API_URL}/productos`, {
        headers: { 'Authorization': `Bearer ${token}` }
      }); 
      if (res.status === 401 || res.status === 403) return logout();
      const resData = await res.json();
      const productosRecibidos = resData.data || resData;
      
      if (Array.isArray(productosRecibidos)) {
        const dataLimpia = productosRecibidos.map(p => ({
          ...p,
          precio_actualizado: Number(p.precio_actualizado || p.precio || 0)
        }));
        setLista(dataLimpia);
      }
    } catch (err) { console.error("Error de sincronización"); } 
    finally { setCargando(false); }
  }, [token]);

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

  const manejarEscaneo = async (e) => {
    const archivo = e.target.files[0];
    if (!archivo || !token) return;
    const formData = new FormData();
    formData.append('imagen', archivo);
    try {
      setCargando(true);
      const res = await fetch(`${API_URL}/productos/detectar`, { 
        method: 'POST', 
        body: formData,
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) await obtenerProductos();
    } catch (err) { console.error("Error en escaneo"); } 
    finally { 
      setCargando(false); 
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const actualizarPrecio = async (id, nuevoPrecio) => {
    try {
      const res = await fetch(`${API_URL}/productos/${id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ precio_actualizado: Number(nuevoPrecio) })
      });
      if (res.ok) {
        setLista(lista.map(p => p.id === id ? { ...p, precio_actualizado: Number(nuevoPrecio) } : p));
        setEditando(null);
      }
    } catch (err) { alert("Error al actualizar precio"); }
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
          <button className={`nav-btn ${view === 'inventario' ? 'active' : ''}`} onClick={() => { setView('inventario'); setMenuAbierto(false); }}>📦 Inventario</button>
          <button className={`nav-btn ${view === 'stock' ? 'active' : ''}`} onClick={() => { setView('stock'); setMenuAbierto(false); }}>📉 Control Stock</button>
          <button className={`nav-btn ${view === 'clientes' ? 'active' : ''}`} onClick={() => { setView('clientes'); setMenuAbierto(false); }}>👥 Clientes</button>
          <button className={`nav-btn ${view === 'empleados' ? 'active' : ''}`} onClick={() => { setView('empleados'); setMenuAbierto(false); }}>🛠 Empleados</button>
        </nav>
        
        <div className="cart-card">
          <p className="cart-label">VENTA ACTUAL</p>
          <div className="cart-row">
            <span>Items:</span>
            <b>{carrito.reduce((acc, p) => acc + p.cantidad, 0)}</b>
          </div>
          <div className="cart-row">
            <span>Total:</span>
            <b className="total-price">
              ${carrito.reduce((acc, p) => acc + (p.precio_actualizado * p.cantidad), 0).toLocaleString()}
            </b>
          </div>
          <button className="btn-pay" onClick={manejarPago} disabled={carrito.length === 0 || cargando}>
            {cargando ? 'PROCESANDO...' : 'PAGAR'}
          </button>
          {carrito.length > 0 && (
            <button className="btn-clear" onClick={() => setCarrito([])}>Vaciar</button>
          )}
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
                <input 
                  autoFocus
                  className="edit-brand-input"
                  defaultValue={configComercio.nombre}
                  onBlur={(e) => cambiarNombreEmpresa(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && cambiarNombreEmpresa(e.target.value)}
                />
              ) : (
                <h2 style={{margin: 0, cursor: 'pointer'}} onClick={() => setEditandoNombre(true)}>
                  {configComercio.nombre} <small style={{fontSize: '0.6em'}}>✎</small>
                </h2>
              )}
              <p className="d-none-mobile" style={{margin: 0, color: '#64748b', fontSize: '0.8rem'}}>Retail 24h AI v2.0</p>
            </div>
          </div>
          <div className="user-badge">
            <span className="d-none-mobile">{user?.nombre || 'Admin'}</span>
            <input type="file" ref={logoInputRef} hidden accept="image/*" onChange={manejarCambioLogo} />
            <div 
              className="avatar company-logo-trigger" 
              title="Cambiar logo de empresa"
              style={{backgroundImage: `url(${configComercio.logo})`, cursor: 'pointer', border: '2px solid var(--primary)'}}
              onClick={() => logoInputRef.current.click()}
            ></div>
          </div>
        </header>

        {cargando && (
          <div className="loading-bar-container">
            <div className="loading-bar-fill"></div>
          </div>
        )}

        {view === 'inventario' ? (
          <section style={{padding: '1.5rem'}}>
            <div className="action-bar">
              <input 
                type="text" 
                placeholder="🔍 Buscar por nombre o EAN..." 
                className="search-input" 
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)} 
              />
              <input type="file" ref={fileInputRef} hidden onChange={manejarEscaneo} accept="image/*" />
              <button className="btn-scan" onClick={() => fileInputRef.current.click()}>📸 ESCANEAR IA</button>
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Precio</th>
                    <th style={{textAlign: 'center'}}>Cantidad</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.filter(p => 
                    p.nombre.toLowerCase().includes(busqueda.toLowerCase()) || 
                    p.codigo_barras?.includes(busqueda)
                  ).map((p) => (
                    <tr key={p.id}>
                      <td className="td-producto">
                        <img src={p.fotoUrl || p.imagen_url || 'https://via.placeholder.com/50'} className="prod-img" alt="" />
                        <div>
                          <b className="p-name">{p.nombre}</b>
                          <small className="p-ean">EAN: {p.codigo_barras}</small>
                        </div>
                      </td>
                      <td className="td-precio">
                        {editando === p.id ? (
                          <input 
                            type="number" 
                            className="edit-price-input"
                            defaultValue={p.precio_actualizado}
                            onBlur={(e) => actualizarPrecio(p.id, e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && actualizarPrecio(p.id, e.target.value)}
                            autoFocus
                          />
                        ) : (
                          <b className="price-tag" onClick={() => setEditando(p.id)}>
                            ${Number(p.precio_actualizado || 0).toLocaleString()} ✎
                          </b>
                        )}
                      </td>
                      <td className="td-accion">
                        <div className="quantity-controls">
                          <button className="btn-qty" onClick={() => restarDelCarrito(p.id)}>-</button>
                          <span className="qty-number">{obtenerCantidad(p.id)}</span>
                          <button className="btn-qty plus" onClick={() => agregarAlCarrito(p)}>+</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {lista.length === 0 && !cargando && (
                <div className="empty-state">
                  <p>No hay productos disponibles.</p>
                </div>
              )}
            </div>
          </section>
        ) : (
          <div className="placeholder-module">
            <h3>Módulo de {view}</h3>
            <p>Sincronizando registros con la nube...</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;