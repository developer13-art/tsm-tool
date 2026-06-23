import { Layout } from "@/components/layout";
import { ProtectedRoute } from "@/lib/auth";
import { useGetDashboardStats, useGetActivityFeed } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Smartphone, ServerCog, Users, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { format } from "date-fns";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: activities, isLoading: activitiesLoading } = useGetActivityFeed();

  return (
    <ProtectedRoute>
      <Layout>
        <div className="space-y-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold tracking-tight">System Overview</h1>
            <p className="text-muted-foreground font-mono text-sm">REAL-TIME TELEMETRY & OPERATIONS</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard 
              title="Total Devices" 
              value={stats?.totalDevices} 
              icon={<Smartphone className="h-4 w-4 text-primary" />} 
              description={`${stats?.onlineDevices || 0} online`} 
              loading={statsLoading} 
            />
            <StatCard 
              title="Active Jobs" 
              value={stats?.runningJobs || 0} 
              icon={<Activity className="h-4 w-4 text-primary" />} 
              description={`${stats?.pendingJobs || 0} queued`} 
              loading={statsLoading} 
            />
            <StatCard 
              title="Failed Jobs" 
              value={stats?.failedJobs} 
              icon={<AlertTriangle className="h-4 w-4 text-destructive" />} 
              description="Requires attention" 
              loading={statsLoading} 
            />
            <StatCard 
              title="Total Users" 
              value={stats?.totalUsers} 
              icon={<Users className="h-4 w-4 text-muted-foreground" />} 
              description="Registered operators" 
              loading={statsLoading} 
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="col-span-1 lg:col-span-2 bg-card border-border">
              <CardHeader>
                <CardTitle className="font-mono text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <ServerCog className="h-4 w-4" />
                  Job Status Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <div className="h-64 animate-pulse bg-muted rounded-md" />
                ) : (
                  <div className="space-y-6">
                    <StatusProgress label="Completed" value={stats?.completedJobs || 0} total={stats?.totalJobs || 1} color="bg-green-500" />
                    <StatusProgress label="Running" value={stats?.runningJobs || 0} total={stats?.totalJobs || 1} color="bg-primary" />
                    <StatusProgress label="Pending" value={stats?.pendingJobs || 0} total={stats?.totalJobs || 1} color="bg-yellow-500" />
                    <StatusProgress label="Failed" value={stats?.failedJobs || 0} total={stats?.totalJobs || 1} color="bg-destructive" />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="col-span-1 bg-card border-border flex flex-col">
              <CardHeader className="pb-3">
                <CardTitle className="font-mono text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-auto max-h-[400px] pr-2">
                {activitiesLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="h-12 animate-pulse bg-muted rounded-md" />
                    ))}
                  </div>
                ) : !activities || activities.length === 0 ? (
                  <div className="text-center text-muted-foreground text-sm py-8 font-mono">
                    NO RECENT ACTIVITY
                  </div>
                ) : (
                  <div className="space-y-4">
                    {activities.map((activity) => (
                      <div key={activity.id} className="flex gap-3 text-sm">
                        <div className="mt-0.5">
                          {activity.type.includes('failed') ? (
                            <AlertTriangle className="h-4 w-4 text-destructive" />
                          ) : activity.type.includes('completed') ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <Activity className="h-4 w-4 text-primary" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="text-foreground leading-snug">{activity.message}</p>
                          <p className="text-xs text-muted-foreground font-mono mt-1">
                            {format(new Date(activity.createdAt), "HH:mm:ss · yyyy-MM-dd")}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}

function StatCard({ title, value, icon, description, loading }: { title: string; value?: number; icon: React.ReactNode; description: string; loading: boolean }) {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="font-mono text-xs uppercase tracking-wider text-muted-foreground">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-8 w-16 animate-pulse bg-muted rounded-md mb-1" />
        ) : (
          <div className="text-3xl font-bold font-mono text-foreground">{value ?? 0}</div>
        )}
        <p className="text-xs text-muted-foreground font-mono mt-1">{description}</p>
      </CardContent>
    </Card>
  );
}

function StatusProgress({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const percentage = Math.round((value / Math.max(total, 1)) * 100);
  return (
    <div>
      <div className="flex justify-between text-sm mb-1 font-mono">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-foreground font-bold">{value} <span className="text-muted-foreground font-normal">({percentage}%)</span></span>
      </div>
      <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}