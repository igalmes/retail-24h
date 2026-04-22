import React, { useState, useEffect } from 'react';
import axios from 'axios';

const Inventario = ({ token, API_URL, refreshList, carrito, setCarrito }) => {
    const [productos, setProductos] = useState([]);
    const [loteDetectado, setLoteDetectado] = useState(null); 
    const [loading, setLoading] = useState(false);

    const fontTexto = { fontFamily: "'Inter', sans-serif" };
    const fontNumeros = { fontFamily: "'Roboto Mono', monospace" };

    useEffect(() => {
        if (token) fetchProductos();
    }, [token, API_URL]);

    const fetchProductos = async () => {
        try {
            const res = await axios.get(`${API_URL}/productos`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.data && res.data.productos) {
                setProductos(res.data.productos);
            }
        } catch (err) { console.error("Error cargando DB:", err); }
    };

    const guardarCambios = async (id, campo, valor) => {
        try {
            await axios.put(`${API_URL}/productos/${id}`, { [campo]: valor }, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            fetchProductos();
        } catch (err) {
            alert("No se pudo guardar el cambio");
        }
    };

    const handleEscaneoMasivo = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const formData = new FormData();
        formData.append('imagen', file);
        setLoading(true);

        try {
            const res = await axios.post(`${API_URL}/productos/detectar-lote`, formData, {
                headers: { 
                    'Authorization': `Bearer ${token}`, 
                    'Content-Type': 'multipart/form-data' 
                }
            });
            // Se espera que la IA devuelva imagePreview y la lista de items detectados
            setLoteDetectado(res.data);
        } catch (err) {
            alert("Error en detección masiva");
        } finally {
            setLoading(false);
            e.target.value = null;
        }
    };

    const confirmarCargaStock = async () => {
        try {
            await axios.post(`${API_URL}/productos/confirmar-lote`, { items: loteDetectado.items }, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setLoteDetectado(null);
            fetchProductos();
            if (refreshList) refreshList();
        } catch (err) { alert("Error al actualizar stock"); }
    };

<div className="cart-card" style={{ ...fontTexto }}>
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
    <p className="cart-label" style={{ margin: 0, fontWeight: '800', color: '#1e293b' }}>CARRITO</p>
    {carrito.length > 0 && (
      <button 
        onClick={vaciarCarrito} 
        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}
      >
        VACIAR TODO
      </button>
    )}
  </div>
  
  <div className="cart-items-list" style={{ maxHeight: '150px', overflowY: 'auto', marginBottom: '10px' }}>
    {carrito.map(item => (
      <div key={item.id} style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        fontSize: '0.9rem', 
        marginBottom: '6px', 
        background: '#f1f5f9', 
        padding: '8px', 
        borderRadius: '6px',
        border: '1px solid #e2e8f0'
      }}>
        {/* TEXTO EN NEGRITA AQUÍ */}
        <span style={{ fontWeight: '700', color: '#0f172a' }}>
          {item.cantidad}x {item.nombre}
        </span>
        
        <button 
          onClick={() => eliminarDelCarrito(item.id)} 
          style={{ border: 'none', background: '#cbd5e1', color: 'white', cursor: 'pointer', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}
        >
          ✕
        </button>
      </div>
    ))}
  </div>

  <p className="cart-label" style={{ fontWeight: '800', marginTop: '15px' }}>TOTAL VENTA</p>
  <b className="total-price" style={{ fontFamily: "'Roboto Mono', monospace", fontSize: '1.4rem', color: '#16a34a', fontWeight: '800' }}>
    ${carrito.reduce((acc, p) => acc + (p.precio_actualizado * p.cantidad), 0).toLocaleString()}
  </b>
  
  <button 
    className="btn-pay" 
    onClick={manejarPago} 
    disabled={carrito.length === 0 || cargando}
    style={{ fontWeight: '800', letterSpacing: '1px', marginTop: '10px' }}
  >
    {cargando ? 'PROCESANDO...' : 'PAGAR AHORA'}
  </button>
</div>
            
            {/* MODAL PROFESIONAL DE CARGA POR IA */}
            {loteDetectado && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                    <div style={{ background: 'white', borderRadius: '16px', maxWidth: '500px', width: '100%', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
                        <div style={{ height: '200px', background: `url(${loteDetectado.imagePreview}) center/cover`, borderBottom: '4px solid #2563eb' }}></div>
                        <div style={{ padding: '24px' }}>
                            <h3 style={{ margin: '0 0 10px 0' }}>Confirmar Ingreso de Mercadería</h3>
                            <p style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '20px' }}>La IA detectó los siguientes productos en la góndola:</p>
                            <div style={{ maxHeight: '180px', overflowY: 'auto', marginBottom: '20px', background: '#f8fafc', borderRadius: '8px', padding: '10px' }}>
                                {loteDetectado.items.map((item, idx) => (
                                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: idx !== loteDetectado.items.length -1 ? '1px solid #e2e8f0' : 'none' }}>
                                        <span style={{ fontWeight: '500' }}>{item.nombre}</span>
                                        <b style={{ color: '#2563eb', ...fontNumeros }}>+{item.cantidad}</b>
                                    </div>
                                ))}
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button onClick={confirmarCargaStock} style={{ flex: 2, background: '#16a34a', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>CONFIRMAR Y CARGAR</button>
                                <button onClick={() => setLoteDetectado(null)} style={{ flex: 1, background: '#f1f5f9', border: 'none', padding: '12px', borderRadius: '8px', cursor: 'pointer', color: '#475569' }}>CANCELAR</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '25px', alignItems: 'center' }}>
                <h1 style={{ fontSize: '1.6rem', fontWeight: '800', color: '#1e293b', margin: 0 }}>Gestión Operativa</h1>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <input type="file" id="ia-upload" hidden onChange={handleEscaneoMasivo} />
                    <label htmlFor="ia-upload" style={{ cursor: 'pointer', background: '#2563eb', color: 'white', padding: '10px 22px', borderRadius: '8px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)' }}>
                        {loading ? '⌛ Analizando...' : '📷 Escaneo Masivo'}
                    </label>
                </div>
            </header>

            <div className="table-card" style={{ background: 'white', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                        <tr style={{ color: '#64748b', fontSize: '0.85rem', textTransform: 'uppercase' }}>
                            <th style={{ padding: '15px', width: '50px' }}>Add</th>
                            <th style={{ padding: '15px', textAlign: 'left' }}>Producto / Marca</th>
                            <th style={{ padding: '15px', textAlign: 'center' }}>Stock</th>
                            <th style={{ padding: '15px', textAlign: 'right' }}>Precio Venta</th>
                            <th style={{ padding: '15px', textAlign: 'right' }}>Margen</th>
                        </tr>
                    </thead>
                    <tbody>
                        {productos.map(p => (
                            <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '15px', textAlign: 'center' }}>
                                    <button onClick={() => manejarSeleccion(p)} style={{ border: 'none', background: '#f1f5f9', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', fontWeight: 'bold' }}>+</button>
                                </td>
                                <td style={{ padding: '15px' }}>
                                    <div style={{ fontWeight: '600', color: '#0f172a' }}>{p.nombre}</div>
                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{p.marca} | {p.codigo_barras}</div>
                                </td>
                                <td style={{ padding: '15px', textAlign: 'center', ...fontNumeros }}>
                                    <input 
                                        type="number" 
                                        defaultValue={p.stock_actual}
                                        onBlur={(e) => guardarCambios(p.id, 'stock_actual', e.target.value)}
                                        style={{ width: '60px', textAlign: 'center', border: '1px solid transparent', padding: '5px', borderRadius: '4px', fontWeight: 'bold' }}
                                    />
                                </td>
                                <td style={{ padding: '15px', textAlign: 'right', fontWeight: 'bold', color: '#16a34a', ...fontNumeros }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                                        <span>$</span>
                                        <input 
                                            type="number" 
                                            defaultValue={p.precio_actualizado}
                                            onBlur={(e) => guardarCambios(p.id, 'precio_actualizado', e.target.value)}
                                            style={{ width: '85px', textAlign: 'right', border: '1px solid transparent', color: '#16a34a', fontWeight: 'bold', fontSize: '1rem' }}
                                        />
                                    </div>
                                </td>
                                <td style={{ padding: '15px', textAlign: 'right' }}>
                                    <span style={{ background: '#dcfce7', color: '#166534', padding: '4px 10px', borderRadius: '6px', fontSize: '0.85rem', ...fontNumeros }}>
                                        ${(p.precio_actualizado - (p.precio_compra || 0)).toFixed(2)}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Inventario;