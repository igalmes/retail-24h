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

  // Simulación de configuración del comercio (Esto podría venir de una DB luego)
  const [configComercio] = useState({
    nombre: "Retail 24h AI",
    logo: null 
  });

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
      alert("Error de conexión");
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
    } catch (err) {
      alert("Error al actualizar precio");
    }
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
      if (data.init_point) {
        window.location.href = data.init_point;
      }
    } catch (err) {
      alert("Error al conectar con Mercado Pago");
    } finally {
      setCargando(false);
    }
  };

  if (!token) {
    return (
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <div className="login-screen">
          <div className="login-box">
            <h1>{configComercio.nombre}</h1>
            <p>Consola de Gestión IA</p>
            <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => {}} useOneTap />
            {cargando && <p className="mt-3">Validando...</p>}
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
              ${carrito.reduce((acc, p) => acc + Number(p.precio_actualizado || p.precio_sugerido || 0), 0).toLocaleString()}
            </b>
          </div>
          <button className="btn-pay" onClick={manejarPago} disabled={carrito.length === 0 || cargando}>
            {cargando ? 'PROCESANDO...' : 'PAGAR'}
          </button>
        </div>
        <button className="btn-logout" onClick={logout}>Cerrar Sesión</button>
      </aside>

      <main className="content">
        <header className="content-header">
          <div><h2>Inventario</h2><p className="d-none-mobile">Sincronizado con Aiven Cloud</p></div>
          <div className="user-badge">
            <span className="d-none-mobile">{user?.nombre || 'Administrador'}</span>
            <div className="avatar" style={{backgroundImage: `url(${user?.foto})`}}></div>
          </div>
        </header>

        <section className="p-4">
          <div className="action-bar">
            <input type="text" placeholder="🔍 Buscar por nombre o EAN..." className="search-input" onChange={(e) => setBusqueda(e.target.value)} />
            <input type="file" ref={fileInputRef} hidden onChange={manejarEscaneo} accept="image/*" />
            <button className="btn-scan" onClick={() => fileInputRef.current.click()}>📸 ESCANEAR</button>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Precio (Clic para editar)</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {lista.filter(p => 
                  p.nombre.toLowerCase().includes(busqueda.toLowerCase()) || 
                  p.codigo_barras?.includes(busqueda)
                ).map((p) => (
                  <tr key={p.id}>
                    <td className="d-flex align-items-center gap-3">
                      <img src={p.fotoUrl || p.imagen_url || 'https://via.placeholder.com/50'} className="prod-img" alt="" />
                      <div><b>{p.nombre}</b><br/><small>EAN: {p.codigo_barras}</small></div>
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
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;