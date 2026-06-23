import { ProtectedRoute } from "@/lib/auth";
import { Layout } from "@/components/layout";
import { useGetActivityFeed } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Terminal, Activity, AlertTriangle, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";

export default function Console() {
  const { data: activities, isLoading } = useGetActivityFeed({
    query: {
      refetchInterval: 5000 // Poll every 5s
    }
  });

  return (
    <ProtectedRoute>
      <Layout>
        <div className="space-y-6 h-full flex flex-col max-h-screen">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
            <div>
              <h1 className="text-3xl font-bold tracking-tight font-mono flex items-center gap-3">
                <Terminal className="w-8 h-8 text-primary" />
                GLOBAL CONSOLE
              </h1>
              <p className="text-muted-foreground font-mono text-sm mt-1">
                SYSTEM-WIDE EVENT STREAM
              </p>
            </div>
            <div className="flex items-center gap-2 text-primary font-mono text-xs bg-primary/10 px-3 py-1.5 rounded-full border border-primary/20">
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
              LIVE STREAM ACTIVE
            </div>
          </div>

          <Card className="bg-[#0c0d12] border-border flex-1 flex flex-col min-h-[600px]">
            <CardHeader className="py-3 px-4 border-b border-border shrink-0 bg-card">
              <CardTitle className="font-mono text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Activity className="h-4 w-4" />
                ACTIVITY FIREHOSE
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 relative overflow-hidden">
              <div className="absolute inset-0 overflow-y-auto p-4 font-mono text-sm leading-relaxed">
                {isLoading ? (
                  <div className="text-muted-foreground animate-pulse">ESTABLISHING STREAM...</div>
                ) : !activities || activities.length === 0 ? (
                  <div className="text-muted-foreground">WAITING FOR EVENTS...</div>
                ) : (
                  <div className="space-y-1">
                    {activities.map((activity) => {
                      let color = "text-primary";
                      let icon = "[INFO]";
                      
                      if (activity.type.includes("failed") || activity.type.includes("error")) {
                        color = "text-destructive";
                        icon = "[ERR ]";
                      } else if (activity.type.includes("completed") || activity.type.includes("success")) {
                        color = "text-green-500";
                        icon = "[ OK ]";
                      } else if (activity.type.includes("warning")) {
                        color = "text-yellow-500";
                        icon = "[WARN]";
                      }

                      return (
                        <div key={activity.id} className="flex gap-4 group hover:bg-white/5 px-2 py-1 rounded -mx-2 transition-colors border-b border-white/5 last:border-0">
                          <span className="text-muted-foreground/50 shrink-0 select-none w-24">
                            {format(new Date(activity.createdAt), "HH:mm:ss")}
                          </span>
                          <span className={`${color} shrink-0 select-none w-16`}>
                            {icon}
                          </span>
                          <span className="text-muted-foreground shrink-0 w-32 truncate">
                            {activity.type}
                          </span>
                          <span className="text-gray-300 break-all">{activity.message}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}