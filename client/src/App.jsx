import { useState, useEffect, useRef } from 'react'
import './App.css'


const API_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:4000/api' 
    : 'https://retail-24h.onrender.com/api';

function App() {
  const [lista, setLista] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('Todas');
  const [productoEditando, setProductoEditando] = useState(null);
  const [vistaActual, setVistaActual] = useState('inicio'); // Manejo de vistas (inicio, success, failure)
  
  const [carrito, setCarrito] = useState([]);
  const fileInputRef = useRef(null);

  // 1. Cargar productos desde el Backend
  const obtenerProductos = async () => {
    try {
      setCargando(true);
      // Reemplazamos el 'http://localhost:4000/api' por ${API_URL}
      const res = await fetch(`${API_URL}/productos`); 
      const resData = await res.json();
      const productosRecibidos = resData.data || resData;
      if (Array.isArray(productosRecibidos)) {
        setLista(productosRecibidos);
      }
    } catch (err) {
      console.error("Error de red al obtener productos:", err);
    } finally {
      setCargando(false);
    }
  };

  // Efecto para cargar productos y detectar retornos de Mercado Pago
  useEffect(() => {
    obtenerProductos();

    // Lógica para detectar si venimos de un pago exitoso o fallido
    const params = new URLSearchParams(window.location.search);
    const status = params.get('status');
    
    if (window.location.pathname === '/success' || status === 'approved') {
      setVistaActual('success');
      setCarrito([]); // Limpiamos carrito tras éxito
    } else if (window.location.pathname === '/failure' || status === 'rejected') {
      setVistaActual('failure');
    }
  }, []);

  // --- LÓGICA DE CARRITO Y MERCADO PAGO ---
  const agregarAlCarrito = (p) => {
    setCarrito([...carrito, p]);
  };

  const finalizarCompra = async () => {
    if (carrito.length === 0) return alert("El carrito está vacío");

    try {
      setCargando(true);
      
      // Formateo estricto para evitar errores 400 en el backend
      const itemsMP = carrito.map(p => ({
        id: String(p.id),
        title: p.nombre,
        unit_price: Number(p.precio_actualizado || p.precio_sugerido),
        quantity: 1,
        currency_id: 'ARS',
	picture_url: "https://www.mercadopago.com/org-img/MP3/home/logomp3.gif"
      }));

      const totalVenta = itemsMP.reduce((acc, item) => acc + item.unit_price, 0);

      const res = await fetch(`${API_URL}/pagos/crear-preferencia`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          items: itemsMP, 
          total: totalVenta,
          email_cliente: "ignacio.galmes@ejemplo.com" 
        }),
      });

      const data = await res.json();
      
      if (data.init_point) {
        window.location.href = data.init_point;
      } else {
        console.error("Respuesta del servidor:", data);
        alert("Error: " + (data.error || "No se pudo generar el link de pago"));
      }
    } catch (err) {
      console.error("Error al procesar el pago:", err);
      alert("Error de conexión con el servidor de pagos");
    } finally {
      setCargando(false);
    }
  };

  // 2. Función para Escanear
  const manejarEscaneo = async (e) => {
    const archivo = e.target.files[0];
    if (!archivo) return;
    const formData = new FormData();
    formData.append('imagen', archivo);

    try {
      setCargando(true);
      const res = await fetch(`${API_URL}/productos/detectar`, {
        method: 'POST',
        body: formData,
      });
      if (res.ok) await obtenerProductos();
    } catch (err) {
      console.error("Error en el escaneo:", err);
    } finally {
      setCargando(false);
    }
  };

  // 3. Función para Eliminar
  const eliminarProducto = async (id) => {
    if (!window.confirm("¿Estás seguro?")) return;
    try {
      const res = await fetch(`${API_URL}/productos/${id}`, { method: 'DELETE' });
      if (res.ok) setLista(lista.filter(p => p.id !== id));
    } catch (err) {
      console.error("Error al eliminar");
    }
  };

  // 4. Función para Editar
  const guardarEdicion = async () => {
    try {
      const res = await fetch(`${API_URL}/productos/${productoEditando.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productoEditando)
      });
      if (res.ok) {
        await obtenerProductos();
        setProductoEditando(null);
      }
    } catch (err) {
      console.error("Error al actualizar");
    }
  };

  // Lógica de filtrado
  const productosFiltrados = lista.filter(p => {
    const nombre = p.nombre ? p.nombre.toLowerCase() : "";
    const coincideNombre = nombre.includes(busqueda.toLowerCase());
    const coincideCat = filtroCategoria === 'Todas' || p.categoria === filtroCategoria;
    return coincideNombre && coincideCat;
  });

  const categorias = ['Todas', ...new Set(lista.map(p => p.categoria).filter(Boolean))];

  // --- VISTA DE ÉXITO ---
  if (vistaActual === 'success') {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100 bg-light">
        <div className="card shadow p-5 text-center" style={{maxWidth: '400px'}}>
          <div className="display-1 text-success mb-3">✅</div>
          <h2 className="fw-bold">¡Pago Exitoso!</h2>
          <p className="text-muted">Tu pedido en Retail 24h ha sido procesado correctamente.</p>
          <button className="btn btn-primary w-100" onClick={() => window.location.href = '/'}>
            Volver al Panel
          </button>
        </div>
      </div>
    );
  }

  // --- VISTA DE ERROR ---
  if (vistaActual === 'failure') {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100 bg-light">
        <div className="card shadow p-5 text-center" style={{maxWidth: '400px'}}>
          <div className="display-1 text-danger mb-3">❌</div>
          <h2 className="fw-bold">Pago Cancelado</h2>
          <p className="text-muted">Hubo un problema o cancelaste el proceso. No se realizó ningún cargo.</p>
          <button className="btn btn-dark w-100" onClick={() => setVistaActual('inicio')}>
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  // --- VISTA PRINCIPAL (DASHBOARD) ---
  return (
    <div className="admin-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">Retail 24h</div>
        <nav className="sidebar-nav">
          <div className="nav-item active">📦 Stock</div>
          <div className="nav-item">📊 Reportes</div>
          <div className="nav-item">⚙️ Config</div>
          
          <div className="mt-5 p-3 border rounded bg-light mx-2" style={{fontSize: '0.85rem', color: '#333'}}>
            <h6 className="fw-bold text-uppercase mb-3" style={{fontSize: '0.75rem'}}>Venta en curso</h6>
            <div className="d-flex justify-content-between mb-2">
              <span>Items:</span>
              <span className="fw-bold">{carrito.length}</span>
            </div>
            <div className="d-flex justify-content-between mb-3">
              <span>Total:</span>
              <span className="fw-bold text-success">
                ${carrito.reduce((acc, p) => acc + Number(p.precio_actualizado || p.precio_sugerido), 0).toFixed(2)}
              </span>
            </div>
            <button 
              className="btn btn-primary btn-sm w-100 fw-bold mb-2"
              onClick={finalizarCompra}
              disabled={carrito.length === 0 || cargando}
            >
              {cargando ? 'Cargando...' : '💳 PAGAR CON MP'}
            </button>
            {carrito.length > 0 && (
              <button className="btn btn-outline-danger btn-sm w-100" onClick={() => setCarrito([])}>
                Vaciar Carrito
              </button>
            )}
          </div>
        </nav>
      </aside>

      <main className="content">
        <header className="content-header">
          <h2 className="fw-bold mb-0" style={{fontFamily: 'Roboto Mono', color: '#1a202c'}}>
            Control de Inventario
          </h2>
          <div className="user-profile fw-bold text-muted" style={{fontSize: '0.85rem'}}>
            IGNACIO GALMES
          </div>
        </header>

        <div className="card shadow-sm border-0 m-4">
          <div className="card-body">
            <div className="d-flex justify-content-between align-items-center mb-4 gap-3">
              <div className="d-flex gap-2 align-items-center">
                <span>Mostrar</span>
                <select className="form-select form-select-sm w-auto"><option>50</option></select>
                <span>unidades</span>
              </div>
              
              <div className="d-flex gap-3 flex-grow-1 justify-content-end" style={{maxWidth: '600px'}}>
                <select className="form-select w-auto" onChange={(e) => setFiltroCategoria(e.target.value)}>
                  {categorias.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Buscar producto..." 
                  onChange={(e) => setBusqueda(e.target.value)} 
                />
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  style={{display: 'none'}} 
                  onChange={manejarEscaneo} 
                  accept="image/*"
                />
                <button 
                  className="btn btn-success text-nowrap" 
                  onClick={() => fileInputRef.current.click()}
                  disabled={cargando}
                >
                  {cargando ? 'Procesando...' : '📸 Escanear'}
                </button>
              </div>
            </div>

            <div className="table-responsive">
              <table className="table table-hover align-middle">
                <thead className="table-light">
                  <tr>
                    <th>Foto</th>
                    <th>Nombre</th>
                    <th>Categoría</th>
                    <th>Precio (IPC)</th>
                    <th className="text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {productosFiltrados.length === 0 && !cargando ? (
                    <tr><td colSpan="5" className="text-center p-4 text-muted">No hay productos.</td></tr>
                  ) : productosFiltrados.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <img 
                          src={p.fotoUrl || p.imagen_url} 
                          className="img-thumbnail rounded" 
                          style={{width: '50px', height: '50px', objectFit: 'cover'}} 
                          alt="prod"
                          onError={(e) => e.target.src = 'https://via.placeholder.com/50'}
                        />
                      </td>
                      <td>
                        <div className="fw-bold">{p.nombre}</div>
                        <small className="text-muted">{p.marca || 'S/M'}</small>
                      </td>
                      <td>{p.categoria}</td>
                      <td>
                        <div className="text-success fw-bold" style={{fontFamily: 'Roboto Mono'}}>
                          ${p.precio_actualizado || p.precio_sugerido}
                        </div>
                      </td>
                      <td className="text-center">
                        <button className="btn btn-sm btn-success me-1" onClick={() => agregarAlCarrito(p)}>+ Añadir</button>
                        <button className="btn btn-sm btn-outline-primary me-1" onClick={() => setProductoEditando({...p})}>Editar</button>
                        <button className="btn btn-sm btn-outline-danger" onClick={() => eliminarProducto(p.id)}>Eliminar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {productoEditando && (
        <div className="modal-overlay">
          <div className="modal-content-card">
            <h4 className="mb-4">Editar Producto</h4>
            <div className="mb-3 text-start">
              <label className="form-label fw-bold">Nombre</label>
              <input 
                type="text" 
                className="form-control" 
                value={productoEditando.nombre} 
                onChange={(e) => setProductoEditando({...productoEditando, nombre: e.target.value})}
              />
            </div>
            <div className="mb-4 text-start">
              <label className="form-label fw-bold">Precio Sugerido</label>
              <input 
                type="number" 
                className="form-control" 
                value={productoEditando.precio_sugerido} 
                onChange={(e) => setProductoEditando({...productoEditando, precio_sugerido: e.target.value})}
              />
            </div>
            <div className="d-flex gap-2">
              <button className="btn btn-light w-50" onClick={() => setProductoEditando(null)}>Cancelar</button>
              <button className="btn btn-primary w-50" onClick={guardarEdicion}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;