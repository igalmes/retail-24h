import { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';

const API_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:4000/api' 
    : 'https://retail-24h.onrender.com/api';

function App() {
  const [lista, setLista] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [carrito, setCarrito] = useState([]);
  const fileInputRef = useRef(null);

  const obtenerProductos = useCallback(async (silencioso = false) => {
    try {
      if (!silencioso) setCargando(true);
      const res = await fetch(`${API_URL}/productos`); 
      const resData = await res.json();
      const productosRecibidos = resData.data || resData;
      if (Array.isArray(productosRecibidos)) setLista(productosRecibidos);
    } catch (err) {
      console.error("Error de sincronización");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    obtenerProductos();
    const interval = setInterval(() => obtenerProductos(true), 15000);
    return () => clearInterval(interval);
  }, [obtenerProductos]);

  const agregarAlCarrito = (p) => setCarrito(prev => [...prev, p]);

  const manejarEscaneo = async (e) => {
    const archivo = e.target.files[0];
    if (!archivo) return;
    const formData = new FormData();
    formData.append('imagen', archivo);
    try {
      setCargando(true);
      const res = await fetch(`${API_URL}/productos/detectar`, { method: 'POST', body: formData });
      if (res.ok) await obtenerProductos();
    } catch (err) { 
      console.error("Error en escaneo"); 
    } finally { 
      setCargando(false); 
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const productosFiltrados = lista.filter(p => 
    p.nombre?.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="admin-layout">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-dot"></span> Retail 24h
        </div>
        
        <div className="cart-card">
          <p style={{fontSize: '0.7rem', opacity: 0.6, marginBottom: '10px', fontWeight: 'bold'}}>RESUMEN DE VENTA</p>
          <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '8px'}}>
            <span>Items:</span>
            <span style={{fontWeight: 'bold'}}>{carrito.length}</span>
          </div>
          <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '20px'}}>
            <span>Total:</span>
            <span className="total-price">
              ${carrito.reduce((acc, p) => acc + Number(p.precio_actualizado || p.precio_sugerido), 0).toLocaleString()}
            </span>
          </div>
          <button className="btn-pay" onClick={() => alert('Próximamente Mercado Pago')} disabled={carrito.length === 0 || cargando}>
            {cargando ? 'Cargando...' : 'PAGAR AHORA'}
          </button>
        </div>
      </aside>

      {/* CONTENIDO PRINCIPAL */}
      <main className="content">
        <header className="content-header">
          <div>
            <h2 style={{margin: 0, fontWeight: 800}}>Inventario</h2>
            <p style={{margin: 0, color: '#64748b', fontSize: '0.85rem'}} className="d-none-mobile">Control de stock con IA</p>
          </div>
          <div className="user-badge">
            <span className="d-none-mobile" style={{fontWeight: 500}}>Ignacio Galmes</span>
            <div className="avatar">IG</div>
          </div>
        </header>

        <section style={{padding: '20px'}}>
          {/* BARRA DE ACCIÓN */}
          <div style={{display: 'flex', gap: '15px', marginBottom: '25px'}}>
            <input 
              type="text" 
              className="search-input"
              placeholder="🔍 Buscar por nombre..." 
              style={{flexGrow: 1, padding: '12px 20px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '1rem'}}
              onChange={(e) => setBusqueda(e.target.value)}
            />
            <input type="file" ref={fileInputRef} hidden onChange={manejarEscaneo} accept="image/*" />
            <button className="btn-scan" onClick={() => fileInputRef.current.click()}>
              ESCANEAR
            </button>
          </div>

          {/* VISTA DESKTOP: TABLA */}
          <div className="table-container d-none-mobile">
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Precio</th>
                  <th style={{textAlign: 'center'}}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {productosFiltrados.map((p) => (
                  <tr key={p.id}>
                    <td style={{display: 'flex', alignItems: 'center', gap: '15px'}}>
                      <img src={p.fotoUrl || p.imagen_url || 'https://via.placeholder.com/45'} className="prod-img" alt="p" />
                      <div>
                        <div style={{fontWeight: 'bold'}}>{p.nombre}</div>
                        <div style={{fontSize: '0.75rem', color: '#94a3b8'}}>EAN: {p.codigo_barras || 'N/A'}</div>
                      </div>
                    </td>
                    <td style={{fontWeight: 'bold'}}>${p.precio_actualizado || p.precio_sugerido}</td>
                    <td style={{textAlign: 'center'}}>
                      <button 
                        style={{padding: '8px 15px', borderRadius: '6px', border: 'none', background: '#dcfce7', color: '#166534', fontWeight: 'bold', cursor: 'pointer'}}
                        onClick={() => agregarAlCarrito(p)}
                      >
                        Añadir +
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* VISTA MÓVIL: CARDS */}
          <div className="mobile-list d-md-none" style={{display: 'flex', flexDirection: 'column'}}>
            <div className="d-md-none" style={{display: 'block'}}>
                {productosFiltrados.map((p) => (
                <div key={p.id} className="product-card-mobile">
                    <img src={p.fotoUrl || p.imagen_url || 'https://via.placeholder.com/70'} alt="p" />
                    <div style={{marginLeft: '15px', flexGrow: 1}}>
                    <div style={{fontWeight: 'bold', fontSize: '0.95rem'}}>{p.nombre}</div>
                    <div style={{color: 'var(--primary)', fontWeight: 'bold', margin: '4px 0'}}>${p.precio_actualizado || p.precio_sugerido}</div>
                    <div style={{fontSize: '0.7rem', color: '#94a3b8'}}>EAN: {p.codigo_barras || 'N/A'}</div>
                    </div>
                    <button 
                    style={{background: '#dcfce7', color: '#166534', border: 'none', borderRadius: '10px', width: '40px', height: '40px', fontWeight: 'bold'}}
                    onClick={() => agregarAlCarrito(p)}
                    >
                    +
                    </button>
                </div>
                ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;