import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function Layout({ children }) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          background: 'var(--surface)',
          borderBottom: '1px solid var(--line)',
          padding: '0 24px',
          height: 60,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <Link
          to="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            textDecoration: 'none',
          }}
        >
          <img src="/favicon.svg" alt="" width={26} height={26} />
          <span
            style={{
              fontFamily: 'var(--font-head)',
              fontWeight: 600,
              fontSize: 17,
              color: 'var(--ink)',
            }}
          >
            Case Study Composer
          </span>
        </Link>
        <div className="spacer" />
        {user && (
          <>
            <span className="muted" style={{ fontSize: 13 }}>
              {user.email}
            </span>
            <button className="btn btn-ghost btn-sm" onClick={handleSignOut}>
              Sign out
            </button>
          </>
        )}
      </header>
      <main
        style={{
          flex: 1,
          width: '100%',
          maxWidth: 1180,
          margin: '0 auto',
          padding: '28px 24px 64px',
        }}
      >
        {children}
      </main>
    </div>
  )
}
