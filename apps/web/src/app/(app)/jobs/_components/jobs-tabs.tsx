"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { JobsDataTable, Job } from "./jobs-data-table";
import { SystemJobsTable } from "./system-jobs-table";
import { Mail, Cpu } from "lucide-react";

interface JobsTabsProps {
  emailJobs: Job[];
}

export function JobsTabs({ emailJobs }: JobsTabsProps) {
  return (
    <Tabs defaultValue="email">
      <TabsList>
        <TabsTrigger value="email" className="gap-2">
          <Mail className="h-4 w-4" />
          Email Queue
        </TabsTrigger>
        <TabsTrigger value="system" className="gap-2">
          <Cpu className="h-4 w-4" />
          System Jobs
        </TabsTrigger>
      </TabsList>

      <TabsContent value="email">
        <Card>
          <CardHeader>
            <CardTitle>Email Queue</CardTitle>
          </CardHeader>
          <CardContent>
            <JobsDataTable data={emailJobs} />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="system">
        <Card>
          <CardHeader>
            <CardTitle>System Jobs (pg-boss)</CardTitle>
          </CardHeader>
          <CardContent>
            <SystemJobsTable />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
