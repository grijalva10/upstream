"use client";

import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { JobActions } from "./job-actions";
import { formatDistanceToNow } from "date-fns";
import {
  RefreshCw,
  Search,
  Copy,
  Check,
} from "lucide-react";

export interface Job {
  id: string;
  job_type: string;
  source: string;
  status: string;
  priority: number;
  to_email: string;
  subject: string;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  created_at: string;
  scheduled_for: string;
  sent_at: string | null;
  sequence_id: string | null;
}

interface JobsDataTableProps {
  data: Job[];
}

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  scheduled: "secondary",
  processing: "default",
  sent: "outline",
  failed: "destructive",
  cancelled: "outline",
};

const statusColors: Record<string, string> = {
  pending: "bg-gray-100 text-gray-800",
  scheduled: "bg-blue-100 text-blue-800",
  processing: "bg-blue-500 text-white",
  sent: "bg-green-100 text-green-800 border-green-300",
  failed: "bg-red-100 text-red-800",
  cancelled: "bg-gray-100 text-gray-500",
};

const sourceVariants: Record<string, string> = {
  script: "bg-slate-100 text-slate-700",
  claude: "bg-purple-100 text-purple-700",
  user: "bg-amber-100 text-amber-700",
  api: "bg-cyan-100 text-cyan-700",
};

export function JobsDataTable({ data }: JobsDataTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Filter data
  const filteredData = useMemo(() => {
    return data.filter((job) => {
      const matchesSearch =
        searchTerm === "" ||
        job.to_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.job_type.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus =
        statusFilter === "all" || job.status === statusFilter;

      const matchesSource =
        sourceFilter === "all" || job.source === sourceFilter;

      return matchesSearch && matchesStatus && matchesSource;
    });
  }, [data, searchTerm, statusFilter, sourceFilter]);

  // Selection handlers
  const toggleAll = () => {
    if (selectedIds.size === filteredData.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredData.map((j) => j.id)));
    }
  };

  const toggleOne = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const copyId = async (id: string) => {
    await navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRetrySelected = async () => {
    // TODO: Implement bulk retry
    console.log("Retry selected:", Array.from(selectedIds));
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  // Get unique statuses and sources from data
  const statuses = [...new Set(data.map((j) => j.status))];
  const sources = [...new Set(data.map((j) => j.source))];

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-1 gap-2 items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by email, subject, or type..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {statuses.map((status) => (
                <SelectItem key={status} value={status}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              {sources.map((source) => (
                <SelectItem key={source} value={source}>
                  {source.charAt(0).toUpperCase() + source.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          {selectedIds.size > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetrySelected}
            >
              Retry Selected ({selectedIds.size})
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={
                    filteredData.length > 0 &&
                    selectedIds.size === filteredData.length
                  }
                  onCheckedChange={toggleAll}
                />
              </TableHead>
              <TableHead className="w-[100px]">ID</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-center">Source</TableHead>
              <TableHead className="text-right">Retries</TableHead>
              <TableHead>To</TableHead>
              <TableHead className="text-right">Created</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="h-24 text-center text-muted-foreground"
                >
                  No jobs found
                </TableCell>
              </TableRow>
            ) : (
              filteredData.map((job) => (
                <TableRow key={job.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(job.id)}
                      onCheckedChange={() => toggleOne(job.id)}
                    />
                  </TableCell>
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
                    <span className="font-medium">
                      {job.job_type.replace(/_/g, " ")}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant={statusVariants[job.status] || "secondary"}
                      className={statusColors[job.status]}
                    >
                      {job.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant="outline"
                      className={sourceVariants[job.source]}
                    >
                      {job.source}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={
                        job.attempts > 0 ? "text-red-600 font-medium" : ""
                      }
                    >
                      {job.attempts}/{job.max_attempts}
                    </span>
                  </TableCell>
                  <TableCell>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="truncate max-w-[200px] block">
                            {job.to_email}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="font-medium">{job.to_email}</p>
                          <p className="text-xs text-muted-foreground max-w-[300px] truncate">
                            {job.subject}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground text-sm">
                    {formatDistanceToNow(new Date(job.created_at), {
                      addSuffix: true,
                    })}
                  </TableCell>
                  <TableCell>
                    <JobActions job={job} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Footer */}
      <div className="text-xs text-muted-foreground">
        Showing {filteredData.length} of {data.length} jobs
      </div>
    </div>
  );
}
