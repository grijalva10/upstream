"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Play,
  Square,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Loader2,
  Server,
  Cpu,
  Globe,
} from "lucide-react";

interface ServiceStatus {
  name: string;
  status: "running" | "stopped" | "unknown";
  pid?: number;
  port?: number;
  uptime?: string;
}

const SERVICE_CONFIG: Record<string, { label: string; description: string; icon: typeof Server }> = {
  costar: {
    label: "CoStar Service",
    description: "Browser session manager for CoStar queries (port 8765)",
    icon: Globe,
  },
  worker: {
    label: "pg-boss Worker",
    description: "Background job processor for emails and queries",
    icon: Cpu,
  },
  web: {
    label: "Web App",
    description: "Next.js frontend (port 3000)",
    icon: Server,
  },
};

export default function ServicesPage() {
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchServices = useCallback(async () => {
    try {
      const res = await fetch("/api/services");
      const data = await res.json();
      setServices(data.services);
    } catch (error) {
      console.error("Failed to fetch services:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServices();
    const interval = setInterval(fetchServices, 5000);
    return () => clearInterval(interval);
  }, [fetchServices]);

  const handleStart = async (name: string) => {
    setActionLoading(`start-${name}`);
    try {
      const res = await fetch(`/api/services/${name}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to start service");
      }
      // Wait a bit then refresh
      setTimeout(fetchServices, 1000);
    } catch (error) {
      alert("Failed to start service");
    } finally {
      setActionLoading(null);
    }
  };

  const handleStop = async (name: string) => {
    setActionLoading(`stop-${name}`);
    try {
      const res = await fetch(`/api/services/${name}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to stop service");
      }
      // Wait a bit then refresh
      setTimeout(fetchServices, 1000);
    } catch (error) {
      alert("Failed to stop service");
    } finally {
      setActionLoading(null);
    }
  };

  const handleStartAll = async () => {
    setActionLoading("start-all");
    for (const service of services) {
      if (service.name !== "web" && service.status === "stopped") {
        await handleStart(service.name);
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
    setActionLoading(null);
    fetchServices();
  };

  const handleStopAll = async () => {
    setActionLoading("stop-all");
    for (const service of services) {
      if (service.name !== "web" && service.status === "running") {
        await handleStop(service.name);
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    setActionLoading(null);
    fetchServices();
  };

  const runningCount = services.filter((s) => s.status === "running").length;
  const controllableServices = services.filter((s) => s.name !== "web");

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Services</h1>
          <p className="text-sm text-muted-foreground">
            Manage background services
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleStartAll}
            disabled={actionLoading !== null || controllableServices.every((s) => s.status === "running")}
          >
            {actionLoading === "start-all" ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            Start All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleStopAll}
            disabled={actionLoading !== null || controllableServices.every((s) => s.status === "stopped")}
          >
            {actionLoading === "stop-all" ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Square className="h-4 w-4 mr-2" />
            )}
            Stop All
          </Button>
          <Button variant="ghost" size="sm" onClick={fetchServices}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {services.map((service) => {
            const config = SERVICE_CONFIG[service.name] || {
              label: service.name,
              description: "",
              icon: Server,
            };
            const Icon = config.icon;
            const isControllable = service.name !== "web";
            const isStarting = actionLoading === `start-${service.name}`;
            const isStopping = actionLoading === `stop-${service.name}`;

            return (
              <Card key={service.name}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{config.label}</h3>
                          <Badge
                            variant={service.status === "running" ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {service.status === "running" ? (
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                            ) : (
                              <XCircle className="h-3 w-3 mr-1" />
                            )}
                            {service.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {config.description}
                        </p>
                        {service.status === "running" && (
                          <p className="text-xs text-muted-foreground mt-1">
                            PID: {service.pid}
                            {service.uptime && ` • Uptime: ${service.uptime}`}
                          </p>
                        )}
                      </div>
                    </div>
                    {isControllable && (
                      <div>
                        {service.status === "running" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleStop(service.name)}
                            disabled={isStopping || actionLoading !== null}
                          >
                            {isStopping ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Square className="h-4 w-4" />
                            )}
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleStart(service.name)}
                            disabled={isStarting || actionLoading !== null}
                          >
                            {isStarting ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Quick Commands</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            <code className="bg-muted px-2 py-1 rounded">npm run dev</code> - Start all services
          </p>
          <p>
            <code className="bg-muted px-2 py-1 rounded">npm run stop</code> - Stop all services
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
