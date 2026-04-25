const problems = [
  "Neck pain",
  "Eye strain",
  "Wrist pain",
  "Bad calls",
  "Low focus",
  "Messy desk",
  "Poor lighting",
  "Back pain",
];

export function ProblemSelector() {
  return (
    <section className="rounded-2xl bg-white p-6 shadow-soft">
      <h2 className="text-xl font-semibold">Problems</h2>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {problems.map((problem) => (
          <label key={problem} className="flex items-center gap-3 rounded-xl bg-mist px-4 py-3">
            <input type="checkbox" className="size-4 accent-moss" defaultChecked={["Neck pain", "Eye strain"].includes(problem)} />
            <span className="text-sm font-medium text-ink/75">{problem}</span>
          </label>
        ))}
      </div>
    </section>
  );
}
