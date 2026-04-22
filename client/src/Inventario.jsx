import React, { useState, useEffect } from 'react';
import axios from 'axios';

const Inventario = ({ token, API_URL, refreshList, carrito, setCarrito }) => {
    const [productos, setProductos] = useState([]);
    const [repetidos, setRepetidos] = useState([]);
    const [loading, setLoading] = useState(false);
    const [alertas, setAlertas] = useState(0);

    const fontTexto = { fontFamily: "'Inter', sans-serif" };
    const fontNumeros = { fontFamily: "'Roboto Mono', monospace" };

    useEffect(() => {
        if (token) fetchProductos();
    }, [token, API_URL]);

    const fetchProductos = async () => {
        if (!token) return;
        try {
            const res = await axios.get(`${API_URL}/productos`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.data && res.data.productos) {
                setProductos(res.data.productos);
                setAlertas(res.data.alertasFaltantes || 0);
            }
        } catch (err) {
            console.error("Error al cargar inventario:", err);
        }
    };

    // Lógica para añadir al carrito de App.jsx
    const manejarSeleccion = (p) => {
        setCarrito(prev => {
            const existe = prev.find(item => item.id === p.id);
            if (existe) {
                return prev.map(item => 
                    item.id === p.id ? { ...item, cantidad: item.cantidad + 1 } : item
                );
            }
            return [...prev, { ...p, cantidad: 1 }];
        });
    };

    const handleIAUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const formData = new FormData();
        formData.append('imagen', file);
        setLoading(true);
        try {
            const res = await axios.post(`${API_URL}/productos/detectar`, formData, {
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
            });
            if (res.data.repetidos?.length > 0) {
                setRepetidos(res.data.repetidos);
            } else {
                fetchProductos();
                if (refreshList) refreshList();
            }
        } catch (err) { alert("Error en IA"); }
        finally { setLoading(false); e.target.value = null; }
    };

    const handleConfirmarRepetido = async (producto) => {
        try {
            await axios.post(`${API_URL}/productos/confirmar-repetido`, producto, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setRepetidos(prev => prev.slice(1));
            fetchProductos();
        } catch (err) { console.error(err); }
    };

    return (
        <div className="inventory-container" style={{ padding: '20px', ...fontTexto }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Gestión de Inventario PRO</h1>
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                    {alertas > 0 && <span style={{ backgroundColor: '#fee2e2', color: '#dc2626', padding: '5px 12px', borderRadius: '20px', fontWeight: 'bold', ...fontNumeros }}>⚠️ {alertas} Alertas</span>}
                    <input type="file" id="upload-ia" hidden accept="image/*" onChange={handleIAUpload} disabled={loading} />
                    <label htmlFor="upload-ia" style={{ backgroundColor: '#2563eb', color: 'white', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>
                        {loading ? '⌛ Analizando...' : '📷 Escanear con IA'}
                    </label>
                </div>
            </header>

            <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <tr>
                            <th style={{ padding: '15px' }}>🛒</th>
                            <th style={{ padding: '15px' }}>Producto</th>
                            <th style={{ padding: '15px' }}>Stock</th>
                            <th style={{ padding: '15px' }}>Venta</th>
                            <th style={{ padding: '15px' }}>Margen</th>
                        </tr>
                    </thead>
                    <tbody>
                        {productos.map(p => {
                            const margen = p.precio_actualizado - (p.precio_compra || 0);
                            const esAlerta = p.stock_actual <= (p.stock_minimo_alerta || 5);
                            const itemEnCarrito = carrito.find(item => item.id === p.id);

                            return (
                                <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: esAlerta ? '#fffaf0' : 'transparent' }}>
                                    <td style={{ padding: '15px' }}>
                                        <button 
                                            onClick={() => manejarSeleccion(p)}
                                            style={{ 
                                                backgroundColor: itemEnCarrito ? '#16a34a' : '#f1f5f9', 
                                                border: 'none', padding: '8px', borderRadius: '6px', cursor: 'pointer' 
                                            }}
                                        >
                                            {itemEnCarrito ? `✅ ${itemEnCarrito.cantidad}` : '➕'}
                                        </button>
                                    </td>
                                    <td style={{ padding: '15px' }}>
                                        <div style={{ fontWeight: '600' }}>{p.nombre}</div>
                                        <div style={{ fontSize: '0.75rem', color: '#64748b', ...fontNumeros }}>{p.marca} | {p.codigo_barras || 'Sin EAN'}</div>
                                    </td>
                                    <td style={{ padding: '15px', fontWeight: 'bold', ...fontNumeros }}>{p.stock_actual}</td>
                                    <td style={{ padding: '15px', fontWeight: 'bold', color: '#16a34a', ...fontNumeros }}>${p.precio_actualizado}</td>
                                    <td style={{ padding: '15px' }}>
                                        <span style={{ backgroundColor: margen > 0 ? '#dcfce7' : '#f1f5f9', color: margen > 0 ? '#166534' : '#475569', padding: '4px 8px', borderRadius: '6px', fontSize: '0.8rem', ...fontNumeros }}>
                                            ${margen.toFixed(2)}
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {repetidos.length > 0 && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '16px', maxWidth: '400px', width: '100%', textAlign: 'center' }}>
                        <h2>Producto ya existente</h2>
                        <p>Detectamos <b>{repetidos[0].nombre}</b>. ¿Actualizar?</p>
                        <button onClick={() => handleConfirmarRepetido(repetidos[0])} style={{ backgroundColor: '#2563eb', color: 'white', padding: '12px', borderRadius: '8px', width: '100%', marginBottom: '10px', cursor: 'pointer', border: 'none' }}>Sumar Stock</button>
                        <button onClick={() => setRepetidos(prev => prev.slice(1))} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>Ignorar</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Inventario;