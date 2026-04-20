import { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import './App.css';

const API_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:4000/api' 
    : 'https://retail-24h.onrender.com/api';

// REEMPLAZAR con tu Client ID de Google Cloud Console
const GOOGLE_CLIENT_ID = "tu_id_aqui.apps.googleusercontent.com"; 

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [lista, setLista] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [carrito, setCarrito] = useState([]);
  const fileInputRef = useRef(null);

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
      } else {
        alert(data.error || "Acceso denegado");
      }
    } catch (err) {
      alert("Error al conectar con el servidor de autenticación");
    } finally {
      setCargando(false);
    }
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
    } catch (err) { 
      console.error("Error en escaneo"); 
    } finally { 
      setCargando(false); 
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // VISTA DE LOGIN
  if (!token) {
    return (
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <div className="login-screen">
          <div className="login-box">
            <h1>Retail 24h</h1>
            <p>Consola de Gestión IA</p>
            <GoogleLogin 
              onSuccess={handleGoogleSuccess} 
              onError={() => alert("Error en Google Login")}
              useOneTap
            />
            {cargando && <p className="mt-3">Validando...</p>}
          </div>
        </div>
      </GoogleOAuthProvider>
    );
  }

  // VISTA DE DASHBOARD (Solo si hay token)
  return (
    <div className="admin-layout">
      <aside className="sidebar">
        <div className="sidebar-brand"><span className="brand-dot"></span> Retail 24h</div>
        <div className="cart-card">
          <p className="cart-label">RESUMEN DE VENTA</p>
          <div className="cart-row"><span>Items:</span><b>{carrito.length}</b></div>
          <div className="cart-row"><span>Total:</span><b className="total-price">${carrito.reduce((acc, p) => acc + Number(p.precio_actualizado || p.precio_sugerido), 0).toLocaleString()}</b></div>
          <button className="btn-pay" disabled={carrito.length === 0 || cargando}>PAGAR</button>
        </div>
        <button className="btn-logout" onClick={logout}>Cerrar Sesión</button>
      </aside>

      <main className="content">
        <header className="content-header">
          <div><h2>Inventario</h2><p className="d-none-mobile">Sincronizado con Aiven</p></div>
          <div className="user-badge">
            <span className="d-none-mobile">{user?.nombre || 'Admin'}</span>
            <div className="avatar" style={{backgroundImage: `url(${user?.foto})`}}></div>
          </div>
        </header>

        <section className="p-4">
          <div className="action-bar">
            <input type="text" placeholder="🔍 Buscar..." className="search-input" onChange={(e) => setBusqueda(e.target.value)} />
            <input type="file" ref={fileInputRef} hidden onChange={manejarEscaneo} accept="image/*" />
            <button className="btn-scan" onClick={() => fileInputRef.current.click()}>ESCANEAR</button>
          </div>

          <div className="table-container d-none-mobile">
            <table>
              <thead><tr><th>Producto</th><th>Precio</th><th>Acción</th></tr></thead>
              <tbody>
                {lista.filter(p => p.nombre.toLowerCase().includes(busqueda.toLowerCase())).map((p) => (
                  <tr key={p.id}>
                    <td className="d-flex align-items-center gap-3">
                      <img src={p.fotoUrl || p.imagen_url} className="prod-img" alt="" />
                      <div><b>{p.nombre}</b><br/><small>EAN: {p.codigo_barras}</small></div>
                    </td>
                    <td><b>${p.precio_actualizado}</b></td>
                    <td><button className="btn-add" onClick={() => setCarrito([...carrito, p])}>+</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;