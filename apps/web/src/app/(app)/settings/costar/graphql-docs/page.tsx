"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Search,
  Copy,
  Check,
  ChevronRight,
  ChevronDown,
  Database,
  Code,
  FileJson,
  Info,
  ArrowLeft,
  Loader2,
  Building2,
  TrendingUp,
  Users,
  MapPin,
  DollarSign,
  ShoppingBag,
  Settings,
  MoreHorizontal,
  FileText,
  Braces,
  Hash,
  Type,
  List,
  Play,
  AlertCircle,
  Zap,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

interface QueryData {
  payload: {
    operationName: string;
    variables: Record<string, unknown>;
    query: string;
  };
  response_template: Record<string, unknown> | null;
  scraping_notes: {
    data_path: string | null;
    useful_fields: string[];
    data_type: string;
  };
}

type GraphQLDocs = Record<string, QueryData>;

// Category configuration with icons and descriptions
const CATEGORY_CONFIG: Record<string, {
  icon: typeof Building2;
  description: string;
  patterns: RegExp[];
  order: number;
}> = {
  "Property Details": {
    icon: Building2,
    description: "Property information, building details, land data",
    patterns: [/^Property/, /^Building/, /^Land/, /^About/, /^parcel/, /^getCountry/, /^Shopping/],
    order: 1,
  },
  "Sale Comps": {
    icon: TrendingUp,
    description: "Sales comparables, buyers, sellers, transactions",
    patterns: [/^Comps/, /^Detail/, /^Buyer/, /^Seller/, /^Transaction/, /^SaleComp/, /^SaleNote/, /^MyNotes/],
    order: 2,
  },
  "Leasing": {
    icon: FileText,
    description: "Lease information, tenants, stacking plans",
    patterns: [/^Lease/, /^Tenant/, /^ForLease/, /^Stacking/, /^CoStarAndListing/],
    order: 3,
  },
  "For Sale & Marketing": {
    icon: ShoppingBag,
    description: "For sale listings, marketing materials, data rooms",
    patterns: [/^ForSale/, /^Marketing/, /^DataRoom/, /^offering/, /^Auction/],
    order: 4,
  },
  "Financial & Loans": {
    icon: DollarSign,
    description: "Loans, CMBS, income/expenses, assessments",
    patterns: [/^Loan/, /^CMBS/, /^Income/, /^Assessment/, /^NonCMBS/, /^Financing/],
    order: 5,
  },
  "Contacts & Companies": {
    icon: Users,
    description: "Contact information, company details, owners",
    patterns: [/^Contact/, /^Company/, /^Companies/, /^Owner/, /^Broker/, /^Fund/],
    order: 6,
  },
  "Search & Lists": {
    icon: Search,
    description: "Property searches, list queries, counts",
    patterns: [/Search/, /^Common/, /List$/, /Count$/, /^Scroller/, /^News/],
    order: 7,
  },
  "Location & Demographics": {
    icon: MapPin,
    description: "Demographics, transit, traffic, flood risk",
    patterns: [/^Location/, /^Demographic/, /^Transit/, /^Traffic/, /^Flood/, /^Subcontinent/],
    order: 8,
  },
  "User & Settings": {
    icon: Settings,
    description: "User preferences, headers, lookups, subscriptions",
    patterns: [/^User/, /^Get/, /^Header/, /^Hamburger/, /^Subscription/, /^Lookup/, /^lookup/, /^Mast/, /^allAvailable/, /^Media/],
    order: 9,
  },
  "Other": {
    icon: MoreHorizontal,
    description: "Miscellaneous queries",
    patterns: [/.*/],
    order: 10,
  },
};

function categorizeQuery(name: string): string {
  for (const [category, config] of Object.entries(CATEGORY_CONFIG)) {
    if (category === "Other") continue;
    if (config.patterns.some(p => p.test(name))) {
      return category;
    }
  }
  return "Other";
}

// GraphQL syntax highlighting tokens
type TokenType = "keyword" | "type" | "field" | "argument" | "variable" | "string" | "number" | "punctuation" | "directive" | "fragment" | "comment";

interface Token {
  type: TokenType;
  value: string;
}

function tokenizeGraphQL(query: string): Token[] {
  const tokens: Token[] = [];
  const keywords = ["query", "mutation", "subscription", "fragment", "on", "true", "false", "null"];

  // Simple tokenizer
  let i = 0;
  while (i < query.length) {
    const char = query[i];

    // Skip whitespace
    if (/\s/.test(char)) {
      i++;
      continue;
    }

    // Comments
    if (char === "#") {
      let comment = "";
      while (i < query.length && query[i] !== "\n") {
        comment += query[i++];
      }
      tokens.push({ type: "comment", value: comment });
      continue;
    }

    // Punctuation
    if (/[{}()[\]:,!=]/.test(char)) {
      tokens.push({ type: "punctuation", value: char });
      i++;
      continue;
    }

    // Spread operator
    if (char === "." && query.slice(i, i + 3) === "...") {
      tokens.push({ type: "punctuation", value: "..." });
      i += 3;
      continue;
    }

    // Variables
    if (char === "$") {
      let variable = "$";
      i++;
      while (i < query.length && /[a-zA-Z0-9_]/.test(query[i])) {
        variable += query[i++];
      }
      tokens.push({ type: "variable", value: variable });
      continue;
    }

    // Directives
    if (char === "@") {
      let directive = "@";
      i++;
      while (i < query.length && /[a-zA-Z0-9_]/.test(query[i])) {
        directive += query[i++];
      }
      tokens.push({ type: "directive", value: directive });
      continue;
    }

    // Strings
    if (char === '"') {
      let str = '"';
      i++;
      while (i < query.length && query[i] !== '"') {
        if (query[i] === "\\") str += query[i++];
        str += query[i++];
      }
      str += '"';
      i++;
      tokens.push({ type: "string", value: str });
      continue;
    }

    // Numbers
    if (/[0-9-]/.test(char)) {
      let num = "";
      while (i < query.length && /[0-9.-]/.test(query[i])) {
        num += query[i++];
      }
      if (/^-?[0-9]+\.?[0-9]*$/.test(num)) {
        tokens.push({ type: "number", value: num });
        continue;
      }
      // Not a valid number, treat as punctuation
      for (const c of num) {
        tokens.push({ type: "punctuation", value: c });
      }
      continue;
    }

    // Identifiers (keywords, types, fields)
    if (/[a-zA-Z_]/.test(char)) {
      let ident = "";
      while (i < query.length && /[a-zA-Z0-9_]/.test(query[i])) {
        ident += query[i++];
      }

      if (keywords.includes(ident)) {
        tokens.push({ type: "keyword", value: ident });
      } else if (ident === "__typename" || /^[A-Z]/.test(ident)) {
        tokens.push({ type: "type", value: ident });
      } else {
        tokens.push({ type: "field", value: ident });
      }
      continue;
    }

    // Unknown character
    i++;
  }

  return tokens;
}

function formatAndHighlightQuery(query: string): { formatted: string; highlighted: React.ReactNode } {
  const tokens = tokenizeGraphQL(query);

  // Format with proper indentation
  let indent = 0;
  const lines: { indent: number; content: Token[] }[] = [];
  let currentLine: Token[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (token.type === "punctuation") {
      if (token.value === "{") {
        currentLine.push(token);
        lines.push({ indent, content: currentLine });
        currentLine = [];
        indent++;
      } else if (token.value === "}") {
        if (currentLine.length > 0) {
          lines.push({ indent, content: currentLine });
          currentLine = [];
        }
        indent--;
        lines.push({ indent, content: [token] });
      } else if (token.value === "(") {
        currentLine.push(token);
      } else if (token.value === ")") {
        currentLine.push(token);
      } else {
        currentLine.push(token);
      }
    } else {
      currentLine.push(token);
    }
  }

  if (currentLine.length > 0) {
    lines.push({ indent, content: currentLine });
  }

  // Build formatted string and highlighted JSX
  const formattedLines: string[] = [];
  const highlightedLines: React.ReactNode[] = [];

  const tokenColors: Record<TokenType, string> = {
    keyword: "text-purple-400",
    type: "text-yellow-400",
    field: "text-blue-300",
    argument: "text-orange-300",
    variable: "text-green-400",
    string: "text-green-300",
    number: "text-orange-400",
    punctuation: "text-gray-400",
    directive: "text-pink-400",
    fragment: "text-cyan-400",
    comment: "text-gray-500 italic",
  };

  lines.forEach((lineData, lineIndex) => {
    const indentStr = "  ".repeat(Math.max(0, lineData.indent));
    const textContent = lineData.content.map(t => t.value).join(" ");
    formattedLines.push(indentStr + textContent);

    highlightedLines.push(
      <div key={lineIndex} className="leading-relaxed">
        <span className="text-gray-600 select-none w-8 inline-block text-right mr-4">
          {lineIndex + 1}
        </span>
        <span className="text-gray-600">{indentStr}</span>
        {lineData.content.map((token, tokenIndex) => (
          <span key={tokenIndex} className={tokenColors[token.type]}>
            {token.value}{tokenIndex < lineData.content.length - 1 ? " " : ""}
          </span>
        ))}
      </div>
    );
  });

  return {
    formatted: formattedLines.join("\n"),
    highlighted: <div className="font-mono text-sm">{highlightedLines}</div>,
  };
}

// Extract variable types from query
function extractVariables(query: string): { name: string; type: string; required: boolean }[] {
  const vars: { name: string; type: string; required: boolean }[] = [];
  const match = query.match(/\(([^)]+)\)\s*\{/);
  if (!match) return vars;

  const varSection = match[1];
  const varMatches = varSection.matchAll(/\$(\w+):\s*([^,!]+)(!)?/g);
  for (const m of varMatches) {
    vars.push({
      name: m[1],
      type: m[2].trim(),
      required: !!m[3],
    });
  }
  return vars;
}

// Extract root fields from query
function extractRootFields(query: string): string[] {
  const fields: string[] = [];
  // Find content after the first {
  const bodyMatch = query.match(/\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/);
  if (!bodyMatch) return fields;

  const body = bodyMatch[1];
  const fieldMatches = body.match(/^\s*(\w+)/gm);
  if (fieldMatches) {
    for (const f of fieldMatches) {
      const field = f.trim();
      if (field && !["__typename"].includes(field)) {
        fields.push(field);
      }
    }
  }
  return [...new Set(fields)].slice(0, 5);
}

// Extract fragments from query
function extractFragments(query: string): string[] {
  const fragments: string[] = [];
  const matches = query.matchAll(/fragment\s+(\w+)\s+on/g);
  for (const m of matches) {
    fragments.push(m[1]);
  }
  return fragments;
}

// JSON syntax highlighting
function highlightJSON(obj: unknown, depth = 0): React.ReactNode {
  const indent = "  ".repeat(depth);
  const nextIndent = "  ".repeat(depth + 1);

  if (obj === null) {
    return <span className="text-orange-400">null</span>;
  }

  if (typeof obj === "boolean") {
    return <span className="text-orange-400">{obj.toString()}</span>;
  }

  if (typeof obj === "number") {
    return <span className="text-orange-400">{obj}</span>;
  }

  if (typeof obj === "string") {
    // Truncate very long strings
    const displayStr = obj.length > 100 ? obj.slice(0, 100) + "..." : obj;
    return <span className="text-green-300">&quot;{displayStr}&quot;</span>;
  }

  if (Array.isArray(obj)) {
    if (obj.length === 0) {
      return <span className="text-gray-400">[]</span>;
    }
    return (
      <>
        <span className="text-gray-400">[</span>
        {obj.map((item, i) => (
          <div key={i}>
            <span className="text-gray-600 select-none">{nextIndent}</span>
            {highlightJSON(item, depth + 1)}
            {i < obj.length - 1 && <span className="text-gray-400">,</span>}
          </div>
        ))}
        <span className="text-gray-600 select-none">{indent}</span>
        <span className="text-gray-400">]</span>
      </>
    );
  }

  if (typeof obj === "object") {
    const entries = Object.entries(obj);
    if (entries.length === 0) {
      return <span className="text-gray-400">{"{}"}</span>;
    }
    return (
      <>
        <span className="text-gray-400">{"{"}</span>
        {entries.map(([key, value], i) => (
          <div key={key}>
            <span className="text-gray-600 select-none">{nextIndent}</span>
            <span className="text-blue-300">&quot;{key}&quot;</span>
            <span className="text-gray-400">: </span>
            {highlightJSON(value, depth + 1)}
            {i < entries.length - 1 && <span className="text-gray-400">,</span>}
          </div>
        ))}
        <span className="text-gray-600 select-none">{indent}</span>
        <span className="text-gray-400">{"}"}</span>
      </>
    );
  }

  return <span>{String(obj)}</span>;
}

function HighlightedJSON({ data }: { data: unknown }) {
  return (
    <div className="font-mono text-sm leading-relaxed">
      {highlightJSON(data)}
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button variant="ghost" size="sm" onClick={handleCopy} className="gap-2">
      {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
      {label && <span className="text-xs">{copied ? "Copied!" : label}</span>}
    </Button>
  );
}

function VariableTypeIcon({ type }: { type: string }) {
  if (type.includes("Int") || type.includes("Float")) {
    return <Hash className="h-3 w-3" />;
  }
  if (type.includes("String")) {
    return <Type className="h-3 w-3" />;
  }
  if (type.includes("[")) {
    return <List className="h-3 w-3" />;
  }
  return <Braces className="h-3 w-3" />;
}

function QueryDetail({ name, data }: { name: string; data: QueryData }) {
  const { formatted, highlighted } = useMemo(
    () => formatAndHighlightQuery(data.payload.query),
    [data.payload.query]
  );

  const variables = useMemo(() => extractVariables(data.payload.query), [data.payload.query]);
  const rootFields = useMemo(() => extractRootFields(data.payload.query), [data.payload.query]);
  const fragments = useMemo(() => extractFragments(data.payload.query), [data.payload.query]);

  // Test state
  const [testVariables, setTestVariables] = useState(
    JSON.stringify(data.payload.variables, null, 2)
  );
  const [testResult, setTestResult] = useState<unknown>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [executionTime, setExecutionTime] = useState<number | null>(null);

  // Reset test variables when query changes
  useEffect(() => {
    setTestVariables(JSON.stringify(data.payload.variables, null, 2));
    setTestResult(null);
    setTestError(null);
    setExecutionTime(null);
  }, [data.payload.variables]);

  const runQuery = async () => {
    setIsRunning(true);
    setTestError(null);
    setTestResult(null);
    setExecutionTime(null);

    const startTime = Date.now();

    try {
      let parsedVariables = {};
      try {
        parsedVariables = JSON.parse(testVariables);
      } catch {
        throw new Error("Invalid JSON in variables");
      }

      const response = await fetch("/api/costar/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query_type: "graphql",
          payload: {
            operationName: data.payload.operationName,
            query: data.payload.query,
            variables: parsedVariables,
          },
        }),
      });

      const result = await response.json();
      setExecutionTime(Date.now() - startTime);

      if (!response.ok) {
        throw new Error(result.error || "Query failed");
      }

      setTestResult(result);
    } catch (err) {
      setTestError(err instanceof Error ? err.message : "Unknown error");
      setExecutionTime(Date.now() - startTime);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold font-mono">{name}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {data.payload.operationName}
            </p>
          </div>
          <CopyButton text={formatted} label="Copy Query" />
        </div>

        {/* Quick info badges */}
        <div className="flex flex-wrap gap-2 mt-4">
          <Badge variant="outline" className="gap-1">
            <Code className="h-3 w-3" />
            {data.scraping_notes.data_type || "unknown"}
          </Badge>
          {variables.length > 0 && (
            <Badge variant="secondary" className="gap-1">
              <Database className="h-3 w-3" />
              {variables.length} variable{variables.length !== 1 ? "s" : ""}
            </Badge>
          )}
          {fragments.length > 0 && (
            <Badge variant="secondary" className="gap-1">
              <FileText className="h-3 w-3" />
              {fragments.length} fragment{fragments.length !== 1 ? "s" : ""}
            </Badge>
          )}
          {data.response_template && (
            <Badge className="gap-1 bg-green-600">
              <Check className="h-3 w-3" />
              Has Example
            </Badge>
          )}
        </div>

        {/* Root fields */}
        {rootFields.length > 0 && (
          <div className="mt-3">
            <span className="text-xs text-muted-foreground">Root fields: </span>
            <span className="text-xs font-mono">
              {rootFields.join(", ")}
              {rootFields.length >= 5 && "..."}
            </span>
          </div>
        )}
      </div>

      <Separator />

      <Tabs defaultValue="query" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="query" className="gap-2">
            <Code className="h-4 w-4" />
            Query
          </TabsTrigger>
          <TabsTrigger value="test" className="gap-2">
            <Play className="h-4 w-4" />
            Test
          </TabsTrigger>
          <TabsTrigger value="variables" className="gap-2">
            <Database className="h-4 w-4" />
            Variables
          </TabsTrigger>
          <TabsTrigger value="response" className="gap-2">
            <FileJson className="h-4 w-4" />
            Response
          </TabsTrigger>
          <TabsTrigger value="notes" className="gap-2">
            <Info className="h-4 w-4" />
            Notes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="query" className="mt-4">
          <Card className="bg-[#1e1e2e] border-gray-800">
            <CardContent className="p-0">
              <ScrollArea className="h-[500px]">
                <div className="p-4">
                  {highlighted}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="test" className="mt-4">
          <div className="grid grid-cols-2 gap-4 h-[550px]">
            {/* Variables Input */}
            <Card className="flex flex-col">
              <CardHeader className="py-3 border-b flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-medium">Variables</CardTitle>
                    <CardDescription>Edit the variables JSON and run the query</CardDescription>
                  </div>
                  <Button
                    onClick={runQuery}
                    disabled={isRunning}
                    className="gap-2"
                  >
                    {isRunning ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                    {isRunning ? "Running..." : "Run Query"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex-1 p-0 min-h-0">
                <Textarea
                  value={testVariables}
                  onChange={(e) => setTestVariables(e.target.value)}
                  className="h-full w-full resize-none rounded-none border-0 font-mono text-sm bg-[#1e1e2e] text-gray-200 focus-visible:ring-0"
                  placeholder="{}"
                />
              </CardContent>
            </Card>

            {/* Response Output */}
            <Card className="flex flex-col bg-[#1e1e2e] border-gray-800">
              <CardHeader className="py-3 border-b border-gray-800 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-medium text-gray-200">Response</CardTitle>
                    <CardDescription className="text-gray-400">
                      {executionTime !== null && (
                        <span className="flex items-center gap-1">
                          <Zap className="h-3 w-3" />
                          {executionTime}ms
                        </span>
                      )}
                      {executionTime === null && "Execute query to see response"}
                    </CardDescription>
                  </div>
                  {testResult !== null && (
                    <CopyButton text={JSON.stringify(testResult, null, 2)} />
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex-1 p-0 min-h-0 overflow-hidden">
                <ScrollArea className="h-full">
                  <div className="p-4">
                    {isRunning && (
                      <div className="flex items-center justify-center py-12">
                        <div className="text-center">
                          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-gray-400" />
                          <p className="text-sm text-gray-400">Executing query...</p>
                        </div>
                      </div>
                    )}
                    {testError && (
                      <div className="flex items-start gap-3 p-4 bg-red-950/50 border border-red-900 rounded-lg">
                        <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium text-red-400">Error</p>
                          <p className="text-sm text-red-300 mt-1">{testError}</p>
                        </div>
                      </div>
                    )}
                    {testResult !== null && !isRunning && (
                      <HighlightedJSON data={testResult} />
                    )}
                    {!testResult && !testError && !isRunning && (
                      <div className="text-center py-12 text-gray-500">
                        <Play className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p className="text-sm">Click &quot;Run Query&quot; to execute</p>
                        <p className="text-xs mt-1">Uses the authenticated CoStar session</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="variables" className="mt-4 space-y-4">
          {/* Variable schema */}
          {variables.length > 0 && (
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm font-medium">Variable Schema</CardTitle>
                <CardDescription>Expected variable types for this query</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {variables.map((v, i) => (
                    <div key={i} className="flex items-center gap-3 p-2 rounded bg-muted/50">
                      <VariableTypeIcon type={v.type} />
                      <code className="text-sm font-mono text-blue-400">${v.name}</code>
                      <span className="text-muted-foreground">:</span>
                      <code className="text-sm font-mono text-yellow-400">{v.type}</code>
                      {v.required && (
                        <Badge variant="destructive" className="text-xs">Required</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Example values */}
          <Card className="bg-[#1e1e2e] border-gray-800">
            <CardHeader className="flex flex-row items-center justify-between py-3 border-b border-gray-800">
              <div>
                <CardTitle className="text-sm font-medium text-gray-200">Example Values</CardTitle>
                <CardDescription className="text-gray-400">Sample variable values from documentation</CardDescription>
              </div>
              <CopyButton text={JSON.stringify(data.payload.variables, null, 2)} />
            </CardHeader>
            <CardContent className="p-4">
              {Object.keys(data.payload.variables).length > 0 ? (
                <HighlightedJSON data={data.payload.variables} />
              ) : (
                <p className="text-gray-400 text-sm">No variables required for this query</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="response" className="mt-4">
          <Card className="bg-[#1e1e2e] border-gray-800">
            <CardHeader className="flex flex-row items-center justify-between py-3 border-b border-gray-800">
              <div>
                <CardTitle className="text-sm font-medium text-gray-200">Response Template</CardTitle>
                <CardDescription className="text-gray-400">
                  {data.scraping_notes.data_path
                    ? `Data path: ${data.scraping_notes.data_path}`
                    : "Example response structure"
                  }
                </CardDescription>
              </div>
              {data.response_template && (
                <CopyButton text={JSON.stringify(data.response_template, null, 2)} />
              )}
            </CardHeader>
            <CardContent className="p-0">
              {data.response_template ? (
                <ScrollArea className="h-[450px]">
                  <div className="p-4">
                    <HighlightedJSON data={data.response_template} />
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <FileJson className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No response template available</p>
                  <p className="text-xs mt-1">Run the query to capture response structure</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes" className="mt-4">
          <div className="grid gap-4">
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm font-medium">Data Access</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground mb-2">DATA TYPE</h4>
                  <Badge variant="outline" className="text-sm">
                    {data.scraping_notes.data_type || "unknown"}
                  </Badge>
                </div>

                <div>
                  <h4 className="text-xs font-medium text-muted-foreground mb-2">DATA PATH</h4>
                  <code className="text-sm bg-muted px-3 py-1.5 rounded block">
                    {data.scraping_notes.data_path || "N/A"}
                  </code>
                </div>
              </CardContent>
            </Card>

            {data.scraping_notes.useful_fields.length > 0 && (
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm font-medium">Useful Fields</CardTitle>
                  <CardDescription>Key data paths for extraction</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {data.scraping_notes.useful_fields.map((field, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                        <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                          {field}
                        </code>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {fragments.length > 0 && (
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm font-medium">Fragments</CardTitle>
                  <CardDescription>Reusable query fragments defined</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {fragments.map((fragment, i) => (
                      <Badge key={i} variant="secondary" className="font-mono">
                        {fragment}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface SessionStatus {
  status: "offline" | "starting" | "authenticating" | "connected" | "error";
  session_valid: boolean;
  error: string | null;
}

export default function GraphQLDocsPage() {
  const [search, setSearch] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [selectedQuery, setSelectedQuery] = useState<string | null>(null);
  const [docs, setDocs] = useState<GraphQLDocs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus | null>(null);

  // Fetch session status
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch("/api/costar/status");
        const data = await res.json();
        setSessionStatus(data);
      } catch {
        setSessionStatus({ status: "offline", session_valid: false, error: "Service not running" });
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetch("/docs/graphql_scraper_docs.json")
      .then(res => {
        if (!res.ok) throw new Error("Failed to load documentation");
        return res.json();
      })
      .then(data => {
        setDocs(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const queryNames = useMemo(() => docs ? Object.keys(docs) : [], [docs]);

  // Group queries by category
  const categorizedQueries = useMemo(() => {
    if (!docs) return {};
    const categories: Record<string, string[]> = {};

    for (const name of queryNames) {
      const category = categorizeQuery(name);
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push(name);
    }

    // Sort queries within each category
    for (const category of Object.keys(categories)) {
      categories[category].sort();
    }

    return categories;
  }, [queryNames, docs]);

  // Sort categories by order
  const sortedCategories = useMemo(() => {
    return Object.keys(categorizedQueries).sort((a, b) => {
      const orderA = CATEGORY_CONFIG[a]?.order ?? 99;
      const orderB = CATEGORY_CONFIG[b]?.order ?? 99;
      return orderA - orderB;
    });
  }, [categorizedQueries]);

  // Filter queries based on search
  const filteredQueries = useMemo(() => {
    if (!docs) return {};
    if (!search) return categorizedQueries;

    const searchLower = search.toLowerCase();
    const filtered: Record<string, string[]> = {};

    for (const [category, queries] of Object.entries(categorizedQueries)) {
      const matching = queries.filter(q =>
        q.toLowerCase().includes(searchLower) ||
        docs[q]?.payload.query.toLowerCase().includes(searchLower)
      );
      if (matching.length > 0) {
        filtered[category] = matching;
      }
    }

    return filtered;
  }, [search, categorizedQueries, docs]);

  const toggleCategory = useCallback((category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  const totalQueries = queryNames.length;
  const filteredCount = Object.values(filteredQueries).flat().length;

  // Loading state
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading API documentation...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !docs) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center max-w-md">
          <Code className="h-12 w-12 mx-auto mb-4 text-red-500" />
          <h2 className="text-xl font-semibold mb-2">Failed to Load Documentation</h2>
          <p className="text-muted-foreground text-sm">
            {error || "Could not load the GraphQL documentation file."}
          </p>
          <Button className="mt-4" onClick={() => window.location.reload()}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b p-4 bg-background">
        <div className="flex items-center justify-between mb-3">
          <a
            href="/settings/costar"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to CoStar Settings
          </a>

          {/* Session Status Indicator */}
          <div className="flex items-center gap-2">
            {sessionStatus?.status === "connected" && sessionStatus?.session_valid ? (
              <Badge className="gap-1.5 bg-green-600">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-300"></span>
                </span>
                Session Ready
              </Badge>
            ) : sessionStatus?.status === "connected" && !sessionStatus?.session_valid ? (
              <Badge variant="outline" className="gap-1.5 text-amber-500 border-amber-500">
                <AlertCircle className="h-3 w-3" />
                Session Expired
              </Badge>
            ) : sessionStatus?.status === "starting" || sessionStatus?.status === "authenticating" ? (
              <Badge variant="outline" className="gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" />
                {sessionStatus.status === "authenticating" ? "Authenticating..." : "Starting..."}
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1.5 text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-gray-400"></span>
                Session Offline
              </Badge>
            )}
            <a
              href="/settings/costar"
              target="_blank"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Manage
            </a>
          </div>
        </div>
        <h1 className="text-2xl font-bold">CoStar GraphQL API Reference</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {totalQueries} documented queries across {sortedCategories.length} categories
        </p>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Sidebar */}
        <div className="w-80 border-r flex flex-col bg-muted/30">
          {/* Search */}
          <div className="p-4 border-b bg-background">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search queries..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            {search && (
              <p className="text-xs text-muted-foreground mt-2">
                Found {filteredCount} of {totalQueries} queries
              </p>
            )}
          </div>

          {/* Category List */}
          <ScrollArea className="flex-1">
            <div className="p-2">
              {sortedCategories
                .filter(cat => filteredQueries[cat]?.length > 0)
                .map((category) => {
                  const config = CATEGORY_CONFIG[category];
                  const Icon = config?.icon || MoreHorizontal;
                  const queries = filteredQueries[category] || [];
                  const isExpanded = expandedCategories.has(category) || !!search;

                  return (
                    <div key={category} className="mb-1">
                      <button
                        onClick={() => toggleCategory(category)}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm font-medium rounded-md hover:bg-muted transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="flex-1 text-left">{category}</span>
                        <Badge variant="secondary" className="text-xs">
                          {queries.length}
                        </Badge>
                      </button>

                      {isExpanded && (
                        <div className="ml-6 mt-1 space-y-0.5 mb-2">
                          {queries.map(name => (
                            <button
                              key={name}
                              onClick={() => setSelectedQuery(name)}
                              className={`flex items-center gap-2 w-full text-left px-3 py-1.5 text-sm rounded-md transition-colors ${
                                selectedQuery === name
                                  ? "bg-primary text-primary-foreground"
                                  : "hover:bg-muted text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              <span className="truncate">{name}</span>
                              {docs[name]?.response_template && (
                                <Check className="h-3 w-3 shrink-0 opacity-50" />
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </ScrollArea>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-auto p-6 bg-background">
          {selectedQuery && docs[selectedQuery] ? (
            <QueryDetail name={selectedQuery} data={docs[selectedQuery]} />
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-lg">
                <Code className="h-16 w-16 mx-auto mb-6 text-muted-foreground/50" />
                <h2 className="text-2xl font-semibold mb-2">CoStar GraphQL API</h2>
                <p className="text-muted-foreground mb-8">
                  Select a query from the sidebar to view its details, variables,
                  and example responses.
                </p>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-6 mb-8">
                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="text-3xl font-bold">{totalQueries}</div>
                    <div className="text-sm text-muted-foreground">Total Queries</div>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="text-3xl font-bold">{sortedCategories.length}</div>
                    <div className="text-sm text-muted-foreground">Categories</div>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="text-3xl font-bold">
                      {queryNames.filter(n => docs[n].response_template).length}
                    </div>
                    <div className="text-sm text-muted-foreground">With Examples</div>
                  </div>
                </div>

                {/* Category overview */}
                <div className="grid grid-cols-2 gap-3 text-left">
                  {sortedCategories.slice(0, 6).map(cat => {
                    const config = CATEGORY_CONFIG[cat];
                    const Icon = config?.icon || MoreHorizontal;
                    return (
                      <button
                        key={cat}
                        onClick={() => {
                          setExpandedCategories(new Set([cat]));
                        }}
                        className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                      >
                        <Icon className="h-5 w-5 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{cat}</div>
                          <div className="text-xs text-muted-foreground">
                            {categorizedQueries[cat]?.length || 0} queries
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
