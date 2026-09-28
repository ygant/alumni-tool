"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson } from "@/lib/api";

export default function Login() {
  const router = useRouter();

  const [step, setStep] = useState<"credentials" | "mfa">("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [alumniId, setAlumniId] = useState<number | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNeedsVerification(false);
    setSubmitting(true);

    try {
      const data = await fetchJson<{ mfaRequired: boolean; alumniId: number }>(
        "/api/alumni/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        },
      );
      setAlumniId(data.alumniId);
      setStep("mfa");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong.";
      setError(message);
      if (message.toLowerCase().includes("verify your email")) {
        setNeedsVerification(true);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const user = await fetchJson<{
        id: number;
        firstName: string;
        lastName: string;
        isAdmin: boolean;
      }>("/api/alumni/verify-mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alumniId, code }),
      });

      localStorage.setItem("alumniId", String(user.id));
      localStorage.setItem("alumniName", `${user.firstName} ${user.lastName}`);
      localStorage.setItem("isAdmin", String(user.isAdmin));

      router.push(user.isAdmin ? "/admin" : "/profile");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    setResendMessage(null);
    try {
      const data = await fetchJson<{ message: string }>(
        "/api/alumni/resend-verification",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        },
      );
      setResendMessage(data.message);
    } catch (err) {
      setResendMessage(
        err instanceof Error ? err.message : "Something went wrong.",
      );
    }
  };

  if (step === "mfa") {
    return (
      <main className="min-h-screen flex items-center justify-center bg-white px-4 py-10">
        <div className="w-full max-w-md">
          <h1 className="text-3xl font-bold text-center mb-4 text-gray-900">
            Enter Your Code
          </h1>
          <p className="text-lg text-gray-700 text-center mb-8">
            We sent a login code to your email. It may take a minute to arrive.
          </p>

          <form onSubmit={handleMfaSubmit} className="flex flex-col gap-5">
            <div>
              <label className="block text-lg font-medium text-gray-800 mb-1">
                Login Code
              </label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full text-2xl text-gray-800 tracking-widest text-center border-2 border-gray-400 rounded-md p-3 uppercase"
                placeholder="XXXXXXXXXXXX"
                maxLength={12}
              />
            </div>

            {error && (
              <p className="text-red-600 text-lg font-medium">{error}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full text-xl font-semibold bg-blue-700 text-white rounded-md py-3 hover:bg-blue-800 disabled:opacity-60"
            >
              {submitting ? "Checking..." : "Log In"}
            </button>
          </form>

          <p className="text-center text-lg mt-6 text-gray-700">
            <button
              onClick={() => {
                setStep("credentials");
                setCode("");
                setError(null);
              }}
              className="text-blue-700 underline font-medium"
            >
              Start Over
            </button>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-white px-4 py-10">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-900">
          Log In
        </h1>

        <form
          onSubmit={handleCredentialsSubmit}
          className="flex flex-col gap-5"
        >
          <div>
            <label className="block text-lg font-medium text-gray-800 mb-1">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full text-gray-900 text-lg border-2 border-gray-400 rounded-md p-3"
            />
          </div>

          <div>
            <label className="block text-lg font-medium text-gray-800 mb-1">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full text-lg text-gray-900 border-2 border-gray-400 rounded-md p-3"
            />
          </div>

          {error && <p className="text-red-600 text-lg font-medium">{error}</p>}

          {needsVerification && (
            <div>
              <button
                type="button"
                onClick={handleResend}
                className="text-lg text-blue-700 underline font-medium"
              >
                Resend Verification Email
              </button>
              {resendMessage && (
                <p className="text-gray-700 mt-2">{resendMessage}</p>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full text-xl font-semibold bg-blue-700 text-white rounded-md py-3 hover:bg-blue-800 disabled:opacity-60"
          >
            {submitting ? "Checking..." : "Continue"}
          </button>
        </form>

        <p className="text-center text-lg mt-4 text-gray-700">
          <a
            href="/forgot-password"
            className="text-blue-700 underline font-medium"
          >
            Forgot your password?
          </a>
        </p>

        <p className="text-center text-lg mt-4 text-gray-700">
          Don't have an account?{" "}
          <a href="/signup" className="text-blue-700 underline font-medium">
            Sign Up
          </a>
        </p>
      </div>
    </main>
  );
}
