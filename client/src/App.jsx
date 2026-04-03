import { useState, useEffect, useRef, useCallback } from 'react'; // IMPORTACIÓN CORREGIDA
import './App.css';

// Configuración de URL fuera del componente para evitar re-creaciones
const API_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:4000/api' 
    : 'https://retail-24h.onrender.com/api';

function App() {
  const [lista, setLista] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('Todas');
  const [productoEditando, setProductoEditando] = useState(null);
  const [vistaActual, setVistaActual] = useState('inicio');
  const [carrito, setCarrito] = useState([]);
  const fileInputRef = useRef(null);

  // 1. Cargar productos (Memorizada con useCallback para evitar el pestañeo)
  const obtenerProductos = useCallback(async () => {
    try {
      setCargando(true);
      const res = await fetch(`${API_URL}/productos`); 
      const resData = await res.json();
      const productosRecibidos = resData.data || resData;
      if (Array.isArray(productosRecibidos)) {
        setLista(productosRecibidos);
      }
    } catch (err) {
      console.error("Error al sincronizar inventario.");
    } finally {
      setCargando(false);
    }
  }, []);

  // 2. Efecto de carga inicial y detección de Mercado Pago
  useEffect(() => {
    obtenerProductos();

    const params = new URLSearchParams(window.location.search);
    const status = params.get('status');
    const paymentId = params.get('payment_id');

    const isSuccess = window.location.pathname.includes('/success') || status === 'approved';
    const isFailure = window.location.pathname.includes('/failure') || status === 'rejected';

    if (isSuccess && paymentId) {
      setVistaActual('success');
      setCarrito([]);
      window.history.replaceState({}, document.title, "/");
    } else if (isFailure) {
      setVistaActual('failure');
      window.history.replaceState({}, document.title, "/");
    }
  }, [obtenerProductos]);

  // --- LÓGICA DE CARRITO Y MERCADO PAGO ---
  const agregarAlCarrito = (p) => {
    setCarrito([...carrito, p]);
  };

  const finalizarCompra = async () => {
    if (carrito.length === 0) return alert("El carrito está vacío");

    try {
      setCargando(true);
      const itemsMP = carrito.map(p => ({
        id: String(p.id),
        title: p.nombre,
        unit_price: Number(p.precio_actualizado || p.precio_sugerido),
        quantity: 1,
        currency_id: 'ARS',
        picture_url: "https://www.mercadopago.com/org-img/MP3/home/logomp3.gif"
      }));

      const res = await fetch(`${API_URL}/pagos/crear-preferencia`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          items: itemsMP, 
          email_cliente: "ignacio.galmes@ejemplo.com" 
        }),
      });

      const data = await res.json();
      if (data.init_point) {
        window.location.href = data.init_point;
      } else {
        alert("Error: " + (data.error || "No se pudo generar el link de pago"));
      }
    } catch (err) {
      console.error("Error en pago:", err);
    } finally {
      setCargando(false);
    }
  };

  // --- FUNCIONES DE GESTIÓN (IA, EDITAR, ELIMINAR) ---
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
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const eliminarProducto = async (id) => {
    if (!window.confirm("¿Estás seguro?")) return;
    try {
      const res = await fetch(`${API_URL}/productos/${id}`, { method: 'DELETE' });
      if (res.ok) setLista(lista.filter(p => p.id !== id));
    } catch (err) {
      console.error("Error al eliminar");
    }
  };

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

  // --- FILTRADO Y CATEGORÍAS ---
  const productosFiltrados = lista.filter(p => {
    const nombre = p.nombre ? p.nombre.toLowerCase() : "";
    const coincideNombre = nombre.includes(busqueda.toLowerCase());
    const coincideCat = filtroCategoria === 'Todas' || p.categoria === filtroCategoria;
    return coincideNombre && coincideCat;
  });

  const categorias = ['Todas', ...new Set(lista.map(p => p.categoria).filter(Boolean))];

  // --- RENDERIZADO DE VISTAS (SUCCESS / FAILURE) ---
  if (vistaActual === 'success') {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100 bg-light">
        <div className="card shadow p-5 text-center" style={{maxWidth: '400px'}}>
          <div className="display-1 text-success mb-3">✅</div>
          <h2 className="fw-bold">¡Pago Exitoso!</h2>
          <p className="text-muted">Pedido procesado correctamente.</p>
          <button className="btn btn-primary w-100" onClick={() => window.location.href = '/'}>
            Volver al Panel
          </button>
        </div>
      </div>
    );
  }

  if (vistaActual === 'failure') {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100 bg-light">
        <div className="card shadow p-5 text-center" style={{maxWidth: '400px'}}>
          <div className="display-1 text-danger mb-3">❌</div>
          <h2 className="fw-bold">Pago Cancelado</h2>
          <button className="btn btn-dark w-100" onClick={() => setVistaActual('inicio')}>
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  // --- DASHBOARD PRINCIPAL ---
  return (
    <div className="admin-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">Retail 24h</div>
        <nav className="sidebar-nav">
          <div className="nav-item active">📦 Stock</div>
          <div className="mt-5 p-3 border rounded bg-light mx-2">
            <h6 className="fw-bold text-uppercase mb-3" style={{fontSize: '0.75rem'}}>Venta</h6>
            <div className="d-flex justify-content-between mb-2">
              <span>Items:</span> <strong>{carrito.length}</strong>
            </div>
            <div className="d-flex justify-content-between mb-3">
              <span>Total:</span> 
              <strong className="text-success">
                ${carrito.reduce((acc, p) => acc + Number(p.precio_actualizado || p.precio_sugerido), 0).toFixed(2)}
              </strong>
            </div>
            <button className="btn btn-primary btn-sm w-100 fw-bold" onClick={finalizarCompra} disabled={carrito.length === 0 || cargando}>
              {cargando ? 'Cargando...' : '💳 PAGAR'}
            </button>
          </div>
        </nav>
      </aside>

      <main className="content">
        <header className="content-header">
          <h2 className="fw-bold mb-0">Control de Inventario</h2>
          <div className="user-profile fw-bold text-muted">IGNACIO GALMES</div>
        </header>

        <div className="card shadow-sm border-0 m-4 p-4">
          <div className="d-flex justify-content-between mb-4 gap-3">
            <input type="text" className="form-control" placeholder="Buscar..." onChange={(e) => setBusqueda(e.target.value)} />
            <input type="file" ref={fileInputRef} style={{display: 'none'}} onChange={manejarEscaneo} accept="image/*" />
            <button className="btn btn-success" onClick={() => fileInputRef.current.click()} disabled={cargando}>
              📸 Escanear
            </button>
          </div>

          <div className="table-responsive">
            <table className="table align-middle">
              <thead>
                <tr>
                  <th>Foto</th>
                  <th>Nombre</th>
                  <th>Precio</th>
                  <th className="text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {productosFiltrados.map((p) => (
                  <tr key={p.id}>
                    <td><img src={p.fotoUrl || p.imagen_url} style={{width: '40px'}} alt="prod" /></td>
                    <td>{p.nombre}</td>
                    <td className="text-success fw-bold">${p.precio_actualizado || p.precio_sugerido}</td>
                    <td className="text-center">
                      <button className="btn btn-sm btn-success me-1" onClick={() => agregarAlCarrito(p)}>+</button>
                      <button className="btn btn-sm btn-outline-primary me-1" onClick={() => setProductoEditando({...p})}>Editar</button>
                      <button className="btn btn-sm btn-outline-danger" onClick={() => eliminarProducto(p.id)}>X</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {productoEditando && (
        <div className="modal-overlay">
          <div className="modal-content-card">
            <h4>Editar Producto</h4>
            <input type="text" className="form-control mb-2" value={productoEditando.nombre} onChange={(e) => setProductoEditando({...productoEditando, nombre: e.target.value})} />
            <input type="number" className="form-control mb-3" value={productoEditando.precio_sugerido} onChange={(e) => setProductoEditando({...productoEditando, precio_sugerido: e.target.value})} />
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