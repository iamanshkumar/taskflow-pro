import { useState, type FormEvent } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { apiClient, getErrorMessage, type AuthSession } from "../api/client";

interface AuthScreenProps {
  onAuthenticated: (session: AuthSession) => void;
  initialError?: string | null;
}

export function AuthScreen({ onAuthenticated, initialError }: AuthScreenProps) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const session = isRegistering
        ? await apiClient.register({ displayName, email, password })
        : await apiClient.login({ email, password });
      onAuthenticated(session);
    } catch (requestError: unknown) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0a0a0c] text-neutral-100 flex items-center justify-center p-5">
      <section className="w-full max-w-md border border-white/15 bg-[#0f0f13] p-7 shadow-2xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="pk-square bg-white" />
          <div>
            <p className="font-mono text-xs font-bold uppercase tracking-widest">
              TASKFLOW // PRO
            </p>
            <p className="font-mono text-[10px] text-neutral-500 mt-1">
              WORKSPACE ACCESS
            </p>
          </div>
        </div>

        <h1 className="font-display text-2xl font-bold text-white">
          {isRegistering ? "Create your account" : "Welcome back"}
        </h1>
        <p className="font-mono text-xs text-neutral-400 mt-2">
          {isRegistering
            ? "Your account starts with a private workspace."
            : "Sign in to open your workspace."}
        </p>

        <form onSubmit={handleSubmit} className="mt-7 space-y-4">
          {isRegistering && (
            <div>
              <label
                htmlFor="displayName"
                className="block text-[10px] font-mono uppercase tracking-widest text-neutral-400 mb-1.5"
              >
                NAME
              </label>
              <input
                id="displayName"
                autoComplete="name"
                required
                maxLength={80}
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                className="w-full px-3 py-2.5 bg-neutral-950 border border-white/15 focus:border-white text-sm text-white outline-none"
              />
            </div>
          )}

          <div>
            <label
              htmlFor="email"
              className="block text-[10px] font-mono uppercase tracking-widest text-neutral-400 mb-1.5"
            >
              EMAIL
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full px-3 py-2.5 bg-neutral-950 border border-white/15 focus:border-white text-sm text-white outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-[10px] font-mono uppercase tracking-widest text-neutral-400 mb-1.5"
            >
              PASSWORD
            </label>
            <input
              id="password"
              type="password"
              autoComplete={isRegistering ? "new-password" : "current-password"}
              minLength={isRegistering ? 10 : undefined}
              maxLength={72}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full px-3 py-2.5 bg-neutral-950 border border-white/15 focus:border-white text-sm text-white outline-none"
            />
          </div>

          {error && (
            <p
              role="alert"
              className="border border-rose-800/60 bg-rose-950/40 p-2.5 text-xs text-rose-200"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="pk-button w-full px-4 py-2.5 text-xs flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : null}
            {isSubmitting
              ? "PLEASE WAIT..."
              : isRegistering
                ? "CREATE ACCOUNT"
                : "SIGN IN"}
            {!isSubmitting && <ArrowRight size={14} />}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-white/10 text-center">
          <span className="text-xs text-neutral-400">
            {isRegistering ? "Already have an account?" : "New to TaskFlow?"}
          </span>{" "}
          <button
            type="button"
            onClick={() => {
              setError(null);
              setIsRegistering((previous) => !previous);
            }}
            className="text-xs text-white underline underline-offset-4"
          >
            {isRegistering ? "Sign in" : "Create account"}
          </button>
        </div>
      </section>
    </main>
  );
}
