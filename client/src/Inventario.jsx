import React, { useState, useEffect } from 'react';
import axios from 'axios';

const Inventario = ({ token, API_URL, refreshList, setCarrito, carrito }) => {
    const [productos, setProductos] = useState([]);
    const [repetidos, setRepetidos] = useState([]);
    const [loading, setLoading] = useState(false);
    const [alertas, setAlertas] = useState(0);

    // Tipografías según tus preferencias
    const fontTexto = { fontFamily: "'Inter', sans-serif" };
    const fontNumeros = { fontFamily: "'Roboto Mono', monospace" };

    // Carga inicial
    useEffect(() => {
        if (token) {
            fetchProductos();
        }
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
            console.error("Error al cargar inventario:", err.response?.data || err.message);
        }
    };

    // Lógica para agregar productos al carrito global
    const agregarAlCarrito = (producto) => {
        setCarrito(prev => {
            const existe = prev.find(item => item.id === producto.id);
            if (existe) {
                return prev.map(item => 
                    item.id === producto.id 
                    ? { ...item, cantidad: item.cantidad + 1 } 
                    : item
                );
            }
            return [...prev, { ...producto, cantidad: 1 }];
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
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });
            
            if (res.data.repetidos && res.data.repetidos.length > 0) {
                setRepetidos(res.data.repetidos);
            } else {
                alert(`Nuevos productos cargados: ${res.data.nuevosCount}`);
                fetchProductos();
                if (refreshList) refreshList();
            }
        } catch (err) {
            console.error("Error IA:", err.response?.data || err.message);
            alert("Error en la detección de IA.");
        } finally {
            setLoading(false);
            e.target.value = null;
        }
    };

    const handleConfirmarRepetido = async (producto) => {
        try {
            await axios.post(`${API_URL}/productos/confirmar-repetido`, producto, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setRepetidos(prev => prev.slice(1));
            fetchProductos();
            if (refreshList) refreshList();
        } catch (err) {
            console.error("Error al confirmar repetido:", err);
            alert("No se pudo actualizar el producto.");
        }
    };

    return (
        <div className="inventory-container" style={{ padding: '20px', ...fontTexto }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1e293b' }}>🚀 Inventario PRO</h1>
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                    {alertas > 0 && (
                        <span style={{ backgroundColor: '#fee2e2', color: '#dc2626', padding: '5px 12px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 'bold', ...fontNumeros }}>
                            ⚠️ {alertas} Alertas
                        </span>
                    )}
                    <input type="file" id="upload-ia" hidden accept="image/*" onChange={handleIAUpload} disabled={loading} />
                    <label htmlFor="upload-ia" style={{ 
                        backgroundColor: '#2563eb', color: 'white', padding: '10px 20px', borderRadius: '8px', 
                        cursor: loading ? 'not-allowed' : 'pointer', fontWeight: '600' 
                    }}>
                        {loading ? '⌛ Analizando...' : '📷 Escanear con IA'}
                    </label>
                </div>
            </header>

            <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <tr>
                            <th style={{ padding: '15px' }}>Producto</th>
                            <th style={{ padding: '15px' }}>Stock</th>
                            <th style={{ padding: '15px' }}>Venta</th>
                            <th style={{ padding: '15px', textAlign: 'center' }}>Acción</th>
                        </tr>
                    </thead>
                    <tbody>
                        {productos.length > 0 ? productos.map(p => {
                            const esAlerta = p.stock_actual <= (p.stock_minimo_alerta || 5);
                            const enCarrito = carrito.find(item => item.id === p.id)?.cantidad || 0;

                            return (
                                <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: esAlerta ? '#fffaf0' : 'transparent' }}>
                                    <td style={{ padding: '15px' }}>
                                        <div style={{ fontWeight: '600', color: '#334155' }}>{p.nombre}</div>
                                        <div style={{ fontSize: '0.75rem', color: '#64748b', ...fontNumeros }}>{p.marca} | {p.codigo_barras || 'Sin EAN'}</div>
                                    </td>
                                    <td style={{ padding: '15px', fontWeight: 'bold', color: esAlerta ? '#ef4444' : '#0f172a', ...fontNumeros }}>
                                        {p.stock_actual}
                                    </td>
                                    <td style={{ padding: '15px', fontWeight: 'bold', color: '#16a34a', ...fontNumeros }}>
                                        ${p.precio_actualizado}
                                    </td>
                                    <td style={{ padding: '15px', textAlign: 'center' }}>
                                        <button 
                                            onClick={() => agregarAlCarrito(p)}
                                            style={{
                                                backgroundColor: enCarrito > 0 ? '#16a34a' : '#f1f5f9',
                                                color: enCarrito > 0 ? 'white' : '#475569',
                                                border: 'none',
                                                padding: '8px 16px',
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                                fontWeight: 'bold',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '5px',
                                                margin: '0 auto'
                                            }}
                                        >
                                            🛒 {enCarrito > 0 && <span style={fontNumeros}>{enCarrito}</span>}
                                        </button>
                                    </td>
                                </tr>
                            );
                        }) : (
                            <tr>
                                <td colSpan="4" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                                    No hay productos. Escanea una góndola para empezar.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal de Repetidos */}
            {repetidos.length > 0 && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '16px', maxWidth: '400px', textAlign: 'center' }}>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '10px' }}>Producto Repetido</h2>
                        <p style={{ marginBottom: '20px' }}><b>{repetidos[0].nombre}</b> ya existe. ¿Actualizar stock y precio?</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <button onClick={() => handleConfirmarRepetido(repetidos[0])} style={{ backgroundColor: '#2563eb', color: 'white', padding: '12px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>Sí, actualizar</button>
                            <button onClick={() => setRepetidos(prev => prev.slice(1))} style={{ backgroundColor: '#f3f4f6', padding: '12px', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>Ignorar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Inventario;