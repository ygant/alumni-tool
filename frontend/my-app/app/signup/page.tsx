"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson } from "@/lib/api";

export default function SignUp() {
  const router = useRouter();
  const [form, setForm] = useState({
    classification: "",
    name: "",
    email: "",
    year: "",
    degree: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      await fetchJson("/api/alumni", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classification: form.classification,
          name: form.name,
          email: form.email,
          year: form.year,
          degree: form.degree,
          password: form.password,
        }),
      });
      router.push("/login");
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
          Create Your Account
        </h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <label className="block text-lg font-medium text-gray-800 mb-1">
              I am a...
            </label>
            <select
              value={form.classification}
              onChange={(e) => handleChange("classification", e.target.value)}
              className="w-full text-lg border-2 border-gray-400 rounded-md p-3"
            >
              <option value="Alumni">Alumni</option>
              <option value="Undergraduate Student">
                Undergraduate Student
              </option>
              <option value="Graduate Student">Graduate Student</option>
              <option value="PhD Student">PhD Student</option>
            </select>
          </div>

          <div>
            <label className="block text-lg font-medium text-gray-800 mb-1">
              Full Name
            </label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => handleChange("name", e.target.value)}
              className="w-full text-lg border-2 border-gray-400 rounded-md p-3"
            />
          </div>

          <div>
            <label className="block text-lg font-medium text-gray-800 mb-1">
              Email Address
            </label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => handleChange("email", e.target.value)}
              className="w-full text-lg border-2 border-gray-400 rounded-md p-3"
            />
          </div>

          <div>
            <label className="block text-lg font-medium text-gray-800 mb-1">
              Graduation Year
            </label>
            <input
              type="text"
              required
              value={form.year}
              onChange={(e) => handleChange("year", e.target.value)}
              className="w-full text-lg border-2 border-gray-400 rounded-md p-3"
              placeholder="e.g. 1998"
            />
          </div>

          <div>
            <label className="block text-lg font-medium text-gray-800 mb-1">
              Degree
            </label>
            <input
              type="text"
              required
              value={form.degree}
              onChange={(e) => handleChange("degree", e.target.value)}
              className="w-full text-lg border-2 border-gray-400 rounded-md p-3"
              placeholder="e.g. Business Administration"
            />
          </div>

          <div>
            <label className="block text-lg font-medium text-gray-800 mb-1">
              Password
            </label>
            <input
              type="password"
              required
              value={form.password}
              onChange={(e) => handleChange("password", e.target.value)}
              className="w-full text-lg border-2 border-gray-400 rounded-md p-3"
            />
          </div>

          <div>
            <label className="block text-lg font-medium text-gray-800 mb-1">
              Confirm Password
            </label>
            <input
              type="password"
              required
              value={form.confirmPassword}
              onChange={(e) => handleChange("confirmPassword", e.target.value)}
              className="w-full text-lg border-2 border-gray-400 rounded-md p-3"
            />
          </div>

          {error && <p className="text-red-600 text-lg font-medium">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full text-xl font-semibold bg-blue-700 text-white rounded-md py-3 mt-2 hover:bg-blue-800 disabled:opacity-60"
          >
            {submitting ? "Creating Account..." : "Create Account"}
          </button>
        </form>

        <p className="text-center text-lg mt-6 text-gray-700">
          Already have an account?{" "}
          <a href="/login" className="text-blue-700 underline font-medium">
            Log In
          </a>
        </p>
      </div>
    </main>
  );
}
