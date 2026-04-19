import { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';

const API_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:4000/api' 
    : 'https://retail-24h.onrender.com/api';

function App() {
  const [lista, setLista] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [productoEditando, setProductoEditando] = useState(null);
  const [vistaActual, setVistaActual] = useState('inicio');
  const [carrito, setCarrito] = useState([]);
  const fileInputRef = useRef(null);

  const obtenerProductos = useCallback(async (silencioso = false) => {
    try {
      if (!silencioso) setCargando(true);
      const res = await fetch(`${API_URL}/productos`); 
      const resData = await res.json();
      const productosRecibidos = resData.data || resData;
      if (Array.isArray(productosRecibidos)) {
        setLista(productosRecibidos);
      }
    } catch (err) {
      console.error("Error de sincronización");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    obtenerProductos();
    const interval = setInterval(() => obtenerProductos(true), 10000);
    return () => clearInterval(interval);
  }, [obtenerProductos]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('status') === 'approved') {
      setVistaActual('success');
      setCarrito([]);
      window.history.replaceState({}, document.title, "/");
    }
  }, []);

  const agregarAlCarrito = (p) => {
    setCarrito(prev => [...prev, p]);
  };

  const eliminarProducto = async (id) => {
    if (!window.confirm("¿Estás seguro?")) return;
    try {
      const res = await fetch(`${API_URL}/productos/${id}`, { method: 'DELETE' });
      if (res.ok) setLista(lista.filter(p => p.id !== id));
    } catch (err) { console.error("Error al eliminar"); }
  };

  const finalizarCompra = async () => {
    if (carrito.length === 0) return;
    try {
      setCargando(true);
      const itemsMP = carrito.map(p => ({
        id: String(p.id),
        title: p.nombre,
        unit_price: Number(p.precio_actualizado || p.precio_sugerido),
        quantity: 1,
        currency_id: 'ARS'
      }));
      const res = await fetch(`${API_URL}/pagos/crear-preferencia`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: itemsMP, email_cliente: "m.galmes@retail24.com" }),
      });
      const data = await res.json();
      if (data.init_point) window.location.href = data.init_point;
    } catch (err) { alert("Error en Mercado Pago"); } finally { setCargando(false); }
  };

  const manejarEscaneo = async (e) => {
    const archivo = e.target.files[0];
    if (!archivo) return;
    const formData = new FormData();
    formData.append('imagen', archivo);
    try {
      setCargando(true);
      const res = await fetch(`${API_URL}/productos/detectar`, { method: 'POST', body: formData });
      if (res.ok) await obtenerProductos();
    } catch (err) { console.error("Error en escaneo"); } finally {
      setCargando(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const productosFiltrados = lista.filter(p => 
    p.nombre?.toLowerCase().includes(busqueda.toLowerCase())
  );

  const SkeletonRow = () => (
    <tr className="skeleton-row">
      <td colSpan="4"><div className="skeleton-line"></div></td>
    </tr>
  );

  if (vistaActual === 'success') { /* Tu vista de éxito */ }

  return (
    <div className="admin-layout">
      <aside className="sidebar shadow">
        <div className="sidebar-brand">
          <span className="brand-dot"></span> Retail 24h
        </div>
        
        <div className="cart-card mx-3 p-3">
          <p className="cart-title">RESUMEN DE VENTA</p>
          <div className="d-flex justify-content-between">
            <span>Items:</span>
            <span className="fw-bold">{carrito.length}</span>
          </div>
          <div className="d-flex justify-content-between mb-3">
            <span>Total:</span>
            <span className="total-price">
              ${carrito.reduce((acc, p) => acc + Number(p.precio_actualizado || p.precio_sugerido), 0).toLocaleString()}
            </span>
          </div>
          <button className="btn btn-pay w-100" onClick={finalizarCompra} disabled={carrito.length === 0 || cargando}>
             {cargando ? 'PROCESANDO...' : 'PAGAR AHORA'}
          </button>
        </div>
      </aside>

      <main className="content">
        <header className="content-header px-4">
          <div>
            <h2 className="fw-bold mb-0">Inventario</h2>
            <p className="text-muted small d-none d-md-block">Control de stock e IA</p>
          </div>
          <div className="user-badge">
            <div className="avatar">IG</div>
            <span className="d-none d-sm-inline">Ignacio Galmes</span>
          </div>
        </header>

        <section className="container-fluid p-3 p-md-4">
          <div className="action-bar card p-3 border-0 shadow-sm mb-4">
            <div className="row g-3">
              <div className="col-12 col-md-8">
                <input 
                  type="text" 
                  className="form-control search-input" 
                  placeholder="🔍 Buscar..." 
                  onChange={(e) => setBusqueda(e.target.value)} 
                />
              </div>
              <div className="col-12 col-md-4">
                <input type="file" ref={fileInputRef} hidden onChange={manejarEscaneo} accept="image/*" />
                <button className="btn btn-scan w-100" onClick={() => fileInputRef.current.click()} disabled={cargando}>
                  📸 ESCANEAR IA
                </button>
              </div>
            </div>
          </div>

          {/* --- VISTA TABLET / DESKTOP --- */}
          <div className="card border-0 shadow-sm d-none d-md-block overflow-hidden">
            <table className="table table-hover mb-0">
              <thead className="bg-light">
                <tr>
                  <th className="ps-4">PRODUCTO</th>
                  <th>CATEGORÍA</th>
                  <th>PRECIO</th>
                  <th className="text-center">GESTIÓN</th>
                </tr>
              </thead>
              <tbody>
                {cargando && lista.length === 0 ? <SkeletonRow /> : productosFiltrados.map((p) => (
                  <tr key={p.id} className="product-row">
                    <td className="ps-4">
                      <div className="d-flex align-items-center">
                        <img src={p.fotoUrl || p.imagen_url || 'https://via.placeholder.com/40'} className="prod-img" alt="p" />
                        <div className="ms-3">
                          <div className="fw-bold">{p.nombre}</div>
                          <div className="text-muted x-small">EAN: {p.codigo_barras || 'N/A'}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className="badge-category">{p.categoria || 'General'}</span></td>
                    <td className="fw-bold text-dark">${p.precio_actualizado || p.precio_sugerido}</td>
                    <td className="text-center">
                      <div className="btn-group">
                        <button className="btn btn-action-add" onClick={() => agregarAlCarrito(p)}>+</button>
                        <button className="btn btn-action-edit" onClick={() => setProductoEditando(p)}>✎</button>
                        <button className="btn btn-action-delete" onClick={() => eliminarProducto(p.id)}>✕</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* --- VISTA MÓVIL (CARDS) --- */}
          <div className="d-md-none">
            {productosFiltrados.map((p) => (
              <div key={p.id} className="product-card-mobile shadow-sm mb-3">
                <div className="d-flex align-items-center w-100">
                  <img src={p.fotoUrl || p.imagen_url || 'https://via.placeholder.com/60'} alt="p" />
                  <div className="ms-3 flex-grow-1">
                    <div className="fw-bold text-dark" style={{fontSize: '0.9rem'}}>{p.nombre}</div>
                    <div className="text-success fw-bold">${p.precio_actualizado || p.precio_sugerido}</div>
                    <div className="text-muted x-small">EAN: {p.codigo_barras || 'N/A'}</div>
                  </div>
                  <div className="d-flex flex-column gap-2 ms-2">
                    <button className="btn btn-sm btn-soft-success" onClick={() => agregarAlCarrito(p)}>+</button>
                    <button className="btn btn-sm btn-soft-danger" onClick={() => eliminarProducto(p.id)}>✕</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;