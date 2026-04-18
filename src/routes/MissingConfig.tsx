export function MissingConfig() {
  return (
    <div className="auth-screen">
      <h1 className="brand">Whacked!</h1>
      <p className="tagline">
        Copy <code>.env.example</code> to <code>.env</code> and add your Supabase
        URL and anon key.
      </p>
    </div>
  )
}
