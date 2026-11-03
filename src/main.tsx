import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './app/App'
import { supabaseConfigured } from './services/supabase'

// Tampilkan layar setup jika env belum dikonfigurasi
function SetupScreen() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%)',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: '1rem',
    }}>
      <div style={{
        background: 'white',
        borderRadius: '1rem',
        padding: '2.5rem',
        maxWidth: '480px',
        width: '100%',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏫</div>
        <h1 style={{ color: '#065f46', fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          Sekolah Admin
        </h1>
        <p style={{ color: '#6b7280', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
          Aplikasi belum terhubung ke database.
        </p>
        <div style={{
          background: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: '0.75rem',
          padding: '1.25rem',
          textAlign: 'left',
          marginBottom: '1.5rem',
        }}>
          <p style={{ fontWeight: 600, color: '#065f46', marginBottom: '0.75rem', fontSize: '0.9rem' }}>
            📋 Langkah setup:
          </p>
          <ol style={{ paddingLeft: '1.25rem', color: '#374151', fontSize: '0.875rem', lineHeight: '1.8' }}>
            <li>Buat project di <strong>supabase.com</strong></li>
            <li>Jalankan <code style={{ background: '#e5e7eb', padding: '0 4px', borderRadius: 4 }}>supabase/schema.sql</code></li>
            <li>Jalankan <code style={{ background: '#e5e7eb', padding: '0 4px', borderRadius: 4 }}>supabase/rls_policies.sql</code></li>
            <li>Isi <code style={{ background: '#e5e7eb', padding: '0 4px', borderRadius: 4 }}>.env.local</code> dengan URL &amp; Anon Key</li>
            <li>Jalankan ulang <code style={{ background: '#e5e7eb', padding: '0 4px', borderRadius: 4 }}>npm run dev</code></li>
          </ol>
        </div>
        <p style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
          Lihat <strong>SETUP.md</strong> untuk panduan lengkap
        </p>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {supabaseConfigured ? <App /> : <SetupScreen />}
  </StrictMode>,
)
