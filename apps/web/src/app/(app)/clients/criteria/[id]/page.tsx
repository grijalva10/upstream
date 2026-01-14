import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Building2, Users, Clock, CheckCircle, AlertCircle, Loader2, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApprovalActions } from "./_components/approval-actions";

interface PageProps {
  params: Promise<{ id: string }>;
}

function getStatusConfig(status: string): {
  variant: "default" | "secondary" | "outline" | "destructive";
  label: string;
  icon: React.ReactNode;
} {
  switch (status) {
    case "pending_queries":
      return {
        variant: "secondary",
        label: "Generating Queries...",
        icon: <Loader2 className="h-4 w-4 animate-spin" />,
      };
    case "pending_approval":
      return {
        variant: "default",
        label: "Awaiting Approval",
        icon: <AlertCircle className="h-4 w-4" />,
      };
    case "approved":
      return {
        variant: "outline",
        label: "Approved",
        icon: <CheckCircle className="h-4 w-4" />,
      };
    case "active":
      return {
        variant: "default",
        label: "Active",
        icon: <Play className="h-4 w-4" />,
      };
    case "draft":
      return {
        variant: "secondary",
        label: "Draft",
        icon: <Clock className="h-4 w-4" />,
      };
    default:
      return {
        variant: "outline",
        label: status,
        icon: null,
      };
  }
}

export default async function CriteriaDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: criteria, error } = await supabase
    .from("client_criteria")
    .select(`
      id,
      name,
      criteria_json,
      queries_json,
      status,
      strategy_summary,
      total_properties,
      total_contacts,
      last_extracted_at,
      created_at,
      updated_at,
      clients!inner (
        id,
        name,
        email
      )
    `)
    .eq("id", id)
    .single();

  if (error || !criteria) {
    notFound();
  }

  const statusConfig = getStatusConfig(criteria.status);
  const client = Array.isArray(criteria.clients) ? criteria.clients[0] : criteria.clients;

  // Parse queries_json if it exists
  const queries = criteria.queries_json as Array<{
    name: string;
    strategy: string;
    rationale: string;
    expected_volume: string;
    payload: object;
  }> | null;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/clients"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Clients
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold tracking-tight">{criteria.name}</h1>
              <Badge variant={statusConfig.variant} className="flex items-center gap-1">
                {statusConfig.icon}
                {statusConfig.label}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              Client: <span className="font-medium text-foreground">{client?.name}</span>
              {client?.email && <span className="ml-2">({client.email})</span>}
            </p>
          </div>

          {criteria.status === "pending_approval" && (
            <ApprovalActions criteriaId={criteria.id} />
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Properties</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-bold">{criteria.total_properties || 0}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Contacts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-bold">{criteria.total_contacts || 0}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Queries</CardDescription>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">{queries?.length || 0}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Last Extraction</CardDescription>
          </CardHeader>
          <CardContent>
            <span className="text-sm">
              {criteria.last_extracted_at
                ? new Date(criteria.last_extracted_at).toLocaleDateString()
                : "Never"}
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="strategy" className="space-y-4">
        <TabsList>
          <TabsTrigger value="strategy">Strategy</TabsTrigger>
          <TabsTrigger value="queries" disabled={!queries}>
            Queries ({queries?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="criteria">Input Criteria</TabsTrigger>
        </TabsList>

        <TabsContent value="strategy">
          <Card>
            <CardHeader>
              <CardTitle>Strategy Summary</CardTitle>
              <CardDescription>
                Generated approach for sourcing properties matching this criteria
              </CardDescription>
            </CardHeader>
            <CardContent>
              {criteria.strategy_summary ? (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg">
                    {criteria.strategy_summary}
                  </pre>
                </div>
              ) : criteria.status === "pending_queries" ? (
                <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Sourcing agent is generating strategy...</span>
                </div>
              ) : (
                <p className="text-muted-foreground py-8 text-center">
                  No strategy generated yet
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="queries">
          <div className="space-y-4">
            {queries && queries.length > 0 ? (
              queries.map((query, index) => (
                <Card key={index}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{query.name}</CardTitle>
                        <CardDescription>{query.strategy}</CardDescription>
                      </div>
                      <Badge variant="outline">{query.expected_volume}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium mb-2">Rationale</h4>
                      <p className="text-sm text-muted-foreground">{query.rationale}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium mb-2">CoStar Payload</h4>
                      <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto max-h-[400px]">
                        {JSON.stringify(query.payload, null, 2)}
                      </pre>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="py-8">
                  <p className="text-muted-foreground text-center">
                    No queries generated yet
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="criteria">
          <Card>
            <CardHeader>
              <CardTitle>Input Criteria</CardTitle>
              <CardDescription>
                Original buyer criteria submitted for this search
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="text-sm bg-muted p-4 rounded-lg overflow-auto max-h-[600px]">
                {JSON.stringify(criteria.criteria_json, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Timestamps */}
      <div className="mt-6 text-sm text-muted-foreground flex gap-4">
        <span>Created: {new Date(criteria.created_at).toLocaleString()}</span>
        <span>Updated: {new Date(criteria.updated_at).toLocaleString()}</span>
      </div>
    </div>
  );
}
