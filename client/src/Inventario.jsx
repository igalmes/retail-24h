import React, { useState, useEffect } from 'react';
import axios from 'axios';

const Inventario = () => {
    const [productos, setProductos] = useState([]);
    const [repetidos, setRepetidos] = useState([]);
    const [loading, setLoading] = useState(false);
    const [alertas, setAlertas] = useState(0);

    // 1. Cargar inventario al montar el componente
    const fetchProductos = async () => {
        try {
            const res = await axios.get('/api/productos');
            // El backend ahora nos devuelve { count, alertasFaltantes, productos }
            setProductos(res.data.productos);
            setAlertas(res.data.alertasFaltantes);
        } catch (err) {
            console.error("Error al cargar productos");
        }
    };

    useEffect(() => {
        fetchProductos();
    }, []);

    // 2. Manejar la carga de imagen (IA)
    const handleIAUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('imagen', file);

        setLoading(true);
        try {
            const res = await axios.post('/api/productos/detectar', formData);
            
            if (res.data.repetidos && res.data.repetidos.length > 0) {
                setRepetidos(res.data.repetidos);
            } else {
                alert(`Nuevos productos cargados: ${res.data.nuevosCount}`);
                fetchProductos();
            }
        } catch (err) {
            alert("Error en la detección de IA");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6">
            <header className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Gestión de Inventario</h1>
                <div className="flex gap-4">
                    {alertas > 0 && (
                        <span className="bg-red-100 text-red-600 px-3 py-1 rounded-full text-sm font-bold">
                            ⚠️ {alertas} Alertas de Stock
                        </span>
                    )}
                    <input 
                        type="file" 
                        id="upload-ia" 
                        hidden 
                        onChange={handleIAUpload} 
                    />
                    <label 
                        htmlFor="upload-ia" 
                        className="bg-blue-600 text-white px-4 py-2 rounded cursor-pointer hover:bg-blue-700"
                    >
                        {loading ? 'Analizando...' : '📷 Escanear Góndola'}
                    </label>
                </div>
            </header>

            {/* TABLA DE PRODUCTOS */}
            <div className="bg-white shadow rounded-lg overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b">
                        <tr>
                            <th className="p-4">Producto</th>
                            <th className="p-4">Stock</th>
                            <th className="p-4">Costo</th>
                            <th className="p-4">Venta (Sugerido)</th>
                            <th className="p-4">Margen</th>
                        </tr>
                    </thead>
                    <tbody>
                        {productos.map(p => {
                            const margen = p.precio_actualizado - p.precio_compra;
                            const esAlerta = p.stock_actual <= p.stock_minimo_alerta;

                            return (
                                <tr key={p.id} className={`border-b ${esAlerta ? 'bg-red-50' : ''}`}>
                                    <td className="p-4">
                                        <div className="font-medium">{p.nombre}</div>
                                        <div className="text-xs text-gray-500">{p.marca} | {p.codigo_barras}</div>
                                    </td>
                                    <td className={`p-4 font-bold ${esAlerta ? 'text-red-600' : ''}`}>
                                        {p.stock_actual}
                                    </td>
                                    <td className="p-4">${p.precio_compra}</td>
                                    <td className="p-4 font-bold text-green-600">${p.precio_actualizado}</td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded text-xs ${margen > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100'}`}>
                                            ${margen.toFixed(2)}
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* MODAL DE REPETIDOS (Solo si la IA detectó duplicados) */}
            {repetidos.length > 0 && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
                    <div className="bg-white p-6 rounded-xl max-w-md w-full">
                        <h2 className="text-xl font-bold mb-4 text-orange-600">¡Producto Repetido!</h2>
                        <p className="mb-4">Se detectó <b>{repetidos[0].nombre}</b>, pero ya lo tenés en tu inventario.</p>
                        <div className="flex flex-col gap-2">
                            <button className="bg-blue-600 text-white py-2 rounded">Actualizar Precio y Sumar Stock</button>
                            <button className="bg-gray-200 py-2 rounded">Solo Actualizar Precio</button>
                            <button 
                                onClick={() => setRepetidos(prev => prev.slice(1))}
                                className="text-gray-500 text-sm mt-2"
                            >
                                Ignorar este producto
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Inventario;