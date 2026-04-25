export function ConstraintForm() {
  return (
    <section className="rounded-2xl bg-white p-6 shadow-soft">
      <h2 className="text-xl font-semibold">Constraints</h2>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium text-ink/70">Desk width</span>
          <input
            className="w-full rounded-xl border border-ink/10 bg-mist px-4 py-3 outline-none ring-moss/30 focus:ring-4"
            placeholder="44 inches"
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-ink/70">Room lighting</span>
          <select className="w-full rounded-xl border border-ink/10 bg-mist px-4 py-3 outline-none ring-moss/30 focus:ring-4">
            <option>Mixed</option>
            <option>Low</option>
            <option>Bright</option>
          </select>
        </label>
        <label className="flex items-center gap-3 rounded-xl bg-mist px-4 py-3">
          <input type="checkbox" className="size-4 accent-moss" defaultChecked />
          <span className="text-sm font-medium text-ink/75">Shared space</span>
        </label>
        <label className="flex items-center gap-3 rounded-xl bg-mist px-4 py-3">
          <input type="checkbox" className="size-4 accent-moss" />
          <span className="text-sm font-medium text-ink/75">Portable setup</span>
        </label>
      </div>
    </section>
  );
}
