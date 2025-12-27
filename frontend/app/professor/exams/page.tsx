"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "@/components/ui/Toast";
import { baseUrl } from "@/lib/api";

type Exam = {
  id: number;
  titre?: string;
  description?: string;
  date_fin?: string | null;
  sujet_path?: string | null;
};

// Retiré: const API = ...

export default function ProfessorExamsListPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      setLoading(true);
      const res = await fetch(`${baseUrl}/exams`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setExams(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      toast("Impossible de charger les examens");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Examens</h1>
        <button
          onClick={load}
          className="px-4 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800"
        >
          Rafraîchir
        </button>
      </div>

      {loading ? (
        <div className="text-gray-500">Chargement...</div>
      ) : exams.length === 0 ? (
        <div className="text-gray-500">Aucun examen.</div>
      ) : (
        <div className="space-y-3">
          {exams.map((ex) => (
            <div key={ex.id} className="bg-white rounded-2xl shadow p-4 flex items-start justify-between">
              <div>
                <div className="text-sm text-gray-500">ID #{ex.id}</div>
                <div className="text-lg font-semibold">{ex.titre || "Sans titre"}</div>
                <div className="text-sm text-gray-700">{ex.description || "—"}</div>
              </div>

              <div className="flex gap-2">
                <Link
                  href={`/professor/exams/${ex.id}`}
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  Surveiller
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
