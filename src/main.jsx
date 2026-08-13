import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { MyProfilesProvider } from './context/MyProfilesContext.jsx';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <MyProfilesProvider>
          <App />
        </MyProfilesProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
