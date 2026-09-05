import { useNavigate } from "react-router-dom";

import {
  createProject,
  type CreateProjectInput,
  type Project,
} from "@/features/projects/api/projects.api";
import { ProjectForm } from "@/features/projects/components/ProjectForm";

export function CreateProjectPage() {
  const navigate = useNavigate();

  async function submit(input: CreateProjectInput): Promise<Project> {
    return createProject(input);
  }

  function handleSaved(project: Project) {
    // New projects are always DRAFT; land the owner on the project page so
    // they can review it and publish when ready.
    void navigate(`/professional/projects/${project.id}`);
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <div className="border-b border-zinc-200 pb-6">
        <p className="text-sm font-semibold text-brand-ink">
          Professional workspace
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-950 sm:text-3xl">
          New Project
        </h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          New projects start as drafts — publish when you are ready to share.
        </p>
      </div>

      <div className="mt-6 rounded-md border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
        <ProjectForm
          onCancel={() => void navigate("/professional/projects")}
          onSaved={handleSaved}
          onSubmitInput={submit}
          submitLabel="Create project"
        />
      </div>
    </main>
  );
}
