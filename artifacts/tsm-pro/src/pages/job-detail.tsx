import { ProtectedRoute } from "@/lib/auth";
import { Layout } from "@/components/layout";
import { useGetJob, useGetJobLogs, getGetJobQueryKey, getGetJobLogsQueryKey } from "@workspace/api-client-react";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Terminal, Clock, Smartphone, Package, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { JobStatusBadge } from "./jobs";
import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function JobDetail() {
  const params = useParams();
  const id = parseInt(params.id || "0");

  const { data: job, isLoading: jobLoading } = useGetJob(id, {
    query: {
      enabled: !!id,
      queryKey: getGetJobQueryKey(id),
      refetchInterval: (query) => {
        return query.state.data?.status === "running" ? 3000 : false;
      }
    }
  });

  const { data: logs, isLoading: logsLoading } = useGetJobLogs(id, {
    query: {
      enabled: !!id,
      queryKey: getGetJobLogsQueryKey(id),
      refetchInterval: job?.status === "running" ? 3000 : false
    }
  });

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  if (jobLoading) {
    return (
      <ProtectedRoute>
        <Layout>
          <div className="flex items-center justify-center h-full min-h-[50vh]">
            <div className="animate-pulse flex flex-col items-center gap-4 text-primary font-mono">
              <Loader2 className="w-8 h-8 animate-spin" />
              <span>RETRIEVING OPERATION DATA...</span>
            </div>
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  if (!job) {
    return (
      <ProtectedRoute>
        <Layout>
          <div className="p-12 text-center text-muted-foreground font-mono">JOB NOT FOUND</div>
        </Layout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <Layout>
        <div className="space-y-6 h-full flex flex-col max-h-screen">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
            <div>
              <h1 className="text-3xl font-bold tracking-tight font-mono flex items-center gap-3">
                OP-{id.toString().padStart(4, '0')}
                <JobStatusBadge status={job.status} />
              </h1>
              <p className="text-muted-foreground font-mono text-sm mt-1">
                EXECUTION TELEMETRY
              </p>
            </div>
            {job.status === "running" && (
              <div className="flex items-center gap-2 text-primary font-mono text-xs bg-primary/10 px-3 py-1.5 rounded-full border border-primary/20">
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                OPERATION IN PROGRESS
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 shrink-0">
            <Card className="bg-card border-border">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded bg-secondary flex items-center justify-center border border-border">
                  <Smartphone className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-mono">TARGET DEVICE</p>
                  <p className="font-mono font-medium">{job.deviceName || `Device ${job.deviceId}`}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded bg-secondary flex items-center justify-center border border-border">
                  <Package className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-mono">PAYLOAD</p>
                  <p className="font-mono font-medium">{job.packageName || `PKG-${job.packageId}`}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded bg-secondary flex items-center justify-center border border-border">
                  <Clock className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-mono">INITIATED</p>
                  <p className="font-mono font-medium">
                    {job.startedAt ? format(new Date(job.startedAt), "HH:mm:ss") : "N/A"}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded bg-secondary flex items-center justify-center border border-border">
                  {job.status === "failed" ? (
                    <AlertTriangle className="w-5 h-5 text-destructive" />
                  ) : job.status === "completed" ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  ) : (
                    <Terminal className="w-5 h-5 text-primary" />
                  )}
                </div>
                <div className="w-full">
                  <p className="text-xs text-muted-foreground font-mono flex justify-between">
                    <span>PROGRESS</span>
                    <span>{job.progress || 0}%</span>
                  </p>
                  <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden mt-1">
                    <div 
                      className={`h-full ${job.status === 'failed' ? 'bg-destructive' : job.status === 'completed' ? 'bg-green-500' : 'bg-primary'}`} 
                      style={{ width: `${job.progress || 0}%` }} 
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-[#0c0d12] border-border flex-1 flex flex-col min-h-[400px]">
            <CardHeader className="py-3 px-4 border-b border-border shrink-0 bg-card">
              <CardTitle className="font-mono text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Terminal className="h-4 w-4" />
                EXECUTION LOGS
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 relative overflow-hidden">
              <div 
                ref={scrollRef}
                className="absolute inset-0 overflow-y-auto p-4 font-mono text-sm leading-relaxed"
              >
                {logsLoading && !logs ? (
                  <div className="text-muted-foreground animate-pulse">ESTABLISHING STREAM...</div>
                ) : !logs || logs.length === 0 ? (
                  <div className="text-muted-foreground">WAITING FOR TELEMETRY...</div>
                ) : (
                  <div className="space-y-1">
                    {logs.map((log) => (
                      <div key={log.id} className="flex gap-4 group hover:bg-white/5 px-2 py-0.5 rounded -mx-2 transition-colors">
                        <span className="text-muted-foreground/50 shrink-0 select-none">
                          {format(new Date(log.createdAt), "HH:mm:ss.SSS")}
                        </span>
                        <LogLevelBadge level={log.level} />
                        <span className="text-gray-300 break-all">{log.message}</span>
                      </div>
                    ))}
                    {job.status === "running" && (
                      <div className="flex gap-4 px-2 py-0.5 mt-2">
                        <span className="text-primary animate-pulse">_</span>
                      </div>
                    )}
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

function LogLevelBadge({ level }: { level: string }) {
  let color = "text-gray-400";
  if (level === "info") color = "text-blue-400";
  if (level === "success") color = "text-green-400";
  if (level === "warning") color = "text-yellow-400";
  if (level === "error") color = "text-red-400";
  if (level === "debug") color = "text-gray-500";

  return (
    <span className={`w-20 shrink-0 uppercase ${color}`}>
      [{level}]
    </span>
  );
}