import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { fetchProducts, type ProductSummary } from "../api";
import { CheckIcon, CrestMark, EyeIcon } from "../components/Icons";
import { useAuth } from "../context/AuthContext";

function AuthShell({ title, subtitle, children, aside }: { title: string; subtitle: string; children: ReactNode; aside: ReactNode }) {
  const [images, setImages] = useState<ProductSummary[]>([]);
  useEffect(() => {
    fetchProducts({ limit: 3 }).then(setImages).catch(() => undefined);
  }, []);

  return (
    <div className="auth">
      <aside className="auth__aside">
        <div className="hero__grain" />
        <div className="auth__aside-inner">
          <CrestMark size={42} />
          {aside}
          <div className="auth__thumbs">
            {images.map((p) => (
              <img key={p.id} src={p.image_url} alt="" />
            ))}
          </div>
          <span className="auth__motto">Lux et Veritas</span>
        </div>
      </aside>
      <section className="auth__main">
        <div className="auth__card">
          <h1 className="display">{title}</h1>
          <p className="auth__sub">{subtitle}</p>
          {children}
        </div>
      </section>
    </div>
  );
}

function PasswordField({ id, label, value, onChange, autoComplete }: { id: string; label: string; value: string; onChange: (v: string) => void; autoComplete: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="field">
      <input id={id} type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} placeholder=" " autoComplete={autoComplete} required />
      <label htmlFor={id}>{label}</label>
      <button type="button" className="field__eye" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide password" : "Show password"}>
        <EyeIcon size={18} />
      </button>
    </div>
  );
}

function Field({ id, label, type = "text", value, onChange, autoComplete }: { id: string; label: string; type?: string; value: string; onChange: (v: string) => void; autoComplete: string }) {
  return (
    <div className="field">
      <input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder=" " autoComplete={autoComplete} required />
      <label htmlFor={id}>{label}</label>
    </div>
  );
}

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { from?: string; reason?: string } | null;
  const redirectTo = state?.from ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!/\S+@\S+\.\S+/.test(email)) return setError("Please enter a valid email address.");
    if (!password) return setError("Please enter your password.");
    setError("");
    setBusy(true);
    try {
      await login(email, password);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to log in.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle={
        state?.reason === "wishlist"
          ? "Log in and we will save that piece to your wishlist right away."
          : "Log in to see your wishlist and orders, and pick up your conversation with our concierge."
      }
      aside={
        <>
          <h2>Good to see you again, Bulldog.</h2>
          <p>Your sizes, your favorites, and your chat history — right where you left them.</p>
        </>
      }
    >
      <form className="form" onSubmit={submit} noValidate>
        <Field id="email" label="Email address" type="email" value={email} onChange={setEmail} autoComplete="email" />
        <PasswordField id="password" label="Password" value={password} onChange={setPassword} autoComplete="current-password" />
        <div className="form__row">
          <label className="check">
            <input type="checkbox" defaultChecked /> <span>Keep me signed in</span>
          </label>
          <a href="mailto:orderdept@campuscustoms.com" className="link-btn">
            Forgot password?
          </a>
        </div>
        {error && <p className="form__error">{error}</p>}
        <button className="btn btn--primary btn--lg btn--block" type="submit" disabled={busy}>
          {busy ? "Signing in…" : "Log in"}
        </button>
        <p className="form__switch">
          New to Bulldog Blue? <Link to="/create-account">Create an account</Link>
        </p>
      </form>
    </AuthShell>
  );
}

function strength(pw: string): { score: number; label: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  return { score, label: ["Too short", "Fair", "Good", "Strong", "Excellent"][score] };
}

export function CreateAccount() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const s = strength(password);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) return setError("Please tell us your first and last name.");
    if (!/\S+@\S+\.\S+/.test(email)) return setError("Please enter a valid email address.");
    if (password.length < 8) return setError("Choose a password with at least 8 characters.");
    if (password !== confirm) return setError("The two passwords don't match.");
    if (!agree) return setError("Please accept the terms to continue.");
    setError("");
    setBusy(true);
    try {
      await register({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        password,
        confirm_password: confirm,
      });
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create your account.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle="Join Bulldog Blue for faster checkout, saved sizes, and a concierge that remembers you."
      aside={
        <>
          <h2>Join the Bulldog Blue family.</h2>
          <ul className="auth__perks">
            <li>
              <CheckIcon size={16} /> Save your sizes and favorite styles
            </li>
            <li>
              <CheckIcon size={16} /> A shopping concierge that remembers you
            </li>
            <li>
              <CheckIcon size={16} /> First access to new arrivals and game-day drops
            </li>
          </ul>
        </>
      }
    >
      <form className="form" onSubmit={submit} noValidate>
        <div className="form__two">
          <Field id="first" label="First name" value={firstName} onChange={setFirstName} autoComplete="given-name" />
          <Field id="last" label="Last name" value={lastName} onChange={setLastName} autoComplete="family-name" />
        </div>
        <Field id="new-email" label="Email address" type="email" value={email} onChange={setEmail} autoComplete="email" />
        <PasswordField id="new-password" label="Password" value={password} onChange={setPassword} autoComplete="new-password" />
        {password && (
          <div className="meter" data-score={s.score}>
            <div className="meter__bars">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className={i < s.score ? "on" : ""} />
              ))}
            </div>
            <span>{s.label}</span>
          </div>
        )}
        <PasswordField id="confirm-password" label="Confirm password" value={confirm} onChange={setConfirm} autoComplete="new-password" />
        <label className="check">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          <span>I agree to the Terms of Service and Privacy Policy.</span>
        </label>
        {error && <p className="form__error">{error}</p>}
        <button className="btn btn--primary btn--lg btn--block" type="submit" disabled={busy}>
          {busy ? "Creating account…" : "Create account"}
        </button>
        <p className="form__switch">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </form>
    </AuthShell>
  );
}
