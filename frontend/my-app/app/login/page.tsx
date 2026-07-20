"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson } from "@/lib/api";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const user = await fetchJson<{
        id: number;
        name: string;
        isAdmin: boolean;
      }>("/api/alumni/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      localStorage.setItem("alumniId", String(user.id));
      localStorage.setItem("alumniName", user.name);
      localStorage.setItem("isAdmin", String(user.isAdmin));

      router.push(user.isAdmin ? "/admin" : "/profile");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-white px-4 py-10">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-900">
          Log In
        </h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <label className="block text-lg font-medium text-gray-800 mb-1">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full text-lg border-2 border-gray-400 rounded-md p-3"
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
              className="w-full text-lg border-2 border-gray-400 rounded-md p-3"
            />
          </div>

          {error && <p className="text-red-600 text-lg font-medium">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full text-xl font-semibold bg-blue-700 text-white rounded-md py-3 mt-2 hover:bg-blue-800 disabled:opacity-60"
          >
            {submitting ? "Logging In..." : "Log In"}
          </button>
        </form>

        <p className="text-center text-lg mt-6 text-gray-700">
          Don't have an account?{" "}
          <a href="/signup" className="text-blue-700 underline font-medium">
            Sign Up
          </a>
        </p>
      </div>
    </main>
  );
}
