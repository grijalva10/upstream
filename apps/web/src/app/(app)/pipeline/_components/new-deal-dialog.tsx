"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { createDeal, searchProperties } from "@/lib/deals/actions";

type Property = Awaited<ReturnType<typeof searchProperties>>[number];

export function NewDealDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Property[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Property | null>(null);

  async function handleSearch(value: string) {
    setQuery(value);
    if (value.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const data = await searchProperties(value);
    setResults(data);
    setSearching(false);
  }

  function handleSelect(property: Property) {
    setSelected(property);
    setQuery("");
    setResults([]);
  }

  async function handleSubmit() {
    if (!selected) return;

    setError(null);
    startTransition(async () => {
      const result = await createDeal(selected.id);
      if (result.success && result.deal) {
        setOpen(false);
        setSelected(null);
        router.push(`/pipeline/${result.deal.id}`);
      } else {
        setError(result.error ?? "Failed to create deal");
      }
    });
  }

  function handleOpenChange(isOpen: boolean) {
    setOpen(isOpen);
    if (!isOpen) {
      setSelected(null);
      setQuery("");
      setResults([]);
      setError(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Deal
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Deal</DialogTitle>
          <DialogDescription>
            Select a property to start tracking.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <Label>Property</Label>

            {selected ? (
              <div className="flex items-center justify-between p-3 border rounded-md bg-muted/50">
                <div className="min-w-0">
                  <p className="font-medium truncate">{selected.address}</p>
                  <p className="text-sm text-muted-foreground">
                    {selected.property_type ?? "Unknown"}
                    {selected.building_size_sqft && ` · ${selected.building_size_sqft.toLocaleString()} sqft`}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
                  Change
                </Button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by address..."
                    value={query}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>

                {(searching || results.length > 0) && (
                  <div className="border rounded-md overflow-hidden">
                    {searching ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                      </div>
                    ) : (
                      <ScrollArea className="max-h-48">
                        {results.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => handleSelect(p)}
                            className="w-full text-left p-3 hover:bg-muted border-b last:border-b-0"
                          >
                            <p className="font-medium">{p.address}</p>
                            <p className="text-sm text-muted-foreground">
                              {p.property_type ?? "Unknown"}
                              {p.building_size_sqft && ` · ${p.building_size_sqft.toLocaleString()} sqft`}
                            </p>
                          </button>
                        ))}
                      </ScrollArea>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 p-2 rounded-md">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!selected || isPending}>
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
