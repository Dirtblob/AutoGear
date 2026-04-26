"use client";

import { useActionState } from "react";
import type { InventoryListItem } from "@/lib/currentUser";
import { ProductModelAutocomplete } from "@/components/ProductModelAutocomplete";
import { ActionButton } from "@/components/ui/ActionButton";
import type { InventoryFormActionState } from "@/app/inventory/actions";

function inputClassName(): string {
  return "w-full rounded-[1.2rem] border border-white/15 bg-slate-900/60 px-4 py-3 text-slate-100 outline-none ring-cyan-300/20 transition placeholder:text-slate-400 focus:border-cyan-300/45 focus:ring-4";
}

const conditionOptions = [
  ["UNKNOWN", "Unknown"],
  ["POOR", "Poor"],
  ["FAIR", "Fair"],
  ["GOOD", "Good"],
  ["EXCELLENT", "Excellent"],
] as const;

const categorySelectOptions: Array<{ value: string; label: string }> = [
  { value: "laptop", label: "Laptop" },
  { value: "monitor", label: "Monitor" },
  { value: "keyboard", label: "Keyboard" },
  { value: "mouse", label: "Mouse" },
  { value: "chair", label: "Chair" },
  { value: "desk", label: "Desk" },
  { value: "desk_lamp", label: "Desk lamp" },
  { value: "headphones", label: "Headphones" },
  { value: "earbuds", label: "Earbuds" },
  { value: "webcam", label: "Webcam" },
  { value: "microphone", label: "Microphone" },
  { value: "tablet", label: "Tablet" },
  { value: "phone", label: "Phone" },
  { value: "docking_station", label: "Docking station" },
  { value: "monitor_arm", label: "Monitor arm" },
  { value: "laptop_stand", label: "Laptop stand" },
  { value: "external_storage", label: "External storage" },
  { value: "router", label: "Router" },
  { value: "printer", label: "Printer" },
  { value: "smart_speaker", label: "Smart speaker" },
  { value: "accessibility_device", label: "Accessibility device" },
  { value: "storage", label: "Storage" },
  { value: "cable_management", label: "Cable management" },
  { value: "other", label: "Other" },
  { value: "unknown", label: "Unknown" },
];

const initialInventoryFormActionState: InventoryFormActionState = {
  error: null,
  fieldErrors: {},
};

function fieldErrorEntries(fieldErrors: Record<string, string>): Array<[string, string]> {
  return Object.entries(fieldErrors).filter(([, message]) => Boolean(message?.trim()));
}

export function InventoryForm({
  action,
  submitLabel,
  submitTone,
  selectedCategory,
  item,
}: {
  action: (state: InventoryFormActionState, formData: FormData) => Promise<InventoryFormActionState>;
  submitLabel: string;
  submitTone: string;
  selectedCategory: string;
  item?: InventoryListItem;
}) {
  const [state, formAction] = useActionState(action, initialInventoryFormActionState);
  const errors = fieldErrorEntries(state.fieldErrors);

  return (
    <form action={formAction} className="space-y-4">
      {item ? <input type="hidden" name="itemId" value={item.id} /> : null}

      {state.error ? (
        <div className="rounded-[1.4rem] border border-rose-300/35 bg-rose-500/10 p-4 text-sm text-rose-100" aria-live="polite">
          <p className="font-semibold">{state.error}</p>
          {errors.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {errors.map(([field, message]) => (
                <li key={field}>{message}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <ProductModelAutocomplete
        categories={categorySelectOptions}
        defaultCategory={item?.category ?? selectedCategory}
        defaultBrand={item?.brand}
        defaultModel={item?.model}
        defaultExactModel={item?.exactModel}
        defaultCatalogProductId={item?.catalogProductId}
        defaultSpecsJson={item?.specsJson}
      />

      {state.fieldErrors.specsJson ? (
        <p className="text-sm font-medium text-rose-200" aria-live="polite">
          {state.fieldErrors.specsJson}
        </p>
      ) : (
        <p className="text-xs leading-5 text-slate-400">
          Exact model and imported specs improve recommendation confidence and compatibility reasoning.
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-300">Condition</span>
          <select
            name="condition"
            defaultValue={(item?.condition ?? "unknown").toUpperCase()}
            className={inputClassName()}
            required
          >
            {conditionOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-300">Age in years</span>
          <input
            type="number"
            min="0"
            step="1"
            name="ageYears"
            defaultValue={item?.ageYears ?? ""}
            className={inputClassName()}
            placeholder="2"
          />
        </label>
      </div>

      <label className="space-y-2">
        <span className="text-sm font-medium text-slate-300">Notes</span>
        <textarea
          name="notes"
          defaultValue={item?.notes ?? ""}
          rows={4}
          className={inputClassName()}
          placeholder="Add fit issues, performance limits, comfort problems, or anything specific about this item."
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <ActionButton
          variant="primary"
          pendingText={item ? "Saving..." : "Adding..."}
          className={submitTone}
          type="submit"
        >
          {submitLabel}
        </ActionButton>
        {item ? (
          <a
            href="/inventory"
            className="rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:border-cyan-300/35 hover:bg-white/10"
          >
            Cancel edit
          </a>
        ) : null}
      </div>
    </form>
  );
}
