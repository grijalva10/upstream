import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Package } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface DealReady {
  id: string;
  propertyType: string;
  address: string;
  companyName: string;
  price: string;
  capRate: string;
  noi: string;
  motivation: string;
  timeline: string;
  matchingClients: string[];
}

interface DealsReadyCardProps {
  deals: DealReady[];
  onPackage?: (dealId: string) => void;
}

export function DealsReadyCard({ deals, onPackage }: DealsReadyCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Deals Ready to Package</CardTitle>
          <span className="text-2xl font-bold text-green-500">{deals.length}</span>
        </div>
      </CardHeader>
      <CardContent>
        {deals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
            <Package className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">No deals ready for packaging</p>
          </div>
        ) : (
          <ScrollArea className="h-[240px]">
            <div className="space-y-3">
              {deals.map((deal) => (
                <div
                  key={deal.id}
                  className="p-3 rounded-md border bg-card hover:bg-accent/30 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <Checkbox id={deal.id} className="mt-1" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">
                          {deal.propertyType}
                        </Badge>
                        <span className="font-medium text-sm truncate">
                          {deal.address}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mb-2">
                        {deal.companyName} | {deal.price} | {deal.capRate} cap | NOI {deal.noi}
                      </div>
                      <div className="text-xs mb-2">
                        <span className="text-muted-foreground">Motivation:</span>{" "}
                        {deal.motivation} |{" "}
                        <span className="text-muted-foreground">Timeline:</span>{" "}
                        {deal.timeline}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Matches:</span>
                        {deal.matchingClients.map((client) => (
                          <Badge key={client} variant="secondary" className="text-xs">
                            {client}
                          </Badge>
                        ))}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2 w-full"
                        onClick={() => onPackage?.(deal.id)}
                      >
                        Package & Notify
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
