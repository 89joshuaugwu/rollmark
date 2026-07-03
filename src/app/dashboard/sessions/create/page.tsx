import { SessionCreationForm } from "@/components/organisms/SessionCreationForm";

export default function CreateSessionPage() {
  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Create attendance session</h1>
      <p className="mb-6 text-sm text-text-secondary">
        Set up a session for one of your courses.
      </p>
      <SessionCreationForm />
    </div>
  );
}
