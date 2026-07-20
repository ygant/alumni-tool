"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson } from "@/lib/api";

const INDUSTRY_CATEGORIES = [
  "Agriculture",
  "Environmental Engineering",
  "Water Resources",
  "Biological/Biotechnology",
  "Food & Beverage",
  "Energy & Utilities",
  "Engineering & Consulting",
  "Construction & Infrastructure",
  "Technology & Data Analytics",
  "Government & Public Service",
  "Research & Education",
  "Manufacturing & Operations",
  "Business & Management",
  "Other",
];

interface Degree {
  id: number;
  degree_level: string;
  degree_name: string;
  year_conferred: number;
}

interface Profile {
  id: number;
  classification: string;
  name: string;
  email: string;
  company: string | null;
  job_title: string | null;
  job_description: string | null;
  research: string | null;
  industry_category: string | null;
  work_city: string | null;
  work_state: string | null;
  work_country: string | null;
  linkedin_url: string | null;
  seeking_internship: boolean;
  seeking_fulltime: boolean;
  seeking_grad_school: boolean;
  open_to_research: boolean;
  bio: string | null;
  degrees: Degree[];
}

// Turn any null coming back from the DB into "" so inputs stay controlled
function blankIfNull(value: string | null): string {
  return value ?? "";
}

export default function ProfilePage() {
  const router = useRouter();

  const [alumniId, setAlumniId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [companies, setCompanies] = useState<string[]>([]);

  const [form, setForm] = useState({
    company: "",
    job_title: "",
    job_description: "",
    research: "",
    industry_category: "",
    work_city: "",
    work_state: "",
    work_country: "",
    linkedin_url: "",
    seeking_internship: false,
    seeking_fulltime: false,
    seeking_grad_school: false,
    open_to_research: false,
    bio: "",
  });

  const [degrees, setDegrees] = useState<Degree[]>([]);
  const [newDegree, setNewDegree] = useState({
    degree_level: "Undergraduate",
    degree_name: "",
    year_conferred: "",
  });
  const [addingDegree, setAddingDegree] = useState(false);

  // ---- Load profile on mount ----
  useEffect(() => {
    const id = localStorage.getItem("alumniId");
    if (!id) {
      router.push("/login");
      return;
    }
    setAlumniId(id);

    const loadProfile = async () => {
      try {
        const [data, companyList] = await Promise.all([
          fetchJson<Profile>(`/api/alumni/${id}`),
          fetchJson<string[]>(`/api/companies`),
        ]);
        setForm({
          company: blankIfNull(data.company),
          job_title: blankIfNull(data.job_title),
          job_description: blankIfNull(data.job_description),
          research: blankIfNull(data.research),
          industry_category: blankIfNull(data.industry_category),
          work_city: blankIfNull(data.work_city),
          work_state: blankIfNull(data.work_state),
          work_country: blankIfNull(data.work_country),
          linkedin_url: blankIfNull(data.linkedin_url),
          seeking_internship: data.seeking_internship,
          seeking_fulltime: data.seeking_fulltime,
          seeking_grad_school: data.seeking_grad_school,
          open_to_research: data.open_to_research,
          bio: blankIfNull(data.bio),
        });
        setDegrees(data.degrees);
        setCompanies(companyList);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load your profile.",
        );
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [router]);

  const handleChange = (field: string, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async (
    e: React.SubmitEvent<HTMLFormElement> | React.MouseEvent,
    section: string,
  ) => {
    e.preventDefault();

    if (!alumniId) return;

    setSaving(section);
    setSaveMessage(null);
    setError(null);

    try {
      await fetchJson(`/api/alumni/${alumniId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      setSaveMessage(`${section} saved successfully.`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save your information.",
      );
    } finally {
      setSaving(null);
    }
  };

  const handleAddDegree = async () => {
    if (!alumniId) return;
    if (!newDegree.degree_name || !newDegree.year_conferred) {
      setError("Please enter a degree name and year before adding it.");
      return;
    }

    setAddingDegree(true);
    setError(null);

    try {
      const created = await fetchJson<Degree>(
        `/api/alumni/${alumniId}/degrees`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newDegree),
        },
      );
      setDegrees((prev) => [...prev, created]);
      setNewDegree({
        degree_level: "Undergraduate",
        degree_name: "",
        year_conferred: "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add degree.");
    } finally {
      setAddingDegree(false);
    }
  };

  const handleDeleteDegree = async (degreeId: number) => {
    if (!alumniId) return;
    if (degrees.length <= 1) {
      setError("You must keep at least one degree on file.");
      return;
    }

    try {
      await fetchJson(`/api/alumni/${alumniId}/degrees/${degreeId}`, {
        method: "DELETE",
      });
      setDegrees((prev) => prev.filter((d) => d.id !== degreeId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove degree.");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("alumniId");
    localStorage.removeItem("alumniName");
    router.push("/");
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-xl text-gray-700">Loading your profile...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">My Profile</h1>
        <p className="text-gray-600 text-lg mt-2">
          Keep your professional information updated! Remember, all fields are
          optional!
        </p>
      </div>

      {error && (
        <p className="text-red-600 text-lg font-medium mb-4">{error}</p>
      )}

      {saveMessage && (
        <p className="text-green-700 text-lg font-medium mb-4">{saveMessage}</p>
      )}

      {/* Degrees */}
      <section className="bg-white rounded-xl shadow-md border border-gray-200 p-6 mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">My Degrees</h2>

        {degrees.length === 0 ? (
          <p className="text-lg text-gray-600 mb-4">No degrees on file yet.</p>
        ) : (
          <ul className="flex flex-col gap-3 mb-6">
            {degrees.map((d) => (
              <li
                key={d.id}
                className="flex justify-between items-center border-b border-gray-200 pb-2"
              >
                <span className="text-lg text-gray-800">
                  {d.degree_level} — {d.degree_name} ({d.year_conferred})
                </span>
                <button
                  onClick={() => handleDeleteDegree(d.id)}
                  className="text-red-600 underline text-base font-medium"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        <h3 className="text-xl font-semibold text-gray-800 mb-3">
          Add Another Degree
        </h3>

        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-lg font-medium text-gray-800 mb-1">
              Degree Level
            </label>

            <select
              value={newDegree.degree_level}
              onChange={(e) =>
                setNewDegree((prev) => ({
                  ...prev,
                  degree_level: e.target.value,
                }))
              }
              className="w-full text-lg text-gray-900 placeholder:text-gray-500 bg-white border-2 border-gray-400 rounded-md p-3"
            >
              <option value="Undergraduate">Undergraduate</option>
              <option value="Graduate">Graduate</option>
              <option value="PhD">PhD</option>
            </select>
          </div>
          <div>
            <label className="block text-lg font-medium text-gray-800 mb-1">
              Degree / Major
            </label>
            <input
              type="text"
              value={newDegree.degree_name}
              onChange={(e) =>
                setNewDegree((prev) => ({
                  ...prev,
                  degree_name: e.target.value,
                }))
              }
              className="w-full text-lg text-gray-900 placeholder:text-gray-500 bg-white border-2 border-gray-400 rounded-md p-3"
              placeholder="e.g. Biological and Agricultural Engineering"
            />
          </div>
          <div>
            <label className="block text-lg font-medium text-gray-800 mb-1">
              Year Conferred
            </label>
            <input
              type="text"
              value={newDegree.year_conferred}
              onChange={(e) =>
                setNewDegree((prev) => ({
                  ...prev,
                  year_conferred: e.target.value,
                }))
              }
              className="w-full text-lg text-gray-900 placeholder:text-gray-500 bg-white border-2 border-gray-400 rounded-md p-3"
              placeholder="e.g. 2005"
            />
          </div>
          <button
            type="button"
            onClick={handleAddDegree}
            disabled={addingDegree}
            className="text-lg font-semibold bg-gray-800 text-white rounded-md py-3 hover:bg-gray-900 disabled:opacity-60"
          >
            {addingDegree ? "Adding..." : "Add Degree"}
          </button>
        </div>
      </section>

      {/* Optional Fields*/}
      <div className="flex flex-col gap-6">
        <section className="border-2 border-gray-200 rounded-md p-5">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Current Employment
          </h2>
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-lg font-medium text-gray-800 mb-1">
                Company
              </label>
              <input
                type="text"
                list="company-options"
                value={form.company}
                onChange={(e) => handleChange("company", e.target.value)}
                className="w-full text-lg text-gray-900 placeholder:text-gray-500 bg-white border-2 border-gray-400 rounded-md p-3"
                placeholder="Start typing to search existing companies..."
              />
              <datalist id="company-options">
                {companies.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="block text-lg font-medium text-gray-800 mb-1">
                Job Title
              </label>
              <input
                type="text"
                value={form.job_title}
                onChange={(e) => handleChange("job_title", e.target.value)}
                className="w-full text-lg text-gray-900 placeholder:text-gray-500 bg-white border-2 border-gray-400 rounded-md p-3"
              />
            </div>
            <div>
              <label className="block text-lg font-medium text-gray-800 mb-1">
                Job Description
              </label>
              <textarea
                value={form.job_description}
                onChange={(e) =>
                  handleChange("job_description", e.target.value)
                }
                rows={3}
                className="w-full text-lg text-gray-900 placeholder:text-gray-500 bg-white border-2 border-gray-400 rounded-md p-3"
              />
            </div>
            <div>
              <label className="block text-lg font-medium text-gray-800 mb-1">
                Research (undergrad or other)
              </label>
              <textarea
                value={form.research}
                onChange={(e) => handleChange("research", e.target.value)}
                rows={3}
                className="w-full text-lg text-gray-900 placeholder:text-gray-500 bg-white border-2 border-gray-400 rounded-md p-3"
              />
            </div>
            <div>
              <label className="block text-lg font-medium text-gray-800 mb-1">
                Industry Category
              </label>
              <select
                value={form.industry_category}
                onChange={(e) =>
                  handleChange("industry_category", e.target.value)
                }
                className="w-full text-lg text-gray-900 placeholder:text-gray-500 bg-white border-2 border-gray-400 rounded-md p-3"
              >
                <option value="">-- Select an Industry --</option>
                {INDUSTRY_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-lg font-medium text-gray-800 mb-1">
                  Work City
                </label>
                <input
                  type="text"
                  value={form.work_city}
                  onChange={(e) => handleChange("work_city", e.target.value)}
                  className="w-full text-lg text-gray-900 placeholder:text-gray-500 bg-white border-2 border-gray-400 rounded-md p-3"
                />
              </div>
              <div>
                <label className="block text-lg font-medium text-gray-800 mb-1">
                  Work State
                </label>
                <input
                  type="text"
                  value={form.work_state}
                  onChange={(e) => handleChange("work_state", e.target.value)}
                  className="w-full text-lg text-gray-900 placeholder:text-gray-500 bg-white border-2 border-gray-400 rounded-md p-3"
                />
              </div>
              <div>
                <label className="block text-lg font-medium text-gray-800 mb-1">
                  Work Country
                </label>
                <input
                  type="text"
                  value={form.work_country}
                  onChange={(e) => handleChange("work_country", e.target.value)}
                  className="w-full text-lg text-gray-900 placeholder:text-gray-500 bg-white border-2 border-gray-400 rounded-md p-3"
                />
              </div>
            </div>

            <div className="flex justify-end mt-4">
              <button
                onClick={(e) => handleSave(e, "Employment")}
                disabled={saving === "Employment"}
                className="bg-blue-700 text-white px-6 py-3 rounded-md hover:bg-blue-800 disabled:opacity-60"
              >
                {saving === "Employment" ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </section>

        {/* Networking */}
        <section className="bg-white rounded-xl shadow-md border border-gray-200 p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Professional Networking
          </h2>
          <div>
            <label className="block text-lg font-medium text-gray-800 mb-1">
              LinkedIn Profile URL
            </label>
            <input
              type="url"
              value={form.linkedin_url}
              onChange={(e) => handleChange("linkedin_url", e.target.value)}
              className="w-full text-lg text-gray-900 placeholder:text-gray-500 bg-white border-2 border-gray-400 rounded-md p-3"
              placeholder="https://linkedin.com/in/yourname"
            />
            <div className="flex justify-end mt-4">
              <button
                onClick={(e) => handleSave(e, "Networking")}
                disabled={saving === "Networking"}
                className="bg-blue-700 text-white px-6 py-3 rounded-md hover:bg-blue-800 disabled:opacity-60"
              >
                {saving === "Networking" ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </section>

        {/* Interests */}
        <section className="bg-white rounded-xl shadow-md border border-gray-200 p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Internship / Job Interests
          </h2>
          <div className="flex flex-col gap-3">
            <label className="flex items-center gap-3 text-lg text-gray-800">
              <input
                type="checkbox"
                checked={form.seeking_internship}
                onChange={(e) =>
                  handleChange("seeking_internship", e.target.checked)
                }
                className="w-6 h-6"
              />
              Seeking an Internship
            </label>
            <label className="flex items-center gap-3 text-lg text-gray-800">
              <input
                type="checkbox"
                checked={form.seeking_fulltime}
                onChange={(e) =>
                  handleChange("seeking_fulltime", e.target.checked)
                }
                className="w-6 h-6"
              />
              Seeking a Full-Time Position
            </label>
            <label className="flex items-center gap-3 text-lg text-gray-800">
              <input
                type="checkbox"
                checked={form.seeking_grad_school}
                onChange={(e) =>
                  handleChange("seeking_grad_school", e.target.checked)
                }
                className="w-6 h-6"
              />
              Seeking Graduate School Opportunities
            </label>
            <label className="flex items-center gap-3 text-lg text-gray-800">
              <input
                type="checkbox"
                checked={form.open_to_research}
                onChange={(e) =>
                  handleChange("open_to_research", e.target.checked)
                }
                className="w-6 h-6"
              />
              Open to Research Opportunities
            </label>
          </div>

          <div className="flex justify-end mt-4">
            <button
              onClick={(e) => handleSave(e, "Career Interests")}
              disabled={saving === "Career Interests"}
              className="bg-blue-700 text-white px-6 py-3 rounded-md hover:bg-blue-800 disabled:opacity-60"
            >
              {saving === "Career Interests" ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </section>

        {/* Bio */}
        <section className="border-2 border-gray-200 rounded-md p-5">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Short Bio</h2>
          <textarea
            value={form.bio}
            onChange={(e) => handleChange("bio", e.target.value)}
            rows={5}
            className="w-full text-lg text-gray-900 placeholder:text-gray-500 bg-white border-2 border-gray-400 rounded-md p-3"
            placeholder="Tell us a bit about yourself..."
          />

          <div className="flex justify-end mt-4">
            <button
              onClick={(e) => handleSave(e, "Bio")}
              disabled={saving === "Bio"}
              className="bg-blue-700 text-white px-6 py-3 rounded-md hover:bg-blue-800 disabled:opacity-60"
            >
              {saving === "Bio" ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </section>

        <div className="flex justify-center mt-10 mb-6">
          <button
            onClick={handleLogout}
            className="text-red-600 text-lg font-medium underline"
          >
            Log Out
          </button>
        </div>
      </div>
    </main>
  );
}
