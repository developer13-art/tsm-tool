import { ProtectedRoute } from "@/lib/auth";
import { Layout } from "@/components/layout";
import { 
  useListJobs, 
  useCreateJob, 
  useRunJob,
  useListDevices, 
  useListMdmPackages,
  getListJobsQueryKey 
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Link, useLocation } from "wouter";
import { Terminal, Plus, PlayCircle, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";

export default function Jobs() {
  const { data: jobs, isLoading } = useListJobs();

  return (
    <ProtectedRoute>
      <Layout>
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Job Queue</h1>
              <p className="text-muted-foreground font-mono text-sm">MDM PACKAGE REMOVAL TASKS</p>
            </div>
            <CreateJobDialog />
          </div>

          <Card className="bg-card border-border">
            {isLoading ? (
              <div className="p-8 space-y-4">
                {[1, 2, 3, 4].map(i => <div key={i} className="h-12 bg-muted animate-pulse rounded-md" />)}
              </div>
            ) : !jobs || jobs.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground flex flex-col items-center">
                <Terminal className="w-12 h-12 mb-4 opacity-20" />
                <p className="font-mono">NO ACTIVE JOBS</p>
                <p className="text-sm mt-1">Create a new job to begin operations.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="font-mono text-xs uppercase text-muted-foreground w-16">ID</TableHead>
                    <TableHead className="font-mono text-xs uppercase text-muted-foreground">Device</TableHead>
                    <TableHead className="font-mono text-xs uppercase text-muted-foreground">Package</TableHead>
                    <TableHead className="font-mono text-xs uppercase text-muted-foreground">Status</TableHead>
                    <TableHead className="font-mono text-xs uppercase text-muted-foreground w-32">Progress</TableHead>
                    <TableHead className="font-mono text-xs uppercase text-muted-foreground text-right">Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map(job => (
                    <TableRow key={job.id} className="border-border hover:bg-secondary/50 group cursor-pointer">
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        <Link href={`/jobs/${job.id}`}>
                          #{job.id.toString().padStart(4, '0')}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link href={`/jobs/${job.id}`} className="block">
                          <div className="font-mono text-sm text-foreground">{job.deviceName || `Device ${job.deviceId}`}</div>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link href={`/jobs/${job.id}`} className="block">
                          <div className="font-mono text-sm text-primary">{job.packageName || `PKG-${job.packageId}`}</div>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link href={`/jobs/${job.id}`} className="block">
                          <JobStatusBadge status={job.status} />
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link href={`/jobs/${job.id}`} className="block w-full">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                              <div 
                                className={`h-full ${job.status === 'failed' ? 'bg-destructive' : job.status === 'completed' ? 'bg-green-500' : 'bg-primary'}`} 
                                style={{ width: `${job.progress || 0}%` }} 
                              />
                            </div>
                            <span className="font-mono text-xs text-muted-foreground">{job.progress || 0}%</span>
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-muted-foreground">
                        <Link href={`/jobs/${job.id}`} className="block">
                          {format(new Date(job.createdAt), "MM-dd HH:mm")}
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}

export function JobStatusBadge({ status }: { status: string }) {
  let colorClass = "border-gray-500 text-gray-400 bg-gray-500/10";
  if (status === "completed") colorClass = "border-green-500 text-green-400 bg-green-500/10";
  if (status === "running") colorClass = "border-primary text-primary bg-primary/10 animate-pulse";
  if (status === "failed") colorClass = "border-red-500 text-red-400 bg-red-500/10";
  if (status === "pending") colorClass = "border-yellow-500 text-yellow-400 bg-yellow-500/10";

  return (
    <Badge variant="outline" className={`font-mono text-xs rounded-sm ${colorClass}`}>
      {status.toUpperCase()}
    </Badge>
  );
}

const jobSchema = z.object({
  deviceId: z.string().min(1, "Device required"),
  packageId: z.string().min(1, "Package required"),
});

function CreateJobDialog() {
  const [open, setOpen] = useState(false);
  const [_, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data: devices } = useListDevices();
  const { data: packages } = useListMdmPackages();
  
  const createMutation = useCreateJob();
  const runMutation = useRunJob();

  const form = useForm<z.infer<typeof jobSchema>>({
    resolver: zodResolver(jobSchema),
    defaultValues: { deviceId: "", packageId: "" }
  });

  const onSubmit = (values: z.infer<typeof jobSchema>) => {
    createMutation.mutate(
      { data: { deviceId: parseInt(values.deviceId), packageId: parseInt(values.packageId) } },
      {
        onSuccess: (job) => {
          runMutation.mutate({ id: job.id }, {
            onSuccess: () => {
              queryClient.invalidateQueries({ queryKey: getListJobsQueryKey() });
              toast({ title: "Job Dispatched", description: `Task #${job.id} initialized.` });
              setOpen(false);
              setLocation(`/jobs/${job.id}`);
            }
          });
        }
      }
    );
  };

  const onlineDevices = devices?.filter(d => d.status === "online") || [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="font-mono text-xs bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-2" /> DISPATCH JOB
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-mono text-lg flex items-center gap-2">
            <PlayCircle className="w-5 h-5 text-primary" /> NEW OPERATION
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <FormField control={form.control} name="deviceId" render={({ field }) => (
              <FormItem>
                <FormLabel className="font-mono text-xs text-muted-foreground">TARGET DEVICE</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger className="font-mono text-sm border-border bg-secondary">
                      <SelectValue placeholder="Select online device..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="bg-card border-border">
                    {onlineDevices.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground font-mono text-center">NO ONLINE DEVICES</div>
                    ) : (
                      onlineDevices.map(d => (
                        <SelectItem key={d.id} value={d.id.toString()} className="font-mono">
                          {d.serialNumber} [{d.model}]
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </FormItem>
            )} />
            
            <FormField control={form.control} name="packageId" render={({ field }) => (
              <FormItem>
                <FormLabel className="font-mono text-xs text-muted-foreground">MDM PACKAGE</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger className="font-mono text-sm border-border bg-secondary">
                      <SelectValue placeholder="Select package to remove..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="bg-card border-border">
                    {packages?.map(p => (
                      <SelectItem key={p.id} value={p.id.toString()} className="font-mono">
                        {p.packageName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )} />

            <DialogFooter className="pt-6">
              <Button 
                type="submit" 
                disabled={createMutation.isPending || runMutation.isPending || onlineDevices.length === 0} 
                className="font-mono w-full font-bold tracking-wider"
              >
                {(createMutation.isPending || runMutation.isPending) ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> EXECUTING...</>
                ) : "EXECUTE OPERATION"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}