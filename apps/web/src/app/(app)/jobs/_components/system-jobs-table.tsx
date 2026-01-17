"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatDistanceToNow } from "date-fns";
import {
  RefreshCw,
  Search,
  Copy,
  Check,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

export interface SystemJob {
  id: string;
  name: string;
  priority: number;
  data: Record<string, unknown> | null;
  state: string;
  retry_limit: number;
  retry_count: number;
  retry_delay: number;
  retry_backoff: boolean;
  start_after: string | null;
  started_on: string | null;
  expire_in: string | null;
  created_on: string;
  completed_on: string | null;
  keep_until: string | null;
  output: Record<string, unknown> | null;
  dead_letter: string | null;
}

interface SystemJobsTableProps {
  initialJobs?: SystemJob[];
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

const stateColors: Record<string, string> = {
  created: "bg-gray-100 text-gray-800",
  retry: "bg-amber-100 text-amber-800",
  active: "bg-blue-500 text-white",
  completed: "bg-green-100 text-green-800 border-green-300",
  expired: "bg-orange-100 text-orange-800",
  cancelled: "bg-gray-100 text-gray-500",
  failed: "bg-red-100 text-red-800",
};

const queueColors: Record<string, string> = {
  "email-sync": "bg-blue-100 text-blue-700",
  "check-replies": "bg-purple-100 text-purple-700",
  "process-queue": "bg-cyan-100 text-cyan-700",
  "send-email": "bg-green-100 text-green-700",
  "classify-email": "bg-amber-100 text-amber-700",
  "costar-query": "bg-rose-100 text-rose-700",
};

export function SystemJobsTable({ initialJobs = [] }: SystemJobsTableProps) {
  const [jobs, setJobs] = useState<SystemJob[]>(initialJobs);
  const [loading, setLoading] = useState(initialJobs.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [nameFilter, setNameFilter] = useState<string>("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/jobs/system");
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setJobs(data.jobs || []);
        setError(null);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialJobs.length === 0) {
      fetchJobs();
    }
  }, [initialJobs.length]);

  // Filter data
  const filteredData = useMemo(() => {
    return jobs.filter((job) => {
      const matchesSearch =
        searchTerm === "" ||
        job.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.id.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesState = stateFilter === "all" || job.state === stateFilter;
      const matchesName = nameFilter === "all" || job.name === nameFilter;

      return matchesSearch && matchesState && matchesName;
    });
  }, [jobs, searchTerm, stateFilter, nameFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredData.length / pageSize);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  // Reset to page 1 when filters change
  useMemo(() => {
    setCurrentPage(1);
  }, [searchTerm, stateFilter, nameFilter, pageSize]);

  const copyId = async (id: string) => {
    await navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Get unique states and names from data
  const states = [...new Set(jobs.map((j) => j.state))];
  const names = [...new Set(jobs.map((j) => j.name))];

  if (error && jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <AlertCircle className="h-8 w-8 mb-2" />
        <p className="text-sm">{error}</p>
        <p className="text-xs mt-1">
          Run the worker to create pg-boss jobs
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-1 gap-2 items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={stateFilter} onValueChange={setStateFilter}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="State" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All States</SelectItem>
              {states.map((state) => (
                <SelectItem key={state} value={state}>
                  {state.charAt(0).toUpperCase() + state.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={nameFilter} onValueChange={setNameFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Queue" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Queues</SelectItem>
              {names.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchJobs}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">ID</TableHead>
              <TableHead>Queue</TableHead>
              <TableHead className="text-center">State</TableHead>
              <TableHead className="text-right">Priority</TableHead>
              <TableHead className="text-right">Retries</TableHead>
              <TableHead className="text-right">Created</TableHead>
              <TableHead className="text-right">Completed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  <RefreshCw className="h-4 w-4 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : paginatedData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-24 text-center text-muted-foreground"
                >
                  No system jobs found
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.map((job) => (
                <TableRow key={job.id}>
                  <TableCell className="font-mono text-xs">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => copyId(job.id)}
                            className="flex items-center gap-1 hover:text-foreground text-muted-foreground"
                          >
                            {job.id.slice(0, 8)}...
                            {copiedId === job.id ? (
                              <Check className="h-3 w-3 text-green-500" />
                            ) : (
                              <Copy className="h-3 w-3 opacity-0 group-hover:opacity-100" />
                            )}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="font-mono text-xs">{job.id}</p>
                          <p className="text-xs text-muted-foreground">
                            Click to copy
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={queueColors[job.name] || "bg-slate-100 text-slate-700"}
                    >
                      {job.name}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant="secondary"
                      className={stateColors[job.state] || "bg-gray-100"}
                    >
                      {job.state}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {job.priority}
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={
                        job.retry_count > 0 ? "text-red-600 font-medium" : ""
                      }
                    >
                      {job.retry_count}/{job.retry_limit}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground text-sm">
                    {job.created_on
                      ? formatDistanceToNow(new Date(job.created_on), {
                          addSuffix: true,
                        })
                      : "-"}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground text-sm">
                    {job.completed_on
                      ? formatDistanceToNow(new Date(job.completed_on), {
                          addSuffix: true,
                        })
                      : "-"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Rows per page:</span>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => setPageSize(Number(v))}
          >
            <SelectTrigger size="sm" className="w-[70px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="ml-2">
            {filteredData.length === 0
              ? "0 of 0"
              : `${(currentPage - 1) * pageSize + 1}-${Math.min(
                  currentPage * pageSize,
                  filteredData.length
                )} of ${filteredData.length}`}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground px-2">
            Page {currentPage} of {totalPages || 1}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage >= totalPages}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
