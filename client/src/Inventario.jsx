import React, { useState, useEffect } from 'react';
import axios from 'axios';

const Inventario = ({ token, API_URL, refreshList, carrito, setCarrito }) => {
    const [productos, setProductos] = useState([]);
    const [repetidos, setRepetidos] = useState([]);
    const [loading, setLoading] = useState(false);
    const [editando, setEditando] = useState(null); // ID del producto en edición

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

    // FUNCIÓN CRÍTICA: Actualizar precio o stock en la DB
    const guardarCambios = async (id, campo, valor) => {
        try {
            await axios.put(`${API_URL}/productos/${id}`, { [campo]: valor }, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setEditando(null);
            fetchProductos(); // Refrescar para asegurar sincronía
        } catch (err) {
            alert("No se pudo guardar el cambio");
        }
    };

    const manejarSeleccion = (p) => {
        setCarrito(prev => {
            const existe = prev.find(item => item.id === p.id);
            if (existe) {
                return prev.map(item => item.id === p.id ? { ...item, cantidad: item.cantidad + 1 } : item);
            }
            return [...prev, { ...p, cantidad: 1 }];
        });
    };

    return (
        <div className="inventory-pro" style={{ padding: '20px', ...fontTexto }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '25px' }}>
                <h1 style={{ fontSize: '1.6rem', fontWeight: '800', color: '#1e293b' }}>Gestión Operativa</h1>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <input type="file" id="ia-upload" hidden onChange={(e) => {/* ... lógica upload IA ... */}} />
                    <label htmlFor="ia-upload" className="btn-primary" style={{ cursor: 'pointer', background: '#2563eb', color: 'white', padding: '10px 20px', borderRadius: '8px', fontWeight: '600' }}>
                        📷 Escaneo Masivo
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
                            <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9', transition: '0.2s' }} className="row-hover">
                                <td style={{ padding: '15px', textAlign: 'center' }}>
                                    <button onClick={() => manejarSeleccion(p)} style={{ border: 'none', background: '#f1f5f9', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', fontWeight: 'bold' }}>+</button>
                                </td>
                                <td style={{ padding: '15px' }}>
                                    <div style={{ fontWeight: '600', color: '#0f172a' }}>{p.nombre}</div>
                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{p.marca} | {p.codigo_barras}</div>
                                </td>
                                
                                {/* EDITAR STOCK INLINE */}
                                <td style={{ padding: '15px', textAlign: 'center', ...fontNumeros }}>
                                    <input 
                                        type="number" 
                                        defaultValue={p.stock_actual}
                                        onBlur={(e) => guardarCambios(p.id, 'stock_actual', e.target.value)}
                                        style={{ width: '60px', textAlign: 'center', border: '1px solid transparent', padding: '5px', borderRadius: '4px', fontWeight: 'bold' }}
                                        onFocus={(e) => e.target.style.border = '1px solid #2563eb'}
                                    />
                                </td>

                                {/* EDITAR PRECIO INLINE */}
                                <td style={{ padding: '15px', textAlign: 'right', fontWeight: 'bold', color: '#16a34a', ...fontNumeros }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                                        <span>$</span>
                                        <input 
                                            type="number" 
                                            defaultValue={p.precio_actualizado}
                                            onBlur={(e) => guardarCambios(p.id, 'precio_actualizado', e.target.value)}
                                            style={{ width: '80px', textAlign: 'right', border: '1px solid transparent', color: '#16a34a', fontWeight: 'bold', fontSize: '1rem' }}
                                            onFocus={(e) => e.target.style.borderBottom = '1px solid #16a34a'}
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