import React, { useState, useEffect } from 'react';
import axios from 'axios';

const Inventario = ({ token, API_URL, refreshList, carrito, setCarrito }) => {
    const [productos, setProductos] = useState([]);
    const [loteDetectado, setLoteDetectado] = useState(null); 
    const [loading, setLoading] = useState(false);
    const [busqueda, setBusqueda] = useState("");
    const [fotoExpandida, setFotoExpandida] = useState(null);
    const [orden, setOrden] = useState("recientes"); // "recientes", "antiguos", "az", "za"
    
    const [modalAbierto, setModalAbierto] = useState(false);
    const [editandoProd, setEditandoProd] = useState(null);

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

    // Lógica de ordenamiento y filtrado
    const procesarProductos = () => {
        let filtrados = productos.filter(p => 
            p.nombre.toLowerCase().includes(busqueda.toLowerCase()) || 
            p.marca.toLowerCase().includes(busqueda.toLowerCase()) ||
            (p.codigo_barras && p.codigo_barras.includes(busqueda))
        );

        switch (orden) {
            case "az":
                return filtrados.sort((a, b) => a.nombre.localeCompare(b.nombre));
            case "za":
                return filtrados.sort((a, b) => b.nombre.localeCompare(a.nombre));
            case "antiguos":
                return filtrados.sort((a, b) => a.id - b.id);
            default: // "recientes"
                return filtrados.sort((a, b) => b.id - a.id);
        }
    };

    const productosAMostrar = procesarProductos();

    const eliminarProducto = async (id, nombre) => {
        if (window.confirm(`¿Estás seguro de eliminar "${nombre}"?`)) {
            try {
                await axios.delete(`${API_URL}/productos/${id}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                fetchProductos();
            } catch (err) { alert("Error al eliminar"); }
        }
    };

    const abrirModal = (producto = null) => {
        if (producto) {
            setEditandoProd({ ...producto });
        } else {
            setEditandoProd({ nombre: '', marca: '', codigo_barras: '', stock_actual: 0, precio_actualizado: 0, precio_compra: 0 });
        }
        setModalAbierto(true);
    };

    const guardarProductoCompleto = async (e) => {
        e.preventDefault();
        try {
            if (editandoProd.id) {
                await axios.put(`${API_URL}/productos/${editandoProd.id}`, editandoProd, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
            } else {
                await axios.post(`${API_URL}/productos`, editandoProd, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
            }
            setModalAbierto(false);
            fetchProductos();
        } catch (err) { alert("Error al guardar"); }
    };

    const manejarSeleccion = (p) => {
        setCarrito(prev => {
            const existe = prev.find(item => item.id === p.id);
            if (existe) return prev.map(item => item.id === p.id ? { ...item, cantidad: item.cantidad + 1 } : item);
            return [...prev, { ...p, cantidad: 1 }];
        });
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
        } catch (err) { alert("Error en detección"); }
        finally { setLoading(false); e.target.value = null; }
    };

    return (
        <div className="inventory-pro" style={{ padding: '20px' }}>
            
            {/* MODAL SIMPLIFICADO (Estilos ahora en App.css) */}
            {modalAbierto && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <form onSubmit={guardarProductoCompleto} style={{ background: 'white', padding: '30px', borderRadius: '15px', width: '400px' }}>
                        <h2 style={{ marginBottom: '20px', color: '#111' }}>{editandoProd.id ? 'Editar Producto' : 'Nuevo Producto'}</h2>
                        <input type="text" placeholder="Nombre" value={editandoProd.nombre} onChange={e => setEditandoProd({...editandoProd, nombre: e.target.value})} style={{ width: '100%', padding: '10px', marginBottom: '15px', borderRadius: '6px', border: '1px solid #e2e8f0' }} required />
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <input type="number" placeholder="Stock" value={editandoProd.stock_actual} onChange={e => setEditandoProd({...editandoProd, stock_actual: e.target.value})} style={{ width: '100%', padding: '10px', marginBottom: '15px', borderRadius: '6px', border: '1px solid #e2e8f0' }} />
                            <input type="number" placeholder="Precio" value={editandoProd.precio_actualizado} onChange={e => setEditandoProd({...editandoProd, precio_actualizado: e.target.value})} style={{ width: '100%', padding: '10px', marginBottom: '15px', borderRadius: '6px', border: '1px solid #e2e8f0' }} />
                        </div>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                            <button type="submit" style={{ flex: 1, background: '#2563eb', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>GUARDAR</button>
                            <button type="button" onClick={() => setModalAbierto(false)} style={{ flex: 1, background: '#1c1c1c', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', cursor: 'pointer' }}>CANCELAR</button>
                        </div>
                    </form>
                </div>
            )}

            {fotoExpandida && (
                <div onClick={() => setFotoExpandida(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}>
                    <img src={fotoExpandida} style={{ maxHeight: '90vh', maxWidth: '90vw', borderRadius: '12px' }} alt="zoom" />
                </div>
            )}

            <header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '25px', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: '1.6rem', fontWeight: '800', color: '#1e293b', margin: 0 }}>Gestión Operativa</h1>
                    <p style={{ margin: 0, color: '#64748b' }}>Panel de Control de Stock</p>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                    {/* Select de Ordenamiento */}
                    <select 
                        value={orden} 
                        onChange={(e) => setOrden(e.target.value)}
                        style={{ padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', color: '#1e293b', fontWeight: '600' }}
                    >
                        <option value="recientes">Nuevos primero</option>
                        <option value="antiguos">Viejos primero</option>
                        <option value="az">Nombre A-Z</option>
                        <option value="za">Nombre Z-A</option>
                    </select>

                    <input 
                        type="text" 
                        placeholder="Buscar..." 
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        style={{ padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', width: '200px' }}
                    />
                    <button onClick={() => abrirModal()} style={{ background: '#0f172a', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>+ Nuevo</button>
                    <input type="file" id="ia-upload" hidden onChange={handleEscaneoMasivo} />
                    <label htmlFor="ia-upload" style={{ cursor: 'pointer', background: '#2563eb', color: 'white', padding: '10px 22px', borderRadius: '8px', fontWeight: '600' }}>
                        {loading ? '⌛...' : '📷 IA'}
                    </label>
                </div>
            </header>

            <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ background: '#f8fafc' }}>
                        <tr style={{ color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase', textAlign: 'left' }}>
                            <th style={{ padding: '15px' }}>Add</th>
                            <th style={{ padding: '15px' }}>Foto</th>
                            <th style={{ padding: '15px' }}>Producto</th>
                            <th style={{ padding: '15px' }}>Stock</th>
                            <th style={{ padding: '15px' }}>Precio</th>
                            <th style={{ padding: '15px', textAlign: 'right' }}>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {productosAMostrar.map(p => (
                            <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '15px' }}>
                                    <button onClick={() => manejarSeleccion(p)} style={{ border: 'none', background: '#e2e8f0', color: '#1e293b', borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer', fontWeight: 'bold' }}>+</button>
                                </td>
                                <td style={{ padding: '10px' }}>
                                    {p.imagen_url ? (
                                        <img src={p.imagen_url} onClick={() => setFotoExpandida(p.imagen_url)} style={{ width: '40px', height: '40px', borderRadius: '6px', objectFit: 'cover', cursor: 'zoom-in' }} />
                                    ) : (
                                        <div style={{ width: '40px', height: '40px', background: '#f1f5f9', borderRadius: '6px' }}></div>
                                    )}
                                </td>
                                <td style={{ padding: '15px' }}>
                                    <div style={{ fontWeight: '700', color: '#111' }}>{p.nombre}</div>
                                    <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{p.marca}</div>
                                </td>
                                <td className="font-numeric" style={{ padding: '15px' }}>{p.stock_actual}</td>
                                <td className="font-numeric" style={{ padding: '15px', color: '#16a34a', fontWeight: 'bold' }}>
                                    ${Number(p.precio_actualizado).toLocaleString()}
                                </td>
                                <td style={{ padding: '15px', textAlign: 'right' }}>
                                    <button onClick={() => abrirModal(p)} style={{ background: 'none', border: 'none', color: '#2563eb', marginRight: '10px', cursor: 'pointer' }}>✏️</button>
                                    <button onClick={() => eliminarProducto(p.id, p.nombre)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>🗑️</button>
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