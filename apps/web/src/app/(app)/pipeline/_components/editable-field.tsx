"use client";

import { useTransition, useState, useCallback } from "react";
import { Check, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type FieldType = "text" | "currency" | "number" | "select" | "checkbox" | "boolean" | "date" | "url";

interface EditableFieldProps {
  label: string;
  value: string | number | boolean | null;
  type?: FieldType;
  options?: readonly string[];
  placeholder?: string;
  onSave: (value: string | number | boolean | null) => Promise<{ success: boolean; error?: string }>;
}

// Shared error display component
function FieldError({ error }: { error: string | null }): React.ReactNode {
  if (!error) return null;
  return <p className="text-xs text-destructive">{error}</p>;
}

export function EditableField({
  label,
  value,
  type = "text",
  options,
  placeholder,
  onSave,
}: EditableFieldProps) {
  const [isPending, startTransition] = useTransition();
  const [localValue, setLocalValue] = useState(value);
  const [error, setError] = useState<string | null>(null);

  const handleSave = useCallback(
    (newValue: string | number | boolean | null) => {
      if (newValue === value) return;

      setError(null);
      startTransition(async () => {
        const result = await onSave(newValue);
        if (!result.success) {
          setError(result.error ?? "Failed to save");
          setLocalValue(value); // Revert
        }
      });
    },
    [value, onSave]
  );

  const stringValue = localValue?.toString() ?? "";

  switch (type) {
    case "currency":
      return (
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">{label}</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
              $
            </span>
            <Input
              type="text"
              inputMode="numeric"
              placeholder={placeholder}
              value={stringValue}
              onChange={(e) => setLocalValue(e.target.value)}
              onBlur={() => {
                const num = localValue ? parseFloat(String(localValue).replace(/[^0-9.]/g, "")) : null;
                handleSave(num);
              }}
              className="pl-7"
              disabled={isPending}
            />
            {isPending && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
          <FieldError error={error} />
        </div>
      );

    case "select":
      return (
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">{label}</Label>
          <Select
            value={stringValue}
            onValueChange={(v) => {
              setLocalValue(v);
              handleSave(v || null);
            }}
            disabled={isPending}
          >
            <SelectTrigger className={cn(isPending && "opacity-50")}>
              <SelectValue placeholder={placeholder ?? `Select ${label.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {options?.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError error={error} />
        </div>
      );

    case "checkbox":
      return (
        <div className="flex items-center gap-2">
          <Checkbox
            id={label}
            checked={Boolean(localValue)}
            onCheckedChange={(checked) => {
              setLocalValue(checked);
              handleSave(Boolean(checked));
            }}
            disabled={isPending}
          />
          <Label htmlFor={label} className="text-sm font-medium cursor-pointer">
            {label}
          </Label>
          {isPending && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          <FieldError error={error} />
        </div>
      );

    case "boolean":
      return (
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">{label}</Label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setLocalValue(true);
                handleSave(true);
              }}
              disabled={isPending}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border transition-colors",
                localValue === true
                  ? "bg-green-100 border-green-500 text-green-700"
                  : "border-border hover:bg-muted"
              )}
            >
              <Check className="h-3.5 w-3.5" />
              Yes
            </button>
            <button
              type="button"
              onClick={() => {
                setLocalValue(false);
                handleSave(false);
              }}
              disabled={isPending}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border transition-colors",
                localValue === false
                  ? "bg-red-100 border-red-500 text-red-700"
                  : "border-border hover:bg-muted"
              )}
            >
              <X className="h-3.5 w-3.5" />
              No
            </button>
            {isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground self-center" />}
          </div>
          <FieldError error={error} />
        </div>
      );

    case "date":
      return (
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">{label}</Label>
          <Input
            type="date"
            value={stringValue}
            onChange={(e) => setLocalValue(e.target.value)}
            onBlur={() => handleSave(stringValue || null)}
            disabled={isPending}
          />
          <FieldError error={error} />
        </div>
      );

    case "number":
      return (
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">{label}</Label>
          <Input
            type="number"
            step="any"
            placeholder={placeholder}
            value={stringValue}
            onChange={(e) => setLocalValue(e.target.value)}
            onBlur={() => {
              const num = localValue ? parseFloat(String(localValue)) : null;
              handleSave(num);
            }}
            disabled={isPending}
          />
          <FieldError error={error} />
        </div>
      );

    case "url":
      return (
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">{label}</Label>
          <Input
            type="url"
            placeholder={placeholder ?? "https://..."}
            value={stringValue}
            onChange={(e) => setLocalValue(e.target.value)}
            onBlur={() => handleSave(stringValue || null)}
            disabled={isPending}
          />
          <FieldError error={error} />
        </div>
      );

    default:
      return (
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">{label}</Label>
          <Input
            type="text"
            placeholder={placeholder}
            value={stringValue}
            onChange={(e) => setLocalValue(e.target.value)}
            onBlur={() => handleSave(stringValue || null)}
            disabled={isPending}
          />
          <FieldError error={error} />
        </div>
      );
  }
}
