import 'bootstrap/dist/css/bootstrap.min.css';
import './index.css'; // <--- IMPORTANTE: Estilos globales
import './App.css';   // <--- IMPORTANTE: Estilos de la aplicación
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);