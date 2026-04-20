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
  const [cargando, setCargando] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [carrito, setCarrito] = useState([]);
  const [editando, setEditando] = useState(null); 
  const fileInputRef = useRef(null);

  const [configComercio] = useState({ nombre: "Retail 24h AI" });

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
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
      if (Array.isArray(productosRecibidos)) setLista(productosRecibidos);
    } catch (err) {
      console.error("Error de sincronización");
    } finally {
      setCargando(false);
    }
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
        setLista(lista.map(p => p.id === id ? { ...p, precio_actualizado: nuevoPrecio } : p));
        setEditando(null);
      }
    } catch (err) { alert("Error al actualizar precio"); }
  };

  const manejarPago = async () => {
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
            id: p.id,
            nombre: p.nombre,
            precio: p.precio_actualizado || p.precio_sugerido,
            quantity: 1
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
          <div className="login-box">
            <h1 style={{color: '#0f172a', marginBottom: '0.5rem'}}>{configComercio.nombre}</h1>
            <p style={{color: '#64748b', marginBottom: '2rem'}}>Gestión Inteligente de Inventario</p>
            <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => {}} useOneTap />
          </div>
        </div>
      </GoogleOAuthProvider>
    );
  }

  return (
    <div className="admin-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-dot"></span> {configComercio.nombre}
        </div>
        
        <div className="cart-card">
          <p className="cart-label">RESUMEN DE VENTA</p>
          <div className="cart-row"><span>Items:</span><b>{carrito.length}</b></div>
          <div className="cart-row">
            <span>Total:</span>
            <b className="total-price">
              ${carrito.reduce((acc, p) => acc + Number(p.precio_actualizado || 0), 0).toLocaleString()}
            </b>
          </div>
          <button className="btn-pay" onClick={manejarPago} disabled={carrito.length === 0 || cargando}>
            {cargando ? 'PROCESANDO...' : 'FINALIZAR VENTA'}
          </button>
          {carrito.length > 0 && (
            <button 
              style={{background: 'transparent', color: '#94a3b8', border: 'none', cursor: 'pointer', width: '100%', marginTop: '10px'}}
              onClick={() => setCarrito([])}
            >Limpiar carrito</button>
          )}
        </div>
        
        <button className="btn-pay" style={{marginTop: 'auto', background: '#334155'}} onClick={logout}>Cerrar Sesión</button>
      </aside>

      <main className="content">
        <header className="content-header">
          <div>
            <h2 style={{margin: 0}}>Inventario</h2>
            <p className="d-none-mobile" style={{margin: 0, color: '#64748b', fontSize: '0.9rem'}}>Sincronizado con Aiven Cloud</p>
          </div>
          <div className="user-badge">
            <span className="d-none-mobile">{user?.nombre || 'Administrador'}</span>
            <div className="avatar" style={{backgroundImage: `url(${user?.foto || 'https://via.placeholder.com/40'})`}}></div>
          </div>
        </header>

        <div className="action-bar">
          <input 
            type="text" 
            placeholder="🔍 Buscar por nombre o EAN..." 
            className="search-input" 
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
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {lista.filter(p => 
                p.nombre.toLowerCase().includes(busqueda.toLowerCase()) || 
                p.codigo_barras?.includes(busqueda)
              ).map((p) => (
                <tr key={p.id}>
                  <td style={{display: 'flex', alignItems: 'center', gap: '15px'}}>
                    <img src={p.fotoUrl || p.imagen_url || 'https://via.placeholder.com/50'} className="prod-img" alt="" />
                    <div>
                      <b style={{display: 'block'}}>{p.nombre}</b>
                      <small style={{color: '#64748b'}}>EAN: {p.codigo_barras}</small>
                    </div>
                  </td>
                  <td>
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
                        ${Number(p.precio_actualizado).toLocaleString()} ✎
                      </b>
                    )}
                  </td>
                  <td>
                    <button className="btn-add" onClick={() => setCarrito([...carrito, p])}>+</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {lista.length === 0 && !cargando && <p style={{padding: '2rem', textAlign: 'center', color: '#64748b'}}>No hay productos. Escaneá uno para empezar.</p>}
        </div>
      </main>
    </div>
  );
}

export default App;