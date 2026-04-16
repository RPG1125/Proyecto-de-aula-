# Proyecto de Aula — Ansiedad y Condición Física

Formulario online para recolección de datos GAD-7 y PHQ-9.

## Credenciales Supabase
Ya están configuradas en `.env.local`. Para Vercel, agrega estas variables de entorno:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Contraseña Admin
La contraseña para ver y descargar datos está en `src/App.jsx`, línea ~233:
```
const ADMIN_PWD = "raul2026";
```
Cámbiala si quieres otra.

## Despliegue
1. Sube a GitHub
2. Importa en Vercel
3. Agrega las dos variables de entorno
4. Deploy
