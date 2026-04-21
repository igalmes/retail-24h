import React, { useState, useEffect } from 'react';
import axios from 'axios';

const Inventario = ({ token, API_URL, refreshList }) => {
    const [productos, setProductos] = useState([]);
    const [repetidos, setRepetidos] = useState([]);
    const [loading, setLoading] = useState(false);
    const [alertas, setAlertas] = useState(0);

    // 1. Cargar inventario con el Token de Auth
    const fetchProductos = async () => {
        if (!token) return;
        try {
            const res = await axios.get(`${API_URL}/api/productos`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            // El backend devuelve { count, alertasFaltantes, productos }
            setProductos(res.data.productos || []);
            setAlertas(res.data.alertasFaltantes || 0);
        } catch (err) {
            console.error("Error al cargar productos:", err.response?.data || err.message);
        }
    };

    useEffect(() => {
        fetchProductos();
    }, [token]); // Se recarga si el token cambia

    // 2. Manejar la carga de imagen (IA)
    const handleIAUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('imagen', file);

        setLoading(true);
        try {
            const res = await axios.post(`${API_URL}/api/productos/detectar`, formData, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });
            
            if (res.data.repetidos && res.data.repetidos.length > 0) {
                setRepetidos(res.data.repetidos);
            } else {
                alert(`Nuevos productos cargados: ${res.data.nuevosCount}`);
                fetchProductos(); // Actualiza tabla local
                if (refreshList) refreshList(); // Actualiza contadores en App.jsx
            }
        } catch (err) {
            console.error("Error IA:", err.response?.data || err.message);
            alert("Error en la detección de IA. Revisá la consola.");
        } finally {
            setLoading(false);
            e.target.value = null; // Reset del input file
        }
    };

    return (
        <div className="inventory-container" style={{ padding: '20px' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1e293b' }}>Gestión de Inventario PRO</h1>
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                    {alertas > 0 && (
                        <span style={{ backgroundColor: '#fee2e2', color: '#dc2626', padding: '5px 12px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 'bold' }}>
                            ⚠️ {alertas} Alertas de Stock
                        </span>
                    )}
                    <input 
                        type="file" 
                        id="upload-ia" 
                        hidden 
                        accept="image/*"
                        onChange={handleIAUpload} 
                        disabled={loading}
                    />
                    <label 
                        htmlFor="upload-ia" 
                        style={{ 
                            backgroundColor: '#2563eb', 
                            color: 'white', 
                            padding: '10px 20px', 
                            borderRadius: '8px', 
                            cursor: loading ? 'not-allowed' : 'pointer',
                            display: 'inline-block',
                            transition: 'background 0.3s'
                        }}
                    >
                        {loading ? '⌛ Analizando Góndola...' : '📷 Escanear con IA'}
                    </label>
                </div>
            </header>

            {/* TABLA DE PRODUCTOS */}
            <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <tr>
                            <th style={{ padding: '15px' }}>Producto</th>
                            <th style={{ padding: '15px' }}>Stock</th>
                            <th style={{ padding: '15px' }}>Costo</th>
                            <th style={{ padding: '15px' }}>Venta</th>
                            <th style={{ padding: '15px' }}>Margen</th>
                        </tr>
                    </thead>
                    <tbody>
                        {productos.length > 0 ? productos.map(p => {
                            const margen = p.precio_actualizado - (p.precio_compra || 0);
                            const esAlerta = p.stock_actual <= (p.stock_minimo_alerta || 0);

                            return (
                                <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: esAlerta ? '#fffaf0' : 'transparent' }}>
                                    <td style={{ padding: '15px' }}>
                                        <div style={{ fontWeight: '600', color: '#334155' }}>{p.nombre}</div>
                                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{p.marca} | {p.codigo_barras || 'Sin EAN'}</div>
                                    </td>
                                    <td style={{ padding: '15px', fontWeight: 'bold', color: esAlerta ? '#ef4444' : '#0f172a' }}>
                                        {p.stock_actual}
                                    </td>
                                    <td style={{ padding: '15px', color: '#64748b' }}>${p.precio_compra || 0}</td>
                                    <td style={{ padding: '15px', fontWeight: 'bold', color: '#16a34a' }}>${p.precio_actualizado}</td>
                                    <td style={{ padding: '15px' }}>
                                        <span style={{ 
                                            backgroundColor: margen > 0 ? '#dcfce7' : '#f1f5f9', 
                                            color: margen > 0 ? '#166534' : '#475569',
                                            padding: '4px 8px',
                                            borderRadius: '6px',
                                            fontSize: '0.8rem'
                                        }}>
                                            ${margen.toFixed(2)}
                                        </span>
                                    </td>
                                </tr>
                            );
                        }) : (
                            <tr>
                                <td colSpan="5" style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>
                                    No hay productos en el inventario. ¡Escaneá una imagen para empezar!
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* MODAL DE REPETIDOS */}
            {repetidos.length > 0 && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
                    <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '16px', maxWidth: '400px', width: '100%', textAlign: 'center' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '10px' }}>📦</div>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '10px', color: '#c2410c' }}>Producto ya existente</h2>
                        <p style={{ color: '#4b5563', marginBottom: '20px' }}>
                            Detectamos <b>{repetidos[0].nombre}</b>. ¿Qué deseas hacer?
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <button className="btn-modal-primary" style={{ backgroundColor: '#2563eb', color: 'white', padding: '12px', borderRadius: '8px', border: 'none', fontWeight: 'bold' }}>
                                Sumar Stock y Actualizar Precio
                            </button>
                            <button onClick={() => setRepetidos(prev => prev.slice(1))} style={{ backgroundColor: '#f3f4f6', color: '#374151', padding: '12px', borderRadius: '8px', border: 'none' }}>
                                Ignorar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Inventario;