import React, { useState, useEffect } from 'react';
import axios from 'axios';

const Inventario = ({ token, API_URL, refreshList, carrito, setCarrito }) => {
    const [productos, setProductos] = useState([]);
    const [loteDetectado, setLoteDetectado] = useState(null); 
    const [loading, setLoading] = useState(false);
    const [busqueda, setBusqueda] = useState(""); // Estado para el filtro
    const [fotoExpandida, setFotoExpandida] = useState(null); // Estado para agrandar foto

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
        } catch (err) { alert("No se pudo guardar el cambio"); }
    };

    // Lógica de filtrado
    const productosFiltrados = productos.filter(p => 
        p.nombre.toLowerCase().includes(busqueda.toLowerCase()) || 
        p.marca.toLowerCase().includes(busqueda.toLowerCase()) ||
        (p.codigo_barras && p.codigo_barras.includes(busqueda))
    );

    const handleEscaneoMasivo = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const formData = new FormData();
        formData.append('imagen', file);
        setLoading(true);
        try {
            const res = await axios.post(`${API_URL}/productos/detectar-lote`, formData, {
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
            });
            setLoteDetectado(res.data);
        } catch (err) { alert("Error en detección masiva"); }
        finally { setLoading(false); e.target.value = null; }
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

    const manejarSeleccion = (p) => {
        setCarrito(prev => {
            const existe = prev.find(item => item.id === p.id);
            if (existe) return prev.map(item => item.id === p.id ? { ...item, cantidad: item.cantidad + 1 } : item);
            return [...prev, { ...p, cantidad: 1 }];
        });
    };

    return (
        <div className="inventory-pro" style={{ padding: '20px', ...fontTexto }}>
            
            {/* ZOOM DE IMAGEN (Lightbox) */}
            {fotoExpandida && (
                <div 
                    onClick={() => setFotoExpandida(null)}
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}
                >
                    <img src={fotoExpandida} style={{ maxHeight: '90vh', maxWidth: '90vw', borderRadius: '12px', boxShadow: '0 0 30px rgba(0,0,0,0.5)' }} alt="zoom" />
                </div>
            )}

            {/* MODAL DE CARGA IA */}
            {loteDetectado && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                    <div style={{ background: 'white', borderRadius: '16px', maxWidth: '500px', width: '100%', overflow: 'hidden' }}>
                        <div style={{ height: '200px', background: `url(${loteDetectado.imagePreview}) center/cover`, borderBottom: '4px solid #2563eb' }}></div>
                        <div style={{ padding: '24px' }}>
                            <h3 style={{ margin: '0' }}>Confirmar Ingreso</h3>
                            <div style={{ maxHeight: '180px', overflowY: 'auto', margin: '20px 0', background: '#f8fafc', borderRadius: '8px', padding: '10px' }}>
                                {loteDetectado.items.map((item, idx) => (
                                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e2e8f0' }}>
                                        <span>{item.nombre}</span>
                                        <b style={{ color: '#2563eb', ...fontNumeros }}>+{item.cantidad}</b>
                                    </div>
                                ))}
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button onClick={confirmarCargaStock} style={{ flex: 2, background: '#16a34a', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>CARGAR</button>
                                <button onClick={() => setLoteDetectado(null)} style={{ flex: 1, background: '#f1f5f9', border: 'none', padding: '12px', borderRadius: '8px', cursor: 'pointer' }}>CERRAR</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '25px', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
                <div>
                    <h1 style={{ fontSize: '1.6rem', fontWeight: '800', color: '#1e293b', margin: 0 }}>Gestión Operativa</h1>
                    <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>Total productos: <span style={{ ...fontNumeros, fontWeight: 'bold', color: '#2563eb' }}>{productos.length}</span></p>
                </div>

                <div style={{ display: 'flex', gap: '15px', flex: 1, justifyContent: 'flex-end', minWidth: '300px' }}>
                    <input 
                        type="text" 
                        placeholder="Buscar producto o marca..." 
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        style={{ padding: '10px 15px', borderRadius: '8px', border: '1px solid #e2e8f0', width: '250px', outline: 'none' }}
                    />
                    <input type="file" id="ia-upload" hidden onChange={handleEscaneoMasivo} />
                    <label htmlFor="ia-upload" style={{ cursor: 'pointer', background: '#2563eb', color: 'white', padding: '10px 22px', borderRadius: '8px', fontWeight: '600' }}>
                        {loading ? '⌛ Analizando...' : '📷 Escaneo Masivo'}
                    </label>
                </div>
            </header>

            <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                        <tr style={{ color: '#64748b', fontSize: '0.85rem', textTransform: 'uppercase' }}>
                            <th style={{ padding: '15px', width: '50px' }}>Add</th>
                            <th style={{ padding: '15px', width: '60px' }}>Foto</th>
                            <th style={{ padding: '15px', textAlign: 'left' }}>Producto / Marca</th>
                            <th style={{ padding: '15px', textAlign: 'center' }}>Stock</th>
                            <th style={{ padding: '15px', textAlign: 'right' }}>Precio Venta</th>
                            <th style={{ padding: '15px', textAlign: 'right' }}>Margen</th>
                        </tr>
                    </thead>
                    <tbody>
                        {productosFiltrados.map(p => (
                            <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '15px', textAlign: 'center' }}>
                                    <button onClick={() => manejarSeleccion(p)} style={{ border: 'none', background: '#28282B', color: 'white', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer' }}>+</button>
                                </td>
                                
                                <td style={{ padding: '10px', textAlign: 'center' }}>
                                    {p.imagen_url ? (
                                        <img 
                                            src={p.imagen_url} 
                                            alt={p.nombre} 
                                            onClick={() => setFotoExpandida(p.imagen_url)} // CLICK PARA AGRANDAR
                                            style={{ width: '45px', height: '45px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #e2e8f0', cursor: 'zoom-in' }} 
                                        />
                                    ) : (
                                        <div style={{ width: '45px', height: '45px', background: '#f1f5f9', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#94a3b8' }}>N/A</div>
                                    )}
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
                                        style={{ width: '60px', textAlign: 'center', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '4px', fontWeight: 'bold' }}
                                    />
                                </td>

                                <td style={{ padding: '15px', textAlign: 'right', ...fontNumeros }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', color: '#16a34a', fontWeight: 'bold' }}>
                                        <span>$</span>
                                        <input 
                                            type="number" 
                                            defaultValue={p.precio_actualizado}
                                            onBlur={(e) => guardarCambios(p.id, 'precio_actualizado', e.target.value)}
                                            style={{ width: '85px', textAlign: 'right', border: 'none', color: '#16a34a', fontWeight: 'bold', background: 'transparent', outline: 'none' }}
                                        />
                                    </div>
                                </td>

                                <td style={{ padding: '15px', textAlign: 'right' }}>
                                    <span style={{ background: '#dcfce7', color: '#166534', padding: '4px 8px', borderRadius: '6px', fontSize: '0.85rem', ...fontNumeros }}>
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