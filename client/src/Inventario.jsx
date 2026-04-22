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
        } catch (err) { alert("No se pudo guardar el cambio"); }
    };

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

    // Función para editar datos detectados dentro del modal antes de confirmar
    const editarDatoDetectado = (index, campo, valor) => {
        const nuevosItems = [...loteDetectado.items];
        nuevosItems[index][campo] = valor;
        setLoteDetectado({ ...loteDetectado, items: nuevosItems });
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
            
            {/* MODAL DE REVISIÓN IA (CON EDICIÓN Y FOTO GRANDE) */}
            {loteDetectado && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                    <div style={{ background: 'white', borderRadius: '16px', maxWidth: '900px', width: '100%', display: 'flex', maxHeight: '90vh', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
                        
                        {/* Lado Izquierdo: Imagen Escaneada (Agrandada) */}
                        <div style={{ flex: 1, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <img src={loteDetectado.imagePreview} alt="Escaneo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                        </div>

                        {/* Lado Derecho: Datos Editables */}
                        <div style={{ flex: 1, padding: '30px', display: 'flex', flexDirection: 'column', background: '#fff' }}>
                            <h2 style={{ margin: '0 0 10px 0', fontSize: '1.4rem' }}>Revisar Detección</h2>
                            <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '20px' }}>Modificá los valores si la IA cometió algún error:</p>
                            
                            <div style={{ flex: 1, overflowY: 'auto', marginBottom: '20px', paddingRight: '10px' }}>
                                {loteDetectado.items.map((item, idx) => (
                                    <div key={idx} style={{ display: 'flex', gap: '10px', marginBottom: '12px', alignItems: 'center', background: '#f8fafc', padding: '10px', borderRadius: '8px' }}>
                                        <input 
                                            style={{ flex: 3, border: '1px solid #e2e8f0', padding: '8px', borderRadius: '6px', fontWeight: '500' }}
                                            value={item.nombre} 
                                            onChange={(e) => editarDatoDetectado(idx, 'nombre', e.target.value)}
                                        />
                                        <input 
                                            type="number"
                                            style={{ flex: 1, border: '1px solid #e2e8f0', padding: '8px', borderRadius: '6px', textAlign: 'center', fontWeight: 'bold', color: '#2563eb', ...fontNumeros }}
                                            value={item.cantidad} 
                                            onChange={(e) => editarDatoDetectado(idx, 'cantidad', parseInt(e.target.value) || 0)}
                                        />
                                    </div>
                                ))}
                            </div>

                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button onClick={confirmarCargaStock} style={{ flex: 2, background: '#16a34a', color: 'white', border: 'none', padding: '15px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>CONFIRMAR E INGRESAR</button>
                                <button onClick={() => setLoteDetectado(null)} style={{ flex: 1, background: '#f1f5f9', border: 'none', padding: '15px', borderRadius: '10px', cursor: 'pointer', color: '#475569' }}>CANCELAR</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '25px', alignItems: 'center' }}>
                <h1 style={{ fontSize: '1.6rem', fontWeight: '800', color: '#1e293b', margin: 0 }}>Gestión Operativa</h1>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <input type="file" id="ia-upload" hidden onChange={handleEscaneoMasivo} />
                    <label htmlFor="ia-upload" style={{ cursor: 'pointer', background: '#2563eb', color: 'white', padding: '10px 22px', borderRadius: '8px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {loading ? '⌛ Analizando...' : '📷 Escaneo Masivo'}
                    </label>
                </div>
            </header>

            {/* TABLA PRINCIPAL */}
            <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                        <tr style={{ color: '#64748b', fontSize: '0.85rem', textTransform: 'uppercase' }}>
                            <th style={{ padding: '15px', width: '50px' }}>Add</th>
                            <th style={{ padding: '15px', textAlign: 'left' }}>Producto</th>
                            <th style={{ padding: '15px', textAlign: 'center' }}>Stock</th>
                            <th style={{ padding: '15px', textAlign: 'right' }}>Precio Venta</th>
                            <th style={{ padding: '15px', textAlign: 'right' }}>Margen</th>
                        </tr>
                    </thead>
                    <tbody>
                        {productos.map(p => (
                            <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '15px', textAlign: 'center' }}>
                                    <button onClick={() => manejarSeleccion(p)} style={{ border: 'none', background: '#28282B', color:'white', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer' }}>+</button>
                                </td>
                                <td style={{ padding: '15px' }}>
                                    <div style={{ fontWeight: '600' }}>{p.nombre}</div>
                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{p.marca}</div>
                                </td>
                                <td style={{ padding: '15px', textAlign: 'center', ...fontNumeros }}>
                                    <input 
                                        type="number" 
                                        defaultValue={p.stock_actual}
                                        onBlur={(e) => guardarCambios(p.id, 'stock_actual', e.target.value)}
                                        style={{ width: '60px', textAlign: 'center', border: '1px solid #e2e8f0', borderRadius: '4px' }}
                                    />
                                </td>
                                <td style={{ padding: '15px', textAlign: 'right', ...fontNumeros }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', color: '#16a34a', fontWeight: 'bold' }}>
                                        <span>$</span>
                                        <input 
                                            type="number" 
                                            defaultValue={p.precio_actualizado}
                                            onBlur={(e) => guardarCambios(p.id, 'precio_actualizado', e.target.value)}
                                            style={{ width: '80px', textAlign: 'right', border: '1px solid transparent', color: '#16a34a', fontWeight: 'bold' }}
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